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
// Only the catch-all needs the /api exclusion — a specific route like /i/:id
// matches nothing under /api by construction. Asserting it of *every* rule
// meant adding any targeted rewrite failed this.
const catchAllRules = vercel.rewrites.filter((r) => r.destination === "/index.html");
check("an SPA catch-all exists", catchAllRules.length > 0);
check(
  "SPA rewrite excludes /api so functions are reachable",
  catchAllRules.every((r) => r.source.includes("?!api"))
);

// ── the DB half ──
const sql = read("supabase/migration_billing.sql");
check(
  "first board in a space is free, decided server-side",
  sql.includes("grant_first_board_free")
);
check("clients cannot flip the paid flag", sql.includes("protect_paid_flag"));
check("unpaid boards refuse entries", sql.includes("This board is not active yet"));

// Grants written as a hand-typed list inside one DO block are all-or-nothing:
// a single wrong signature aborts the block and leaves every function
// ungranted, which is how superadmin_stats ended up uncallable.
const superadminSql = read("supabase/migration_superadmin.sql");
const fixSql = read("supabase/migration_fix_superadmin_grants.sql");
check("a repair migration for the grants exists", fixSql.length > 0);
check(
  "the repair reads signatures from the catalog, not a hand-typed list",
  /oid::regprocedure/.test(fixSql)
);
check("the repair grants each function independently", /EXCEPTION WHEN OTHERS/.test(fixSql));
check("the repair is idempotent (no bare CREATE POLICY)", !/CREATE POLICY/.test(fixSql));
check(
  "CHECK_MIGRATIONS verifies the grants landed",
  /has_function_privilege\('authenticated'/.test(read("supabase/CHECK_MIGRATIONS.sql"))
);
check(
  "the original all-or-nothing block is documented as the cause",
  /hand-written list of signatures/.test(fixSql) && superadminSql.includes("FOREACH fn IN ARRAY")
);

// ── link previews ──
// The app is client-rendered and a space code lives in the URL fragment, which
// is never sent to a server. A preview crawler asking for the app URL sees a
// static index.html and no idea which board is meant, so board previews are
// served from a path instead — and no crawler runs JavaScript, so the tags have
// to be in the HTML itself.
const invite = read("api/invite.js");
const og = read("api/og.js");

check("the invite route is server-rendered HTML", /og:title|og:image/.test(invite));
check(
  "the preview names its image size",
  /og:image:width/.test(invite) && /og:image:height/.test(invite)
);
check("previews use a large card", /summary_large_image/.test(invite));
check("board values are escaped into the HTML", /escape\(/.test(invite));
check("the browser is bounced on to the app", /location\.replace/.test(invite));

// The catch-all rewrite sends everything non-api to index.html, so /i/ has to
// be matched before it or the function never runs.
const rules = vercel.rewrites || [];
const iIndex = rules.findIndex((r) => r.source.startsWith("/i/"));
const catchAll = rules.findIndex((r) => r.source.includes("(?!api/)"));
check("the invite route is rewritten to the function", iIndex !== -1);
check("it is matched before the catch-all", iIndex !== -1 && iIndex < catchAll);

check("the image runs on the edge runtime", /runtime:\s*"edge"/.test(og));
check("previews are cached for messaging apps", /s-maxage/.test(og) && /s-maxage/.test(invite));
// A preview is fetched by an anonymous crawler; it must never mutate.
check("preview endpoints only read", !/\.(insert|update|upsert|delete)\(/.test(invite + og));

// ── Stripe mode ──
// Switching sandbox to live touches three separate settings: the secret key,
// the webhook endpoint, and that endpoint's signing secret. Getting one wrong
// produces the worst possible failure — a real payment that succeeds while the
// board it paid for never activates.
const envSrc = read("api/_lib/env.js");
check(
  "the deployed Stripe mode is derivable from the key",
  /export function stripeMode/.test(envSrc)
);
check(
  "both live and test key prefixes are recognised, including restricted keys",
  /\(sk\|rk\)_live_/.test(envSrc) && /\(sk\|rk\)_test_/.test(envSrc)
);

// A signature only proves which endpoint sent the event, not that the endpoint
// matches the key the rest of the app runs on.
check(
  "the webhook refuses an event from the other mode",
  /event\.livemode !== \(mode === "live"\)/.test(webhook)
);
check(
  "a mode mismatch is refused, not merely logged",
  /Stripe mode mismatch[\s\S]{0,200}status\(400\)/.test(webhook)
);
// Unknown means we cannot tell; asserting a mismatch on a key we do not
// recognise would break a working deployment.
check(
  "an unrecognised key disables the check rather than blocking payments",
  /mode !== "unknown" &&/.test(webhook)
);
check(
  "the mode is recorded when a session is created",
  /Stripe \$\{stripeMode\(\)\} mode/.test(checkout)
);

console.log(failed === 0 ? "\nAll API safety cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
