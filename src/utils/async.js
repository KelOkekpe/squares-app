/**
 * Timeout helpers.
 *
 * Every PostgREST call internally asks supabase-js for the current access
 * token, which can attempt a token refresh. When the stored refresh token is
 * stale that call can hang rather than reject — and a hung query means the
 * `finally { setLoading(false) }` in our loaders never runs, so the UI sits on
 * "Loading…" forever. Racing a timeout guarantees every loader settles.
 */

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
    this.isTimeout = true;
  }
}

export const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Resolve/reject with `promise`, or reject with a TimeoutError after `ms`.
 * Works with supabase-js query builders, which are thenable but not Promises.
 */
export function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = "request") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() =>
    clearTimeout(timer)
  );
}

/** True for the failures that a stale stored session tends to produce. */
export function isStaleSessionError(err) {
  if (!err) return false;
  if (err.isTimeout) return true;
  const text = `${err.message || ""} ${err.code || ""}`.toLowerCase();
  return (
    text.includes("refresh token") ||
    text.includes("jwt expired") ||
    text.includes("invalid claim") ||
    text.includes("pgrst301")
  );
}
