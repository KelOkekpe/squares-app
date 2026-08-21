// Static checks on the payment endpoints.
//
// These functions can't be exercised here, so this asserts the properties that
// would be expensive to get wrong: a leaked service-role key bypasses every RLS
// policy, an unverified webhook hands out free boards, and a client-supplied
// price lets anyone name zero.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const checkout = read("api/checkout.js");
const webhook = read("api/stripe-webhook.js");
const env = read("api/_lib/env.js");
const admin = read("api/_lib/supabaseAdmin.js");

// ── secrets must never be reachable from the browser ──
const walk = (d) =>
  readdirSync(d).flatMap((e) => {
    const f = join(d, e);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
const clientSrc = walk(join(root, "src"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
for (const secret of ["SERVICE_ROLE", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
  check(`${secret} never appears in src/`, !clientSrc.includes(secret));
}
check(
  "server env vars carry no VITE_ prefix (which would inline them into the bundle)",
  !/VITE_[A-Z_]*(SERVICE|SECRET)/.test(env + admin + checkout + webhook)
);

// ── webhook ──
check("webhook disables body parsing", /bodyParser:\s*false/.test(webhook));
check("webhook verifies the Stripe signature", webhook.includes("constructEvent"));
check("webhook reads the signature header", webhook.includes("stripe-signature"));
const beforeVerify = webhook.slice(0, webhook.indexOf("constructEvent"));
check(
  "nothing from the body is trusted before verification",
  !/req\.body|session\.metadata/.test(beforeVerify)
);
check("webhook rejects non-POST", webhook.includes("405"));
check("replay of a completed session is a no-op", /\.eq\("paid",\s*false\)/.test(webhook));
check("write failure returns 500 so Stripe retries", /status\(500\)/.test(webhook));

// ── checkout ──
check(
  "checkout requires the caller to administer the space",
  checkout.includes("requireSpaceAdmin")
);
check(
  "price is not read from the request body",
  !/req\.body[^;]*(amount|price|unit_amount)/i.test(checkout)
);
check(
  "amount comes from server config",
  checkout.includes("BOARD_PRICE_CENTS") || checkout.includes("STRIPE_PRICE_ID")
);
check("board id travels in Stripe metadata", /metadata:\s*\{[^}]*poolId/.test(checkout));
check("checkout refuses an already-paid board", checkout.includes("already active"));
check("checkout rejects non-POST", checkout.includes("405"));

// ── auth helper ──
check(
  "admin check resolves the user from a JWT, not a client-supplied id",
  admin.includes("auth.getUser(token)")
);
check(
  "admin check verifies membership or ownership",
  admin.includes("space_admins") && admin.includes("owner_id")
);

// ── routing ──
const vercel = JSON.parse(read("vercel.json"));
check(
  "SPA rewrite excludes /api so functions are reachable",
  vercel.rewrites.every((r) => r.source.includes("?!api"))
);

// ── the DB half ──
const sql = read("supabase/migration_billing.sql");
check(
  "first board in a space is free, decided server-side",
  sql.includes("grant_first_board_free")
);
check("clients cannot flip the paid flag", sql.includes("protect_paid_flag"));
check("unpaid boards refuse entries", sql.includes("This board is not active yet"));

console.log(failed === 0 ? "\nAll API safety cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
