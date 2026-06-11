"""
ML Inference Sidecar — FastAPI
================================

Unified inference server hosting both SAKT and DKT models.
Deployed on OCI Instance 2, VCN-private port 10003.

Model priority for /predict endpoints:
  1. DKT (gold standard) — if dkt.onnx is present and loaded
  2. SAKT (transformer)  — if sakt.onnx is present and loaded
  3. P=0.5 prior         — if neither model is available (cold start)

DKT-specific capabilities (not available in SAKT):
  • /dkt/state/{userId}  — returns the full P(correct) vector across ALL
    questions, derived from the student's persisted LSTM hidden state.
    This is the killer feature: a single Redis read gives the complete
    per-student knowledge state without any N-query batch prediction.
  • /record updates the DKT LSTM state incrementally (stateful inference):
    one ONNX forward pass per answer, O(1) regardless of history length.

Redis keys consumed:
  sakt_vocab / dkt_vocab          → question vocabulary JSON
  sakt_history:{userId}           → [{q_idx, correct}] for SAKT context
  dkt_state:{userId}              → {h: base64, c: base64} LSTM hidden state

Redis keys written:
  sakt_predict:{userId}:{q_id}    → float (SAKT cache, TTL 1h)
  dkt_predict:{userId}:{q_id}     → float (DKT per-question cache, TTL 1h)
  dkt_pall:{userId}               → base64 float32 full P-vector (TTL 1h)
  dkt_state:{userId}              → JSON LSTM state (TTL 30d)

Endpoints:
  GET  /health                    → model status + vocab size
  POST /predict                   → best-model single prediction
  POST /predict/batch             → best-model batch prediction
  POST /dkt/state/{userId}        → full topic difficulty vector (DKT only)
  POST /record                    → update interaction history + DKT state
  GET  /models                    → which models are loaded

Environment variables:
  REDIS_URL      (default: redis://localhost:6379)
  SAKT_PATH      (default: /app/model/sakt.onnx)
  DKT_PATH       (default: /app/model/dkt.onnx)
  MAX_SEQ        (default: 100)
  DKT_HIDDEN     (default: 200)
  DKT_LAYERS     (default: 2)
"""

from __future__ import annotations

import base64
import json
import logging
import os
import struct
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger('ml_server')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

# ─── Config ──────────────────────────────────────────────────
REDIS_URL  = os.getenv('REDIS_URL',  'redis://localhost:6379')
SAKT_PATH  = os.getenv('SAKT_PATH',  '/app/model/sakt.onnx')
DKT_PATH   = os.getenv('DKT_PATH',   '/app/model/dkt.onnx')
MAX_SEQ    = int(os.getenv('MAX_SEQ',    '100'))
DKT_HIDDEN = int(os.getenv('DKT_HIDDEN', '200'))
DKT_LAYERS = int(os.getenv('DKT_LAYERS', '2'))
TIMEOUT_MS = 3.0

SAKT_PRED_TTL  = 3_600        # 1h: SAKT per-question cache
DKT_PRED_TTL   = 3_600        # 1h: DKT per-question cache
DKT_PALL_TTL   = 3_600        # 1h: DKT full-P-vector cache
DKT_STATE_TTL  = 30 * 24 * 3600  # 30d: LSTM hidden state
HIST_TTL       = 7 * 24 * 3600   # 7d: SAKT interaction history
HIST_LIMIT     = 100

# ─── Global state ────────────────────────────────────────────
_s: dict[str, Any] = {}


# ─── ONNX session loader ──────────────────────────────────────

def _load_onnx(path: str, label: str):
    if not os.path.exists(path):
        log.warning('%s model not found at %s — will use fallback', label, path)
        return None
    try:
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads    = 2
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess = ort.InferenceSession(path, sess_options=opts, providers=['CPUExecutionProvider'])
        log.info('%s model loaded from %s', label, path)
        return sess
    except Exception as e:
        log.error('Failed to load %s model: %s', label, e)
        return None


# ─── Lifespan ────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI):
    _s['sakt']       = _load_onnx(SAKT_PATH, 'SAKT')
    _s['dkt']        = _load_onnx(DKT_PATH,  'DKT')
    _s['redis']      = aioredis.from_url(REDIS_URL, decode_responses=True)
    _s['sakt_vocab'] = None
    _s['dkt_vocab']  = None
    log.info('ML sidecar ready | SAKT=%s | DKT=%s',
             'loaded' if _s['sakt'] else 'missing',
             'loaded' if _s['dkt']  else 'missing')
    yield
    await _s['redis'].aclose()


app = FastAPI(
    title='Quanti-Pi ML Inference Server',
    description='SAKT + DKT unified knowledge tracing sidecar',
    version='2.0.0',
    lifespan=lifespan,
)


# ─── Schemas ─────────────────────────────────────────────────

class PredictRequest(BaseModel):
    userId:     str
    questionId: str

class PredictResponse(BaseModel):
    userId:     str
    questionId: str
    pCorrect:   float
    source:     str   # 'dkt' | 'sakt' | 'cache' | 'fallback'
    latencyMs:  float

class BatchPredictRequest(BaseModel):
    predictions: list[PredictRequest] = Field(..., max_items=200)

class RecordRequest(BaseModel):
    userId:     str
    questionId: str
    correct:    bool

class DKTStateResponse(BaseModel):
    userId:         str
    topicDifficulty: dict[str, float]  # topicSlug → pDifficult
    modelVersion:   str
    latencyMs:      float
    source:         str   # 'computed' | 'cached'

class HealthResponse(BaseModel):
    status:       str
    saktLoaded:   bool
    dktLoaded:    bool
    saktVocabSize: int
    dktVocabSize:  int
    activeModel:  str   # 'dkt' | 'sakt' | 'none'


# ─── Vocab helpers ────────────────────────────────────────────

async def _get_vocab(key: str, cache_field: str) -> dict[str, int]:
    if _s.get(cache_field):
        return _s[cache_field]
    r: aioredis.Redis = _s['redis']
    raw = await r.get(key)
    if not raw:
        return {}
    data = json.loads(raw)
    vocab = data.get('vocab', {})
    _s[cache_field] = vocab
    return vocab

async def get_sakt_vocab() -> dict[str, int]:
    return await _get_vocab('sakt_vocab', 'sakt_vocab')

async def get_dkt_vocab() -> dict[str, int]:
    return await _get_vocab('dkt_vocab', 'dkt_vocab')


# ─── SAKT history ────────────────────────────────────────────

async def get_sakt_history(user_id: str) -> list[tuple[int, int]]:
    r: aioredis.Redis = _s['redis']
    raw = await r.get(f'sakt_history:{user_id}')
    if not raw:
        return []
    return [(int(i['q_idx']), int(i['correct'])) for i in json.loads(raw)[-HIST_LIMIT:]]

async def append_sakt_history(user_id: str, q_idx: int, correct: bool):
    r: aioredis.Redis = _s['redis']
    raw  = await r.get(f'sakt_history:{user_id}')
    hist = json.loads(raw) if raw else []
    hist.append({'q_idx': q_idx, 'correct': int(correct)})
    await r.set(f'sakt_history:{user_id}', json.dumps(hist[-HIST_LIMIT:]), ex=HIST_TTL)


# ─── DKT hidden state helpers ────────────────────────────────

def _encode(arr: np.ndarray) -> str:
    return base64.b64encode(struct.pack(f'{arr.size}f', *arr.flatten().tolist())).decode()

def _decode(b64: str, shape: tuple) -> np.ndarray:
    flat = struct.unpack(f'{len(base64.b64decode(b64)) // 4}f', base64.b64decode(b64))
    return np.array(flat, dtype=np.float32).reshape(shape)

async def load_dkt_state(user_id: str) -> tuple[np.ndarray, np.ndarray]:
    """Load LSTM h,c from Redis or return zero state."""
    r: aioredis.Redis = _s['redis']
    raw = await r.get(f'dkt_state:{user_id}')
    if raw:
        data = json.loads(raw)
        h = _decode(data['h'], (DKT_LAYERS, 1, DKT_HIDDEN))
        c = _decode(data['c'], (DKT_LAYERS, 1, DKT_HIDDEN))
        return h, c
    # Zero state = student has no known history
    h = np.zeros((DKT_LAYERS, 1, DKT_HIDDEN), dtype=np.float32)
    c = np.zeros((DKT_LAYERS, 1, DKT_HIDDEN), dtype=np.float32)
    return h, c

async def save_dkt_state(user_id: str, h: np.ndarray, c: np.ndarray):
    r: aioredis.Redis = _s['redis']
    payload = json.dumps({'h': _encode(h), 'c': _encode(c)})
    await r.set(f'dkt_state:{user_id}', payload, ex=DKT_STATE_TTL)


# ─── DKT inference helpers ────────────────────────────────────

def _dkt_run_single_step(
    x_idx: int,
    h: np.ndarray,
    c: np.ndarray,
    n_questions: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Run one DKT inference step.

    Args:
        x_idx:       interaction index (q_idx + r * n_q)
        h, c:        current LSTM hidden / cell state
        n_questions: vocab size

    Returns:
        p_all: (n_questions,) float32 — full probability vector
        h_n:   updated hidden state
        c_n:   updated cell state
    """
    sess = _s['dkt']
    x    = np.array([[x_idx]], dtype=np.int64)  # (1, 1)
    out  = sess.run(['p_all', 'h_n', 'c_n'], {'x': x, 'h_0': h, 'c_0': c})
    p_all = out[0][0, 0, :]   # (n_questions,)
    h_n   = out[1]
    c_n   = out[2]
    return p_all, h_n, c_n

def _sakt_run(q_ids: list[int], r_ids: list[int]) -> float:
    """Run SAKT inference for a single student's context."""
    sess = _s['sakt']
    if sess is None:
        return 0.5
    q_arr = np.array([q_ids[-MAX_SEQ:]], dtype=np.int64)
    r_arr = np.array([r_ids[-MAX_SEQ:]], dtype=np.int64)
    pad   = MAX_SEQ - q_arr.shape[1]
    if pad > 0:
        q_arr = np.pad(q_arr, ((0, 0), (pad, 0)), constant_values=0)
        r_arr = np.pad(r_arr, ((0, 0), (pad, 0)), constant_values=0)
    out = sess.run(['p_correct'], {'q_ids': q_arr, 'r_ids': r_arr})
    return float(np.clip(out[0][0], 0.0, 1.0))


# ─── Best-model prediction logic ─────────────────────────────

async def _predict_one(user_id: str, question_id: str) -> tuple[float, str]:
    """
    Predict P(correct) for one question using best available model.
    Returns (pCorrect, source_label).
    """
    r: aioredis.Redis = _s['redis']

    # DKT path
    if _s['dkt'] is not None:
        # Check DKT per-question cache
        cached = await r.get(f'dkt_predict:{user_id}:{question_id}')
        if cached:
            return float(cached), 'cache_dkt'

        vocab  = await get_dkt_vocab()
        q_idx  = vocab.get(question_id, 0)
        if q_idx > 0:
            h, c   = await load_dkt_state(user_id)
            # At prediction time, we pass x=q_idx + 0*n_q (unresponded question)
            n_q    = len(vocab)
            p_all, _, _ = _dkt_run_single_step(q_idx, h, c, n_q)
            p = float(np.clip(p_all[q_idx - 1], 0.0, 1.0))
            await r.set(f'dkt_predict:{user_id}:{question_id}', str(round(p, 6)), ex=DKT_PRED_TTL)
            return p, 'dkt'

    # SAKT path
    if _s['sakt'] is not None:
        cached = await r.get(f'sakt_predict:{user_id}:{question_id}')
        if cached:
            return float(cached), 'cache_sakt'

        vocab  = await get_sakt_vocab()
        q_idx  = vocab.get(question_id, 0)
        if q_idx > 0:
            hist  = await get_sakt_history(user_id)
            q_ids = [h[0] for h in hist] + [q_idx]
            r_ids = [h[1] for h in hist] + [0]
            p = _sakt_run(q_ids, r_ids)
            await r.set(f'sakt_predict:{user_id}:{question_id}', str(round(p, 6)), ex=SAKT_PRED_TTL)
            return p, 'sakt'

    return 0.5, 'fallback'


# ─── Endpoints ───────────────────────────────────────────────

@app.get('/health', response_model=HealthResponse)
async def health():
    sv = await get_sakt_vocab()
    dv = await get_dkt_vocab()
    active = 'dkt' if _s['dkt'] else ('sakt' if _s['sakt'] else 'none')
    return HealthResponse(
        status='ok',
        saktLoaded=_s['sakt'] is not None,
        dktLoaded=_s['dkt'] is not None,
        saktVocabSize=len(sv),
        dktVocabSize=len(dv),
        activeModel=active,
    )


@app.get('/models')
async def models():
    return {
        'sakt': {'loaded': _s['sakt'] is not None, 'path': SAKT_PATH},
        'dkt':  {'loaded': _s['dkt']  is not None, 'path': DKT_PATH},
        'activeModel': 'dkt' if _s['dkt'] else ('sakt' if _s['sakt'] else 'none'),
    }


@app.post('/predict', response_model=PredictResponse)
async def predict(req: PredictRequest):
    t0 = time.perf_counter()
    p, source = await _predict_one(req.userId, req.questionId)
    return PredictResponse(
        userId=req.userId, questionId=req.questionId,
        pCorrect=round(p, 6), source=source,
        latencyMs=round((time.perf_counter() - t0) * 1000, 2),
    )


@app.post('/predict/batch', response_model=list[PredictResponse])
async def predict_batch(req: BatchPredictRequest):
    results = []
    for item in req.predictions:
        t0 = time.perf_counter()
        p, source = await _predict_one(item.userId, item.questionId)
        results.append(PredictResponse(
            userId=item.userId, questionId=item.questionId,
            pCorrect=round(p, 6), source=source,
            latencyMs=round((time.perf_counter() - t0) * 1000, 2),
        ))
    return results


@app.get('/dkt/state/{user_id}', response_model=DKTStateResponse)
async def dkt_state(user_id: str):
    """
    DKT killer feature: return the full P(correct) vector across ALL questions
    using the student's persisted LSTM hidden state.

    This gives the complete knowledge profile for a student in one API call —
    buildStudyPlan uses this to map every topic slug to a difficulty score
    without making N separate predictions.

    Topic slugs are the question IDs in the DKT vocabulary.
    Returns pDifficult = 1 - pCorrect so higher values = topics to schedule first.
    """
    t0 = time.perf_counter()
    r: aioredis.Redis = _s['redis']

    # Check the full-P-vector cache (TTL 1h)
    cached_pall = await r.get(f'dkt_pall:{user_id}')
    if cached_pall and _s['dkt']:
        vocab    = await get_dkt_vocab()
        flat     = list(struct.unpack(f'{len(base64.b64decode(cached_pall)) // 4}f',
                                       base64.b64decode(cached_pall)))
        idx_to_q = {v: k for k, v in vocab.items()}
        topic_diff = {
            idx_to_q[i + 1]: round(1.0 - float(np.clip(flat[i], 0, 1)), 4)
            for i in range(len(flat)) if (i + 1) in idx_to_q
        }
        return DKTStateResponse(
            userId=user_id, topicDifficulty=topic_diff,
            modelVersion='dkt', source='cached',
            latencyMs=round((time.perf_counter() - t0) * 1000, 2),
        )

    if _s['dkt'] is None:
        raise HTTPException(status_code=503, detail='DKT model not loaded')

    vocab  = await get_dkt_vocab()
    if not vocab:
        raise HTTPException(status_code=503, detail='DKT vocabulary not loaded')

    n_q = len(vocab)
    h, c = await load_dkt_state(user_id)

    # Run the output layer on the current hidden state to get full P vector.
    # We use a "neutral" query (question_id=0, no interaction) to read the state.
    # The output layer is linear so p_all reflects h_t directly.
    # Trick: run with x=0 (padding) to get the current knowledge state without
    # updating it (the LSTM output for padding doesn't affect h meaningfully).
    x_probe = np.array([[0]], dtype=np.int64)
    out = _s['dkt'].run(['p_all', 'h_n', 'c_n'], {'x': x_probe, 'h_0': h, 'c_0': c})
    p_all = out[0][0, 0, :]   # (n_questions,)

    # Cache the full P vector as base64
    pall_b64 = _encode(p_all)
    await r.set(f'dkt_pall:{user_id}', pall_b64, ex=DKT_PALL_TTL)

    idx_to_q = {v: k for k, v in vocab.items()}
    topic_diff = {
        idx_to_q[i + 1]: round(float(np.clip(1.0 - p_all[i], 0, 1)), 4)
        for i in range(len(p_all)) if (i + 1) in idx_to_q
    }

    return DKTStateResponse(
        userId=user_id, topicDifficulty=topic_diff,
        modelVersion='dkt', source='computed',
        latencyMs=round((time.perf_counter() - t0) * 1000, 2),
    )


@app.post('/record', status_code=204)
async def record_interaction(req: RecordRequest):
    """
    Record a student answer.

    For DKT: runs one ONNX forward step to update the student's LSTM
    hidden state (h_t, c_t) and saves it to Redis. Invalidates the
    cached full-P-vector so the next /dkt/state call reflects the new answer.

    For SAKT: appends to the interaction history list.

    Both updates happen concurrently.
    """
    r: aioredis.Redis = _s['redis']

    # ── DKT state update ──────────────────────────────────────
    if _s['dkt']:
        vocab  = await get_dkt_vocab()
        q_idx  = vocab.get(req.questionId, 0)
        if q_idx > 0:
            h, c   = await load_dkt_state(req.userId)
            n_q    = len(vocab)
            x_idx  = q_idx + int(req.correct) * n_q   # interaction embedding index
            _, h_n, c_n = _dkt_run_single_step(x_idx, h, c, n_q)
            await save_dkt_state(req.userId, h_n, c_n)
            # Invalidate caches
            await r.delete(
                f'dkt_pall:{req.userId}',
                f'dkt_predict:{req.userId}:{req.questionId}',
            )

    # ── SAKT history update ───────────────────────────────────
    if _s['sakt']:
        vocab  = await get_sakt_vocab()
        q_idx  = vocab.get(req.questionId, 0)
        if q_idx > 0:
            await append_sakt_history(req.userId, q_idx, req.correct)
            await r.delete(f'sakt_predict:{req.userId}:{req.questionId}')


def _encode(arr: np.ndarray) -> str:
    return base64.b64encode(struct.pack(f'{arr.size}f', *arr.flatten().tolist())).decode()
