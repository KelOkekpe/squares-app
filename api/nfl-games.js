import { listGames } from "./_lib/espn.js";

/**
 * Games an admin can link a board to. Read-only passthrough of public data,
 * so it needs no auth — it exposes nothing this app owns.
 */
export default async function handler(req, res) {
  try {
    const dates = typeof req.query?.dates === "string" ? req.query.dates.replace(/\D/g, "") : "";
    const games = await listGames(dates || undefined);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ games });
  } catch (err) {
    console.error("nfl-games error:", err);
    return res.status(502).json({ error: "Could not reach the score provider", games: [] });
  }
}
