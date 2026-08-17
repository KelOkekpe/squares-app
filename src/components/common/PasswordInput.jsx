import React, { useState } from "react";
import { colors, inputStyle } from "../../styles";

const ICON_SLOT = 42;

function EyeIcon({ off }) {
  const shared = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  return off ? (
    <svg {...shared}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg {...shared}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Password field with a show/hide toggle.
 *
 * Takes the caller's full style object (the app has two input styles, and
 * modals tweak margins), then reserves room on the right so the value never
 * runs underneath the button.
 */
export function PasswordInput({ style = inputStyle, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        style={{ ...style, paddingRight: ICON_SLOT }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          bottom: style?.marginBottom ? style.marginBottom : 0,
          right: 0,
          width: ICON_SLOT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: visible ? colors.accentViolet : colors.textDim,
          transition: "color 0.15s",
        }}
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}
