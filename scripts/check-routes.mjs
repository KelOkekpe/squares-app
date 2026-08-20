import { parseLocation, isAuthCallbackHash, authErrorFromHash } from "../src/utils/routes.js";

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
check("/ unaffected", parseLocation("/", "").name === "player");

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

console.log(failed === 0 ? "\nAll auth-callback cases pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
