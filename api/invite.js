import { boardPreview } from "./_lib/preview.js";

const escape = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The shareable address for a board: /i/<poolId>.
 *
 * This exists because the app is client-rendered and a space lives in the URL
 * *fragment* — and a fragment is never sent to a server. A crawler asking for
 * `/?b=x#scriberfam` sees only `/?b=x`, and the static index.html it gets back
 * has no idea which board is meant. So previews are served from a path the
 * server can actually read, with the tags already in the HTML; no preview
 * crawler runs JavaScript.
 *
 * Real browsers are bounced straight through to the app.
 */
export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const poolId = url.searchParams.get("b") || "";
  const preview = await boardPreview(poolId);

  const origin = `https://${req.headers.host}`;
  const target = preview.spaceCode
    ? `${origin}/?b=${encodeURIComponent(poolId)}#${preview.spaceCode}`
    : `${origin}/`;

  const title = preview.stat
    ? `${preview.title} — ${preview.stat}`
    : `${preview.title} · SquarePool`;
  const description = preview.tag
    ? `${preview.subtitle} · ${preview.tag}`
    : preview.subtitle;
  const image = `${origin}/api/og?b=${encodeURIComponent(poolId)}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="SquarePool" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(description)}" />
<meta property="og:url" content="${escape(`${origin}/i/${poolId}`)}" />
<meta property="og:image" content="${escape(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escape(preview.title)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escape(title)}" />
<meta name="twitter:description" content="${escape(description)}" />
<meta name="twitter:image" content="${escape(image)}" />

<link rel="canonical" href="${escape(`${origin}/i/${poolId}`)}" />
</head>
<body style="margin:0;background:#0a0a1f;color:#e8e8f5;font-family:system-ui,sans-serif">
<!-- Crawlers stop at the tags above. Anyone with a browser goes to the board.
     replace() rather than assign() so Back doesn't bounce them back here. -->
<script>location.replace(${JSON.stringify(target)});</script>
<div style="padding:40px;text-align:center">
  <p>${escape(preview.title)}</p>
  <p><a href="${escape(target)}" style="color:#a855f7">Open this board</a></p>
</div>
</body>
</html>`);
}
