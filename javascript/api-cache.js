/**
 * GradeAnt — API response cache
 *
 * sessionStorage-backed cache so navigating back to a page (or re-opening
 * a form you already submitted this tab) reuses the last successful API
 * response instead of re-hitting the backend. Cleared automatically when
 * the tab closes (sessionStorage), and explicitly on login/logout/any
 * mutation that would make cached reads stale.
 *
 * Only successful responses are ever cached — a failed/thrown fetch never
 * populates the cache, so errors always retry on the next call.
 */
(function (global) {
  const PREFIX = "apiCache:";

  function get(key) {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      if (!raw) return undefined;
      return JSON.parse(raw).data;
    } catch (e) {
      return undefined;
    }
  }

  function set(key, data) {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify({ data: data, cachedAt: Date.now() }));
    } catch (e) {
      // sessionStorage full/unavailable (e.g. private browsing) — caching
      // is a perf optimization only, never a hard requirement.
    }
  }

  function has(key) {
    return get(key) !== undefined;
  }

  function clear(key) {
    sessionStorage.removeItem(PREFIX + key);
  }

  // Clears every cached entry whose key starts with `prefix` — use this to
  // invalidate a whole family of reads (e.g. all cached grades) after a
  // mutation, without having to reconstruct each exact cache key.
  function clearPrefix(prefix) {
    const fullPrefix = PREFIX + prefix;
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.indexOf(fullPrefix) === 0) toRemove.push(k);
    }
    toRemove.forEach(function (k) { sessionStorage.removeItem(k); });
  }

  function clearAll() {
    clearPrefix("");
  }

  // Generic cached-fetch helper: returns the cached value for `key` unless
  // `force` is true or nothing is cached yet, in which case it awaits
  // `fetcherFn()` and caches the result. `fetcherFn` should throw (not
  // return null/undefined) on failure so failed calls are never cached.
  async function withCache(key, force, fetcherFn) {
    if (!force) {
      const cached = get(key);
      if (cached !== undefined) return cached;
    }
    const data = await fetcherFn();
    set(key, data);
    return data;
  }

  global.apiCache = { get, set, has, clear, clearPrefix, clearAll, withCache };
})(window);
