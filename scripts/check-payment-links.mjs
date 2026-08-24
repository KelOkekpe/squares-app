// Payment deep links open the organiser's own app — the money never touches
// this platform, which is the whole basis for not being a gambling operator.
// These assert the links are well-formed and that nothing routes through us.
import { readFileSync } from "node:fs";
import {
  buildPaymentLink,
  buildPaymentNote,
  generatePaymentRef,
  configuredProviders,
  PAYMENT_PROVIDERS,
} from "../src/utils/paymentLinks.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const note = buildPaymentNote({ playerName: "Joe Q. Okekpe", poolName: "Pool 2", ref: "K7M2QX" });
check("note carries pool, player and reference", /Pool 2.*Joe Q\. Okekpe.*K7M2QX/.test(note));
check("note avoids characters that encode badly", !/[—–]/.test(note));

const venmo = buildPaymentLink("venmo", "@kel-okekpe", 40, note);
check(
  "venmo strips the leading @",
  venmo.includes("recipients=kel-okekpe") && !venmo.includes("%40kel")
);
check("venmo carries the amount", venmo.includes("amount=40.00"));
check("venmo carries the note", venmo.includes("K7M2QX"));
check("venmo defaults to a private audience", venmo.includes("audience=private"));

check(
  "cashapp normalises a $cashtag",
  buildPaymentLink("cashapp", "$hook", 40) === "https://cash.app/$hook/40.00"
);
check(
  "cashapp accepts a bare tag",
  buildPaymentLink("cashapp", "hook", 40) === "https://cash.app/$hook/40.00"
);
check(
  "paypal strips a full URL",
  buildPaymentLink("paypal", "https://paypal.me/kel", 40) === "https://paypal.me/kel/40.00"
);
check("zelle has no link format", buildPaymentLink("zelle", "kel@example.com", 40) === null);
check("a blank handle yields no link", buildPaymentLink("venmo", "   ", 40) === null);
check("a zero amount still links", buildPaymentLink("venmo", "kel", 0, note) !== null);

check(
  "only configured providers are offered",
  configuredProviders({ venmo: "@kel", cashapp: "" })
    .map((p) => p.key)
    .join() === "venmo"
);
check("no handles means no buttons", configuredProviders({}).length === 0);

const refs = new Set(Array.from({ length: 500 }, generatePaymentRef));
check(
  "references are 6 chars, unambiguous alphabet",
  [...refs].every((r) => /^[A-HJ-NP-Z2-9]{6}$/.test(r))
);
check("references rarely collide", refs.size > 495);

// Every link must point at the provider's own domain — never ours.
const ours = ["squarepool.app", "sqrbet.app", "/api/", "localhost"];
for (const p of PAYMENT_PROVIDERS) {
  const link = buildPaymentLink(p.key, "someone", 25, note);
  if (!link) continue;
  check(`${p.key} link leaves this platform entirely`, !ours.some((o) => link.includes(o)));
}

// And no client code may create a charge against a player.
const src = readFileSync(
  new URL("../src/components/join/PaymentStep.jsx", import.meta.url),
  "utf8"
);
check("the payment step never calls our checkout endpoint", !src.includes("/api/checkout"));

console.log(failed === 0 ? "\nAll payment-link cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
