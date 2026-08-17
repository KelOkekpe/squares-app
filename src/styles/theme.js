/**
 * Central design tokens.
 * Every colour, shadow, radius, and font referenced across the app
 * lives here so the theme can be changed in one place.
 */

export const colors = {
  /* backgrounds */
  pageBg: "#0a0a1a",
  pageBgMid: "#0d0d24",
  pageBgEnd: "#10102a",
  surfacePrimary: "#12122e",
  surfaceDeep: "#0e0e22",
  surfaceFilled: "#14142e",
  surfaceInput: "#0e0e24",
  surfaceSection: "#0c0c20",

  /* text */
  textPrimary: "#e0e0ff",
  textSecondary: "#c8c8e8",
  textMuted: "#8a8ab0",
  textDim: "#555",
  textDimmer: "#444",
  textDimmest: "#333",

  /* accents */
  accentPurple: "#6c5ce7",
  accentViolet: "#a855f7",
  accentGreen: "#22aa44",
  accentGreenBright: "#4ade80",
  accentGreenLight: "#44cc66",
  accentRed: "#ff6b6b",
  accentRedDark: "#dd3333",
  accentRedDeep: "#ff2222",
  accentRedMuted: "#ff4444",
  accentGold: "#ffd700",
  accentYellow: "#facc15",
  accentOrange: "#ffaa44",
  accentPink: "#e8b4f8",

  /* borders */
  border: "#ffffff08",
  borderLight: "#ffffff10",
  borderInput: "#ffffff12",
  borderSubtle: "#ffffff15",

  /* misc */
  white: "#fff",
  overlay: "rgba(0,0,0,0.85)",
  overlayLight: "rgba(0,0,0,0.8)",
  overlaySubtle: "rgba(0,0,0,0.3)",
};

export const fonts = {
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 100,
  circle: "50%",
};

export const shadows = {
  card: "0 8px 40px rgba(0,0,0,0.3)",
  modal: "0 40px 80px rgba(0,0,0,0.5)",
  glow: (color) => `0 4px 20px ${color}40`,
  winner: `0 0 20px ${colors.accentGold}30`,
};
