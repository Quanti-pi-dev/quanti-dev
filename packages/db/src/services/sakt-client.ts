// ─── ML Inference Client (SAKT + DKT) ────────────────────────
// TypeScript client for the FastAPI ML sidecar (port 10003).
//
// Provides knowledge state predictions powering buildStudyPlan.
// Model priority: DKT (LSTM hidden state) → SAKT (transformer) → BKT → 0.5
//
// DKT killer feature — getSAKTDifficultyMap now delegates to:
//   1. GET /dkt/state/{userId} — one call gives the FULL topic difficulty
//      map derived from the student's persisted LSTM hidden state.
//      O(1) Redis read per build cycle, covers ALL topics at once.
//   2. POST /predict/batch — SAKT fallback (N per-topic predictions)
//   3. Empty map — BKT heuristic handles difficulty in buildStudyPlan
//
// Redis caching (client-side layer on top of sidecar TTLs):
//   dkt_pall:{userId}               → full P-vector (TTL 1h, sidecar-managed)
//   dkt_predict:{userId}:{q_id}     → per-question cache (TTL 1h)
//   sakt_predict:{userId}:{q_id}    → per-question cache (TTL 1h)
//
// Graceful degradation:
//   • SAKT_URL unset     → all functions no-op (BKT baseline only)
//   • Sidecar down       → all functions return null/empty (non-fatal)
//   • DKT not loaded     → transparent fallback to SAKT in sidecar
//   • Neither model      → sidecar returns 0.5 prior

import { getRedisClient } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('MLClient');

const SAKT_URL   = process.env['SAKT_URL'];   // same URL, now serves DKT too
const TIMEOUT_MS = 3_000;

// ─── Types ────────────────────────────────────────────────────

export interface SAKTPrediction {
  questionId: string;
  pCorrect:   number;
  source:     string;  // 'dkt' | 'sakt' | 'cache_dkt' | 'cache_sakt' | 'fallback'
}

export interface SAKTTopicScore {
  topicSlug:   string;
  pCorrect:    number;
  pDifficult:  number;
}

export interface DKTStateResult {
  /** Map of topicSlug → pDifficult (0 = easy, 1 = very hard). */
  topicDifficulty: Map<string, number>;
  /** 'dkt' | 'sakt' — which model powered this result. */
  modelVersion: string;
  /** 'computed' | 'cached' — whether the DKT state was freshly computed. */
  source: string;
}

export interface MLHealthStatus {
  available:    boolean;
  saktLoaded:   boolean;
  dktLoaded:    boolean;
  activeModel:  string;
  saktVocabSize: number;
  dktVocabSize:  number;
}

// ─── Redis helpers ────────────────────────────────────────────

const cacheKey = (prefix: string, userId: string, qId: string) =>
  `${prefix}:${userId}:${qId}`;

// ─── HTTP fetch with timeout ──────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Predict P(correct) for a single (student, question) pair.
 * Uses best available model (DKT → SAKT → 0.5).
 */
export async function saktPredict(
  userId: string,
  questionId: string,
): Promise<SAKTPrediction | null> {
  if (!SAKT_URL) return null;

  // Client-side Redis cache check (covers both DKT and SAKT predictions)
  try {
    const redis = getRedisClient();
    const dktCached = await redis.get(cacheKey('dkt_predict', userId, questionId));
    if (dktCached !== null) {
      return { questionId, pCorrect: parseFloat(dktCached), source: 'cache_dkt' };
    }
    const saktCached = await redis.get(cacheKey('sakt_predict', userId, questionId));
    if (saktCached !== null) {
      return { questionId, pCorrect: parseFloat(saktCached), source: 'cache_sakt' };
    }
  } catch { /* non-fatal */ }

  try {
    const resp = await fetchWithTimeout(
      `${SAKT_URL}/predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questionId }),
      },
      TIMEOUT_MS,
    );
    if (!resp.ok) return null;
    return await resp.json() as SAKTPrediction;
  } catch (err) {
    log.warn({ err, userId, questionId }, 'ML predict failed — using BKT fallback');
    return null;
  }
}

/**
 * Batch-predict P(correct) for a list of topic slugs.
 * Uses DKT when available; falls back to SAKT batch endpoint.
 */
export async function saktBatchPredict(
  userId: string,
  questionIds: string[],
): Promise<SAKTTopicScore[]> {
  if (!SAKT_URL || questionIds.length === 0) return [];

  try {
    const redis   = getRedisClient();
    const pipeline = redis.pipeline();

    // Check DKT cache first, then SAKT cache
    for (const qid of questionIds) {
      pipeline.get(cacheKey('dkt_predict', userId, qid));
    }
    for (const qid of questionIds) {
      pipeline.get(cacheKey('sakt_predict', userId, qid));
    }
    const results = await pipeline.exec();

    const cached: SAKTTopicScore[] = [];
    const uncached: string[] = [];

    for (let i = 0; i < questionIds.length; i++) {
      const dktVal  = results?.[i]?.[1];
      const saktVal = results?.[questionIds.length + i]?.[1];
      const val = dktVal ?? saktVal;
      if (val !== null && val !== undefined) {
        const p = parseFloat(val as string);
        cached.push({ topicSlug: questionIds[i]!, pCorrect: p, pDifficult: 1 - p });
      } else {
        uncached.push(questionIds[i]!);
      }
    }

    if (uncached.length === 0) return cached;

    const resp = await fetchWithTimeout(
      `${SAKT_URL}/predict/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictions: uncached.map(qid => ({ userId, questionId: qid })),
        }),
      },
      TIMEOUT_MS,
    );
    if (!resp.ok) return cached;

    const data = await resp.json() as SAKTPrediction[];
    const fresh: SAKTTopicScore[] = data.map(d => ({
      topicSlug:  d.questionId,
      pCorrect:   d.pCorrect,
      pDifficult: Math.round((1 - d.pCorrect) * 1000) / 1000,
    }));

    return [...cached, ...fresh];
  } catch (err) {
    log.warn({ err, userId }, 'ML batch predict failed — using BKT fallback');
    return [];
  }
}

/**
 * Get the full DKT knowledge state for a student.
 *
 * DKT killer feature: one HTTP call gives difficulty scores for ALL topics
 * simultaneously, derived from the continuously updated LSTM hidden state.
 * No per-topic batch prediction needed.
 *
 * Falls back to null if DKT is not loaded in the sidecar.
 */
export async function getDKTState(userId: string): Promise<DKTStateResult | null> {
  if (!SAKT_URL) return null;

  try {
    const resp = await fetchWithTimeout(
      `${SAKT_URL}/dkt/state/${encodeURIComponent(userId)}`,
      { method: 'GET' },
      TIMEOUT_MS,
    );

    if (resp.status === 503) return null; // DKT not loaded — use SAKT fallback
    if (!resp.ok) return null;

    const data = await resp.json() as {
      topicDifficulty: Record<string, number>;
      modelVersion: string;
      source: string;
    };

    return {
      topicDifficulty: new Map(Object.entries(data.topicDifficulty)),
      modelVersion: data.modelVersion,
      source: data.source,
    };
  } catch (err) {
    log.warn({ err, userId }, 'DKT state fetch failed — falling back to SAKT');
    return null;
  }
}

/**
 * Record a student answer. Updates:
 *   1. DKT: runs one ONNX step to update the LSTM hidden state in Redis
 *   2. SAKT: appends to the interaction history list
 * Fire-and-forget — does not block the session pipeline.
 */
export async function saktRecord(
  userId: string,
  questionId: string,
  correct: boolean,
): Promise<void> {
  if (!SAKT_URL) return;

  fetchWithTimeout(
    `${SAKT_URL}/record`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, questionId, correct }),
    },
    TIMEOUT_MS,
  ).catch(err => log.warn({ err }, 'ML record failed (non-fatal)'));
}

/**
 * Health check for the ML sidecar.
 */
export async function saktHealth(): Promise<MLHealthStatus> {
  const off: MLHealthStatus = {
    available: false, saktLoaded: false, dktLoaded: false,
    activeModel: 'none', saktVocabSize: 0, dktVocabSize: 0,
  };
  if (!SAKT_URL) return off;

  try {
    const resp = await fetchWithTimeout(`${SAKT_URL}/health`, {}, 2_000);
    if (!resp.ok) return off;
    const data = await resp.json() as Omit<MLHealthStatus, 'available'>;
    return { available: true, ...data };
  } catch {
    return off;
  }
}

/**
 * Primary integration point for buildStudyPlan.
 *
 * Fetches a difficulty map for a list of topic slugs using the best
 * available model:
 *   1. DKT /dkt/state → covers ALL topics in ONE call (preferred)
 *   2. SAKT /predict/batch → N-topic batch fallback
 *   3. Empty map → BKT heuristic in buildStudyPlan handles it
 *
 * @returns Map<topicSlug, pDifficult>  (0 = easy, 1 = hard)
 */
export async function getSAKTDifficultyMap(
  userId: string,
  topicSlugs: string[],
): Promise<Map<string, number>> {
  // ── Attempt 1: DKT full knowledge state ────────────────────
  const dktState = await getDKTState(userId);
  if (dktState !== null && dktState.topicDifficulty.size > 0) {
    // Filter to only the topic slugs requested in this plan
    const filtered = new Map<string, number>();
    for (const slug of topicSlugs) {
      const diff = dktState.topicDifficulty.get(slug);
      if (diff !== undefined) filtered.set(slug, diff);
    }
    if (filtered.size > 0) {
      log.info(
        { userId, model: dktState.modelVersion, source: dktState.source, topics: filtered.size },
        'DKT knowledge state loaded for study plan',
      );
      return filtered;
    }
  }

  // ── Attempt 2: SAKT batch prediction ───────────────────────
  const scores = await saktBatchPredict(userId, topicSlugs);
  const map = new Map<string, number>();
  for (const s of scores) {
    map.set(s.topicSlug, s.pDifficult);
  }
  return map;
}
