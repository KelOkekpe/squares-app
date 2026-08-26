import React from "react";
import { cardStyle, btnPrimary, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";

/** Drawn rather than faded in — the motion is what reads as "that worked". */
function AnimatedCheck() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      style={{ margin: "0 auto 18px", display: "block" }}
    >
      <circle
        className="sp-check-ring"
        cx="36"
        cy="36"
        r="26"
        fill="none"
        stroke={colors.accentGreenBright}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="166"
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "36px 36px",
          animation: "sp-check-ring 0.5s ease-out forwards",
        }}
      />
      <path
        className="sp-check-mark"
        d="M24 37l9 9 16-18"
        fill="none"
        stroke={colors.accentGreenBright}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="48"
        style={{ animation: "sp-check-mark 0.35s 0.35s ease-out forwards", strokeDashoffset: 48 }}
      />
    </svg>
  );
}

/**
 * Confirmation after a sheet is submitted.
 *
 * A dialog rather than a panel on the page: it used to sit above the standings,
 * which meant the thing telling you it worked stayed there permanently and the
 * standings you were being pointed at were pushed below the fold. Dismissing it
 * leaves them where they were told to go.
 */
export function PicksSubmitted({
  name,
  gameCount,
  tiebreak,
  entryFee,
  emailedTo,
  onViewStandings,
  onDone,
}) {
  const owes = Number(entryFee) > 0;

  return (
    <div
      onClick={onDone}
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        className="sp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Picks submitted"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...cardStyle,
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          animation: "sp-modal-in 0.25s ease-out",
        }}
      >
        <AnimatedCheck />

        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Success!</h2>
        <p style={{ color: colors.textMuted, marginBottom: 8, fontSize: 15 }}>
          <strong style={{ color: colors.textSecondary }}>{name}</strong> picked{" "}
          <strong style={{ color: colors.accentBrand }}>
            {gameCount} game{gameCount === 1 ? "" : "s"}
          </strong>
        </p>
        {tiebreak !== "" && tiebreak != null && (
          <p style={{ color: colors.textDim, fontSize: 13, margin: "0 0 18px" }}>
            Tiebreaker: {tiebreak}
          </p>
        )}

        {/* The reason for the email, said plainly — otherwise "why can't I see
            my own picks?" is the first support message of the week. */}
        <div
          style={{
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.lg,
            padding: "14px 16px",
            margin: "0 0 18px",
            textAlign: "left",
          }}
        >
          <p style={{ color: colors.textMuted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            We emailed your picks{emailedTo ? ` to ${emailedTo}` : ""} — everyone's stay hidden
            until the first kickoff, so nobody can copy yours. 😉
          </p>
          <p style={{ color: colors.textDim, fontSize: 12, margin: "8px 0 0", lineHeight: 1.6 }}>
            {owes
              ? "They join the standings once your admin confirms your entry fee arrived."
              : "Standings update on their own as games finish."}{" "}
            Submitting again with the same email replaces this sheet, right up until kickoff.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onViewStandings} style={{ ...btnPrimary, flex: 1 }}>
            View Standings
          </button>
          <button
            onClick={onDone}
            style={{ ...btnSecondary, flex: 1, color: colors.accentBrandAlt }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
