// Payment deep links open the organiser's own app — the money never touches
// this platform, which is the whole basis for not being a gambling operator.
// These assert the links are well-formed and that nothing routes through us.
import { readFileSync } from "node:fs";
import {
  buildPaymentLink,
  buildPaymentNote,
  buildSquaresNote,
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

// ── the squares memo ──
// The generated reference is gone from the squares flow. It was unambiguous and
// meaningless: an organiser scrolling their Venmo feed had to come back to the
// app to learn who K7M2QX was. A name and a count match the pending list on
// sight.
check(
  "the memo reads exactly as asked",
  buildSquaresNote({ playerName: "John Jones", squares: 5 }) === "John Jones - 5 squares"
);
check(
  "one square is not pluralised",
  buildSquaresNote({ playerName: "John Jones", squares: 1 }) === "John Jones - 1 square"
);
check(
  "no count yet leaves just the name",
  buildSquaresNote({ playerName: "John Jones", squares: 0 }) === "John Jones"
);
check(
  "no name produces nothing rather than a stray hyphen",
  buildSquaresNote({ playerName: "", squares: 5 }) === ""
);
check(
  "surrounding whitespace is trimmed",
  buildSquaresNote({ playerName: "  Jay O  ", squares: 12 }) === "Jay O - 12 squares"
);
check(
  "the memo avoids characters that encode badly",
  !/[—–]/.test(buildSquaresNote({ playerName: "John Jones", squares: 5 }))
);
{
  // Compared after decoding, not as a substring: the link builds its query with
  // URLSearchParams, which writes spaces as "+" rather than "%20". Asserting on
  // one encoding would fail on a change that is invisible to the payment app.
  const memo = buildSquaresNote({ playerName: "John Jones", squares: 5 });
  const link = buildPaymentLink("venmo", "@kel-okekpe", 50, memo);
  const got = new URL(link).searchParams.get("note");
  check("the memo is prefilled into the payment link", got === memo);
}

const gb = readFileSync(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
const step = readFileSync(
  new URL("../src/components/join/PaymentStep.jsx", import.meta.url),
  "utf8"
);
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
check("squares no longer generates a reference", !/paymentRef/.test(strip(gb)));
check("nor sends one with the entry", !/paymentRef/.test(strip(gb)));
check(
  "the squares memo builder is the one used",
  /buildSquaresNote\(\{ playerName: fullName, squares: squaresForAmount \}\)/.test(strip(gb))
);
check("the payment step no longer explains a reference", !/Reference/.test(strip(step)));
check("it tells the buyer what to put in the memo", /in the memo so/.test(strip(step)));
check("and shows them the actual string", /\{note\}/.test(strip(step)));
check("the boilerplate disclaimer is gone", !/aren't reserved in the meantime/.test(strip(step)));
// Pick'em still uses the reference form, so its builder must survive intact.
check(
  "pick'em's reference note is untouched",
  /Ref K7M2QX/.test(buildPaymentNote({ playerName: "x", poolName: "y", ref: "K7M2QX" }))
);

console.log(failed === 0 ? "\nAll payment-link cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
