// ─── Challenge SSE Hook ─────────────────────────────────────
// Manages the Server-Sent Events connection for live score updates
// during a P2P challenge game. Handles:
//   - AppState background/foreground lifecycle
//   - Reconnection with exponential backoff
//   - Client-side countdown timer
//   - Automatic game-over detection

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { auth } from '../lib/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ChallengeSSEState {
  myScore: number;
  opponentScore: number;
  gameOver: boolean;
  winnerId: string | null;
  timeRemainingMs: number;
  connected: boolean;
}

interface SSEEvent {
  type: 'initial' | 'score' | 'lifecycle';
  creatorScore?: number;
  opponentScore?: number;
  startedAt?: string;
  durationSeconds?: number;
  role?: 'creator' | 'opponent';
  newScore?: number;
  event?: 'accepted' | 'completed';
  winnerId?: string | null;
}

export function useChallengeSSE(
  challengeId: string | null,
  myRole: 'creator' | 'opponent' | null,
): ChallengeSSEState {
  const [state, setState] = useState<ChallengeSSEState>({
    myScore: 0,
    opponentScore: 0,
    gameOver: false,
    winnerId: null,
    timeRemainingMs: 0,
    connected: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const durationMsRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameOverRef = useRef(false);

  // FIX PF2: Store mutable values in refs so `connect` has a stable identity
  const challengeIdRef = useRef(challengeId);
  challengeIdRef.current = challengeId;
  const myRoleRef = useRef(myRole);
  myRoleRef.current = myRole;

  // Client-side countdown
  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (startedAtRef.current && durationMsRef.current) {
        const remaining = Math.max(
          0,
          durationMsRef.current - (Date.now() - startedAtRef.current),
        );
        setState((prev) => ({ ...prev, timeRemainingMs: remaining }));
        if (remaining <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }, 100);
  }, []);

  // SSE connection — FIX PF2: Reads from refs to keep stable callback identity
  const connect = useCallback(async () => {
    const cId = challengeIdRef.current;
    const role = myRoleRef.current;
    if (!cId || !role || gameOverRef.current) return;

    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/p2p/challenges/${cId}/stream`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      setState((prev) => ({ ...prev, connected: true }));
      reconnectAttemptsRef.current = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));

            if (event.type === 'initial') {
              const creatorScore = event.creatorScore ?? 0;
              const opponentScore = event.opponentScore ?? 0;
              setState((prev) => ({
                ...prev,
                myScore: role === 'creator' ? creatorScore : opponentScore,
                opponentScore: role === 'creator' ? opponentScore : creatorScore,
              }));
              if (event.startedAt && event.durationSeconds) {
                startedAtRef.current = new Date(event.startedAt).getTime();
                durationMsRef.current = event.durationSeconds * 1000;
                startCountdown();
              }
            }

            if (event.type === 'score' && event.role && event.newScore !== undefined) {
              setState((prev) => {
                if (event.role === role) {
                  return { ...prev, myScore: event.newScore! };
                } else {
                  return { ...prev, opponentScore: event.newScore! };
                }
              });
            }

            if (event.type === 'lifecycle' && event.event === 'completed') {
              gameOverRef.current = true;
              setState((prev) => ({
                ...prev,
                gameOver: true,
                winnerId: event.winnerId ?? null,
              }));
              if (timerRef.current) clearInterval(timerRef.current);
              reader.cancel();
              return;
            }
          } catch {
            // Ignore malformed lines (keepalive comments, etc.)
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setState((prev) => ({ ...prev, connected: false }));

      // Reconnect with exponential backoff
      if (!gameOverRef.current) {
        const delay = Math.min(500 * 2 ** reconnectAttemptsRef.current, 5000);
        reconnectAttemptsRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    }
  }, [startCountdown]); // FIX PF2: Only depends on startCountdown (stable)

  // AppState lifecycle
  useEffect(() => {
    if (!challengeId) return;

    const handleAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        abortRef.current?.abort();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      if (next === 'active' && !gameOverRef.current) {
        connect();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    connect();

    return () => {
      sub.remove();
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [challengeId, connect]); // connect is now stable (PF2)

  return state;
}
