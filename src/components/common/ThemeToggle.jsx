import React from "react";
import { useTheme } from "../../hooks/useTheme";
import { colors, radii } from "../../styles";

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Shows the theme you'd switch *to*, which is the convention users expect.
 */
export function ThemeToggle({ size = 32, style }) {
  const { isLight, toggle } = useTheme();
  const target = isLight ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${target} mode`}
      title={`Switch to ${target} mode`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.pill,
        border: `1px solid ${colors.border}`,
        background: colors.surface3,
        color: isLight ? colors.accentPurple : colors.accentGold,
        cursor: "pointer",
        padding: 0,
        transition: "color 0.2s, background 0.2s",
        ...style,
      }}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
