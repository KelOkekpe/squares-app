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
const reset = sql["RESET_ALL_DATA.sql"] || "";

// Migrations declare their own order in a header comment ("Run ... AFTER x"),
// so the chain gives the run order without hard-coding one. It matters because
// these functions get redefined by later migrations: reading a fixed file meant
// checking a superseded copy and missing a table the current one must sweep.
function runOrder() {
  const after = {};
  for (const [file, body] of Object.entries(sql)) {
    const m = body.match(/Run in the Supabase SQL Editor AFTER ([\w.]+)/);
    after[file] = m ? m[1] : null;
  }
  const depth = (file, seen = new Set()) => {
    if (!after[file] || seen.has(file)) return 0;
    seen.add(file);
    return 1 + depth(after[file], seen);
  };
  return Object.keys(sql).sort((a, b) => depth(a) - depth(b));
}
const ordered = runOrder();

/** The definition that actually ships: the last one in run order. */
function currentBody(name) {
  let found = "";
  for (const file of ordered) {
    const body = sql[file] || "";
    const start = body.indexOf(`FUNCTION public.${name}(`);
    if (start === -1) continue;
    const end = body.indexOf("$$;", start);
    if (end !== -1) found = body.slice(start, end);
  }
  return found;
}

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

// One function's body, from its CREATE to the matching $$;. Slicing from a bare
// name instead matched the prose in a file header and ran on through the next
// function, so a purge missing pickem_contacts still passed — the sweep it
// found belonged to delete_space.
const body = currentBody;
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
  /p_older_than_days INT DEFAULT (\d+)/.test(purge) &&
    Number(purge.match(/p_older_than_days INT DEFAULT (\d+)/)[1]) > 0
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
  /CREATE POLICY "pools_select"[\s\S]{0,120}deleted_at IS NULL/.test(
    sql["migration_board_deletion.sql"] || ""
  )
);
// The console reads deleted boards through SECURITY DEFINER RPCs, so exempting
// superadmins in the policy buys nothing and hides the delete from the one
// person most likely to be testing it.
check(
  "the hide has no superadmin exception",
  !/CREATE POLICY "pools_select"[\s\S]{0,200}is_superadmin/.test(
    sql["migration_board_deletion.sql"] || ""
  )
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

// ── personal data stays out of the world-readable blobs ──
// `participants` cannot be gated the way `picks` was: the board draws its names
// from it, so every player reads it. That makes it the one place contact
// details must never be written in the first place.
const gameBoard = readFileSync(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
const approve = gameBoard.slice(
  gameBoard.indexOf("const approveEntry"),
  gameBoard.indexOf("const smartFill")
);
const written = approve.slice(approve.indexOf("setParticipants((p) => ["));
const blobWrite = written.slice(0, written.indexOf("]);"));
for (const field of ["email", "phone", "payoutMethod", "payoutHandles"]) {
  check(
    `approval keeps ${field} out of the participants blob`,
    !new RegExp(`\\b${field}\\b`).test(blobWrite)
  );
}
check("approval records the contact separately", /saveContact\(/.test(approve));
check(
  "the admin console reads contacts from the admin-only table",
  /contacts\[entry\.id\]/.test(
    readFileSync(new URL("../src/components/admin/EntriesSection.jsx", import.meta.url), "utf8")
  )
);
// Backfilling must not renumber entries that already have an id — the contacts
// hang off it, and regenerating would orphan every one of them.
const privacySql = sql["migration_entry_privacy.sql"] || "";
check(
  "the backfill leaves existing entry ids alone",
  /CASE WHEN e \? 'id' THEN e/.test(privacySql)
);
check(
  "contact fields are stripped from the blob",
  /- 'email' - 'phone' - 'payoutMethod' - 'payoutHandles'/.test(privacySql)
);

console.log(failed === 0 ? "\nAll deletion cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
