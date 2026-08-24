/**
 * What a board looks like from the outside, for link previews.
 *
 * Read over plain fetch rather than supabase-js because this also runs on the
 * edge runtime, and read-only because a preview crawler is anonymous by
 * definition. Everything returned is already visible to anyone holding the
 * link.
 */
import { findTeam } from "../../src/utils/nflTeams.js";

const CDN = "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard";

const GENERIC = {
  title: "Football Squares",
  subtitle: "Run the pool. Skip the paperwork.",
  stat: "",
  tag: "",
  logos: [],
  variant: "squares",
  spaceCode: null,
};

async function query(path) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  return res.json();
}

const money = (n) => `$${Number(n).toLocaleString()}`;

/**
 * A board stores its teams as free text, so the logo comes from the same team
 * table the app uses — full name, city or nickname all resolve.
 */
function logoFor(name) {
  const team = findTeam(name);
  return team ? `${CDN}/${team.abbr.toLowerCase()}.png` : null;
}

export async function boardPreview(poolId) {
  if (!poolId || !/^[0-9a-f-]{36}$/i.test(poolId)) return GENERIC;

  const pools = await query(
    `pools?id=eq.${poolId}&select=id,name,space_code,game_type,archived,deleted_at`
  );
  const pool = pools?.[0];
  // A deleted board must not keep advertising itself.
  if (!pool || pool.deleted_at) return GENERIC;

  const rows = await query(
    `spaces?pool_id=eq.${poolId}&type=in.(admin,slate,participants)&select=type,value`
  );
  const byType = Object.fromEntries((rows || []).map((r) => [r.type, r.value]));
  const cfg = byType.admin || {};
  const slate = byType.slate || null;
  const taken = Array.isArray(byType.participants)
    ? byType.participants.reduce((n, p) => n + (Number(p.squares) || 0), 0)
    : 0;

  if (pool.game_type === "pickem") {
    const games = slate?.games?.length;
    return {
      title: slate?.label || pool.name,
      subtitle: games ? `${games} games · most correct wins` : "Most correct wins",
      stat: "Locks at kickoff",
      tag: "",
      logos: [],
      variant: "pickem",
      spaceCode: pool.space_code,
    };
  }

  const teams = cfg.teamX && cfg.teamY ? `${cfg.teamX} vs ${cfg.teamY}` : pool.name;
  const left = Math.max(0, 100 - taken);
  const prize =
    Number(cfg.quarterlyPayout) > 0
      ? `${money(cfg.quarterlyPayout)} a quarter`
      : Number(cfg.totalPot) > 0
        ? `${money(cfg.totalPot)} pot`
        : Number(cfg.pricePerSquare) > 0
          ? `${money(cfg.pricePerSquare)} a square`
          : "";

  return {
    title: teams,
    subtitle: `Football Squares · #${pool.space_code}`,
    stat: prize,
    tag: left > 0 ? `${left} squares left` : "Board full",
    logos: [logoFor(cfg.teamX), logoFor(cfg.teamY)].filter(Boolean),
    variant: "squares",
    spaceCode: pool.space_code,
  };
}
