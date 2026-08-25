# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` (or `start`) — Vite dev server on port 3000
- `npm run build`
- `npm run check:imports` / `check:keys` / `check:routes` / `check:async` / `check:theme` / `check:pools` / `check:deletion` — plain node scripts in `scripts/`. There is no test framework; these are the only automated checks. Run them all before committing.
- `check:hooks`, `check:imports` and `check:undef` matter most, because all three catch runtime-only failures — the build succeeds and the page throws. `check:undef` is ESLint with exactly one rule, `no-undef`; it is kept to that so it stays instant and never produces a finding anyone has to argue about. It would have caught all three failures that have shipped from here.
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

Because the client only ever holds the sanitised list, **admin edits must go through `set_pickem_paid` / `remove_pickem_entry` / `clear_pickem_entries`** — writing the array back would erase everyone's picks. Entrant email lives in `pickem_contacts` (admin-only RLS), never in the blob, which keeps only `emailHash` for the one-sheet-per-email rule. `migration_pickem_privacy.sql` moves existing data and is idempotent.

Scoring is in `src/utils/pickem.js`. The tiebreaker is closest-total-without-going-over, and two gaps the plain rule leaves are closed explicitly: if everyone tied goes over, the closest of them still wins; identical guesses fall back to earliest submission. Ungraded games never count, so standings are meaningful mid-week. `npm run check:pickem` covers all of it.

## Invites

Anyone in a space can invite — players fill boards, not just admins. The link is `/?b=<poolId>#<spaceCode>`: the board rides in the **query string** because the fragment already carries the space code, and `parseLocation()` ignores `search` entirely, so it can't collide and won't be stripped by the canonical-URL rewrite. Putting the board in the fragment instead breaks the space code outright — `npm run check:routes` covers it.

Which board you're viewing is otherwise per-viewer state that never reaches the URL, so without this an invite lands people on whatever the admin set as the space default rather than the board the message is about.

**Link previews** are why an invite is `/i/<poolId>` rather than the app URL. The app is client-rendered and a space code lives in the URL **fragment, which is never sent to a server** — a crawler asking for `/?b=x#code` sees only `/?b=x` and a static `index.html`. So `/i/` is a Vercel rewrite to `api/invite.js`, which resolves the board server-side and returns HTML with per-board OG tags, then bounces real browsers on to `/?b=…#code`. No preview crawler runs JavaScript, so the tags must be in the HTML itself. The rewrite must sit **before** the SPA catch-all or the function never runs.

The image comes from `api/og.js` (`@vercel/og`, the only edge-runtime function). `api/_lib/ogCard.js` holds the card as a plain element tree so it can be rendered to a PNG on disk and looked at — Satori supports flex only, and every multi-child node needs an explicit `display: flex`.

There is no way to send a text from a desktop, so the two cases get different primary actions rather than one compromise: phones get the native share sheet (`navigator.share`, which already contains Messages and WhatsApp) with a direct `sms:` link underneath; desktops get copy-to-clipboard plus `mailto:`. The share sheet is used wherever it exists, including recent macOS and Windows. **iOS and Android disagree on the SMS separator** (`sms:&body=` vs `sms:?body=`) — the wrong one opens an empty composer, which reads as the feature being broken.

## The alpha cap

During the alpha, **12 people** may run spaces. The number lives in `app_settings.alpha_max_owners` and is changed with SQL, not a deploy:

```sql
UPDATE app_settings SET value = '100000' WHERE key = 'alpha_max_owners';
INSERT INTO owner_allowlist (email, note) VALUES ('them@example.com', 'why');
```

It caps **organisers, not signups** — one organiser brings 10–30 players, and it's organisers who generate support. Accounts are never blocked; only creating a space is, and invited co-admins don't consume a slot.

Enforced by a trigger on `spaces_registry`, **not** inside `create_space()`. That function only handles *private* spaces — a public one is a direct client insert guarded by RLS — so a check in the function would have missed the larger path. Superadmins, allowlisted addresses, anyone who already owns a space, and any caller with no `auth.uid()` (the service role, the SQL editor, migrations) all pass through. `npm run check:pools` covers each exemption.

## Board lifecycle

A board is active while it is **neither archived nor past `pools.expires_at`**. Anything else is "completed" — closed to entries but still viewable via Past Boards. `src/utils/poolStatus.js` is the single definition; don't re-derive it with `!p.archived`, which misses expired boards.

Board names are unique **among live boards only** — `unique_pool_name_per_space` is a partial index (`WHERE deleted_at IS NULL AND NOT archived`), not a table constraint. It started as a table-wide constraint, which meant an archived-then-deleted board still owned its name and blocked a new one the admin could neither see nor reach. The cost is that Past Boards may hold two boards with the same name, told apart by their dates, and that **unarchiving can now be refused** if a live board has taken the name — so `updatePool` returns `{ error }`, rolls back its optimistic write, and the admin sees a message instead of a toggle that silently does nothing.

**Entries close ten minutes before kickoff** (`DEADLINE_LEAD_MS`). The deadline is **derived, never stored** — `config.game.startsAt` for a squares board, the earliest game in the frozen slate for pick'em — because both are already in the database and a stored copy would drift when a game is rescheduled. `deadlineAt()`/`isPastDeadline()` in `poolStatus.js`; a squares board with no linked game falls back to the end of its expiry date. `NewBoardModal` therefore only asks for a date when there's no kickoff to work from.

A new space arrives **empty**. It used to create a "Pool 1" — an unasked-for Seahawks-vs-Patriots grid the owner had to recognise as a placeholder — and now shows `<EmptySpace>`, which asks squares or pick'em and preselects it in the modal.

An expiry date is **required** on creation and a space may hold at most **16 active boards**. Both are enforced by a trigger in `migration_pool_lifecycle.sql`, not just the UI, so `createPool` surfaces the database's message verbatim. `npm run check:pools` asserts the JS and SQL agree on the cap.

Which board you're *viewing* is local per-viewer state in `GameBoard`. It must not be written to `spaces` — players are anonymous and have no write access there, so persisting it silently fails for them. The space-wide default still lives in `spaceMeta.activePoolId` and is set from the admin panel only.

## Deleting boards

`spaces.pool_id` is TEXT, `pools.id` is UUID, and there is **no foreign key between them — nothing cascades**. `DELETE FROM pools` therefore deletes a board's label and orphans its payload: grid, participants, pending queue, scores, slate and sheets all survive, unreachable, with entrants' email addresses in them. Any hard delete must sweep `spaces`, `pickem_contacts` and `entry_request_log` in the same operation. `npm run check:deletion` discovers every table keyed by `pool_id`/`space_code` from the schema and fails if a sweep misses one.

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

A **score ticker** runs along the bottom of every space view (`GameTicker`), fed by `/api/nfl-games` through `useScoreboard`. It's mounted once in `GameBoard` rather than per view, so home, board and pick'em can't drift and the scoreboard is fetched once. Two details are load-bearing: the game list is rendered **twice** and the animation travels exactly `-50%`, which is what makes the loop seamless; and ESPN reports **0-0 before kickoff**, so scores are suppressed until a game has started. Keyframes are the one thing an inline style object can't express, so `@keyframes sp-ticker` and the `prefers-reduced-motion` rule live in the `<style>` block in `index.html` alongside the theme palettes.

Polling runs from whoever has the board open rather than a cron job, since scheduled functions need a paid Vercel tier. `/api/sync-scores` is unauthenticated by design and throttled server-side to 45s per board; it can only ever write the scores row of a board that was explicitly linked to a game.

## Billing

Boards are sold individually at a flat fee — never a share of the pot, which would make this a rake rather than a software sale, and processors treat that as restricted. The platform never touches pool money; players still pay the organiser directly.

**Coupons must not be restricted by product.** The line item is built from inline `price_data`, which creates an *ad-hoc* product per session rather than referencing anything in the Stripe catalogue — so a coupon with `applies_to` set matches nothing and Checkout says "valid, but doesn't apply to items in your order". Leave Applicable Products empty; there is only one thing to buy. Inline pricing is deliberate: it lets the charge read "Pick'em contest — Week 3" instead of a single static product name, which is what a real Price ID would force.

**Switching Stripe between sandbox and live touches three settings**, not one: `STRIPE_SECRET_KEY`, the webhook *endpoint* (each mode has its own), and that endpoint's `STRIPE_WEBHOOK_SECRET`. Getting one wrong gives the worst failure available — a real payment that succeeds while the board it paid for never activates. `stripeMode()` derives the mode from the key prefix; the webhook refuses any event whose `event.livemode` disagrees with it, and `checkout.js` logs the mode on every session so the answer is in the function logs. An unrecognised key prefix disables the check rather than blocking payments.

`api/` holds the only server-side code: `checkout.js` creates a Stripe session, `stripe-webhook.js` marks the board paid. `api/_lib/*` is `_`-prefixed so Vercel doesn't route it. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must **never** carry a `VITE_` prefix — Vite inlines those into the client bundle, and the service-role key bypasses every RLS policy. `npm run check:api` enforces that plus signature verification, server-side pricing, and replay-safety.

**Both contest types charge, and both collect payout details.** `PayoutPicker` (one method at a time, in `components/join/`) is shared by the squares join step and the pick'em sheet; `PaymentDetailsSection` is shared by both admin panels — it used to sit inside the squares-only branch, so a pick'em admin literally could not say where to pay. A pick'em contest's price is `config.entryFee`; at 0 the payment step doesn't render at all. Payout details go to the admin-only contacts tables, never the readable blob.

**A new board requires a payment handle at creation**, prefilled from whatever the space last used. Without it the first player reaching the payment step is told to go and ask their admin, which is where entries get abandoned.

Players pay the organiser through **prefilled deep links** into Venmo, Cash App or PayPal (`src/utils/paymentLinks.js`). The link opens their app with recipient, amount and a reference note filled in; the payment happens there, between two people. **Never route entry fees through this platform** — doing so would make it the rail carrying wagers into a game of chance, which changes both the legal posture and Stripe's classification. `npm run check:payments` asserts every generated link leaves this domain.

`submit_entry_request` has been redefined three times. **`migration_payment_ref.sql` holds the live version**; the copies in `migration_entry_contact.sql` and `migration_billing.sql` are historical. Worth consolidating into one canonical file.

## Supabase

- Migrations in `supabase/` are run **by hand** in the Supabase SQL Editor. There is no CLI, no `config.toml`, no linked project. Never assume a migration has been applied.
- Functions using `crypt`/`gen_salt` need `SET search_path = public, extensions` — pgcrypto lives in the `extensions` schema on Supabase, not `public`.
- Policies on `space_admins` must not query `space_admins` directly (infinite RLS recursion). Use the `SECURITY DEFINER` helpers `is_space_admin()` / `is_space_owner()`.

## RLS: players are anonymous and cannot write

Players never sign up or sign in. They have **no write access** to `spaces` — entry submission goes through the `submit_entry_request()` RPC, and private-space unlock through `unlock_space()`. Don't add a client-side table write on a player code path; RLS will reject it. Admin writes require space membership.

Entry submissions require an email. **Phone numbers are not collected anywhere** — the field was required and never used, and its only plausible use was SMS, which US carriers block without A2P 10DLC registration that lists gambling as a rejection category. The app also never asked consent to text anyone, so those numbers could not lawfully have been used. `migration_drop_phone.sql` removed the field, the columns and the stored values; `npm run check:deletion` fails if a `type="tel"` input or a phone write reappears. `submit_entry_request` validates it and uses the email as a rate-limit key — 5/hour per address, 120/hour per space, tracked in `entry_request_log` (which stores an md5, not the address). Payout details and middle initial are optional.

Entrant **contact and payout details are never written into the `participants` blob**. That blob is world-readable and cannot be gated — the board draws its names from it — so email, phone and payout handles live in `entry_contacts`, admin-only by RLS, keyed by an `id` now carried on each participant. `migration_entry_privacy.sql` moved the existing ones; its backfill deliberately leaves an entry that already has an id alone, because regenerating would orphan every contact. `npm run check:deletion` fails if the approval path puts any of those fields back.

`placeParticipant` returns the cells it filled, because the grid stores only names — approval is the one moment a player's actual squares are knowable. `src/utils/notify.js` turns those into grid coordinates and an approval message.

Entries are gated by admin confirmation: a submission lands in a pending queue and only reaches the board when an admin approves it.

**Pick'em is gated too, but differently.** The sheet is recorded immediately — picks have to be locked in before kickoff, and holding them in a queue until an admin looked would lose them. What waits is whether the sheet **counts**: `Standings` ranks only `paid` entries when `config.entryFee > 0`, and reports the rest as awaiting confirmation rather than hiding them. A contest with no fee marks entries paid on arrival, decided from the board's own config inside `submit_picks` — reading the fee from the request would let a client declare itself free. `rankEntries` stays payment-blind; the filter belongs to the view, not the rules of the game. The trust boundary is a human, not the database.

**Password recovery** is detected from the `PASSWORD_RECOVERY` auth event, never by reading `type=recovery` from the fragment — supabase-js clears the fragment as soon as it consumes the token, before React renders. The recovery link **signs the user in**, so `App` checks `recovering` ahead of the auth callback and every route; without that they land in the dashboard with the forgotten password still set and are never asked to change it. Cancelling therefore has to sign out. The reset form returns the same message for a known and an unknown address, so it can't be used to enumerate accounts. `npm run check:async` covers all four.

Google sign-in is offered on `/admin` only. Google sends no role, so `handle_new_user()` defaults an OAuth signup to `player`; `claim_owner_role()` promotes a genuinely new signup to `owner` server-side, and deliberately skips invited admins (who already have a `space_admins` row) and superadmins. It is an RPC rather than a client-side profile update because `user_profiles` is self-updatable.

Superadmins reach every space via `is_superadmin()`, folded into `is_space_admin()`/`is_space_owner()`. The console at `/superadmin` calls `superadmin_*` RPCs that each re-check the role server-side — the client-side `isSuperadmin` flag is UI only, never the security boundary. Closing an account sets `user_profiles.closed_at`; it does not delete the auth row, because that needs the `service_role` key which cannot ship in a client bundle. "View as" is read-only for the same reason — it never mints a session. The first superadmin must be promoted by hand in the SQL Editor.

## Styling: inline objects only

There are no CSS files. Every style is an inline object, and inline styles beat stylesheet rules — **CSS media queries cannot reach them**. For responsive behavior use `useIsMobile()` from `src/hooks/useMediaQuery.js` and branch the style object. Shared style objects live in `src/styles/shared.js`.

**Theming:** every token in `src/styles/theme.js` resolves to a CSS custom property (`var(--accent-purple)`), and the actual palettes for both themes live in a `<style>` block in `index.html` — that's the source of truth for colour values, inlined so the theme resolves before first paint. Toggling `data-theme` on `<html>` re-themes the app; components never need to know which theme is active.

Two consequences: you **cannot concatenate an alpha suffix** onto a token (`` `${colors.accentGold}30` `` produces invalid CSS now) — add a token to `index.html` instead; and a new token must be defined in **both** palettes or it silently renders as transparent. `npm run check:theme` enforces both. Use `colors.white` only for text on accent-filled buttons; use `colors.headline` for text that must invert.

**Team banner colours** default to white on black via `DEFAULT_TEAM_COLORS` in `src/utils/constants.js` — one definition, imported by the grid and the colour picker, because the same four hexes used to be written out in all three and could drift. The grid's number gutters keep their team-derived background (`darken(teamBg, 0.5)`), but the digits go through `axisDigitColor()` — the team's colour when it is genuinely light *and* clears 3:1 against that gutter, otherwise white. Painting them in the team's colour unconditionally, as they once were, gave black-on-grey for a white board and near-black-on-near-black for a dark one. The board's cells use `--grid-cell-*` rather than the general page surfaces, which are too close to the page background to read as a grid in the dark.

Note `pageStyle` sets `overflow: hidden`, so anything that overflows horizontally is clipped rather than scrollable.

## Domain

Production is **squarepool.app**, canonical host `www.squarepool.app` — the apex 308-redirects to www. `sqrbet.app` still resolves and serves the same app.

Nothing in the code hard-codes it: the client builds links from `window.location.origin`, and `api/checkout.js` and `api/invite.js` use `req.headers.origin`/`host`. The couplings that *do* need the exact canonical host are all outside the repo — Supabase **Site URL** (which is what `{{ .ConfirmationURL }}` is built from, since `signUp` passes no `redirectTo`) and Supabase's **redirect allowlist** (which `resetPasswordForEmail` and Google sign-in both need, as they pass `redirectTo: origin + "/admin"`).

The `sqrbet-theme` localStorage key keeps its old name deliberately — renaming it would reset the theme for everyone who has already chosen one.

## Gotchas

- `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and is gitignored. Vite inlines them at **build** time — changing them requires a rebuild, not a restart.
- `.gitignore` excludes `DEPLOYMENT.md`, `SUPABASE_SETUP.md` and `SCHEMA_UPDATE.md`. They exist locally but are not in the repo.
- `README.md` is out of date — it describes "rooms" (now spaces), hash routing, and localStorage persistence (now Supabase). Trust the code over it.
