import React from "react";
import { colors, fonts } from "../../styles";

export function PrizePotBar({ totalPot, quarterlyPayout }) {
  if (!totalPot && !quarterlyPayout) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 40,
        marginTop: 20,
        padding: "16px 28px",
        background: "#ffffff04",
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
      }}
    >
      {totalPot > 0 && (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            Total Prize Pot
          </div>
          <div
            style={{
              color: colors.accentGreenBright,
              fontSize: 26,
              fontWeight: 800,
              fontFamily: fonts.mono,
              letterSpacing: -1,
            }}
          >
            ${totalPot.toLocaleString()}
          </div>
        </div>
      )}
      {quarterlyPayout > 0 && (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            Quarterly Payout
          </div>
          <div
            style={{
              color: colors.accentYellow,
              fontSize: 26,
              fontWeight: 800,
              fontFamily: fonts.mono,
              letterSpacing: -1,
            }}
          >
            ${quarterlyPayout.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
