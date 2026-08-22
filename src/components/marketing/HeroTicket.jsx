import React from "react";
import { colors, radii, fonts } from "../../styles";

// A believable mid-week sheet: some games settled, some still to play.
const ROWS = [
  { away: "PHI", home: "DAL", pick: "away", result: "win" },
  { away: "KC", home: "BUF", pick: "home", result: "win" },
  { away: "SF", home: "SEA", pick: "away", result: "loss" },
  { away: "GB", home: "MIN", pick: "home", result: "win" },
  { away: "BAL", home: "CIN", pick: "away", result: null },
  { away: "DEN", home: "LAC", pick: "home", result: null },
];

/**
 * The pick'em counterpart to HeroBoard.
 *
 * Shows a sheet part-way through the week — settled picks marked, later games
 * still open — because a fully graded sheet reads as a receipt rather than a
 * game in progress.
 */
export function HeroTicket({ scale = 1 }) {
  const px = (n) => n * scale;

  const chip = (row, side) => {
    const picked = row.pick === side;
    const settled = picked && row.result;
    const won = row.result === "win";

    return {
      flex: 1,
      minWidth: 0,
      textAlign: "center",
      padding: `${px(7)}px 0`,
      borderRadius: px(7),
      fontSize: px(11),
      fontWeight: 800,
      fontFamily: fonts.body,
      background: !picked
        ? colors.surfaceDeep
        : settled
          ? won
            ? colors.pickWinBg
            : colors.pickLossBg
          : `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
      border: `1px solid ${
        !picked
          ? colors.border
          : settled
            ? won
              ? colors.pickWinBorder
              : colors.pickLossBorder
            : "transparent"
      }`,
      color: !picked
        ? colors.textDim
        : settled
          ? won
            ? colors.accentGreenBright
            : colors.accentRed
          : colors.white,
    };
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        style={{
          width: px(300),
          background: colors.surfacePrimary,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: px(20),
          padding: px(14),
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
            borderRadius: px(8),
            padding: `${px(7)}px 0`,
            textAlign: "center",
            color: colors.white,
            fontSize: px(10),
            fontWeight: 900,
            letterSpacing: 2,
            marginBottom: px(9),
          }}
        >
          WEEK 1 PICKS
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: px(5) }}>
          {ROWS.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: px(5) }}>
              <div style={chip(row, "away")}>{row.away}</div>
              <span style={{ color: colors.textDimmest, fontSize: px(9), flexShrink: 0 }}>@</span>
              <div style={chip(row, "home")}>{row.home}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: px(10),
            paddingTop: px(9),
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: colors.accentGold,
              fontSize: px(9),
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            TIEBREAKER
          </span>
          <span style={{ color: colors.textMuted, fontSize: px(11), fontWeight: 700 }}>
            DEN @ KC · <span style={{ color: colors.textPrimary, fontFamily: fonts.mono }}>47</span>
          </span>
        </div>
      </div>

      {/* the payoff, matching HeroBoard's floating result */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: px(-34),
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: px(12),
          background: colors.surfacePrimary,
          border: `1px solid ${colors.pickLeadBorder}`,
          borderRadius: radii.pill,
          padding: `${px(10)}px ${px(18)}px`,
          boxShadow: "var(--shadow-modal)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            background: colors.accentGreenBright,
            color: colors.pageBg,
            borderRadius: radii.pill,
            padding: `${px(2)}px ${px(9)}px`,
            fontSize: px(10),
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          1st
        </span>
        <span style={{ color: colors.textPrimary, fontWeight: 800, fontSize: px(13) }}>
          Dana R. · 12–2
        </span>
        <span style={{ color: colors.accentGreenBright, fontWeight: 800, fontSize: px(13) }}>
          $400
        </span>
      </div>
    </div>
  );
}
