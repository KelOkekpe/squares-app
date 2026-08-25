# Email setup

Two separate jobs, on two separate names. Keeping them apart is deliberate —
neither can break the other.

| Job | Name | Provider |
| --- | --- | --- |
| Outbound app mail (tickets, confirmations) | `send.squarepool.app` | Resend, DKIM-only |
| Inbound support mail | `squarepool.app` (root) | ImprovMX forwarding |

`PICKS_FROM_EMAIL` sends from the Resend subdomain. The support address lives on
the root domain, which had no MX records at all before this — so adding them
cannot affect anything Resend is doing.

## Inbound: support@squarepool.app

DNS is on Vercel (`ns1/ns2.vercel-dns.com`), which has no mailbox product, so
inbound needs an outside provider. ImprovMX forwards to an address you already
read, free, and stores no mail of its own.

**1. Create the alias** at improvmx.com — domain `squarepool.app`, alias
`support`, forwarding to your Gmail address.

**2. Add three records** in Vercel → Project → Settings → Domains →
`squarepool.app` → DNS:

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | — |

The SPF record goes on the root only. Do not put it on `send.` — that name is
Resend's and does not want it.

**3. Verify** in the ImprovMX dashboard, then send a test message to
support@squarepool.app and confirm it lands in Gmail. Propagation is usually
minutes on Vercel DNS.

## Replying as support@ (optional)

Forwarding is inbound only, so replies leave from your Gmail address unless you
set up send-as. Two ways:

- **ImprovMX paid plan** — includes SMTP credentials. Simplest, a few dollars a
  month, no extra DNS.
- **Resend SMTP** — free, but Resend must verify the *root* domain before it
  will send as `@squarepool.app`. Today only `send.squarepool.app` is verified.
  Add `squarepool.app` in Resend, publish the DKIM record it gives you, then in
  Gmail → Settings → Accounts → "Send mail as" use `smtp.resend.com`, port 465,
  username `resend`, password = your Resend API key.

Until one of those is done, replying from Gmail still works — the reply just
comes from your personal address.

## Verifying it stayed working

```
dig +short MX squarepool.app                       # the two improvmx hosts
dig +short TXT squarepool.app                      # the SPF include
dig +short TXT resend._domainkey.send.squarepool.app   # Resend's DKIM, untouched
```

The third is the one to watch. If it ever disappears, outbound app mail stops
and the failure is silent — `send-confirmation` returns 200 with a reason.
