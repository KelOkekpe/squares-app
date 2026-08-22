import { listWeeks, seasonYear } from "./_lib/espn.js";

/** The season calendar, so board creation can offer a week picker. */
export default async function handler(req, res) {
  try {
    const year = req.query?.year ? Number(req.query.year) : seasonYear();
    const blocks = await listWeeks(year);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ year, blocks });
  } catch (err) {
    console.error("nfl-weeks error:", err);
    return res.status(502).json({ error: "Could not reach the score provider", blocks: [] });
  }
}
