// ─── Study State Storage ────────────────────────────────────
// Persists in-progress study session state to AsyncStorage so users
// can resume where they left off after closing the app or clearing cache.
//
// Key format: `study_state:{cacheKey}` where cacheKey is the deck or
// level identifier used on the study screen.
//
// Each entry auto-expires after 24h of inactivity (checked on load).

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'study_state:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

type CardAnswer = boolean | 'skipped' | undefined;

export interface PersistedStudyState {
  currentIdx: number;
  answered: CardAnswer[];
  sessionCoinsEarned: number;
  /** Total number of cards in the deck when the session was saved. */
  totalCards: number;
  /** ISO timestamp of the last save — used for expiry check. */
  savedAt: string;
}

/**
 * Load a persisted study session for the given cache key.
 * Returns null if no saved state exists or if it has expired.
 */
export async function loadStudyState(cacheKey: string): Promise<PersistedStudyState | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${cacheKey}`);
    if (!raw) return null;

    const state: PersistedStudyState = JSON.parse(raw);

    // Expire sessions older than MAX_AGE_MS
    if (Date.now() - new Date(state.savedAt).getTime() > MAX_AGE_MS) {
      void AsyncStorage.removeItem(`${PREFIX}${cacheKey}`).catch(() => {});
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Persist the current study session state for later resumption.
 * Called on every navigation (next/prev) and on every answer.
 */
export async function saveStudyState(
  cacheKey: string,
  state: Omit<PersistedStudyState, 'savedAt'>,
): Promise<void> {
  try {
    const payload: PersistedStudyState = {
      ...state,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(`${PREFIX}${cacheKey}`, JSON.stringify(payload));
  } catch {
    // Best-effort — don't crash the study session
  }
}

/**
 * Remove persisted state for a completed or reset session.
 */
export async function clearStudyState(cacheKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${cacheKey}`);
  } catch {
    // Best-effort
  }
}
