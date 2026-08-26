import React from "react";
import { colors, pageStyle, containerStyle } from "../../styles";
import { LEGAL_UPDATED, SUPPORT_EMAIL, TERMS_PATH, PRIVACY_PATH } from "../../utils";

/**
 * Shared chrome for the Terms and Privacy pages.
 *
 * The documents are data rather than markup so both render identically — a
 * heading that looks like a heading in one and not the other reads as
 * carelessness in exactly the place where carelessness is expensive.
 *
 * Sections are { h, p: [], ul: [], note } — `note` is set apart because a few
 * points (we never hold your money; your state's law still applies to you)
 * matter more than the paragraph they sit in.
 */
export function LegalPage({ title, intro, sections, onBack }) {
  return (
    <div style={pageStyle}>
      <div style={{ ...containerStyle, maxWidth: 760, paddingTop: 32, paddingBottom: 64 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: colors.accentBrand,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            padding: 0,
            marginBottom: 24,
          }}
        >
          ← Back
        </button>

        <h1 style={{ margin: "0 0 6px", fontSize: 30, lineHeight: 1.2 }}>{title}</h1>
        <p style={{ margin: "0 0 26px", color: colors.textDim, fontSize: 13 }}>
          Last updated {LEGAL_UPDATED}
        </p>

        {intro.map((text, i) => (
          <p key={i} style={introStyle}>
            {text}
          </p>
        ))}

        {sections.map((s, i) => (
          <section key={s.h} style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, color: colors.textPrimary }}>
              {i + 1}. {s.h}
            </h2>
            {(s.p || []).map((text, j) => (
              <p key={j} style={bodyStyle}>
                {text}
              </p>
            ))}
            {s.ul && (
              <ul style={{ ...bodyStyle, paddingLeft: 20, margin: "0 0 12px" }}>
                {s.ul.map((item, j) => (
                  <li key={j} style={{ marginBottom: 6 }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {s.note && (
              <p
                style={{
                  ...bodyStyle,
                  background: colors.surface4,
                  borderLeft: `3px solid ${colors.accentBrand}`,
                  borderRadius: 6,
                  padding: "12px 14px",
                  color: colors.textSecondary,
                }}
              >
                {s.note}
              </p>
            )}
          </section>
        ))}

        <footer
          style={{
            marginTop: 44,
            paddingTop: 20,
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 13,
          }}
        >
          <a href={TERMS_PATH} style={linkStyle}>
            Terms of Service
          </a>
          <a href={PRIVACY_PATH} style={linkStyle}>
            Privacy Policy
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={linkStyle}>
            {SUPPORT_EMAIL}
          </a>
        </footer>
      </div>
    </div>
  );
}

const bodyStyle = {
  margin: "0 0 12px",
  color: colors.textMuted,
  fontSize: 14.5,
  lineHeight: 1.65,
};

const introStyle = { ...bodyStyle, fontSize: 15.5, color: colors.textSecondary };

const linkStyle = { color: colors.textMuted, textDecoration: "none" };
