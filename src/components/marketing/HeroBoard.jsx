import React from "react";
import { colors, radii, fonts } from "../../styles";

// Team colours below are deliberately literal: they mimic real club branding,
// which an admin picks per board, and shouldn't shift with the site theme.
const X_DIGITS = [4, 6, 0, 2, 8, 1];
const Y_DIGITS = [1, 9, 0, 5, 8];

// A believable board rather than a placeholder — the visual is the product.
const FILLED = {
  "0-1": "JO",
  "0-3": "MT",
  "0-5": "KR",
  "1-0": "AB",
  "1-2": "MT",
  "1-4": "DL",
  "2-1": "KR",
  "2-2": "JO",
  "2-5": "AB",
  "3-0": "DL",
  "3-3": "JO",
  "3-4": "MT",
  "4-2": "AB",
  "4-4": "KR",
  "4-5": "JO",
};
const WINNER = "2-2";

/**
 * The hero visual: a squares board mid-game with a quarter just settled.
 *
 * Abstracted to initials and a 6×5 slice — a literal 10×10 with full names is
 * unreadable at hero scale, and the point is recognition, not legibility.
 */
export function HeroBoard({ scale = 1 }) {
  const cell = 46 * scale;
  const axis = 26 * scale;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* board */}
      <div
        style={{
          background: colors.surfacePrimary,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 20 * scale,
          padding: 14 * scale,
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* away team bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${axis}px repeat(${X_DIGITS.length}, ${cell}px)`,
            gap: 3 * scale,
            marginBottom: 3 * scale,
          }}
        >
          <div />
          <div
            style={{
              gridColumn: `2 / ${X_DIGITS.length + 2}`,
              background: "linear-gradient(135deg, #1e3a5f, #16293f)",
              color: "#7db8f0",
              borderRadius: 8 * scale,
              padding: `${6 * scale}px 0`,
              textAlign: "center",
              fontSize: 10 * scale,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            SEAHAWKS
          </div>
        </div>

        {/* digit row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${axis}px repeat(${X_DIGITS.length}, ${cell}px)`,
            gap: 3 * scale,
            marginBottom: 3 * scale,
          }}
        >
          <div />
          {X_DIGITS.map((d, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                color: "#7db8f0",
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 13 * scale,
                padding: `${4 * scale}px 0`,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* rows */}
        {Y_DIGITS.map((yd, r) => (
          <div
            key={r}
            style={{
              display: "grid",
              gridTemplateColumns: `${axis}px repeat(${X_DIGITS.length}, ${cell}px)`,
              gap: 3 * scale,
              marginBottom: 3 * scale,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f0a0b8",
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 13 * scale,
              }}
            >
              {yd}
            </div>
            {X_DIGITS.map((_, c) => {
              const key = `${r}-${c}`;
              const name = FILLED[key];
              const isWinner = key === WINNER;
              return (
                <div
                  key={c}
                  style={{
                    height: cell * 0.78,
                    borderRadius: 6 * scale,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11 * scale,
                    fontWeight: 700,
                    background: isWinner
                      ? "linear-gradient(135deg, #ffd70035, #ff8c0020)"
                      : name
                        ? colors.surfaceFilled
                        : colors.surfaceDeep,
                    border: isWinner
                      ? `2px solid ${colors.accentGold}`
                      : `1px solid ${colors.border}`,
                    color: isWinner ? colors.accentGold : colors.textMuted,
                    boxShadow: isWinner ? "0 0 24px #ffd70040" : "none",
                  }}
                >
                  {name || ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* floating result — the payoff, mirroring the reference's stat panel */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -34 * scale,
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 12 * scale,
          background: colors.surfacePrimary,
          border: `1px solid ${colors.accentGold}55`,
          borderRadius: radii.pill,
          padding: `${10 * scale}px ${18 * scale}px`,
          boxShadow: "var(--shadow-modal)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            background: colors.accentGold,
            // accentGold is #ffd700 in dark but #b07d0a in light — a fixed dark
            // text colour is unreadable on the second. pageBg inverts with the
            // theme, so this stays legible either way.
            color: colors.pageBg,
            borderRadius: radii.pill,
            padding: `${2 * scale}px ${9 * scale}px`,
            fontSize: 10 * scale,
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          Q3
        </span>
        <span style={{ color: colors.textPrimary, fontWeight: 800, fontSize: 13 * scale }}>
          Marcus T. wins
        </span>
        <span style={{ color: colors.accentGreenBright, fontWeight: 800, fontSize: 13 * scale }}>
          $250
        </span>
      </div>
    </div>
  );
}
