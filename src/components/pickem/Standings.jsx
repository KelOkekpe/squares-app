import React from "react";
import { colors, radii, cardStyle } from "../../styles";
import { rankEntries, tiebreakGame, gradedCount } from "../../utils";

/**
 * Standings, live as games finish. Only graded games count, so the table is
 * meaningful mid-week rather than blank until Monday night.
 */
export function Standings({ slate, entries }) {
  const rows = rankEntries(entries || [], slate);
  const graded = gradedCount(slate);
  const total = slate?.games?.length || 0;
  const tb = tiebreakGame(slate);
  const tbSettled = typeof tb?.total === "number";

  if (!rows.length) {
    return (
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>No picks submitted yet.</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Standings</h3>
        <span style={{ color: colors.textDim, fontSize: 12 }}>
          {graded}/{total} games final
        </span>
      </div>
      <p style={{ color: colors.textMuted, fontSize: 12, margin: "0 0 16px" }}>
        {tbSettled
          ? `Tiebreaker settled — ${tb.shortName} totalled ${tb.total}.`
          : `Ties break on ${tb?.shortName || "the final game"}: closest total without going over.`}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row) => {
          const leading = row.rank === 1 && graded > 0;
          return (
            <div
              key={row.entry.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: leading ? "#ffd7000f" : colors.surface2,
                border: `1px solid ${leading ? `${colors.borderGold}` : colors.border}`,
                borderRadius: radii.lg,
              }}
            >
              <span
                style={{
                  width: 26,
                  flexShrink: 0,
                  fontWeight: 900,
                  fontSize: 14,
                  color: leading ? colors.accentGold : colors.textDim,
                }}
              >
                {row.rank}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.entry.name}
                {row.busted && (
                  <span
                    style={{
                      color: colors.accentRed,
                      fontSize: 10,
                      marginLeft: 8,
                      fontWeight: 800,
                    }}
                  >
                    OVER
                  </span>
                )}
              </span>
              <span style={{ color: colors.textDim, fontSize: 11, flexShrink: 0 }}>
                TB {row.guess ?? "—"}
                {row.distance !== null && !row.busted ? ` (−${row.distance})` : ""}
              </span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 15,
                  color: leading ? colors.accentGold : colors.textPrimary,
                  flexShrink: 0,
                }}
              >
                {row.correct}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
