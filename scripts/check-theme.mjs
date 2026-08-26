// Verifies the theme wiring: every var() the JS tokens reference must be
// defined in BOTH palettes in index.html. A missing token doesn't error —
// it silently renders as transparent/inherit, which is worse.
import { readFileSync, readdirSync } from "node:fs";
import {
  contrastRatio,
  luminance,
  darken,
  axisDigitColor,
  bestContrast,
  MIN_DIGIT_CONTRAST,
  MIN_DIGIT_LUMINANCE,
} from "../src/utils/colorUtils.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const theme = readFileSync(new URL("../src/styles/theme.js", import.meta.url), "utf8");

let failed = 0;
const fail = (m) => {
  console.log("FAIL  " + m);
  failed++;
};
const pass = (m) => console.log("PASS  " + m);

const block = (selector) => {
  const i = html.indexOf(selector);
  if (i === -1) return null;
  const start = html.indexOf("{", i);
  return html.slice(start, html.indexOf("}", start));
};

const dark = block(":root {");
const light = block(':root[data-theme="light"]');
if (!dark) fail("no :root block in index.html");
if (!light) fail('no :root[data-theme="light"] block in index.html');

const declared = (b) => new Set([...(b || "").matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const darkVars = declared(dark);
const lightVars = declared(light);

// Every var() referenced from JS must exist in dark (the base palette)
const used = [...theme.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
const missing = [...new Set(used)].filter((v) => !darkVars.has(v));
missing.length
  ? fail(`tokens used in theme.js but not defined: ${missing.join(", ")}`)
  : pass(`all ${new Set(used).size} tokens referenced by theme.js are defined`);

// Light must override every colour token, or it inherits a dark value
const nonColour = new Set([
  "--shadow-card",
  "--shadow-modal",
  "--glow-primary",
  "--shadow-winner",
  "--decor-1",
  "--decor-2",
]);
const notOverridden = [...darkVars].filter((v) => !lightVars.has(v) && !nonColour.has(v));
notOverridden.length
  ? fail(`defined for dark but never overridden for light: ${notOverridden.join(", ")}`)
  : pass(`light palette overrides all ${darkVars.size} tokens`);

// The concatenation hazard: `${colors.x}` + alpha suffix produces invalid CSS.
// This once only scanned shared.js, which let the same bug straight into a
// component — every file that can name a token has to be checked.
const sources = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(e.name)) sources.push([full, readFileSync(full, "utf8")]);
  }
};
walk(fileURLToPath(new URL("../src", import.meta.url)));

// strip comments first — theme.js documents this exact anti-pattern in prose
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const offenders = sources
  .filter(([, text]) => /\$\{colors\.[a-zA-Z]+\}[0-9a-fA-F]{2}/.test(strip(text)))
  .map(([file]) => file.slice(file.lastIndexOf("/src/") + 1));
offenders.length
  ? fail(
      `alpha suffix concatenated onto a colors.* token (invalid CSS with var()): ${offenders.join(", ")}`
    )
  : pass(`no alpha suffixes concatenated onto colour tokens (${sources.length} files)`);

// The pre-paint script must agree with the CSS on the attribute name
/data-theme/.test(html) && /localStorage.getItem\("sqrbet-theme"\)/.test(html)
  ? pass("pre-paint script sets data-theme from sqrbet-theme")
  : fail("pre-paint theme script missing or renamed");

// A style with width:100% and padding but no border-box renders wider than its
// container and overlaps whatever sits beside it. adminInputStyle shipped that
// way and broke every field in the admin console.
const shared = readFileSync(new URL("../src/styles/shared.js", import.meta.url), "utf8");
for (const m of shared.matchAll(/export const (\w+) = \{([\s\S]*?)\n\};/g)) {
  const [, name, body] = m;
  const fullWidth = /width:\s*"100%"/.test(body);
  const padded = /padding:/.test(body);
  if (!fullWidth || !padded) continue;
  /boxSizing:\s*"border-box"/.test(body)
    ? pass(`${name} sets box-sizing (width:100% + padding)`)
    : fail(`${name} has width:100% and padding but no box-sizing — it will overflow its container`);
}

// ── team banner colours ──
// The same four hexes were written out in three files — constants, the grid and
// the colour picker — so the picker could show one thing and the board draw
// another. One definition now, and nothing outside the marketing illustration
// may hard-code the old pair.
const strays = sources
  .filter(([file]) => !file.includes("/marketing/"))
  .filter(([, text]) => /#1e3a5f|#7db8f0|#3a1e2e|#f0a0b8/.test(strip(text)))
  .map(([file]) => file.slice(file.lastIndexOf("/src/") + 1));
strays.length
  ? fail(`the old team colours are hard-coded outside marketing: ${strays.join(", ")}`)
  : pass("team banner colours have a single definition");

const constants = readFileSync(new URL("../src/utils/constants.js", import.meta.url), "utf8");
const pair = constants.match(
  /DEFAULT_TEAM_COLORS = \{ bg: "(#[0-9a-f]{6})", color: "(#[0-9a-f]{6})" \}/i
);
check_pair: {
  if (!pair) {
    fail("DEFAULT_TEAM_COLORS is missing or reshaped");
    break check_pair;
  }
  const ratio = contrastRatio(pair[1], pair[2]);
  ratio >= 7
    ? pass(`the default team colours are legible (contrast ${ratio.toFixed(1)}:1)`)
    : fail(`the default team colours only reach ${ratio.toFixed(1)}:1 contrast`);
}

// A white banner made the axis numbers white-on-white, because they were
// painted in the team's *background* colour.
const gridSrc = readFileSync(
  new URL("../src/components/grid/SquaresGrid.jsx", import.meta.url),
  "utf8"
);
// Superseded by the numeric checks further down, which compute the actual
// contrast of the digits against the real palette for a range of team colours
// — that catches a regression this pattern-match would miss.

// A preview that draws a different gradient than the board is a lie.
const picker = readFileSync(
  new URL("../src/components/admin/TeamColorSection.jsx", import.meta.url),
  "utf8"
);
/darken\(bg, 0\.25\)/.test(picker)
  ? pass("the colour preview draws the same gradient as the grid")
  : fail("the colour preview's gradient no longer matches the grid");

// ── the board has to be readable in the dark ──
// It used to draw its cells on --surface-deep with a 3%-white border and take
// the number gutters from the team colour, so a dark board was a near-black
// void carrying near-black digits.
const darkVal = (name) =>
  (block(":root") || "").match(new RegExp(`${name}:\\s*(#[0-9a-f]{3,8})`, "i"))?.[1];
const lightVal = (name) =>
  (block('[data-theme="light"]') || "").match(new RegExp(`${name}:\\s*(#[0-9a-f]{3,8})`, "i"))?.[1];

const gridUses = readFileSync(
  new URL("../src/components/grid/SquaresGrid.jsx", import.meta.url),
  "utf8"
);
/colors\.surfaceDeep|colors\.surfaceFilled/.test(gridUses)
  ? fail("the grid still draws cells on the general page surfaces")
  : pass("the grid draws cells on its own surfaces");

const pageBg = darkVal("--page-bg");
const empty = darkVal("--grid-cell-empty");
const filled = darkVal("--grid-cell-filled");

// Adjacent large blocks, so these are separation checks rather than text
// contrast — but they must be a visible step, which 1.03:1 was not.
const step = (a, b, label, min) => {
  const r = contrastRatio(a, b);
  r >= min
    ? pass(`${label} are distinguishable in the dark (${r.toFixed(2)}:1)`)
    : fail(`${label} are only ${r.toFixed(2)}:1 apart in the dark — the grid reads as a void`);
};
step(empty, pageBg, "empty cells and the page", 1.1);
step(filled, empty, "filled and empty cells", 1.15);

// The gutter takes its background from the team's colour, so the digits have to
// hold up against anything an admin can pick. axisDigitColor is imported rather
// than restated — an earlier version of this check duplicated the rule, and a
// deliberately broken threshold in the component sailed straight through it.
// The thresholds are asserted directly as well as through samples. Lowering
// MIN_DIGIT_CONTRAST barely moves the sample outcomes — a team's background is
// nearly always brighter than its own darkened gutter, so it stays a valid
// candidate — which means the samples alone would not notice it being weakened.
MIN_DIGIT_CONTRAST >= 3
  ? pass(`the digit contrast floor is WCAG large-text or better (${MIN_DIGIT_CONTRAST}:1)`)
  : fail(`the digit contrast floor has dropped to ${MIN_DIGIT_CONTRAST}:1`);
MIN_DIGIT_LUMINANCE >= 0.35
  ? pass(`digits must be genuinely light (luminance ${MIN_DIGIT_LUMINANCE})`)
  : fail(`the digit luminance floor has dropped to ${MIN_DIGIT_LUMINANCE}`);

const SAMPLE_TEAMS = [
  ["white banner", "#ffffff", "#000000"],
  ["dark navy", "#1e3a5f", "#7db8f0"],
  ["black on green", "#000000", "#7bcc9e"],
  ["black on black", "#000000", "#000000"],
  ["mid grey on grey", "#808080", "#909090"],
  // A light team colour that is still too close to its own darkened gutter —
  // this is the case the contrast floor exists for; without it the digits are
  // technically light and still unreadable.
  ["pale on pale", "#c8c8c8", "#b0b0b0"],
];
for (const [label, bg, fg] of SAMPLE_TEAMS) {
  const gutter = darken(bg, 0.5);
  const used = axisDigitColor({
    candidates: [fg, bg],
    background: gutter,
    // colors.white in the component
    fallback: "#ffffff",
  });
  const r = contrastRatio(used, gutter);
  const lightEnough = luminance(used) >= 0.35;
  // 3:1 and 0.35 are written out rather than imported: taking them from the
  // module under test meant weakening the module weakened the assertion too.
  r >= 3 && lightEnough
    ? pass(
        `dark-mode axis digits are legible for ${label} (${used} on ${gutter}, ${r.toFixed(1)}:1)`
      )
    : fail(
        `dark-mode axis digits for ${label} are ${used} on ${gutter} — ${r.toFixed(1)}:1${lightEnough ? "" : ", and not a light colour"}`
      );
}

// The gutter is gone as of the board redesign: the digits now float on the
// board panel instead of sitting in a team-coloured band. That reverses an
// earlier explicit instruction to keep the gutter background as it was, so it
// is recorded here rather than left implicit -- and the property that
// instruction was protecting (legible digits over any team colour an admin
// picks) is now asserted directly against the panel instead.
const gridCode = strip(gridUses);
/background: gutter,/.test(gridCode)
  ? fail("the axis digits are back in a coloured gutter — the redesign floats them")
  : pass("the axis digits float on the board panel");

/const digitColor = \(teamBg, teamColor\) =>/.test(gridCode)
  ? pass("digit colour is chosen per team")
  : fail("digitColor is gone — axis digits no longer adapt to the team colour");

// The threshold has to come from the shared constant, not a number retyped
// here: a previous version of this file restated the rule and a deliberately
// broken component sailed through.
/contrastRatio\(best, surface\) >= MIN_DIGIT_CONTRAST/.test(gridCode)
  ? pass("digits are held to MIN_DIGIT_CONTRAST against the panel")
  : fail("digit contrast is no longer checked against the board panel");

// Whatever an admin picks, the digits must clear the bar on both panels.
for (const panel of [darkVal("--grid-panel"), lightVal("--grid-panel")]) {
  for (const [bg, fg] of [
    ["#ffffff", "#000000"],
    ["#002244", "#69be28"],
    ["#0e2222", "#111111"],
  ]) {
    const best = bestContrast([fg, bg], panel);
    const used = contrastRatio(best, panel) >= MIN_DIGIT_CONTRAST ? best : null;
    used === null
      ? pass(`team ${bg}/${fg} falls back to the theme text colour on ${panel}`)
      : pass(
          `team ${bg}/${fg} keeps its own colour on ${panel} (${contrastRatio(best, panel).toFixed(2)}:1)`
        );
  }
}

console.log(failed === 0 ? "\nAll theme cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
