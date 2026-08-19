import { parseStorageKey, POOL_STATE_TYPES } from "../src/utils/storageKeys.js";
import { STORAGE_KEYS, SPACE_META_KEY } from "../src/utils/constants.js";

let failed = 0;
const fail = (msg) => {
  console.log("FAIL  " + msg);
  failed++;
};
const pass = (msg) => console.log("PASS  " + msg);

// The invariant that broke: every key STORAGE_KEYS emits must parse, for both
// pool-id shapes. An unparseable key can't be written — space_code/type are NOT NULL.
const poolIds = {
  uuid: "3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071",
  legacy: "p1739300000000",
};

for (const [shape, poolId] of Object.entries(poolIds)) {
  const keys = STORAGE_KEYS("scriberfam", poolId);
  for (const [name, key] of Object.entries(keys)) {
    const parsed = parseStorageKey(key);
    if (!parsed) {
      fail(`${shape} poolId · STORAGE_KEYS.${name} → "${key}" does not parse`);
    } else if (parsed.type !== name || parsed.space !== "scriberfam" || parsed.pool !== poolId) {
      fail(`${shape} poolId · ${name} parsed wrong: ${JSON.stringify(parsed)}`);
    } else {
      pass(`${shape} poolId · ${name} → type=${parsed.type} space=${parsed.space}`);
    }
  }
}

// Every declared type must be reachable from a real key
const emitted = new Set(Object.keys(STORAGE_KEYS("s", poolIds.uuid)));
for (const t of POOL_STATE_TYPES) {
  if (!emitted.has(t)) fail(`POOL_STATE_TYPES has "${t}" but STORAGE_KEYS never emits it`);
}

// Space-level meta key
const meta = parseStorageKey(SPACE_META_KEY("scriberfam"));
if (!meta || meta.type !== "meta" || meta.space !== "scriberfam" || meta.pool !== "") {
  fail(`meta key parsed wrong: ${JSON.stringify(meta)}`);
} else {
  pass(`meta → type=meta space=${meta.space} pool=""`);
}

// Garbage must not parse
for (const bad of ["fb-space-p1-bogus", "nonsense", "", "fb-space-notapool-board"]) {
  if (parseStorageKey(bad)) fail(`"${bad}" parsed but should not have`);
  else pass(`rejected "${bad}"`);
}

console.log(failed === 0 ? "\nAll storage-key cases pass." : `\n${failed} case(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
