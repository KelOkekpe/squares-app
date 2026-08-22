import { listGames } from "./_lib/espn.js";

/**
 * Games an admin can link a board to, by week or by date. Read-only
 * passthrough of public data, so it needs no auth.
 */
export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const games = await listGames({
      dates: typeof q.dates === "string" ? q.dates.replace(/\D/g, "") : undefined,
      week: q.week ? Number(q.week) : undefined,
      seasonType: q.seasonType ? Number(q.seasonType) : undefined,
      year: q.year ? Number(q.year) : undefined,
    });
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ games });
  } catch (err) {
    console.error("nfl-games error:", err);
    return res.status(502).json({ error: "Could not reach the score provider", games: [] });
  }
}
