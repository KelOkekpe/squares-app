import React, { useMemo } from "react";
import { GRID_SIZE, QUARTERS, getWinnerCell } from "../../utils";
import { darken } from "../../utils";
import { colors, fonts } from "../../styles";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { PrizePotBar } from "./PrizePotBar";

export function SquaresGrid({ board, headers, config, scores }) {
  const isMobile = useIsMobile();
  // On a phone the desktop sizing forces both horizontal and a lot of vertical
  // scrolling. Shrinking the axis gutters and cell height fits 10 columns in a
  // ~360px viewport, so the whole board is visible at once.
  const axisSize = isMobile ? 22 : 40;
  const cellHeight = isMobile ? 30 : 52;
  const cellGap = isMobile ? 1 : 2;
  const gridMinWidth = isMobile ? 0 : 700;
  const nameSize = (name) =>
    isMobile
      ? name.length > 12
        ? 6
        : name.length > 8
          ? 7
          : 8
      : name.length > 14
        ? 8
        : name.length > 10
          ? 9
          : 10;
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
                background: scores[q] ? "#e8b4f820" : colors.surface4,
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
          gridTemplateColumns: `${axisSize}px ${axisSize}px repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `${axisSize}px ${axisSize}px repeat(${GRID_SIZE}, 1fr)`,
          gap: cellGap,
          minWidth: gridMinWidth,
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
            fontSize: isMobile ? 10 : 13,
            fontWeight: 700,
            letterSpacing: isMobile ? 1 : 2,
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
              fontSize: isMobile ? 11 : 16,
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
            fontSize: isMobile ? 10 : 13,
            fontWeight: 700,
            letterSpacing: isMobile ? 1 : 2,
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
                fontSize: isMobile ? 11 : 16,
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
                    border: winQ ? `2px solid ${colors.accentGold}` : `1px solid ${colors.border}`,
                    borderRadius: isMobile ? 3 : 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: isMobile ? 1 : 4,
                    minHeight: cellHeight,
                    position: "relative",
                    transition: "all 0.2s",
                    cursor: "default",
                    boxShadow: winQ ? "0 0 20px #ffd70030" : "none",
                  }}
                  title={cell ? `${cell}${winQ ? ` — ${winQ} Winner!` : ""}` : "Empty"}
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
                        fontSize: nameSize(cell),
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
                    <span style={{ fontSize: isMobile ? 10 : 16, color: colors.border }}>·</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* prize pot bar */}
      <PrizePotBar totalPot={config.totalPot} quarterlyPayout={config.quarterlyPayout} />
    </div>
  );
}
