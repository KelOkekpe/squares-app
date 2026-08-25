import React from "react";
import { colors } from "../../styles";
import { TERMS_PATH, PRIVACY_PATH } from "../../utils";

/**
 * The one line that turns "we published terms" into "the user agreed to them".
 *
 * Shown at the point of submission rather than behind a checkbox: an entry form
 * a player fills out in thirty seconds does not survive a consent gate, and an
 * unticked box that blocks submission would cost more entries than it is worth.
 * Sitting directly under the button that commits them is what makes it binding.
 *
 * Links open in a new tab so a half-filled form is never lost to a click.
 */
export function LegalConsent({ action = "submitting", style }) {
  return (
    <p
      style={{
        margin: "12px 0 0",
        color: colors.textDim,
        fontSize: 11.5,
        lineHeight: 1.5,
        textAlign: "center",
        ...style,
      }}
    >
      By {action} you agree to our{" "}
      <a href={TERMS_PATH} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Terms
      </a>{" "}
      and{" "}
      <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Privacy Policy
      </a>
      .
    </p>
  );
}

const linkStyle = { color: colors.textMuted, textDecoration: "underline" };
