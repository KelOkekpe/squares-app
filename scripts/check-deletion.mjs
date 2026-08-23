// Deleting a board is the one operation that can silently leave personal data
// behind. `spaces.pool_id` is TEXT and `pools.id` is UUID with no foreign key
// between them, so nothing cascades: whatever the purge forgets to sweep stays
// in the database forever, attached to a board that no longer exists.
//
// These assert the sweep is complete and that the safe path stays the default.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;
const check = (label, cond) => {
  console.log((cond ? "PASS  " : "FAIL  ") + label);
  if (!cond) failed++;
};

const dir = fileURLToPath(new URL("../supabase", import.meta.url));
const sql = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => [f, readFileSync(join(dir, f), "utf8")])
);
const all = Object.values(sql).join("\n");
const deletion = sql["migration_board_deletion.sql"] || "";
const reset = sql["RESET_ALL_DATA.sql"] || "";

// Every table that stores a pool_id or space_code, discovered from the schema
// rather than hard-coded — a new one shows up here automatically.
const tables = new Set();
for (const body of Object.values(sql)) {
  for (const m of body.matchAll(
    /CREATE TABLE(?: IF NOT EXISTS)? (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g
  )) {
    const [, name, cols] = m;
    if (/\bpool_id\b|\bspace_code\b/.test(cols)) tables.add(name);
  }
}
check(`found the tables keyed by pool/space (${[...tables].join(", ")})`, tables.size >= 5);

// Take ONE function's body, from its CREATE to the matching $$;. Slicing from a
// bare name instead matched the prose in the file header and ran on through the
// next function, so a purge missing pickem_contacts still passed — the sweep it
// found belonged to delete_space.
function body(name) {
  const start = deletion.indexOf(`FUNCTION public.${name}(`);
  if (start === -1) return "";
  const end = deletion.indexOf("$$;", start);
  return end === -1 ? "" : deletion.slice(start, end);
}
const sweeps = (src, t) => new RegExp(`DELETE FROM ${t}\\b`).test(src);

// pickem_contacts was added months after superadmin_delete_space was written,
// and delete_space kept working while quietly leaving addresses behind.
const purge = body("superadmin_purge_deleted_boards");
check("the purge function body was located", purge.length > 0);
for (const t of ["spaces", "pickem_contacts", "entry_request_log", "pools"]) {
  check(`purge sweeps ${t}`, sweeps(purge, t));
}

const deleteSpaceBody = body("superadmin_delete_space");
check("the delete_space function body was located", deleteSpaceBody.length > 0);
for (const t of tables) {
  check(`delete_space sweeps ${t}`, sweeps(deleteSpaceBody, t));
}

// The wipe has the same completeness requirement.
for (const t of tables) {
  check(`RESET_ALL_DATA clears ${t}`, new RegExp(`DELETE FROM ${t}\\b`).test(reset));
}

// A purge with no retention window would make the undo meaningless.
check(
  "purge defaults to a retention window, not zero",
  /p_older_than_days INT DEFAULT (\d+)/.test(deletion) &&
    Number(deletion.match(/p_older_than_days INT DEFAULT (\d+)/)[1]) > 0
);

// Soft delete must never reach a board that is still live.
check(
  "soft delete only touches archived boards",
  /coalesce\(archived, false\)/.test(body("superadmin_delete_archived_boards"))
);

// RLS is what keeps a deleted board off every screen; filtering in the client
// would mean finding all dozen reads of pools and never missing one.
check(
  "deleted boards are hidden by RLS, not by client filtering",
  /pools_select[\s\S]{0,200}deleted_at IS NULL OR public\.is_superadmin\(\)/.test(deletion)
);

// Every destructive RPC re-checks the role server-side.
for (const fn of [
  "superadmin_delete_archived_boards",
  "superadmin_restore_board",
  "superadmin_purge_deleted_boards",
  "superadmin_delete_space",
]) {
  check(`${fn} re-checks is_superadmin()`, /is_superadmin\(\)/.test(body(fn)));
}

// The wipe is all-or-nothing: a half-applied one is the orphan problem again.
check("RESET_ALL_DATA runs in a transaction", /BEGIN;[\s\S]*COMMIT;/.test(reset));
check(
  "RESET_ALL_DATA keeps user_profiles so you don't lock yourself out",
  !/^\s*DELETE FROM user_profiles/m.test(reset)
);

console.log(failed === 0 ? "\nAll deletion cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
