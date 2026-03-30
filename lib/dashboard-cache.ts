// lib/dashboard-cache.ts
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage may be unavailable (SSR) or full
  }
}

export function cacheClear(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

/** Returns age in minutes, or null if no entry. */
export function cacheAge(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Math.floor((Date.now() - entry.timestamp) / 60_000);
  } catch {
    return null;
  }
}

// Increment CACHE_VERSION whenever SummaryData shape changes to auto-bust stale localStorage
const CACHE_VERSION = 2;

export function dashboardCacheKey(tab: string, ownerId: string, days?: number): string {
  return days != null
    ? `dashboard:v${CACHE_VERSION}:${tab}:${ownerId}:${days}`
    : `dashboard:v${CACHE_VERSION}:${tab}:${ownerId}`;
}
