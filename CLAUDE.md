# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` (or `start`) — Vite dev server on port 3000
- `npm run build`
- `npm run check:imports` / `check:keys` / `check:routes` / `check:async` / `check:theme` / `check:pools` / `check:deletion` — plain node scripts in `scripts/`. There is no test framework; these are the only automated checks. Run them all before committing.
- `check:hooks` and `check:imports` matter most, because both catch runtime-only failures. A hook dependency array is evaluated immediately, so listing a `const` declared further down the component throws "Cannot access 'x' before initialization" — define callbacks *below* the state they depend on.
- `check:imports`: Vite doesn't resolve identifiers, so a component used without being imported builds clean and throws `X is not defined` at runtime. That has shipped twice.

## Routing: paths are sites, fragments are spaces

```
/            marketing page
/join        player join form (enter a space code)
/admin       admin site (sign in / sign up → dashboard)
/superadmin  superadmin console (superadmin role only)
/#<code>     a space
```

Spaces live in the URL fragment so their codes can never shadow a site path. That's also why `/` could become the marketing page without breaking anything: a shared `/#code` link resolves to the space before the path is ever considered.

Supabase also returns auth results in the fragment (`#access_token=…&type=signup`, `#error=…`). `parseLocation()` in `src/utils/routes.js` therefore checks `isAuthCallbackHash()` **first** and returns with no `redirectTo` — rewriting the URL there destroys the tokens before supabase-js can read them. Legacy `#/<code>` and `/<code>` links are rewritten to `/#<code>`.

## Persisted state: register new keys or writes are silently dropped

All game state is JSON blobs in the `spaces` table, keyed `fb-{spaceCode}-{poolId}-{type}`.

`spaces.space_code` and `spaces.type` are `NOT NULL`. A key whose type is missing from `POOL_STATE_TYPES` (`src/utils/storageKeys.js`) fails to parse, gets written without those columns, and is rejected by Postgres — the error is swallowed into a `console.error` and the data vanishes with no user-visible failure.

**Adding a key to `STORAGE_KEYS` means adding its type to `POOL_STATE_TYPES`.** `npm run check:keys` enforces this.

## Game types

A pool is a **squares board** or a **pick'em contest** (`pools.game_type`). They share the pool model deliberately, so pick'em inherits the 16-active cap, expiry, billing, Past Boards and the board picker rather than needing a parallel set of everything.

Pick'em state lives in two blobs: `slate` (the week's games, **frozen at creation** so a rescheduled game can't move under picks already made) and `picks` (submitted sheets). Grading writes winners back into `slate` from `/api/sync-picks`, polled by viewers exactly like live scores.

Team logos come from ESPN's CDN, on pick'em sheets, standings and the squares grid banners. Nothing stores a logo consistently and none of it is migratable: a pick'em slate is frozen at creation, a squares board linked to a game kept only ESPN's numeric team ids, and an unlinked board holds whatever the admin typed. `teamLogoUrl()` therefore resolves from whatever is present — explicit logo, then abbreviation, id or name via `findTeam()` in `src/utils/nflTeams.js` (city and nickname match too). `<TeamLogo>` removes itself on error rather than leaving a broken-image glyph. Note the grid's Y banner rotates **its text only** — rotating the banner turns the logo on its side.

Sheets are **not** readable off the `spaces` row: `spaces_select` excludes `picks` the same way it excludes `pending`. Players read them through `list_picks()`, which withholds each entry's picks *and* tiebreaker guess until the slate locks — a sheet visible before kickoff is a sheet to copy, and hiding it only in the UI left it one devtools panel away. Standings rows expand to show a sheet, gated on the same `isSlateLocked` that closes submission; never gate that on "something has graded", which would expose the rest of the week the moment one early game went final.

Because the client only ever holds the sanitised list, **admin edits must go through `set_pickem_paid` / `remove_pickem_entry` / `clear_pickem_entries`** — writing the array back would erase everyone's picks. Entrant email and phone live in `pickem_contacts` (admin-only RLS), never in the blob, which keeps only `emailHash` for the one-sheet-per-email rule. `migration_pickem_privacy.sql` moves existing data and is idempotent.

Scoring is in `src/utils/pickem.js`. The tiebreaker is closest-total-without-going-over, and two gaps the plain rule leaves are closed explicitly: if everyone tied goes over, the closest of them still wins; identical guesses fall back to earliest submission. Ungraded games never count, so standings are meaningful mid-week. `npm run check:pickem` covers all of it.

## Board lifecycle

A board is active while it is **neither archived nor past `pools.expires_at`**. Anything else is "completed" — closed to entries but still viewable via Past Boards. `src/utils/poolStatus.js` is the single definition; don't re-derive it with `!p.archived`, which misses expired boards.

Board names are unique **among live boards only** — `unique_pool_name_per_space` is a partial index (`WHERE deleted_at IS NULL AND NOT archived`), not a table constraint. It started as a table-wide constraint, which meant an archived-then-deleted board still owned its name and blocked a new one the admin could neither see nor reach. The cost is that Past Boards may hold two boards with the same name, told apart by their dates, and that **unarchiving can now be refused** if a live board has taken the name — so `updatePool` returns `{ error }`, rolls back its optimistic write, and the admin sees a message instead of a toggle that silently does nothing.

An expiry date is **required** on creation and a space may hold at most **16 active boards**. Both are enforced by a trigger in `migration_pool_lifecycle.sql`, not just the UI, so `createPool` surfaces the database's message verbatim. `npm run check:pools` asserts the JS and SQL agree on the cap.

Which board you're *viewing* is local per-viewer state in `GameBoard`. It must not be written to `spaces` — players are anonymous and have no write access there, so persisting it silently fails for them. The space-wide default still lives in `spaceMeta.activePoolId` and is set from the admin panel only.

## Deleting boards

`spaces.pool_id` is TEXT, `pools.id` is UUID, and there is **no foreign key between them — nothing cascades**. `DELETE FROM pools` therefore deletes a board's label and orphans its payload: grid, participants, pending queue, scores, slate and sheets all survive, unreachable, with entrants' emails and phones in them. Any hard delete must sweep `spaces`, `pickem_contacts` and `entry_request_log` in the same operation. `npm run check:deletion` discovers every table keyed by `pool_id`/`space_code` from the schema and fails if a sweep misses one.

Deletion is two steps. `superadmin_delete_archived_boards()` stamps `pools.deleted_at`; RLS on `pools_select` then hides it from **everyone**, so no client query needs a `deleted_at IS NULL` filter and none can forget one. The policy deliberately has no superadmin exception — one shipped briefly and meant a superadmin browsing their own space still saw deleted boards in Past Boards, so the delete looked broken. The console doesn't need it: its list/restore/purge functions are SECURITY DEFINER and bypass RLS anyway. Nothing is destroyed — `paid`/`paid_at`/`checkout_session_id` are the only record tying a Stripe charge to what it bought. `superadmin_purge_deleted_boards()` is the irreversible half and only reaches boards deleted longer than its retention window (30 days).

`superadmin_stats` and `superadmin_list_spaces` are SECURITY DEFINER and bypass that RLS, so they filter `deleted_at` themselves.

To clear test data before launch, use `supabase/RESET_ALL_DATA.sql` — a one-time wipe of everything, keeping `user_profiles` so you don't lock yourself out. The superadmin actions only ever touch *archived* boards and are the wrong tool for it.

## Smart fill

An undersold board can be completed by handing the empty squares to existing participants in proportion to what they already bought (`src/utils/smartFill.js`). Nobody is charged for the extra squares; the payout drops to the money actually collected, so every dollar paid in keeps the same share of the pot.

It runs **once, automatically, five minutes before kickoff**, from `maybeSmartFill()` inside `/api/sync-scores` — server-side so it happens whether or not anyone has the board open, guarded by `config.smartFilledAt` so it can never run twice. It needs a linked game for the kickoff time; without one the admin runs it by hand.

Two things are easy to get wrong. Payouts must be scaled from the board **before** filling — afterwards it reads as fully sold and the reduction is lost. And proportional shares rarely divide evenly, so leftovers go by largest remainder, with genuine ties broken randomly so the biggest buyer doesn't win every coin-flip. Naive rounding would leave squares unowned, and a winning number there pays nobody. `npm run check:smartfill` covers both.

Payouts scale the admin's configured figures rather than recomputing from price × squares, which preserves any margin they built in.

## Live scores

A board can be linked to a real game (`config.game`), after which quarter scores fill in from ESPN's public scoreboard — free, no key, and isolated in `api/_lib/espn.js` so a provider change touches one file.

ESPN reports points scored *within* each quarter; squares pay on the **cumulative** score, so totals are accumulated. A quarter is only recorded once it has ended (`period - 1`, or all four when final) — recording a quarter still in play would award it to whoever happened to lead mid-drive. Q4 uses the final score so overtime settles there.

Polling runs from whoever has the board open rather than a cron job, since scheduled functions need a paid Vercel tier. `/api/sync-scores` is unauthenticated by design and throttled server-side to 45s per board; it can only ever write the scores row of a board that was explicitly linked to a game.

## Billing

Boards are sold individually at a flat fee — never a share of the pot, which would make this a rake rather than a software sale, and processors treat that as restricted. The platform never touches pool money; players still pay the organiser directly.

`api/` holds the only server-side code: `checkout.js` creates a Stripe session, `stripe-webhook.js` marks the board paid. `api/_lib/*` is `_`-prefixed so Vercel doesn't route it. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must **never** carry a `VITE_` prefix — Vite inlines those into the client bundle, and the service-role key bypasses every RLS policy. `npm run check:api` enforces that plus signature verification, server-side pricing, and replay-safety.

Players pay the organiser through **prefilled deep links** into Venmo, Cash App or PayPal (`src/utils/paymentLinks.js`). The link opens their app with recipient, amount and a reference note filled in; the payment happens there, between two people. **Never route entry fees through this platform** — doing so would make it the rail carrying wagers into a game of chance, which changes both the legal posture and Stripe's classification. `npm run check:payments` asserts every generated link leaves this domain.

`submit_entry_request` has been redefined three times. **`migration_payment_ref.sql` holds the live version**; the copies in `migration_entry_contact.sql` and `migration_billing.sql` are historical. Worth consolidating into one canonical file.

## Supabase

- Migrations in `supabase/` are run **by hand** in the Supabase SQL Editor. There is no CLI, no `config.toml`, no linked project. Never assume a migration has been applied.
- Functions using `crypt`/`gen_salt` need `SET search_path = public, extensions` — pgcrypto lives in the `extensions` schema on Supabase, not `public`.
- Policies on `space_admins` must not query `space_admins` directly (infinite RLS recursion). Use the `SECURITY DEFINER` helpers `is_space_admin()` / `is_space_owner()`.

## RLS: players are anonymous and cannot write

Players never sign up or sign in. They have **no write access** to `spaces` — entry submission goes through the `submit_entry_request()` RPC, and private-space unlock through `unlock_space()`. Don't add a client-side table write on a player code path; RLS will reject it. Admin writes require space membership.

Entry submissions require an email and phone. `submit_entry_request` validates both and uses the email as a rate-limit key — 5/hour per address, 120/hour per space, tracked in `entry_request_log` (which stores an md5, not the address). Payout details and middle initial are optional.

`placeParticipant` returns the cells it filled, because the grid stores only names — approval is the one moment a player's actual squares are knowable. `src/utils/notify.js` turns those into grid coordinates and an approval message.

Entries are gated by admin confirmation: a submission lands in a pending queue and only reaches the board when an admin approves it. The trust boundary is a human, not the database.

Google sign-in is offered on `/admin` only. Google sends no role, so `handle_new_user()` defaults an OAuth signup to `player`; `claim_owner_role()` promotes a genuinely new signup to `owner` server-side, and deliberately skips invited admins (who already have a `space_admins` row) and superadmins. It is an RPC rather than a client-side profile update because `user_profiles` is self-updatable.

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
