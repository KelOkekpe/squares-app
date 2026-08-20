// Board lifecycle: the JS view of "active" must match the SQL trigger's, or the
// UI will offer a board slot the database then refuses.
import { readFileSync } from "node:fs";
import {
  isPoolActive,
  isPoolCompleted,
  splitPools,
  poolStatus,
  todayISO,
  addDaysISO,
  MAX_ACTIVE_POOLS,
} from "../src/utils/poolStatus.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const future = addDaysISO(10),
  past = addDaysISO(-3),
  today = todayISO();

check(
  "active while unarchived and future-dated",
  isPoolActive({ archived: false, expiresAt: future })
);
check(
  "expiry day itself still counts as active",
  isPoolActive({ archived: false, expiresAt: today })
);
check("past expiry is completed", isPoolCompleted({ archived: false, expiresAt: past }));
check(
  "archived is completed even if future-dated",
  isPoolCompleted({ archived: true, expiresAt: future })
);
check(
  "pre-migration board (no expiry) stays active",
  isPoolActive({ archived: false, expiresAt: null })
);
check("null pool is neither", !isPoolActive(null) && !isPoolCompleted(null));

const pools = [
  { id: "a", archived: false, expiresAt: future },
  { id: "b", archived: false, expiresAt: past },
  { id: "c", archived: true, expiresAt: future },
  { id: "d", archived: false, expiresAt: null },
];
const { active, completed } = splitPools(pools);
check("split partitions completely", active.length + completed.length === pools.length);
check("split puts the right ones in active", active.map((p) => p.id).join() === "a,d");

check(
  "expiring today reads urgent",
  poolStatus({ archived: false, expiresAt: today }).tone === "accentRed"
);
check(
  "expiring in a week reads as a warning",
  poolStatus({ archived: false, expiresAt: addDaysISO(5) }).tone === "accentOrange"
);
check(
  "far-off expiry is neutral",
  poolStatus({ archived: false, expiresAt: addDaysISO(60) }).tone === "textDim"
);

// The cap must be the same number on both sides
const sql = readFileSync(
  new URL("../supabase/migration_pool_lifecycle.sql", import.meta.url),
  "utf8"
);
const m = sql.match(/v_limit CONSTANT INT :=\s*(\d+)/);
check(`cap agrees with SQL (${MAX_ACTIVE_POOLS})`, m && Number(m[1]) === MAX_ACTIVE_POOLS);
check("SQL requires an expiry on insert", /TG_OP = 'INSERT' AND NEW\.expires_at IS NULL/.test(sql));

// addDaysISO must not drift across month boundaries
check("addDaysISO(30) is a valid ISO date", /^\d{4}-\d{2}-\d{2}$/.test(addDaysISO(30)));
check("addDaysISO(30) is later than today", addDaysISO(30) > today);
check("addDaysISO(-1) is earlier than today", addDaysISO(-1) < today);

console.log(failed === 0 ? "\nAll pool-lifecycle cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
