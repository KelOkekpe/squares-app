// Catches identifiers used in a hook's dependency array before they're declared.
//
// A dependency array is evaluated immediately, so listing a `const` declared
// further down the component throws "Cannot access 'x' before initialization"
// at runtime. Vite builds it clean and every other check passes — it only
// fails in the browser, on whichever screen renders that component.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const walk = (d) =>
  readdirSync(d).flatMap((e) => {
    const f = join(d, e);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });

const DECL =
  /\b(?:const|let|var)\s+(?:\[([^\]]*)\]|\{([^}]*)\}|([A-Za-z_$][\w$]*))|\bfunction\s+([A-Za-z_$][\w$]*)/g;
const MULTILINE_DEPS = /^[ \t]*\[([^[\]]*)\][ \t]*\r?\n[ \t]*\);/gm;
const INLINE_DEPS = /\},\s*\[([^[\]]*)\]\s*\)/g;

let failed = 0;
const files = walk(root).filter((f) => f.endsWith(".jsx") || f.endsWith(".js"));

for (const file of files) {
  const src = readFileSync(file, "utf8");

  // first declaration offset for every binding in the file
  const declaredAt = new Map();
  for (const m of src.matchAll(DECL)) {
    const names = (m[1] || m[2] || "")
      .split(",")
      .map((x) =>
        x
          .split(":")
          .pop()
          .replace(/=.*/, "")
          .replace(/\.\.\./, "")
          .trim()
      )
      .filter(Boolean)
      .concat([m[3], m[4]].filter(Boolean));
    for (const n of names)
      if (/^[A-Za-z_$][\w$]*$/.test(n) && !declaredAt.has(n)) declaredAt.set(n, m.index);
  }

  const check = (deps, at) => {
    for (const raw of deps.split(",")) {
      const name = raw.trim().split(/[.?[]/)[0].trim();
      if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      const decl = declaredAt.get(name);
      if (decl !== undefined && decl > at) {
        const line = src.slice(0, at).split("\n").length;
        console.log(
          `FAIL  ${file.replace(root, "src")}:${line} → dependency "${name}" is declared later (TDZ)`
        );
        failed++;
      }
    }
  };

  for (const m of src.matchAll(MULTILINE_DEPS)) check(m[1], m.index);
  for (const m of src.matchAll(INLINE_DEPS)) check(m[1], m.index);
}

console.log(
  failed === 0
    ? `\nAll hook dependencies resolve — no use-before-declaration.`
    : `\n${failed} dependency reference(s) declared after use.`
);
process.exit(failed ? 1 : 0);
