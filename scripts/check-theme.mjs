// Verifies the theme wiring: every var() the JS tokens reference must be
// defined in BOTH palettes in index.html. A missing token doesn't error —
// it silently renders as transparent/inherit, which is worse.
import { readFileSync, readdirSync } from "node:fs";
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

console.log(failed === 0 ? "\nAll theme cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
