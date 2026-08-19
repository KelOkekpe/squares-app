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
check("/ unaffected", parseLocation("/", "").name === "player");

console.log(failed === 0 ? "\nAll auth-callback cases pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
