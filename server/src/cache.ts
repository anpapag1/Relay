interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** In-memory, TTL'd, keyed by URL — so a rebuild (or reopening the
 * article drawer) doesn't re-crawl the old site for a page already
 * fetched this session. Cleared on server restart; no persistence
 * needed beyond that (design spec §5.7). */
const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}
