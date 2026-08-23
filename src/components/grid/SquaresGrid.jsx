import React, { useMemo } from "react";
import { GRID_SIZE, QUARTERS, getWinnerCell, DEFAULT_TEAM_COLORS } from "../../utils";
import { darken, bestContrast } from "../../utils";
import { colors, fonts } from "../../styles";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { useTheme } from "../../hooks/useTheme";
import { PrizePotBar } from "./PrizePotBar";
import { TeamLogo } from "../common";

export function SquaresGrid({ board, headers, config, scores }) {
  const isMobile = useIsMobile();
  const { isLight } = useTheme();
  // On a phone the desktop sizing forces both horizontal and a lot of vertical
  // scrolling. Shrinking the axis gutters and cell height fits 10 columns in a
  // ~360px viewport, so the whole board is visible at once.
  const axisSize = isMobile ? 22 : 40;
  const cellHeight = isMobile ? 30 : 52;
  const cellGap = isMobile ? 1 : 2;
  const gridMinWidth = isMobile ? 0 : 700;
  // In light mode the darkened team colour reads as a heavy black band across a
  // pale board, so the number gutters go white and the team colour moves to the
  // digits instead.
  // The number used to be painted in the team's background colour, which is
  // invisible the moment that colour is white. Pick whichever of the team's two
  // colours actually reads against the cell — for dark team colours that lands
  // on the same one it always did.
  const axisCell = (teamBg, teamColor) => {
    if (isLight) {
      // The light surface is white, so the darker of the pair wins.
      return {
        background: colors.surfacePrimary,
        color: bestContrast([teamBg, teamColor], "#ffffff"),
        border: `1px solid ${colors.border}`,
      };
    }
    const cell = darken(teamBg, 0.5);
    return { background: cell, color: bestContrast([teamColor, teamBg], cell) };
  };

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
  // A linked game carries ESPN's team ids, which beat the free-text fields —
  // those are whatever the admin typed and may be a nickname or a joke.
  const xTeam = config.game?.xTeamId || config.teamX;
  const yTeam = config.game?.yTeamId || config.teamY;

  const teamXBg = config.teamXBg || DEFAULT_TEAM_COLORS.bg;
  const teamXColor = config.teamXColor || DEFAULT_TEAM_COLORS.color;
  const teamYBg = config.teamYBg || DEFAULT_TEAM_COLORS.bg;
  const teamYColor = config.teamYColor || DEFAULT_TEAM_COLORS.color;

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
            gap: 8,
          }}
        >
          <TeamLogo team={xTeam} size={isMobile ? 16 : 22} />
          {config.teamX || "Team X"}
        </div>

        {/* X-axis number headers */}
        {headers.x.map((num, i) => (
          <div
            key={`xh-${i}`}
            style={{
              gridRow: 2,
              gridColumn: i + 3,
              ...axisCell(teamXBg, teamXColor),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: "0 0 0 8px",
            color: teamYColor,
          }}
        >
          <TeamLogo team={yTeam} size={isMobile ? 16 : 22} />
          {/* The rotation lives on the text, not the banner — on the banner it
              turned the logo on its side too. */}
          <span
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              fontSize: isMobile ? 10 : 13,
              fontWeight: 700,
              letterSpacing: isMobile ? 1 : 2,
              textTransform: "uppercase",
            }}
          >
            {config.teamY || "Team Y"}
          </span>
        </div>

        {/* Y-axis numbers + data cells */}
        {board.map((row, r) => (
          <React.Fragment key={`row-${r}`}>
            <div
              style={{
                gridRow: r + 3,
                gridColumn: 2,
                ...axisCell(teamYBg, teamYColor),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
