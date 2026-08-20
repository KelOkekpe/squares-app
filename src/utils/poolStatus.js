/**
 * Board lifecycle.
 *
 * A board is active while it is neither archived nor past its expiry date.
 * Anything else is "completed" — still readable, but closed to new entries.
 * Mirrors public.is_pool_active() in migration_pool_lifecycle.sql; the database
 * is the enforcement point and this keeps the UI honest about it.
 */

export const MAX_ACTIVE_POOLS = 16;

/** Local calendar day as YYYY-MM-DD, which is what <input type="date"> speaks. */
export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDaysISO(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function isExpired(pool) {
  if (!pool?.expiresAt) return false; // pre-migration boards never expire
  return pool.expiresAt < todayISO();
}

export function isPoolActive(pool) {
  return !!pool && !pool.archived && !isExpired(pool);
}

export function isPoolCompleted(pool) {
  return !!pool && !isPoolActive(pool);
}

export function splitPools(pools = []) {
  return {
    active: pools.filter(isPoolActive),
    completed: pools.filter(isPoolCompleted),
  };
}

/** Whole days until expiry — negative once past. */
export function daysUntilExpiry(pool) {
  if (!pool?.expiresAt) return null;
  const ms = new Date(`${pool.expiresAt}T00:00:00`) - new Date(`${todayISO()}T00:00:00`);
  return Math.round(ms / 86400000);
}

/** Short human status: { label, tone } where tone is a colors.* key or null. */
export function poolStatus(pool) {
  if (!pool) return { label: "", tone: null };
  if (pool.archived) return { label: "Archived", tone: "textDim" };
  if (isExpired(pool)) return { label: `Ended ${formatDate(pool.expiresAt)}`, tone: "textDim" };

  const days = daysUntilExpiry(pool);
  if (days === null) return { label: "No end date", tone: "textDim" };
  if (days === 0) return { label: "Ends today", tone: "accentRed" };
  if (days === 1) return { label: "Ends tomorrow", tone: "accentOrange" };
  if (days <= 7) return { label: `Ends in ${days} days`, tone: "accentOrange" };
  return { label: `Ends ${formatDate(pool.expiresAt)}`, tone: "textDim" };
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
