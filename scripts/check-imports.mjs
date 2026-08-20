// Catches JSX components that are used but never imported.
//
// Vite doesn't resolve identifiers, so this builds clean and then throws
// "X is not defined" at runtime — in production, on a page nobody tested.
// It has shipped twice, both times because a formatter reshaped an import
// block and a scripted edit silently missed it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../src", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

let failed = 0;
const files = walk(root).filter((f) => f.endsWith(".jsx"));

for (const file of files) {
  const src = readFileSync(file, "utf8");

  const available = new Set();
  // import Foo, { Bar as Baz } from "..."
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["']/g)) {
    const clause = m[1];
    const named = clause.match(/\{([\s\S]*?)\}/);
    if (named) {
      named[1]
        .split(",")
        .map((x) =>
          x
            .trim()
            .split(/\s+as\s+/)
            .pop()
            .trim()
        )
        .filter(Boolean)
        .forEach((n) => available.add(n));
    }
    const def = clause
      .replace(/\{[\s\S]*?\}/, "")
      .replace(/,/g, "")
      .trim();
    if (def && /^[A-Za-z_$][\w$]*$/.test(def)) available.add(def);
  }
  // locally declared components
  for (const m of src.matchAll(/(?:export\s+)?(?:function|const|class)\s+([A-Z][\w$]*)/g)) {
    available.add(m[1]);
  }

  const used = new Set([...src.matchAll(/<([A-Z][\w$]*)/g)].map((m) => m[1].split(".")[0]));

  const missing = [...used].filter((name) => !available.has(name));
  if (missing.length) {
    console.log(`FAIL  ${file.replace(root, "src")} → ${missing.join(", ")}`);
    failed++;
  }
}

console.log(
  failed === 0
    ? `\nAll ${files.length} components resolve — no missing imports.`
    : `\n${failed} file(s) reference components they never import.`
);
process.exit(failed ? 1 : 0);
