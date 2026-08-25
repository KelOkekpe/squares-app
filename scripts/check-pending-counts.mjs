/**
 * The pending badge has to fall to zero the moment the last entry is approved.
 *
 * It did not: the counts were fetched once at mount, so the badge and the
 * board picker's "PENDING SUBMISSIONS" tag both survived every approval until
 * the admin left the console and came back. These cases pin the live override.
 */
import { livePendingCounts } from "../src/utils/poolStatus.js";
import { readFileSync } from "node:fs";

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got),
    w = JSON.stringify(want);
  if (g !== w) {
    console.error(`  FAIL ${label}\n    got  ${g}\n    want ${w}`);
    failed++;
  } else console.log(`  ok   ${label}`);
};

const snapshot = { a: 3, b: 2 };

// Squares: the live queue wins over the snapshot for the open board.
eq(
  "approving one of three drops the open board to 2",
  livePendingCounts({ pendingCounts: snapshot, activePoolId: "a", pending: [1, 2] }),
  { a: 2, b: 2 }
);

eq(
  "approving the last one clears the open board",
  livePendingCounts({ pendingCounts: snapshot, activePoolId: "a", pending: [] }),
  { a: 0, b: 2 }
);

// The regression this exists for: a stale snapshot must not resurrect a count.
const cleared = livePendingCounts({ pendingCounts: snapshot, activePoolId: "a", pending: [] });
const total = Object.values(cleared).reduce((n, v) => n + v, 0);
eq("other boards keep their fetched counts", total, 2);

// Boards the admin isn't looking at can't change, so they are left alone.
eq(
  "no active board leaves the snapshot untouched",
  livePendingCounts({ pendingCounts: snapshot, activePoolId: "" }),
  snapshot
);

eq(
  "a board absent from the snapshot still reports live",
  livePendingCounts({ pendingCounts: snapshot, activePoolId: "c", pending: [1] }),
  { a: 3, b: 2, c: 1 }
);

// Pick'em counts unconfirmed sheets, and only when the contest charges.
const sheets = [{ paid: true }, { paid: false }, {}];
eq(
  "paid contest counts unconfirmed sheets",
  livePendingCounts({
    pendingCounts: {},
    activePoolId: "p",
    isPickem: true,
    entryFee: 10,
    picks: sheets,
  }),
  { p: 2 }
);

eq(
  "free contest never shows a pending flag",
  livePendingCounts({
    pendingCounts: { p: 5 },
    activePoolId: "p",
    isPickem: true,
    entryFee: 0,
    picks: sheets,
  }),
  { p: 0 }
);

eq(
  "pick'em ignores the squares queue",
  livePendingCounts({
    pendingCounts: {},
    activePoolId: "p",
    isPickem: true,
    entryFee: 5,
    picks: [],
    pending: [1, 2, 3],
  }),
  { p: 0 }
);

// The component must actually route its badge through this, or the fix is
// dead code — both readers are asserted, not just the import.
const panel = readFileSync(
  new URL("../src/components/admin/AdminPanel.jsx", import.meta.url),
  "utf8"
).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
eq("AdminPanel derives its counts live", /livePendingCounts\(\{/.test(panel), true);
eq(
  "tab badge reads the live counts",
  /totalPending\s*=\s*Object\.values\(liveCounts\)/.test(panel),
  true
);
eq("board picker reads the live counts", /waiting\s*=\s*liveCounts\?\.\[p\.id\]/.test(panel), true);
eq(
  "no reader falls back to the raw snapshot",
  /pendingCounts\??\.?\[/.test(panel.split("livePendingCounts({")[1] || ""),
  false
);

if (failed) {
  console.error(`\ncheck:counts — ${failed} failing`);
  process.exit(1);
}
console.log("\ncheck:counts — pending counts update live");
