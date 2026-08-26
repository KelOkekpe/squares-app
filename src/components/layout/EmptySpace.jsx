import React from "react";
import { colors, radii, cardStyle } from "../../styles";

function Choice({ icon, title, blurb, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 240,
        textAlign: "left",
        background: colors.surface3,
        border: `1px solid ${tone}`,
        borderRadius: radii.xl,
        padding: 24,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
        {title}
      </h3>
      <p style={{ margin: 0, color: colors.textMuted, fontSize: 13, lineHeight: 1.6 }}>{blurb}</p>
    </button>
  );
}

/**
 * What a space looks like before it has anything in it.
 *
 * A new space used to arrive with a board already created — an empty
 * Seahawks-vs-Patriots grid nobody chose, which the owner had to work out was a
 * placeholder. Asking is both more honest and one fewer thing to undo.
 *
 * Players see a different message: an admin can act on this, a player can only
 * be confused by it.
 */
export function EmptySpace({ spaceCode, canCreate, onCreate }) {
  if (!canCreate) {
    return (
      <div style={{ ...cardStyle, maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>🏈</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Nothing here yet</h2>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          #{spaceCode} hasn't opened a contest yet. Check back once whoever invited you has set one
          up.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }}>
          What are you running?
        </h2>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          #{spaceCode} is ready. Pick a format and the rest fills itself in — including live scores
          and automatic winners.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Choice
          icon="▦"
          title="Squares board"
          tone={colors.accentBrand}
          blurb="The classic 10×10 grid for one game. Players buy squares, numbers are drawn once it fills, and each quarter pays out on its own."
          onClick={() => onCreate("squares")}
        />
        <Choice
          icon="🗒️"
          title="Pick'em contest"
          tone={colors.accentBrandAlt}
          blurb="A whole week of games. Everyone picks a winner in each, most correct takes it, and every sheet locks at the first kickoff."
          onClick={() => onCreate("pickem")}
        />
      </div>

      <p style={{ color: colors.textDim, fontSize: 12, textAlign: "center", margin: "20px 0 0" }}>
        You can run both at once — a space holds up to 16 at a time.
      </p>
    </div>
  );
}
