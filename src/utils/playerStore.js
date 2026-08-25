/**
 * What this browser remembers about the person using it.
 *
 * Players never sign in — that is deliberate, and it is why entries go through
 * SECURITY DEFINER RPCs rather than table writes. The cost was that a pick'em
 * player retyped their name, email and payout details every week of the season,
 * and re-entered a private space's password on every visit.
 *
 * All of this is per-browser and per-device on purpose. Nothing here is
 * authoritative — the database is — and nothing here is trusted by the server.
 * It exists so the forms arrive filled in. If any of it is wrong or missing the
 * app behaves exactly as it did before.
 *
 * Keys are prefixed `sp:` rather than matching the older `sqrbet-theme`, which
 * keeps its name only because renaming it would reset everyone's theme.
 */
const KEYS = {
  profile: "sp:player",
  unlocked: "sp:unlocked",
  sheets: "sp:sheets",
};

/** localStorage throws in Safari private mode, so every access is guarded. */
function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full, disabled, or private mode. Losing a convenience is not worth an
    // error in front of someone trying to enter a pool.
  }
}

/** Name, email and payout details, for prefilling the entry forms. */
export function loadProfile() {
  const p = read(KEYS.profile, {});
  return {
    firstName: p.firstName || "",
    middleInitial: p.middleInitial || "",
    lastName: p.lastName || "",
    name: p.name || "",
    email: p.email || "",
    payoutMethod: p.payoutMethod || "",
    payoutHandles: p.payoutHandles || {},
  };
}

/**
 * Merged rather than replaced: the squares form knows a first and last name,
 * the pick'em sheet knows a single display name, and neither should erase what
 * the other learned.
 *
 * Empty values are dropped from the *patch* before merging, not from the result
 * — pruning afterwards deleted keys that loadProfile() had defaulted to "",
 * so submitting the pick'em sheet wiped the squares name and email.
 */
export function saveProfile(patch) {
  const stored = read(KEYS.profile, {});
  const meaningful = ([, v]) => {
    if (v == null || v === "") return false;
    if (typeof v === "object" && !Array.isArray(v)) return Object.keys(v).length > 0;
    return true;
  };
  const next = { ...stored, ...Object.fromEntries(Object.entries(patch || {}).filter(meaningful)) };
  write(KEYS.profile, next);
  return next;
}

/**
 * Private spaces this browser has already unlocked.
 *
 * Held in memory before, so the password was retyped on every visit. It is a
 * pool password on the owner's own device, not a credential — the trade for not
 * asking every single time is worth it.
 */
export function loadUnlocked() {
  const list = read(KEYS.unlocked, []);
  return Array.isArray(list) ? list : [];
}

export function rememberUnlocked(spaceCode) {
  if (!spaceCode) return;
  const list = loadUnlocked();
  if (!list.includes(spaceCode)) write(KEYS.unlocked, [...list, spaceCode]);
}

export function forgetUnlocked(spaceCode) {
  write(
    KEYS.unlocked,
    loadUnlocked().filter((c) => c !== spaceCode)
  );
}

/**
 * A sheet this browser submitted, kept so it can be shown back.
 *
 * The picks themselves are stored, not just an id: everyone's picks are hidden
 * until the first kickoff, so the server will not return them — this is the
 * only way to show someone their own before then, short of the email.
 */
export function loadSheet(poolId) {
  if (!poolId) return null;
  return read(KEYS.sheets, {})[poolId] || null;
}

export function saveSheet(poolId, sheet) {
  if (!poolId) return;
  const all = read(KEYS.sheets, {});
  write(KEYS.sheets, { ...all, [poolId]: { ...sheet, savedAt: Date.now() } });
}

/**
 * The entry id this browser submitted for a contest, if any.
 *
 * Lets the standings tell someone *their own* sheet is waiting on confirmation
 * without telling everyone how many other people haven't paid — which is the
 * admin's business, not theirs.
 */
export function myEntryId(poolId) {
  return loadSheet(poolId)?.entryId || null;
}
