import { ImageResponse } from "@vercel/og";
import { ogCard } from "./_lib/ogCard.js";
import { boardPreview } from "./_lib/preview.js";

// Satori and resvg need the edge runtime; this is the only function that does.
export const config = { runtime: "edge" };

/**
 * The link-preview image for a board, at /api/og?b=<poolId>.
 *
 * Unauthenticated on purpose — a preview crawler has no session, and everything
 * here is already visible to anyone holding the invite link. It only ever reads.
 */
export default async function handler(req) {
  const poolId = new URL(req.url).searchParams.get("b");
  const preview = await boardPreview(poolId);

  return new ImageResponse(
    ogCard({
      title: preview.title,
      subtitle: preview.subtitle,
      stat: preview.stat,
      tag: preview.tag,
      logos: preview.logos,
      variant: preview.variant,
    }),
    {
      width: 1200,
      height: 630,
      headers: {
        // Messaging apps cache previews hard and re-fetch rarely, so a long
        // shared cache costs nothing and a short one buys nothing. Squares-left
        // will lag; the board itself is always current.
        "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
