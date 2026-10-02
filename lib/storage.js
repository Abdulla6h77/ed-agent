// Thin, SSR-safe wrapper around localStorage.
//
// The tab panels are conditionally rendered, so React unmounts a panel the moment
// you switch tabs — which destroys its useState. Caching results here keeps your work
// across tab switches, a page refresh, and the navigation to /grading-agent.
//
// Every access is guarded because localStorage is hostile in three ways: it does not
// exist during Next.js server rendering, it throws when disabled/private mode, and a
// hand-edited or truncated value can fail to parse. Persistence is a convenience, so
// any failure degrades to "no cached value" rather than breaking the page.

const PREFIX = "edagent:";

export function readStore(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(PREFIX + key);
      return;
    }
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — carry on without persistence */
  }
}

export function clearStore(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
