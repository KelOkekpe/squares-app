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
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

/**
 * True for the failures that a stale stored session tends to produce.
 *
 * Aborts belong here: when the session recovery path clears credentials, it
 * signs out, and supabase-js aborts every request already in flight. Those
 * surface as AbortError — a different shape from a refresh-token failure, but
 * the same underlying cause, and they're recoverable by simply trying again
 * once the bad session is gone.
 */
/**
 * True only when the stored session is definitively unusable.
 *
 * Deliberately narrower than isStaleSessionError: that one decides whether to
 * retry a query, this one decides whether to delete someone's credentials.
 * A slow response is not evidence of a bad session — treating it as such logs
 * people out for being on a slow connection, or for returning from a redirect.
 */
export function isUnusableSessionError(err) {
  if (!err || err.isTimeout || err.name === "AbortError") return false;
  const text = `${err.message || ""} ${err.code || ""}`.toLowerCase();
  return (
    text.includes("refresh token") ||
    text.includes("invalid claim") ||
    text.includes("jwt expired") ||
    text.includes("invalid jwt")
  );
}

/**
 * The token's `iat` is ahead of the database clock.
 *
 * PostgREST validates the issued-at claim against Postgres's own now(), so a
 * token minted a moment ago can arrive fractionally "in the future" and be
 * refused. It resolves itself within a second, which makes it worth retrying —
 * and makes it emphatically not grounds for discarding the session. Signing
 * someone out because two clocks disagreed by 300ms is the worst possible
 * response, so this is deliberately absent from isUnusableSessionError.
 */
export function isClockSkewError(err) {
  if (!err) return false;
  const text = `${err.message || ""} ${err.code || ""}`.toLowerCase();
  return text.includes("issued at future") || text.includes("issued in the future");
}

export function isStaleSessionError(err) {
  if (!err) return false;
  if (err.isTimeout) return true;
  if (err.name === "AbortError") return true;
  const text = `${err.message || ""} ${err.code || ""} ${err.name || ""}`.toLowerCase();
  return (
    text.includes("refresh token") ||
    text.includes("jwt expired") ||
    text.includes("invalid claim") ||
    text.includes("pgrst301") ||
    text.includes("abort") ||
    isClockSkewError(err)
  );
}
