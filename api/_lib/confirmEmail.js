const PURPLE = "#5b46d9";
const GREEN = "#16a34a";
const INK = "#1a1633";
const MUTED = "#6f6a8d";
const LINE = "#eceaf5";

const escape = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function shell(title, lead, body, footer) {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f5fb;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:14px;padding:30px 26px;text-align:left">
  <tr><td style="font-size:14px;font-weight:800;letter-spacing:2px;color:${PURPLE};padding-bottom:20px">SQUAREPOOL</td></tr>
  <tr><td style="font-size:21px;font-weight:800;color:${INK};padding-bottom:6px">${title}</td></tr>
  <tr><td style="font-size:14px;line-height:1.6;color:${MUTED};padding-bottom:20px">${lead}</td></tr>
  ${body}
  <tr><td style="border-top:1px solid ${LINE};padding-top:16px;font-size:12px;color:#8d88a8;line-height:1.6">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Sent when an admin confirms the money arrived.
 *
 * For squares this is the only time the player learns which squares they own —
 * the grid stores names, so the coordinates are knowable at exactly one moment
 * and nowhere else afterwards. For pick'em it is confirmation that the sheet
 * now counts.
 */
export function renderConfirmationEmail({ kind, playerName, poolName, spaceCode, coords, amount }) {
  const paid = Number(amount) > 0 ? ` of $${Number(amount).toFixed(2)}` : "";

  if (kind === "pickem") {
    return shell(
      "You're in",
      `${escape(playerName)}, your entry${paid} for <strong style="color:${INK}">${escape(poolName)}</strong> is confirmed.`,
      `<tr><td style="padding-bottom:20px">
        <div style="background:#f2fbf5;border:1px solid ${GREEN};border-radius:10px;padding:14px 16px;font-size:14px;color:${INK};line-height:1.6">
          Your sheet now counts in the standings. Results update on their own as games finish.
        </div>
      </td></tr>`,
      `Your picks stay hidden until the first kickoff — the email with your sheet has them.`
    );
  }

  const list = (coords || [])
    .map(
      (c) =>
        `<tr><td align="center" style="padding:10px 4px;border:1px solid ${LINE};border-radius:6px;background:#faf9ff;font-size:15px;font-weight:800;color:${PURPLE};font-family:monospace">${escape(c)}</td></tr>
         <tr><td height="6"></td></tr>`
    )
    .join("");

  return shell(
    "Your squares are yours",
    `${escape(playerName)}, your payment${paid} for <strong style="color:${INK}">${escape(poolName)}</strong> is confirmed and your squares are on the board.`,
    coords?.length
      ? `<tr><td style="padding-bottom:20px">
          <div style="font-size:12px;color:${MUTED};padding-bottom:8px">Your ${coords.length} square${coords.length === 1 ? "" : "s"}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list}</table>
        </td></tr>`
      : `<tr><td style="padding-bottom:20px;font-size:14px;color:${MUTED}">Your squares are on the board.</td></tr>`,
    `Numbers are drawn once the board fills, so check back to see how yours landed.${
      spaceCode ? ` — #${escape(spaceCode)}` : ""
    }`
  );
}

/** The same, as plain text. An HTML-only message scores worse with spam filters. */
export function renderConfirmationText({ kind, playerName, poolName, coords, amount }) {
  const paid = Number(amount) > 0 ? ` of $${Number(amount).toFixed(2)}` : "";
  if (kind === "pickem") {
    return [
      "YOU'RE IN",
      "",
      `${playerName}, your entry${paid} for ${poolName} is confirmed.`,
      "Your sheet now counts in the standings.",
      "",
      "SquarePool",
    ].join("\n");
  }
  return [
    "YOUR SQUARES ARE YOURS",
    "",
    `${playerName}, your payment${paid} for ${poolName} is confirmed.`,
    "",
    ...(coords || []).map((c) => `  ${c}`),
    "",
    "Numbers are drawn once the board fills.",
    "",
    "SquarePool",
  ].join("\n");
}
