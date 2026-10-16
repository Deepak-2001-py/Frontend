/**
 * sessionStorage-backed API response cache, ported from javascript/api-cache.js.
 * Navigating back to a page reuses the last successful response instead of
 * re-hitting the backend. Only successful responses are cached; it is
 * cleared on login, logout and any mutation that makes cached reads stale.
 */
const PREFIX = 'apiCache:'

function get<T = unknown>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return undefined
    return (JSON.parse(raw) as { data: T }).data
  } catch {
    return undefined
  }
}

function set(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ data, cachedAt: Date.now() }))
  } catch {
    // Storage full/unavailable: caching is an optimization, never required.
  }
}

function clear(key: string): void {
  sessionStorage.removeItem(PREFIX + key)
}

/** Clears every entry whose key starts with `prefix` (e.g. all cached grades). */
function clearPrefix(prefix: string): void {
  const fullPrefix = PREFIX + prefix
  const toRemove: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (k && k.startsWith(fullPrefix)) toRemove.push(k)
  }
  toRemove.forEach((k) => sessionStorage.removeItem(k))
}

function clearAll(): void {
  clearPrefix('')
}

/** Returns the cached value unless `force` or nothing cached; `fetcher` must throw on failure. */
async function withCache<T>(key: string, force: boolean, fetcher: () => Promise<T>): Promise<T> {
  if (!force) {
    const cached = get<T>(key)
    if (cached !== undefined) return cached
  }
  const data = await fetcher()
  set(key, data)
  return data
}

export const apiCache = { get, set, has: (k: string) => get(k) !== undefined, clear, clearPrefix, clearAll, withCache }
