// ─── In-Process UID Cache ────────────────────────────────────
// Caches firebase_uid → postgres UUID mappings in Node.js memory
// to eliminate the redundant SQL lookup on every request.
//
// Why this is safe: a user's postgres UUID never changes after
// account creation — the mapping is immutable. A 30-minute TTL
// provides a safety net for edge cases (user deletion).
//
// Why in-process (not Redis): this cache is specifically designed
// to REDUCE external I/O calls. Putting it in Redis would defeat
// the purpose — we'd be making a Redis call to avoid a PG call.
// In-process means zero network latency, zero command quota usage.
//
// Memory: ~200 bytes per entry × 5,000 max = ~1 MB total.

const MAX_ENTRIES = 5_000;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const uidMap = new Map<string, CacheEntry>();

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of uidMap) {
    if (now >= entry.expiresAt) {
      uidMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Get a cached postgres UUID for a firebase UID.
 * Returns undefined if not cached or expired.
 */
export function getCachedUid(firebaseUid: string): string | undefined {
  const entry = uidMap.get(firebaseUid);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    uidMap.delete(firebaseUid);
    return undefined;
  }
  return entry.value;
}

/**
 * Store a firebase_uid → postgres UUID mapping in the cache.
 * If the cache is full, evicts the oldest entry.
 */
export function setCachedUid(firebaseUid: string, pgId: string): void {
  // Evict oldest if at capacity
  if (uidMap.size >= MAX_ENTRIES && !uidMap.has(firebaseUid)) {
    const firstKey = uidMap.keys().next().value;
    if (firstKey) uidMap.delete(firstKey);
  }
  uidMap.set(firebaseUid, {
    value: pgId,
    expiresAt: Date.now() + TTL_MS,
  });
}
