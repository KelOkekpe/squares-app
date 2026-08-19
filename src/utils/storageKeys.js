/**
 * Storage-key parsing for the `spaces` key/value table.
 *
 * Keys look like:
 *   fb-{spaceCode}-{poolId}-{type}   pool-scoped state
 *   fb-{spaceCode}-meta              space-scoped metadata
 *
 * poolId is a UUID, or the legacy p123 form.
 */

/**
 * Pool-scoped state types.
 *
 * `spaces.space_code` and `spaces.type` are NOT NULL, so a key whose type is
 * missing here cannot be written at all — the row is rejected by the database.
 * Adding a new usePersistedState key means adding its type here too.
 */
export const POOL_STATE_TYPES = ["board", "admin", "participants", "pending", "scores", "headers"];

const META_KEY_RE = /^fb-(.+)-meta$/;
const POOL_KEY_RE = new RegExp(
  `^fb-(.+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|p\\d+)-(${POOL_STATE_TYPES.join("|")})$`,
  "i"
);

/** Split a storage key into { space, pool, type }, or null if it doesn't parse. */
export function parseStorageKey(key) {
  const metaMatch = String(key || "").match(META_KEY_RE);
  if (metaMatch) return { space: metaMatch[1], pool: "", type: "meta" };

  const poolMatch = String(key || "").match(POOL_KEY_RE);
  if (poolMatch) {
    return { space: poolMatch[1], pool: poolMatch[2], type: poolMatch[3] };
  }
  return null;
}
