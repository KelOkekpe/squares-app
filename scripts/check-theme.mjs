// Verifies the theme wiring: every var() the JS tokens reference must be
// defined in BOTH palettes in index.html. A missing token doesn't error —
// it silently renders as transparent/inherit, which is worse.
import { readFileSync, readdirSync } from "node:fs";
import { contrastRatio } from "../src/utils/colorUtils.js";
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
// Checked per branch: testing the whole file for "bestContrast(" passed even
// with the light branch reverted, because the dark branch still had one.
const axisBody = gridSrc.slice(
  gridSrc.indexOf("const axisCell ="),
  gridSrc.indexOf("const nameSize =")
);
const colourAssignments = [...axisBody.matchAll(/color:\s*([^,\n]+)/g)].map((m) => m[1].trim());
colourAssignments.length >= 2 && colourAssignments.every((c) => c.startsWith("bestContrast("))
  ? pass(`axis numbers are chosen by contrast in all ${colourAssignments.length} branches`)
  : fail(
      `axis numbers ignore contrast in at least one branch (${colourAssignments.join(" | ")}) — a light team colour renders them invisible`
    );

// A preview that draws a different gradient than the board is a lie.
const picker = readFileSync(
  new URL("../src/components/admin/TeamColorSection.jsx", import.meta.url),
  "utf8"
);
/darken\(bg, 0\.25\)/.test(picker)
  ? pass("the colour preview draws the same gradient as the grid")
  : fail("the colour preview's gradient no longer matches the grid");

console.log(failed === 0 ? "\nAll theme cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
