import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLocation, isAuthCallbackHash, authErrorFromHash } from "../src/utils/routes.js";
import { inviteUrl, invitedPoolId, inviteMessage, smsHref } from "../src/utils/invite.js";

let failed = 0;
const check = (label, cond) => {
  console.log((cond ? "PASS  " : "FAIL  ") + label);
  if (!cond) failed++;
};

// The exact shape from the screenshot's URL
const signupHash =
  "#access_token=eyJhbGciOiJIUzI1NiIsImtpZCI6Imy5ZjJlMTc3&expires_at=1787005687&expires_in=3600&refresh_token=xe7ooioaftubsb&token_type=bearer&type=signup";
const recoveryHash = "#access_token=abc123&refresh_token=def&token_type=bearer&type=recovery";
const errorHash =
  "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

for (const [label, h] of [
  ["signup", signupHash],
  ["recovery", recoveryHash],
  ["error", errorHash],
]) {
  const r = parseLocation("/", h);
  check(`${label} fragment → auth route`, r.name === "auth");
  check(`${label} fragment → NO redirect (tokens preserved)`, r.redirectTo === undefined);
  check(`${label} fragment detected`, isAuthCallbackHash(h) === true);
}

check(
  "error message extracted",
  authErrorFromHash(errorHash) === "Email link is invalid or has expired"
);
check("no error message on success fragment", authErrorFromHash(signupHash) === null);

// Real space codes must be unaffected
for (const h of ["#scriberfam", "#my-league", "#/scriberfam"]) {
  check(`"${h}" still a space`, parseLocation("/", h).name === "space");
  check(`"${h}" not an auth fragment`, isAuthCallbackHash(h) === false);
}
check("/admin unaffected", parseLocation("/admin", "").name === "admin");
check("/superadmin routes to superadmin", parseLocation("/superadmin", "").name === "superadmin");
check(
  "/superadmin ignores a lingering fragment",
  parseLocation("/superadmin", "#stale").name === "superadmin"
);
check(
  "#superadmin is still a space, not the console",
  parseLocation("/", "#superadmin").name === "space"
);
check("/ is now marketing, not the join form", parseLocation("/", "").name === "marketing");

// Google via Supabase returns the same implicit-flow fragment, plus provider_token.
// It must resolve to the auth route with no redirectTo — a rewrite here would
// discard the tokens before supabase-js reads them.
const googleHash =
  "#access_token=ya29.abc&expires_in=3600&provider_token=ya29.goog&refresh_token=r1&token_type=bearer";
const googleDenied = "#error=access_denied&error_description=The+user+denied+the+request";

for (const [label, h] of [
  ["google success", googleHash],
  ["google denied", googleDenied],
]) {
  const r = parseLocation("/admin", h);
  check(`${label} → auth route`, r.name === "auth");
  check(`${label} → no redirect (tokens preserved)`, r.redirectTo === undefined);
  check(`${label} detected as auth fragment`, isAuthCallbackHash(h) === true);
}
check(
  "google denial surfaces its message",
  authErrorFromHash(googleDenied) === "The user denied the request"
);

// "/" is the marketing page now. The thing that must not break is a shared
// link: a player following /#code should never see marketing first.
check("/ is the marketing page", parseLocation("/", "").name === "marketing");
check("/join is the player join form", parseLocation("/join", "").name === "join");
check("a shared space link bypasses marketing", parseLocation("/", "#scriberfam").name === "space");
check(
  "a legacy path link still reaches the space",
  parseLocation("/scriberfam", "").name === "space"
);
check(
  "an auth callback still outranks marketing",
  parseLocation("/", "#access_token=abc").name === "auth"
);
check("/admin is unaffected", parseLocation("/admin", "").name === "admin");
check("#join is a space, not the join page", parseLocation("/", "#join").name === "space");

// A fragment is a space code, so an in-page anchor on the marketing site is a
// navigation *away* from it — `href="#features"` looks up a space called
// "features". Marketing scrolls by id instead; nothing there may emit one.
const marketingDir = fileURLToPath(new URL("../src/components/marketing", import.meta.url));
const anchored = readdirSync(marketingDir).filter((f) =>
  /href=\{?["'`]#/.test(
    readFileSync(join(marketingDir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  )
);
check(
  `no fragment hrefs on the marketing page (${anchored.join(", ") || "none"})`,
  anchored.length === 0
);
check(
  "an anchor-shaped fragment would resolve as a space",
  parseLocation("/", "#features").name === "space"
);

// ── invite links ──
// The shared link is a *path*, /i/<poolId>, not the app URL. A messaging app
// fetches the link to build its preview and never sends the fragment, so a link
// whose space lives in the fragment cannot be previewed at all — the crawler
// would see only "/" and the static index.html behind it.
const invite = new URL(inviteUrl("scriberfam", "pool-abc", "https://www.squarepool.app"));
check("an invite link is a server-readable path", invite.pathname === "/i/pool-abc");
check("an invite link carries no fragment", invite.hash === "");
check(
  "the board id is escaped into the path",
  inviteUrl("s", "a b/c", "https://x").endsWith("/i/a%20b%2Fc")
);

// /i/ bounces the browser to this URL, which the app itself has to understand.
// The danger is parseLocation rewriting it to a canonical form, dropping ?b=
// and landing the visitor on whatever board the admin set as the default.
const landing = new URL("https://www.squarepool.app/?b=pool-abc#scriberfam");
const landed = parseLocation(landing.pathname, landing.hash);
check(
  "the landing URL resolves to the space",
  landed.name === "space" && landed.code === "scriberfam"
);
check("the landing URL is not rewritten (that would strip ?b=)", landed.redirectTo === undefined);
check("the board survives the round trip", invitedPoolId(landing.search) === "pool-abc");
check("a plain space link still carries no board", invitedPoolId("") === null);

// ── what the invite says ──
// "Pool 1" means nothing to someone who has not joined; the matchup does.
const squaresMsg = inviteMessage({
  pool: { name: "Pool 1", gameType: "squares" },
  config: {
    teamX: "Seattle Seahawks",
    teamY: "New England Patriots",
    pricePerSquare: 10,
    quarterlyPayout: 250,
  },
  squaresLeft: 88,
});
check(
  "a squares invite names the teams, not the board",
  /Seahawks vs New England Patriots/.test(squaresMsg) && !/Pool 1/.test(squaresMsg)
);
check(
  "a squares invite leads with the stakes",
  /\$10 a square/.test(squaresMsg) && /\$250 a quarter/.test(squaresMsg)
);
const pickemMsg = inviteMessage({
  pool: { name: "Week 3", gameType: "pickem" },
  slate: { label: "Week 3", games: new Array(16).fill({}) },
});
check(
  "a pick'em invite describes picks, not squares",
  /picks/i.test(pickemMsg) && !/square/i.test(pickemMsg)
);
check("a pick'em invite warns about the lock", /lock/i.test(pickemMsg));
// A board with nothing configured must still produce a sentence.
check("a bare board still yields a message", inviteMessage({}).length > 0);
check(
  "no undefined leaks into the message",
  !/undefined|NaN|\$0\b/.test(inviteMessage({ pool: {}, config: {} }))
);

// iOS and Android disagree on the separator; the wrong one opens an empty
// composer, which reads as the feature being broken.
check(
  "the SMS link is iOS-shaped on Apple devices",
  smsHref("hi", "iPhone").startsWith("sms:&body=")
);
check(
  "the SMS link is Android-shaped elsewhere",
  smsHref("hi", "Android").startsWith("sms:?body=")
);
check("the SMS body is escaped", smsHref("a b&c", "Android").includes("a%20b%26c"));

console.log(failed === 0 ? "\nAll auth-callback cases pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
