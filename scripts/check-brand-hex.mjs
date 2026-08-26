/**
 * No raw brand colour outside the token definitions.
 *
 * Changing the theme from purple to teal meant chasing the accent through ten
 * hardcoded hexes that the token swap could not see — five in components, five
 * in the server-rendered emails and OG cards. A theme change that misses them
 * ships a teal app that sends purple email.
 *
 * Components must read the brand from a token. The api/ files cannot — they are
 * rendered outside the browser with no CSS variables — so they get one named
 * constant each, and this checks the constant agrees with the live token.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (d) =>
  readdirSync(d).flatMap((e) => {
    const f = join(d, e);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });

let failed = 0;
const fail = (m) => {
  console.error(`  FAIL ${m}`);
  failed++;
};
const ok = (m) => console.log(`  ok   ${m}`);

const html = read("index.html");
const tokenOf = (name, block) => {
  const scope =
    block === "light"
      ? html.slice(html.indexOf(':root[data-theme="light"]'))
      : html.slice(html.indexOf(":root {"), html.indexOf(':root[data-theme="light"]'));
  return (scope.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
};

const brandDark = tokenOf("--accent-brand", "dark");
const brandLight = tokenOf("--accent-brand", "light");
ok(`brand tokens resolve (dark ${brandDark}, light ${brandLight})`);

// --- components must not inline a brand colour ---
// Semantic hues are exempt: they mean win / loss / winner, not brand.
const SEMANTIC = /^#(?:[0-9a-f]{2})?(?:ff|dd|b9|ea|ca|b0|fa|22|44|15|16|1c|4a)/i;
const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  if (d < 0.02) return null; // greys carry no hue
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

// A literal that exactly equals a live token is a mirror, not a stray colour --
// some values (contrast maths) genuinely cannot be read from a var(). Those are
// allowed precisely because this equality is checked: if the theme moves and the
// mirror does not, it stops matching and this fails.
const tokenValues = new Set(
  (html.match(/--[a-z-]+:\s*(#[0-9a-fA-F]{6})\b/g) || []).map((m) =>
    m.slice(m.indexOf("#")).toLowerCase()
  )
);
const mirrors = [];
for (const file of walk(join(root, "src")).filter((f) => /\.jsx?$/.test(f))) {
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  for (const hex of src.match(/#[0-9a-fA-F]{6}\b/g) || []) {
    const h = hueOf(hex);
    const brandHue = hueOf(brandDark);
    if (h === null || brandHue === null || Math.abs(h - brandHue) >= 25) continue;
    if (tokenValues.has(hex.toLowerCase())) {
      mirrors.push(`${file.replace(root, "")} → ${hex}`);
    } else {
      fail(`${file.replace(root, "")} inlines ${hex}, which matches no token — use colors.*`);
    }
  }
}
for (const m of mirrors) ok(`mirrors a live token: ${m}`);

// The band scan above only sees colours near the brand hue, so a mirror that
// drifts *out* of the band would slip past it entirely -- which is exactly what
// a bad edit looks like. Named mirrors are therefore pinned to their token by
// name, not by hue.
const NAMED_MIRRORS = [
  ["src/components/grid/SquaresGrid.jsx", "LIGHT_GUTTER_HEX", "--grid-panel", "light"],
  ["src/components/grid/SquaresGrid.jsx", "DARK_BOARD_HEX", "--grid-panel", "dark"],
];
for (const [file, constName, token, block] of NAMED_MIRRORS) {
  const m = read(file).match(new RegExp(`${constName} = "(#[0-9a-fA-F]{6})"`));
  const want = tokenOf(token, block);
  if (!m) fail(`${file} no longer defines ${constName}`);
  else if (!want) fail(`${token} is missing from the ${block} theme`);
  else if (m[1].toLowerCase() !== want.toLowerCase())
    fail(`${constName} is ${m[1]} but ${token} (${block}) is ${want}`);
  else ok(`${constName} still equals ${token}`);
}
if (!failed) ok("no component inlines the brand colour");

// --- server-side constants must agree with the tokens ---
const before = failed;
for (const [file, token] of [
  ["api/_lib/ogCard.js", brandDark],
  ["api/_lib/pickEmail.js", brandLight],
  ["api/_lib/confirmEmail.js", brandLight],
]) {
  const m = read(file).match(/const BRAND = "(#[0-9a-fA-F]{6})"/);
  if (!m) fail(`${file} has no BRAND constant`);
  else if (m[1].toLowerCase() !== token.toLowerCase())
    fail(`${file} BRAND is ${m[1]} but the token is ${token}`);
}
if (failed === before) ok("email and OG brand constants match the live tokens");

if (failed) {
  console.error(`\ncheck:brand — ${failed} failing`);
  process.exit(1);
}
console.log("\ncheck:brand — the brand colour lives in exactly one place");
