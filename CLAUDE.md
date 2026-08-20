# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` (or `start`) — Vite dev server on port 3000
- `npm run build`
- `npm run check:keys` / `check:routes` / `check:async` — plain node scripts in `scripts/`. There is no test framework; these are the only automated checks. Run all three after touching routing, storage keys, or the async guards.

## Routing: paths are sites, fragments are spaces

```
/            player landing
/admin       admin site (sign in / sign up → dashboard)
/superadmin  superadmin console (superadmin role only)
/#<code>     a space
```

Spaces live in the URL fragment so their codes can never shadow a site path.

Supabase also returns auth results in the fragment (`#access_token=…&type=signup`, `#error=…`). `parseLocation()` in `src/utils/routes.js` therefore checks `isAuthCallbackHash()` **first** and returns with no `redirectTo` — rewriting the URL there destroys the tokens before supabase-js can read them. Legacy `#/<code>` and `/<code>` links are rewritten to `/#<code>`.

## Persisted state: register new keys or writes are silently dropped

All game state is JSON blobs in the `spaces` table, keyed `fb-{spaceCode}-{poolId}-{type}`.

`spaces.space_code` and `spaces.type` are `NOT NULL`. A key whose type is missing from `POOL_STATE_TYPES` (`src/utils/storageKeys.js`) fails to parse, gets written without those columns, and is rejected by Postgres — the error is swallowed into a `console.error` and the data vanishes with no user-visible failure.

**Adding a key to `STORAGE_KEYS` means adding its type to `POOL_STATE_TYPES`.** `npm run check:keys` enforces this.

## Supabase

- Migrations in `supabase/` are run **by hand** in the Supabase SQL Editor. There is no CLI, no `config.toml`, no linked project. Never assume a migration has been applied.
- Functions using `crypt`/`gen_salt` need `SET search_path = public, extensions` — pgcrypto lives in the `extensions` schema on Supabase, not `public`.
- Policies on `space_admins` must not query `space_admins` directly (infinite RLS recursion). Use the `SECURITY DEFINER` helpers `is_space_admin()` / `is_space_owner()`.

## RLS: players are anonymous and cannot write

Players never sign up or sign in. They have **no write access** to `spaces` — entry submission goes through the `submit_entry_request()` RPC, and private-space unlock through `unlock_space()`. Don't add a client-side table write on a player code path; RLS will reject it. Admin writes require space membership.

Entries are gated by admin confirmation: a submission lands in a pending queue and only reaches the board when an admin approves it. The trust boundary is a human, not the database.

Superadmins reach every space via `is_superadmin()`, folded into `is_space_admin()`/`is_space_owner()`. The console at `/superadmin` calls `superadmin_*` RPCs that each re-check the role server-side — the client-side `isSuperadmin` flag is UI only, never the security boundary. Closing an account sets `user_profiles.closed_at`; it does not delete the auth row, because that needs the `service_role` key which cannot ship in a client bundle. "View as" is read-only for the same reason — it never mints a session. The first superadmin must be promoted by hand in the SQL Editor.

## Styling: inline objects only

There are no CSS files. Every style is an inline object, and inline styles beat stylesheet rules — **CSS media queries cannot reach them**. For responsive behavior use `useIsMobile()` from `src/hooks/useMediaQuery.js` and branch the style object. Shared style objects live in `src/styles/shared.js`.

**Theming:** every token in `src/styles/theme.js` resolves to a CSS custom property (`var(--accent-purple)`), and the actual palettes for both themes live in a `<style>` block in `index.html` — that's the source of truth for colour values, inlined so the theme resolves before first paint. Toggling `data-theme` on `<html>` re-themes the app; components never need to know which theme is active.

Two consequences: you **cannot concatenate an alpha suffix** onto a token (`` `${colors.accentGold}30` `` produces invalid CSS now) — add a token to `index.html` instead; and a new token must be defined in **both** palettes or it silently renders as transparent. `npm run check:theme` enforces both. Use `colors.white` only for text on accent-filled buttons; use `colors.headline` for text that must invert.

Note `pageStyle` sets `overflow: hidden`, so anything that overflows horizontally is clipped rather than scrollable.

## Gotchas

- `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and is gitignored. Vite inlines them at **build** time — changing them requires a rebuild, not a restart.
- `.gitignore` excludes `DEPLOYMENT.md`, `SUPABASE_SETUP.md` and `SCHEMA_UPDATE.md`. They exist locally but are not in the repo.
- `README.md` is out of date — it describes "rooms" (now spaces), hash routing, and localStorage persistence (now Supabase). Trust the code over it.
