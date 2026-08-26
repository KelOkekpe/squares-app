import React, { useMemo } from "react";
import { GRID_SIZE, QUARTERS, getWinnerCell, DEFAULT_TEAM_COLORS } from "../../utils";
import {
  darken,
  axisDigitColor,
  bestContrast,
  contrastRatio,
  MIN_DIGIT_CONTRAST,
} from "../../utils";
import { colors, fonts } from "../../styles";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { useTheme } from "../../hooks/useTheme";
import { PrizePotBar } from "./PrizePotBar";
import { TeamLogo } from "../common";

// The surfaces the axis digits sit on. Mirrored as literals because contrast
// cannot be computed from a var(); check:brand asserts each still equals the
// token it mirrors, so a theme change cannot leave these behind.
const LIGHT_GUTTER_HEX = "#ffffff"; // --grid-panel
const DARK_BOARD_HEX = "#0e2222"; // --grid-panel

export function SquaresGrid({ board, headers, config, scores }) {
  const isMobile = useIsMobile();
  const { isLight } = useTheme();
  // On a phone the desktop sizing forces both horizontal and a lot of vertical
  // scrolling. Shrinking the axis gutters and cell height fits 10 columns in a
  // ~360px viewport, so the whole board is visible at once.
  const axisSize = isMobile ? 20 : 34;
  const cellHeight = isMobile ? 30 : 52;
  // Tiles, not a table. At a 2px gap the cells fuse into a grid of lines and
  // the board reads as a spreadsheet; at 4px each square is its own object,
  // which is what people are actually looking for when they hunt for theirs.
  //
  // Phones keep the original tighter spacing. All ten columns have to fit at
  // once, and the desktop gap and padding cost about 25px there -- two columns'
  // worth on a narrow screen. The rounding still reads at 4px; the air does not
  // fit. Verified down to a 500px viewport, which is as narrow as headless
  // Chrome will lay out.
  const cellGap = isMobile ? 1 : 4;
  const cellRadius = isMobile ? 4 : 7;
  const boardPad = isMobile ? 3 : 14;
  const gridMinWidth = isMobile ? 0 : 700;
  // The number gutters used to take their background from the team's colour —
  // darken(teamBg, 0.5). That produced a near-black gutter carrying near-black
  // digits for a dark team colour, and a grey band for a light one. They now
  // sit on a fixed board surface in both themes, so the digits are legible
  // whatever the admin picks.
  //
  // The team's colour is still used for the digits, but only when it actually
  // reads against that surface; otherwise the theme's own text colour wins.
  // The gutter keeps the background it always had. Only the digits changed:
  // they were painted in the team's colour regardless of whether it showed up,
  // which left black-on-grey for a white board and near-black-on-near-black for
  // a dark one.
  // The digits float on the board surface now rather than sitting in a coloured
  // gutter. The gutter existed to give them a background to contrast against,
  // but it also produced a grey slab down two edges that fought the board for
  // attention. Floating them is both lighter and simpler: there is exactly one
  // surface to be legible against, in either theme.
  const digitColor = (teamBg, teamColor) => {
    const surface = isLight ? LIGHT_GUTTER_HEX : DARK_BOARD_HEX;
    const best = bestContrast([teamColor, teamBg], surface);
    return contrastRatio(best, surface) >= MIN_DIGIT_CONTRAST ? best : colors.textPrimary;
  };

  // Banner depth scales with the team's own colour. A fixed 25% darken looked
  // right on a navy but turned the default white into a grey slab, which is the
  // colour most boards actually ship with.
  const bannerDepth = (hex) => (contrastRatio(hex, "#ffffff") < 1.6 ? 0.07 : 0.25);

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
                background: scores[q] ? colors.surfaceAccentSoft : colors.surface4,
                color: scores[q] ? colors.accentPink : colors.textDim,
                border: `1px solid ${scores[q] ? colors.borderAccentSoft : colors.borderLight}`,
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
          background: colors.gridPanel,
          borderRadius: isMobile ? 10 : 14,
          padding: boardPad,
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* corner blank (2 cols × 2 rows) */}
        <div
          style={{
            gridRow: "1 / 3",
            gridColumn: "1 / 3",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textDimmer,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        />

        {/* X-axis team banner */}
        <div
          style={{
            gridRow: 1,
            gridColumn: `3 / ${GRID_SIZE + 3}`,
            background: `linear-gradient(135deg, ${teamXBg}, ${darken(teamXBg, bannerDepth(teamXBg))})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: teamXColor,
            fontSize: isMobile ? 10 : 13,
            fontWeight: 700,
            letterSpacing: isMobile ? 1 : 2,
            textTransform: "uppercase",
            borderRadius: cellRadius + 2,
            gap: 8,
            border: `1px solid ${colors.gridCellBorder}`,
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
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
              color: digitColor(teamXBg, teamXColor),
              minWidth: 0,
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
            background: `linear-gradient(180deg, ${teamYBg}, ${darken(teamYBg, bannerDepth(teamYBg))})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: cellRadius + 2,
            border: `1px solid ${colors.gridCellBorder}`,
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
                color: digitColor(teamYBg, teamYColor),
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
                        ? colors.gridCellEmpty
                        : colors.gridCellFilled,
                    border: winQ
                      ? `2px solid ${colors.accentGold}`
                      : `1px solid ${colors.gridCellBorder}`,
                    borderRadius: cellRadius,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: isMobile ? 1 : 4,
                    minHeight: cellHeight,
                    minWidth: 0,
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
