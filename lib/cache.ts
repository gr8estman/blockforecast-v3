// Simple in-process TTL cache — zero dependencies, works with Next.js
// One Map per process; survives across requests, resets on server restart.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Periodically evict expired entries so the Map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 60_000);

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Cache-aside helper. Runs `fn` only on a miss.
 * Usage: cacheWrap("key", 30_000, () => expensiveQuery())
 */
export async function cacheWrap<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cacheSet(key, value, ttlMs);
  return value;
}
