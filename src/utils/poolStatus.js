/**
 * Board lifecycle.
 *
 * A board is active while it is neither archived nor past its expiry date.
 * Anything else is "completed" — still readable, but closed to new entries.
 * Mirrors public.is_pool_active() in migration_pool_lifecycle.sql; the database
 * is the enforcement point and this keeps the UI honest about it.
 */

export const MAX_ACTIVE_POOLS = 16;

/**
 * Entries close this long before kickoff.
 *
 * Not at kickoff: someone paying at the whistle can't have their entry
 * confirmed and their squares drawn before the first score, and a board whose
 * numbers move after play started isn't a board anyone trusts.
 */
export const DEADLINE_LEAD_MS = 10 * 60 * 1000;

/**
 * The moment a board stops taking entries, from the game it is attached to.
 *
 * Derived rather than stored. Both kickoff times are already in the database —
 * `config.game.startsAt` for a squares board, the frozen slate for a pick'em
 * contest — and a second copy would be one more thing to keep in step when a
 * game is rescheduled.
 *
 * A squares board with no game linked has no kickoff to work from and falls
 * back to the end of its expiry date, which is the admin's own choice.
 */
export function deadlineAt({ config, slate, pool } = {}) {
  const kickoffs = [];

  if (config?.game?.startsAt) kickoffs.push(new Date(config.game.startsAt).getTime());

  for (const game of slate?.games || []) {
    if (game.startsAt) kickoffs.push(new Date(game.startsAt).getTime());
  }

  const valid = kickoffs.filter((t) => Number.isFinite(t));
  // The first kickoff, so a pick'em week closes before any of it has happened.
  if (valid.length) return Math.min(...valid) - DEADLINE_LEAD_MS;

  if (pool?.expiresAt) return new Date(`${pool.expiresAt}T23:59:59`).getTime();
  return null;
}

/** True once entries are closed for the game this board is attached to. */
export function isPastDeadline(args, now = Date.now()) {
  const at = deadlineAt(args);
  return at !== null && now >= at;
}

/** Local calendar day as YYYY-MM-DD, which is what <input type="date"> speaks. */
export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** The local calendar day an instant falls on, as YYYY-MM-DD. */
export function localDateISO(when) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return null;
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
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
  if (isExpired(pool)) return { label: `Closed ${formatDate(pool.expiresAt)}`, tone: "textDim" };

  const days = daysUntilExpiry(pool);
  if (days === null) return { label: "No deadline", tone: "textDim" };
  if (days === 0) return { label: "Deadline today", tone: "accentRed" };
  if (days === 1) return { label: "Deadline tomorrow", tone: "accentOrange" };
  if (days <= 7) return { label: `Deadline in ${days} days`, tone: "accentOrange" };
  return { label: `Deadline ${formatDate(pool.expiresAt)}`, tone: "textDim" };
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * How many submissions are waiting on each board, with the board currently
 * open in the admin console counted from live state rather than the snapshot.
 *
 * The snapshot (`pendingCounts`) is fetched once when the console mounts, so
 * approving an entry used to leave both the tab badge and the board picker's
 * "PENDING SUBMISSIONS" tag stale until the admin navigated away and back.
 *
 * Only the open board can change while the console is open, and its queue is
 * already held in component state — so that is the one entry worth overriding.
 * Every other board keeps its fetched count, which stays correct precisely
 * because nothing the admin does here can alter it.
 *
 * Pick'em counts sheets whose fee is unconfirmed, and only when the contest
 * charges — a free contest confirms itself, so the flag would never clear.
 */
export function livePendingCounts({
  pendingCounts = {},
  activePoolId,
  isPickem = false,
  entryFee = 0,
  pending = [],
  picks = [],
} = {}) {
  if (!activePoolId) return pendingCounts;
  const live = isPickem
    ? Number(entryFee) > 0
      ? picks.filter((e) => !e?.paid).length
      : 0
    : pending.length;
  return { ...pendingCounts, [activePoolId]: live };
}
