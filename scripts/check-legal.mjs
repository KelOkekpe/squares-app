/**
 * The legal pages have two failure modes that a build cannot see.
 *
 * One: /terms parses as a space code. Spaces live in the fragment and sites on
 * the path, but the legacy path-form branch catches any unclaimed segment and
 * redirects it — so a legal page that isn't registered as a route silently
 * becomes a space named "terms". The #features nav bug, again.
 *
 * Two: the operator placeholder ships. A Terms of Service naming
 * PLACEHOLDER_LLC_NAME is worse than none, so this fails loudly once the
 * details are real elsewhere, and warns unmistakably until then.
 */
import { readFileSync } from "node:fs";
import { parseLocation, TERMS_PATH, PRIVACY_PATH } from "../src/utils/routes.js";
import {
  OPERATOR_NAME,
  OPERATOR_STATE,
  SUPPORT_EMAIL,
  legalDetailsSet,
} from "../src/utils/legal.js";

let failed = 0;
const t = (label, cond) => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    console.error(`  FAIL ${label}`);
    failed++;
  }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

// --- routing: a legal page must never resolve to a space ---
for (const [name, path] of [
  ["terms", TERMS_PATH],
  ["privacy", PRIVACY_PATH],
]) {
  const route = parseLocation(path, "");
  t(`${path} resolves to the ${name} page`, route.name === name);
  t(`${path} is not treated as a space`, route.name !== "space" && !route.code);
  t(`${path} does not redirect`, !route.redirectTo);
}
// A trailing fragment must not hijack the page — /terms#somecode is still terms.
t(
  "a stray fragment cannot turn /terms into a space",
  parseLocation(TERMS_PATH, "#scriberfam").name === "terms"
);
// And the legacy behaviour still works for everything else.
t(
  "an unclaimed path is still a legacy space link",
  parseLocation("/scriberfam", "").redirectTo === "/#scriberfam"
);

// --- the App must actually render them ---
const app = strip(read("src/App.jsx"));
t("App renders the terms route", /route\.name === "terms"/.test(app) && /<TermsPage/.test(app));
t(
  "App renders the privacy route",
  /route\.name === "privacy"/.test(app) && /<PrivacyPage/.test(app)
);

// --- the operator placeholder must not reach production ---
const placeholder = !legalDetailsSet();
if (placeholder) {
  console.warn(
    "\n  ⚠  OPERATOR_NAME / OPERATOR_STATE are still placeholders in src/utils/legal.js." +
      "\n     The legal pages render, but must not be advertised until these are real.\n"
  );
}
// Single-sourced, so filling them in is one edit and cannot half-apply.
const stray = ["src/components/legal/TermsPage.jsx", "src/components/legal/PrivacyPage.jsx"].filter(
  (f) => /PLACEHOLDER_/.test(read(f))
);
t("no page hardcodes a placeholder of its own", stray.length === 0);
t(
  "the operator name is read from the shared constant",
  /OPERATOR_NAME/.test(read("src/components/legal/TermsPage.jsx"))
);
t(
  "the governing-law clause is read from the shared constant",
  /OPERATOR_STATE/.test(read("src/components/legal/TermsPage.jsx"))
);

// --- the documents must be reachable and the support address real ---
t("the support address is on our own domain", /@squarepool\.app$/.test(SUPPORT_EMAIL));
const marketing = read("src/components/marketing/MarketingPage.jsx");
t("the marketing footer links to the terms", marketing.includes('href="/terms"'));
t("the marketing footer links to the privacy policy", marketing.includes('href="/privacy"'));
t("the marketing footer offers support", marketing.includes("SUPPORT_EMAIL"));

// --- consent has to sit on every point that creates an obligation ---
const consentPoints = {
  "squares entry": "src/components/join/PaymentStep.jsx",
  "pick'em sheet": "src/components/pickem/PickSheet.jsx",
  "account signup": "src/components/admin/AdminLanding.jsx",
};
for (const [label, file] of Object.entries(consentPoints)) {
  t(`${label} shows the consent line`, /<LegalConsent/.test(strip(read(file))));
}
// The links must open away from a half-filled form.
t(
  "consent links do not navigate the form away",
  /target="_blank"/.test(read("src/components/common/LegalConsent.jsx"))
);

if (failed) {
  console.error(`\ncheck:legal — ${failed} failing`);
  process.exit(1);
}
console.log(
  `\ncheck:legal — legal pages route, render and bind${placeholder ? " (placeholders unset)" : ""}`
);
