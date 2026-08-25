import React from "react";
import { cardStyle, btnPrimary, btnSecondary } from "../../styles";
import { colors } from "../../styles";

/**
 * Shown after a sheet is submitted, matching the squares confirmation.
 *
 * The picks are recorded immediately — unlike a squares entry, nothing waits on
 * an admin. What may still be outstanding is the money, so the wording depends
 * on whether the contest charges an entry fee.
 */
export function PicksSubmitted({ name, gameCount, tiebreak, entryFee, onViewStandings, onDone }) {
  const owes = Number(entryFee) > 0;

  return (
    <div style={{ ...cardStyle, textAlign: "center" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 32,
        }}
      >
        ✓
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Picks Submitted</h2>
      <p style={{ color: colors.textMuted, marginBottom: 8, fontSize: 15 }}>
        <strong style={{ color: colors.textSecondary }}>{name}</strong> picked{" "}
        <strong style={{ color: colors.accentPurple }}>
          {gameCount} game{gameCount === 1 ? "" : "s"}
        </strong>
      </p>
      {tiebreak !== "" && tiebreak != null && (
        <p style={{ color: colors.textDim, fontSize: 13, margin: "0 0 18px" }}>
          Tiebreaker: {tiebreak}
        </p>
      )}

      <div
        style={{
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "14px 16px",
          margin: "0 0 20px",
        }}
      >
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          {owes
            ? "Your picks are locked in and can't be changed after the first kickoff. They join the standings once your admin confirms your entry fee arrived."
            : "Your picks are locked in. Standings update on their own as games finish."}
        </p>
        <p style={{ color: colors.textDim, fontSize: 12, margin: "8px 0 0" }}>
          Submitting again with the same email replaces this sheet, right up until the first
          kickoff.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onViewStandings} style={{ ...btnPrimary, flex: 1 }}>
          View Standings
        </button>
        <button onClick={onDone} style={{ ...btnSecondary, flex: 1 }}>
          Done
        </button>
      </div>
    </div>
  );
}
