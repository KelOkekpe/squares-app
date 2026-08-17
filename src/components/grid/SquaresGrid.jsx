import React, { useMemo } from "react";
import { GRID_SIZE, QUARTERS, getWinnerCell } from "../../utils";
import { darken } from "../../utils";
import { colors, fonts } from "../../styles";
import { PrizePotBar } from "./PrizePotBar";

export function SquaresGrid({ board, headers, config, scores }) {
  /* ── derive winner map ────────────────────────────────── */
  const winners = useMemo(() => {
    const w = {};
    QUARTERS.forEach((q) => {
      const cell = getWinnerCell(headers, scores, q);
      if (cell) w[`${cell.row}-${cell.col}`] = q;
    });
    return w;
  }, [headers, scores]);

  const totalSquares = board.flat().filter(Boolean).length;
  const uniqueNames = [...new Set(board.flat().filter(Boolean))];

  /* ── team colours (with fallbacks) ────────────────────── */
  const teamXBg = config.teamXBg || "#1e3a5f";
  const teamXColor = config.teamXColor || "#7db8f0";
  const teamYBg = config.teamYBg || "#3a1e2e";
  const teamYColor = config.teamYColor || "#f0a0b8";

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      {/* ── status bar ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          <span style={{ color: colors.textMuted, fontSize: 13 }}>
            {totalSquares}/100 squares filled
          </span>
          <span style={{ color: colors.textMuted, fontSize: 13 }}>
            {uniqueNames.length} participants
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {QUARTERS.map((q) => (
            <span
              key={q}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                background: scores[q] ? "#e8b4f820" : "#ffffff08",
                color: scores[q] ? colors.accentPink : colors.textDim,
                border: `1px solid ${scores[q] ? "#e8b4f840" : colors.borderLight}`,
                fontWeight: 600,
              }}
            >
              {q}: {scores[q] ? `${scores[q].x}-${scores[q].y}` : "—"}
            </span>
          ))}
        </div>
      </div>

      {/* ── grid ────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `40px 40px repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `40px 40px repeat(${GRID_SIZE}, 1fr)`,
          gap: 2,
          minWidth: 700,
        }}
      >
        {/* corner blank (2 cols × 2 rows) */}
        <div
          style={{
            gridRow: "1 / 3",
            gridColumn: "1 / 3",
            background: colors.surfacePrimary,
            borderRadius: "8px 0 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textDimmer,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          ×
        </div>

        {/* X-axis team banner */}
        <div
          style={{
            gridRow: 1,
            gridColumn: `3 / ${GRID_SIZE + 3}`,
            background: `linear-gradient(135deg, ${teamXBg}, ${darken(teamXBg, 0.25)})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: teamXColor,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            borderRadius: "0 8px 0 0",
          }}
        >
          {config.teamX || "Team X"}
        </div>

        {/* X-axis number headers */}
        {headers.x.map((num, i) => (
          <div
            key={`xh-${i}`}
            style={{
              gridRow: 2,
              gridColumn: i + 3,
              background: darken(teamXBg, 0.5),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: teamXColor,
              fontWeight: 800,
              fontSize: 16,
              fontFamily: fonts.mono,
            }}
          >
            {num}
          </div>
        ))}

        {/* Y-axis team banner */}
        <div
          style={{
            gridRow: `3 / ${GRID_SIZE + 3}`,
            gridColumn: 1,
            background: `linear-gradient(180deg, ${teamYBg}, ${darken(teamYBg, 0.25)})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "0 0 0 8px",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            color: teamYColor,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            transform: "rotate(180deg)",
          }}
        >
          {config.teamY || "Team Y"}
        </div>

        {/* Y-axis numbers + data cells */}
        {board.map((row, r) => (
          <React.Fragment key={`row-${r}`}>
            <div
              style={{
                gridRow: r + 3,
                gridColumn: 2,
                background: darken(teamYBg, 0.5),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: teamYColor,
                fontWeight: 800,
                fontSize: 16,
                fontFamily: fonts.mono,
              }}
            >
              {headers.y[r]}
            </div>

            {row.map((cell, c) => {
              const winQ = winners[`${r}-${c}`];
              const isEmpty = !cell;
              return (
                <div
                  key={`cell-${r}-${c}`}
                  style={{
                    gridRow: r + 3,
                    gridColumn: c + 3,
                    background: winQ
                      ? "linear-gradient(135deg, #ffd70030, #ff8c0025)"
                      : isEmpty
                      ? colors.surfaceDeep
                      : colors.surfaceFilled,
                    border: winQ
                      ? `2px solid ${colors.accentGold}`
                      : `1px solid ${colors.border}`,
                    borderRadius: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 4,
                    minHeight: 52,
                    position: "relative",
                    transition: "all 0.2s",
                    cursor: "default",
                    boxShadow: winQ ? "0 0 20px #ffd70030" : "none",
                  }}
                  title={
                    cell
                      ? `${cell}${winQ ? ` — ${winQ} Winner!` : ""}`
                      : "Empty"
                  }
                >
                  {winQ && (
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 4,
                        fontSize: 8,
                        fontWeight: 800,
                        color: colors.accentGold,
                        letterSpacing: 1,
                      }}
                    >
                      {winQ} ★
                    </span>
                  )}
                  {cell ? (
                    <span
                      style={{
                        fontSize:
                          cell.length > 14 ? 8 : cell.length > 10 ? 9 : 10,
                        color: winQ ? colors.accentGold : colors.textSecondary,
                        fontWeight: winQ ? 800 : 500,
                        textAlign: "center",
                        lineHeight: 1.2,
                        wordBreak: "break-word",
                        maxWidth: "100%",
                        overflow: "hidden",
                      }}
                    >
                      {cell}
                    </span>
                  ) : (
                    <span style={{ fontSize: 16, color: colors.border }}>
                      ·
                    </span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* prize pot bar */}
      <PrizePotBar
        totalPot={config.totalPot}
        quarterlyPayout={config.quarterlyPayout}
      />
    </div>
  );
}
