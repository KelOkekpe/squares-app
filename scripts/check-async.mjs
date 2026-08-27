import {
  isClockSkewError,
  withTimeout,
  TimeoutError,
  isStaleSessionError,
} from "../src/utils/async.js";
let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

// A hanging promise — the exact failure mode (query never settles)
const hang = new Promise(() => {});
try {
  await withTimeout(hang, 120, "hanging query");
  check("hang rejects", false);
} catch (e) {
  check("hang rejects with TimeoutError", e instanceof TimeoutError && e.isTimeout === true);
}

// Resolves normally, fast
check(
  "fast resolve passes through",
  (await withTimeout(Promise.resolve({ data: 1 }), 500)).data === 1
);

// Thenable (supabase query builders are thenable, not Promises)
const thenable = { then: (res) => res({ data: "ok" }) };
check("thenable supported", (await withTimeout(thenable, 500)).data === "ok");

// Rejection propagates unchanged
try {
  await withTimeout(Promise.reject(new Error("boom")), 500);
  check("reject propagates", false);
} catch (e) {
  check("original rejection preserved", e.message === "boom" && !e.isTimeout);
}

// Timer cleanup: process must exit promptly, not linger on a 60s timer
const t0 = Date.now();
await withTimeout(Promise.resolve(1), 60000);
check("timer cleared (no lingering handle)", Date.now() - t0 < 200);

// Stale-session classification
check("timeout counts as stale", isStaleSessionError(new TimeoutError("x")));
check(
  "refresh token error counts",
  isStaleSessionError(new Error("Invalid Refresh Token: Already Used"))
);
check("jwt expired counts", isStaleSessionError({ message: "JWT expired" }));
check("PGRST301 counts", isStaleSessionError({ code: "PGRST301" }));
check("unrelated error does not", !isStaleSessionError(new Error("network down")));
check("null does not", !isStaleSessionError(null));

// A slow response must never cost someone their session. Returning from an
// external redirect (Stripe Checkout) is slow by nature, and treating that as a
// bad session logged the admin out every time they paid.
import { isUnusableSessionError } from "../src/utils/async.js";
const timeout = new TimeoutError("auth session timed out");
const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
check("a timeout does not justify clearing credentials", !isUnusableSessionError(timeout));
check("an abort does not justify clearing credentials", !isUnusableSessionError(aborted));
check(
  "an explicit refresh-token rejection does",
  isUnusableSessionError(new Error("Invalid Refresh Token: Already Used"))
);
check("a null error does not", !isUnusableSessionError(null));
check("timeouts still trigger a query retry", isStaleSessionError(timeout));

// A background refresh must not gate the UI: GameBoard blanks the screen on
// registryLoading, so a focus-triggered reload would replace the board with
// "Checking access…" every time the tab regained focus.
import { readFileSync as rf } from "node:fs";
const registry = rf(new URL("../src/hooks/useSpacesRegistry.js", import.meta.url), "utf8");
check("registry supports a silent refresh", /silent\s*=\s*false/.test(registry));
check("silent refresh skips the loading flag", /if \(!silent\) setLoading\(true\)/.test(registry));
check(
  "the focus handler uses the silent path",
  /visibilityState === "visible"\) refreshQuietly\(\)/.test(registry)
);

// Returning to a tab must not blank the page.
//
// supabase-js refreshes the token whenever a tab regains focus and fires
// onAuthStateChange with a fresh object for the same person. Passing that down
// changes identity for every consumer, re-running their queries and dropping
// the user behind a loading gate — which read as "extremely long load times"
// on tab return.
const nextUser = (prev, authUser) =>
  authUser ? (prev?.id === authUser.id ? prev : authUser) : null;

const a1 = { id: "u1" },
  a2 = { id: "u1" },
  b = { id: "u2" };
check("a token refresh keeps the same user object", nextUser(a1, a2) === a1);
check("a different user does replace it", nextUser(a1, b) === b);
check("sign-out clears to null", nextUser(a1, null) === null);
check("signing in from nothing sets the user", nextUser(null, a1) === a1);

const auth = rf(new URL("../src/hooks/useAuth.js".replace(".js", ".jsx"), import.meta.url), "utf8");
check(
  "useAuth keeps user identity stable across refreshes",
  /prev\?\.id === authUser\.id \? prev : authUser/.test(auth)
);
check(
  "useAuth skips refetching a profile it already holds",
  /profileForRef\.current !== authUser\.id/.test(auth)
);

const userSpaces = rf(new URL("../src/hooks/useUserSpaces.js", import.meta.url), "utf8");
check(
  "useUserSpaces only gates on the first load",
  /if \(!hasLoadedRef\.current\) setLoading\(true\)/.test(userSpaces)
);

const gameBoard = rf(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
check(
  "the access gate resolves once rather than per request",
  /!accessResolved && \(registryLoading \|\| userSpacesLoading\)/.test(gameBoard)
);

// ── password recovery ──
// A recovery link signs the user in before anything renders. The two ways to
// get this wrong are both silent.
// Comments are stripped before matching. A check that greps raw source finds
// the comment explaining why a thing is NOT done and concludes it is.
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const readSrc = (rel) => stripComments(rf(new URL(rel, import.meta.url), "utf8"));
const app = readSrc("../src/App.jsx");
const screen = readSrc("../src/components/admin/ResetPasswordScreen.jsx");
const landing = readSrc("../src/components/admin/AdminLanding.jsx");

// 1. Detecting recovery by reading the fragment is a race — supabase-js clears
//    it as soon as it consumes the token, before React renders.
check(
  "recovery is detected from the PASSWORD_RECOVERY event",
  /event === "PASSWORD_RECOVERY"/.test(auth)
);
check(
  "recovery is not detected by parsing the fragment",
  !/type=recovery|type === "recovery"/.test(auth + app)
);

// 2. The link already granted a session, so if the recovery screen doesn't win
//    the routing race the user lands in the dashboard with the password they
//    have forgotten still set — and never gets asked to change it.
const recoveryAt = app.indexOf("if (recovering)");
const callbackAt = app.indexOf('route.name === "auth"');
const adminAt = app.indexOf('route.name === "admin"');
check("the recovery screen is routed at all", recoveryAt !== -1);
check(
  "recovery is checked before the auth callback and the dashboard",
  recoveryAt !== -1 && recoveryAt < callbackAt && recoveryAt < adminAt
);

// 3. Leaving without setting one must not leave them signed in.
check("cancelling recovery signs out", /endRecovery\(\);\s*signOut\(\);/.test(screen));

// 4. A different message for a known and unknown address turns the reset form
//    into a way to enumerate who has an account.
check(
  "the reset request does not disclose whether an account exists",
  /If \$\{sentTo\} has an account/.test(landing) && !/no account|not found/i.test(landing)
);

// ── signing up an address that already exists ──
// Supabase does not error on a taken address. It returns a success-shaped
// response with an empty identities array, so the form can't be used to find
// out who has an account — and sends no confirmation email. Reporting that as
// "Account created" left people waiting for mail that was never sent.
const authSrc = readSrc("../src/hooks/useAuth.jsx");
check(
  "an already-registered signup is detected from empty identities",
  /identities\.length === 0/.test(authSrc)
);
check("it is reported as a flag, not an error", /alreadyRegistered: true/.test(authSrc));
// Naming which case happened would undo the obfuscation Supabase is doing.
check(
  "the signup message does not reveal whether the account existed",
  !/already (has|have) an account\b.*\bsign in instead/i.test(landing) ||
    /Check your inbox/.test(landing)
);
check(
  "an unconfirmed signup can be resent",
  /auth\.resend\(/.test(authSrc) && /handleResend/.test(landing)
);

// ── a token dated ahead of the database clock ──
// PostgREST checks the iat claim against Postgres's own now(), so a freshly
// minted token can arrive fractionally "in the future" and be refused. It
// matched neither session predicate, so nothing retried and the raw message
// reached the superadmin console as a dead end.
const skew = { message: "JWT issued at future" };
check("a future-dated token is recognised as clock skew", isClockSkewError(skew));
check("clock skew is retry-worthy", isStaleSessionError(skew));
// The distinction that matters: two clocks disagreeing by a fraction of a
// second must never cost someone their session.
check("clock skew never discards the session", !isUnusableSessionError(skew));
check("an expired jwt still discards it", isUnusableSessionError({ message: "jwt expired" }));
check(
  "an unrelated failure is not mistaken for skew",
  !isClockSkewError({ message: "permission denied" })
);

const superSrc = readSrc("../src/hooks/useSuperAdmin.js");
check("the superadmin console retries a skewed token", /isClockSkewError\(err\)/.test(superSrc));
check(
  "and rethrows anything else untouched",
  /if \(!isClockSkewError\(err\)\) throw err;/.test(superSrc)
);
// One retry, not a loop -- a persistently wrong clock must surface, not hang.
check(
  "it retries once rather than looping",
  (superSrc.match(/await once\(\)/g) || []).length === 2
);
check(
  "a persistent skew explains itself",
  /sign out and back in/.test(superSrc) && /clock is set automatically/.test(superSrc)
);

console.log(failed === 0 ? "\nAll async-guard cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
