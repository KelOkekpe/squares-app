# Auth email templates

Paste each file's body into **https://supabase.com/dashboard/project/_/auth/templates**
(Authentication → Emails → Templates). The subject line for each is in the HTML
comment at the top of the file; Supabase asks for it separately.

These are kept here rather than only in the dashboard so they're reviewable and
survive a project rebuild — the dashboard is the only place they actually run.

## Which of these can currently fire

| Template | Wired up in the app? |
|---|---|
| `confirm-signup.html` | **Yes** — `signUpWithEmail` in `src/hooks/useAuth.jsx` |
| `reset-password.html` | **No** — nothing calls `resetPasswordForEmail` yet |
| `magic-link.html` | **No** — nothing calls `signInWithOtp` |

The last two are written and ready, but until the app offers the flow, Supabase
has nothing to trigger them. A user who forgets their password currently has no
route back into their account except signing in with Google.

## Before these reach anyone

The built-in Supabase email service **only delivers to your organisation's team
members** and is capped at 2 messages/hour — everyone else fails with "Email
address not authorized". Custom SMTP has to be configured first, at
`/auth/smtp`, then the hourly limit raised at `/auth/rate-limits`. Raising the
limit first does nothing.

## Why they look plain

Auth email is transactional, and heavy templates are read as marketing by spam
filters. No images (so nothing breaks when images are blocked), no web fonts,
inline styles only, a table-based button so Outlook renders it, and the raw URL
printed underneath for clients that strip the link. The hidden first line is
preheader text — the grey preview line next to the subject in most inboxes.

Variables come from Supabase's template set — only `{{ .ConfirmationURL }}` and
`{{ .Email }}` are used.

`{{ .Data.display_name }}` was deliberately dropped. It resolves from
`auth.users.user_metadata`, which `signUpWithEmail` does populate — but a Google
signup carries no `display_name`, and an empty one renders "Hi , tap below" on
the first email a new organiser ever sees. Guarding it needs a Go-template
conditional, and if the dashboard doesn't evaluate those the raw `{{ if }}`
would print in the email, which is worse than the problem. Not worth the risk
for a greeting.
