const PURPLE = "#5b46d9";
const INK = "#1a1633";
const MUTED = "#6f6a8d";
const LINE = "#eceaf5";

const escape = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * A player's sheet, as an email.
 *
 * Sent because a sheet is invisible until the first kickoff — picks stay hidden
 * so nobody can copy them — which otherwise leaves the player with no record of
 * what they chose.
 *
 * Two cells per game, the picked side filled. Built as a table with inline
 * styles because that is the only layout email clients agree on: no flex, no
 * grid, no stylesheet.
 */
export function renderPicksEmail({ contestName, playerName, games, picks, tiebreak, spaceCode }) {
  const rows = (games || [])
    .map((game) => {
      const cell = (side, team) => {
        const chosen = picks?.[game.id] === side;
        const label = escape(team?.abbr || team?.name || "?");
        return `<td width="50%" align="center" style="
            padding:12px 6px;
            border:1px solid ${chosen ? PURPLE : LINE};
            border-radius:6px;
            background:${chosen ? PURPLE : "#ffffff"};
            color:${chosen ? "#ffffff" : MUTED};
            font-size:14px;
            font-weight:${chosen ? 800 : 600};
          ">${label}</td>`;
      };
      return `<tr>
          ${cell("away", game.away)}
          <td width="18" align="center" style="font-size:11px;color:#b9b5cc">@</td>
          ${cell("home", game.home)}
        </tr>
        <tr><td colspan="3" height="6"></td></tr>`;
    })
    .join("");

  const picked = (games || []).filter((g) => picks?.[g.id]).length;

  return `<!doctype html>
<html><body style="margin:0;background:#f6f5fb;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:14px;padding:30px 26px;text-align:left">

  <tr><td style="font-size:14px;font-weight:800;letter-spacing:2px;color:${PURPLE};padding-bottom:20px">SQUAREPOOL</td></tr>

  <tr><td style="font-size:21px;font-weight:800;color:${INK};padding-bottom:6px">Your picks are in</td></tr>
  <tr><td style="font-size:14px;line-height:1.6;color:${MUTED};padding-bottom:22px">
    ${escape(playerName)} &middot; ${escape(contestName)} &middot; ${picked} of ${(games || []).length} games
    <br />
    Keep this — everyone's picks stay hidden until the first kickoff, so you can't see them in the app until then.
  </td></tr>

  <tr><td style="padding-bottom:18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>

  ${
    tiebreak == null || tiebreak === ""
      ? ""
      : `<tr><td style="border-top:1px solid ${LINE};padding-top:16px;font-size:13px;color:${MUTED}">
          Tiebreaker &middot; <strong style="color:${INK}">${escape(tiebreak)}</strong>
        </td></tr>`
  }

  <tr><td style="padding-top:18px;font-size:12px;color:#8d88a8;line-height:1.6">
    Submitting again with the same email replaces this sheet, right up until the first kickoff.
  </td></tr>
</table>
<div style="max-width:460px;font-size:11px;color:#8d88a8;padding:16px 6px 0;text-align:left">
  SquarePool &middot; ${escape(spaceCode ? `#${spaceCode}` : "squarepool.app")}
</div>
</td></tr></table>
</body></html>`;
}
