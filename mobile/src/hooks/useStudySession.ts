// ─── useStudySession ─────────────────────────────────────────
// Centralized study session management with incremental persistence.
// Progress is synced on every answer via a debounced batch flush,
// eliminating reliance on useEffect cleanup which is unreliable
// on app kill / force quit.
//
// Usage:
//   const session = useStudySession({ deckId, startedAt });
//   session.recordAnswer(correct, cardId);
//   // On completion screen: session.correctCount, session.answeredCount, etc.

import { useRef, useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { enqueue } from '../services/offlineQueue';
import { progressKeys } from './useProgress';
import { gamificationKeys } from './useGamification';

// ─── Types ──────────────────────────────────────────────────

interface UseStudySessionConfig {
  /** The deckId for this session. null = not ready yet. */
  deckId: string | null;
  /** ISO timestamp when the session started */
  startedAt: string;
}

interface AnswerRecord {
  cardId: string;
  correct: boolean;
  responseTimeMs: number;
}

interface SessionSnapshot {
  deckId: string;
  cardsStudied: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageResponseTimeMs: number;
  startedAt: string;
  endedAt: string;
}

interface UseStudySessionResult {
  /** Record one answer with its response time in ms. Triggers a debounced flush to the server. */
  recordAnswer: (correct: boolean, cardId: string, responseTimeMs: number) => void;
  /** Total number of answered cards (correct + incorrect, not skipped). */
  answeredCount: number;
  /** Number of correct answers. */
  correctCount: number;
  /** Force an immediate flush (e.g. on "Done" button press). */
  flush: () => void;
}

// ─── Constants ─────────────────────────────────────────────

const FLUSH_DEBOUNCE_MS = 800;

// ─── Hook ──────────────────────────────────────────────────

export function useStudySession({ deckId, startedAt }: UseStudySessionConfig): UseStudySessionResult {
  const queryClient = useQueryClient();
  // Mutable ref for flush payloads (no stale-closure risk)
  const answersRef = useRef<AnswerRecord[]>([]);
  const lastFlushedCountRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushing = useRef(false);
  const deckIdRef = useRef(deckId);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // State counters that trigger re-renders so the UI stays in sync (FIX C1)
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Keep deckId ref in sync (it may arrive late in level-mode)
  useEffect(() => {
    deckIdRef.current = deckId;
  }, [deckId]);

  // ─── Flush logic ──────────────────────────────────────────

  const flushToServer = useCallback(async () => {
    const currentDeckId = deckIdRef.current;
    if (!currentDeckId) return;

    const answers = answersRef.current;
    if (answers.length === 0) return;

    // Nothing new since last flush
    if (answers.length === lastFlushedCountRef.current) return;

    // Prevent concurrent flushes
    if (isFlushing.current) return;
    isFlushing.current = true;

    const snapshotCorrect = answers.filter((a) => a.correct).length;
    const snapshotAnswered = answers.length;

    const snapshot: SessionSnapshot = {
      deckId: currentDeckId,
      cardsStudied: snapshotAnswered,
      correctAnswers: snapshotCorrect,
      incorrectAnswers: snapshotAnswered - snapshotCorrect,
      averageResponseTimeMs: snapshotAnswered > 0
        ? Math.round(answers.reduce((sum, a) => sum + a.responseTimeMs, 0) / snapshotAnswered)
        : 0,
      startedAt,
      endedAt: new Date().toISOString(),
    };

    try {
      await api.post('/progress/session', snapshot);
      lastFlushedCountRef.current = snapshotAnswered;
      // Invalidate caches so Home screen stats update immediately
      queryClient.invalidateQueries({ queryKey: progressKeys.summary() });
      queryClient.invalidateQueries({ queryKey: progressKeys.streak() });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coinsToday() });
    } catch {
      // Server unreachable — persist to offline queue for later retry
      await enqueue({
        method: 'POST',
        path: '/progress/session',
        body: snapshot as unknown as Record<string, unknown>,
      });
    } finally {
      isFlushing.current = false;
    }
  }, [startedAt, queryClient]);

  // Keep flushRef in sync so unmount cleanup always calls the latest version
  useEffect(() => {
    flushRef.current = flushToServer;
  }, [flushToServer]);

  // ─── Debounced flush ──────────────────────────────────────

  const scheduleDebouncedFlush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void flushToServer();
    }, FLUSH_DEBOUNCE_MS);
  }, [flushToServer]);

  // ─── Record answer ─────────────────────────────────────────

  const recordAnswer = useCallback(
    (correct: boolean, cardId: string, responseTimeMs: number) => {
      // FIX PF4: Use O(1) push instead of O(n) spread — ref doesn't drive renders
      answersRef.current.push({ cardId, correct, responseTimeMs });
      // Update state counters so consuming components re-render (FIX C1)
      setAnsweredCount(prev => prev + 1);
      if (correct) setCorrectCount(prev => prev + 1);
      scheduleDebouncedFlush();
    },
    [scheduleDebouncedFlush],
  );

  // ─── Flush on unmount (best-effort final cleanup) ─────────

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Reset the flushing guard so the final flush isn't blocked by an
      // in-flight debounced flush (FIX C2)
      isFlushing.current = false;
      void flushRef.current();
    };

  }, []);

  return {
    recordAnswer,
    answeredCount,
    correctCount,
    flush: flushToServer,
  };
}
