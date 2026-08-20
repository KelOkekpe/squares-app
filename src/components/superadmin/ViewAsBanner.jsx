import React from "react";
import { colors, radii } from "../../styles";

/**
 * Fixed, unmissable, and deliberately loud. "View as" is read-only — it never
 * mints a session — but a superadmin looking at someone else's account should
 * never be able to forget they're doing it.
 */
export function ViewAsBanner({ viewAs, onExit }) {
  if (!viewAs) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        background: `linear-gradient(90deg, ${colors.accentOrange}, ${colors.accentGold})`,
        color: "#1a1a2e",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "0 2px 12px #00000060",
      }}
    >
      <span>
        👁 Viewing as <strong>{viewAs.email}</strong> · read-only
      </span>
      <button
        type="button"
        onClick={onExit}
        style={{
          background: "#1a1a2e",
          color: colors.accentGold,
          border: "none",
          borderRadius: radii.pill,
          padding: "4px 14px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Exit
      </button>
    </div>
  );
}
