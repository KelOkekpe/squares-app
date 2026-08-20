/**
 * Central design tokens.
 *
 * Every value resolves to a CSS custom property rather than a literal, so the
 * whole app re-themes when `data-theme` flips on <html>. The palettes live in
 * index.html — that's the single source of truth for actual colour values, and
 * it's inlined there so the theme resolves before first paint.
 *
 * Consequence worth knowing: these are strings like "var(--accent-purple)", so
 * you can no longer concatenate an alpha suffix onto them (`${colors.x}30` used
 * to work and now produces invalid CSS). Add a token in index.html instead.
 */

export const colors = {
  /* backgrounds */
  pageBg: "var(--page-bg)",
  pageBgMid: "var(--page-bg-mid)",
  pageBgEnd: "var(--page-bg-end)",
  surfacePrimary: "var(--surface-primary)",
  surfaceDeep: "var(--surface-deep)",
  surfaceFilled: "var(--surface-filled)",
  surfaceInput: "var(--surface-input)",
  surfaceAdminInput: "var(--surface-admin-input)",
  surfaceSection: "var(--surface-section)",

  /* text */
  headline: "var(--text-headline)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textDim: "var(--text-dim)",
  textDimmer: "var(--text-dimmer)",
  textDimmest: "var(--text-dimmest)",

  /* accents */
  accentPurple: "var(--accent-purple)",
  accentViolet: "var(--accent-violet)",
  accentGreen: "var(--accent-green)",
  accentGreenBright: "var(--accent-green-bright)",
  accentGreenLight: "var(--accent-green-light)",
  accentRed: "var(--accent-red)",
  accentRedDark: "var(--accent-red-dark)",
  accentRedDeep: "var(--accent-red-deep)",
  accentRedMuted: "var(--accent-red-muted)",
  accentGold: "var(--accent-gold)",
  accentYellow: "var(--accent-yellow)",
  accentOrange: "var(--accent-orange)",
  accentPink: "var(--accent-pink)",

  /* borders */
  border: "var(--border)",
  borderLight: "var(--border-light)",
  borderInput: "var(--border-input)",
  borderSubtle: "var(--border-subtle)",

  /* tinted surfaces — white-on-dark, dark-on-light */
  surface1: "var(--surface-1)",
  surface2: "var(--surface-2)",
  surface3: "var(--surface-3)",
  surface4: "var(--surface-4)",
  surface5: "var(--surface-5)",
  surface6: "var(--surface-6)",
  surface7: "var(--surface-7)",

  /* misc */
  white: "#fff", // literal on purpose: text on accent-filled buttons, both themes
  overlay: "var(--overlay)",
  overlayLight: "var(--overlay-light)",
  overlaySubtle: "var(--overlay-subtle)",
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
  card: "var(--shadow-card)",
  modal: "var(--shadow-modal)",
  winner: "var(--shadow-winner)",
  glowPrimary: "var(--glow-primary)",
  /* Only valid for literal hex input — never pass a colors.* token */
  glow: (color) => `0 4px 20px ${color}40`,
};

export const decor = {
  one: "var(--decor-1)",
  two: "var(--decor-2)",
};
