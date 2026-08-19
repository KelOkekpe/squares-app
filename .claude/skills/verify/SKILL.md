---
name: verify
description: Verify changes to squares-app by running the production build and all three check scripts. Use after editing routing, storage keys, async guards, or before committing and pushing.
---

This repo has no test framework. The production build plus three node scripts in `scripts/` are the entire automated safety net, and they are easy to forget individually.

Run all four from the repo root, and do not stop at the first failure — run everything, then report:

```bash
npm run build
npm run check:keys
npm run check:routes
npm run check:async
```

What each one protects:

- **build** — catches missing imports and barrel exports. Vite resolves every module, so a stale export in an `index.js` fails here.
- **check:keys** — asserts every key `STORAGE_KEYS` emits parses, for both UUID and legacy `p123` pool ids. A key whose type is missing from `POOL_STATE_TYPES` is written without `space_code`/`type`, silently rejected by Postgres, and the data is lost with no visible error. This is the one that matters most.
- **check:routes** — asserts Supabase auth fragments (`#access_token=…`, `#error=…`) resolve to the auth route with **no** `redirectTo`, and that real space codes still resolve as spaces. A `redirectTo` here destroys the session tokens before supabase-js reads them.
- **check:async** — asserts the timeout guard rejects hangs, passes through thenables, and clears its timer. These guards are what stop a stale Supabase session from hanging the UI forever.

Report a concise pass/fail per item. On failure, quote the actual output rather than paraphrasing it, and fix the cause rather than loosening the check — each one encodes a bug that already shipped once.

Note this only covers logic and wiring. It cannot verify anything visual, and it does not touch the database, so RLS policy changes and hand-run migrations still need checking in Supabase directly.
