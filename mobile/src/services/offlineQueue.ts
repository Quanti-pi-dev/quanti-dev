// ─── Offline Mutation Queue ──────────────────────────────────
// Lightweight AsyncStorage-backed queue for critical mutations
// that must survive network interruptions (study sessions, etc.).
//
// Usage:
//   import { enqueue, flush } from './offlineQueue';
//   // On failed POST:
//   await enqueue({ method: 'POST', path: '/progress/session', body: snapshot });
//   // On app resume / auth success:
//   await flush();

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// ─── Types ──────────────────────────────────────────────────

interface QueuedMutation {
  id: string;
  method: 'POST' | 'PUT';
  path: string;
  body: Record<string, unknown>;
  createdAt: string;
}

const QUEUE_KEY = '@kd:offline_queue';

// Maximum number of items stored in the offline queue.
// Prevents unbounded growth if a user studies offline for extended sessions.
const MAX_QUEUE_SIZE = 500;

// ─── Simple UUID (no crypto dependency for RN compatibility) ─

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Queue Operations ───────────────────────────────────────

async function getQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add a failed mutation to the offline queue for later retry.
 * Should be called from catch blocks in study session / progress hooks.
 * Oldest items are dropped if the queue exceeds MAX_QUEUE_SIZE.
 */
export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'createdAt'>,
): Promise<void> {
  try {
    const queue = await getQueue();
    queue.push({
      ...mutation,
      id: generateId(),
      createdAt: new Date().toISOString(),
    });
    // Cap the queue size — drop oldest items (FIFO) when limit exceeded
    const trimmed = queue.length > MAX_QUEUE_SIZE
      ? queue.slice(queue.length - MAX_QUEUE_SIZE)
      : queue;
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // AsyncStorage failure — truly best-effort at this point
  }
}

/**
 * Attempt to flush all queued mutations to the server.
 * Successfully sent items are removed from the queue.
 * Failed items remain for the next flush attempt.
 *
 * Returns the count of succeeded and failed items.
 */
export async function flush(): Promise<{ succeeded: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const item of queue) {
    try {
      if (item.method === 'POST') {
        await api.post(item.path, item.body);
      } else {
        await api.put(item.path, item.body);
      }
      succeeded++;
    } catch {
      // Keep the item for the next retry cycle
      failed++;
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { succeeded, failed };
}

/**
 * Returns the current queue size (for debug/monitoring).
 */
export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
