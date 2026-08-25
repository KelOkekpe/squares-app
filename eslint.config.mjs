import globals from "globals";

/**
 * Deliberately one rule.
 *
 * This exists because three separate runtime-only failures have shipped from
 * this repo: a component used without being imported, a hook dependency read
 * before its declaration, and a local binding referenced but never declared.
 * Vite resolves none of them — the build succeeds and the page throws.
 *
 * check:imports and check:hooks cover the first two. `no-undef` covers the
 * third, and would have caught all three. Keeping the rule set to exactly that
 * means the check stays instant and never produces a finding anyone has to
 * argue about, which is what makes it worth running before every commit.
 */
export default [
  {
    files: ["src/**/*.{js,jsx}", "api/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { "no-undef": "error" },
  },
];
