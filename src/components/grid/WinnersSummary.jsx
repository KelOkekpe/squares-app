import React from "react";
import { QUARTERS, getWinnerCell } from "../../utils";
import { colors } from "../../styles";

export function WinnersSummary({ headers, board, scores }) {
  const hasScores = Object.keys(scores).length > 0;
  if (!hasScores) return null;

  return (
    <div
      style={{
        marginTop: 28,
        padding: 24,
        background: "#ffffff04",
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: colors.accentGold,
          margin: "0 0 16px",
          fontWeight: 700,
        }}
      >
        ★ Winners
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {QUARTERS.map((q) => {
          if (!scores[q]) return null;
          const cell = getWinnerCell(headers, scores, q);
          const winner = cell ? board[cell.row]?.[cell.col] : null;
          return (
            <div
              key={q}
              style={{
                padding: "14px 18px",
                background: "#ffd70008",
                borderRadius: 12,
                border: "1px solid #ffd70020",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span style={{ color: colors.accentGold, fontWeight: 800, fontSize: 14 }}>{q}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  {scores[q].x} - {scores[q].y}
                </span>
              </div>
              <span
                style={{
                  color: winner ? colors.white : colors.textDim,
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {winner || "Empty square"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
