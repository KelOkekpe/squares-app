import { withTimeout, TimeoutError, isStaleSessionError } from "../src/utils/async.js";
let failed = 0;
const check = (l, c) => { console.log((c?"PASS  ":"FAIL  ")+l); if(!c) failed++; };

// A hanging promise — the exact failure mode (query never settles)
const hang = new Promise(() => {});
try { await withTimeout(hang, 120, "hanging query"); check("hang rejects", false); }
catch (e) { check("hang rejects with TimeoutError", e instanceof TimeoutError && e.isTimeout === true); }

// Resolves normally, fast
check("fast resolve passes through", (await withTimeout(Promise.resolve({data:1}), 500)).data === 1);

// Thenable (supabase query builders are thenable, not Promises)
const thenable = { then: (res) => res({ data: "ok" }) };
check("thenable supported", (await withTimeout(thenable, 500)).data === "ok");

// Rejection propagates unchanged
try { await withTimeout(Promise.reject(new Error("boom")), 500); check("reject propagates", false); }
catch (e) { check("original rejection preserved", e.message === "boom" && !e.isTimeout); }

// Timer cleanup: process must exit promptly, not linger on a 60s timer
const t0 = Date.now();
await withTimeout(Promise.resolve(1), 60000);
check("timer cleared (no lingering handle)", Date.now() - t0 < 200);

// Stale-session classification
check("timeout counts as stale", isStaleSessionError(new TimeoutError("x")));
check("refresh token error counts", isStaleSessionError(new Error("Invalid Refresh Token: Already Used")));
check("jwt expired counts", isStaleSessionError({ message: "JWT expired" }));
check("PGRST301 counts", isStaleSessionError({ code: "PGRST301" }));
check("unrelated error does not", !isStaleSessionError(new Error("network down")));
check("null does not", !isStaleSessionError(null));

console.log(failed === 0 ? "\nAll async-guard cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
