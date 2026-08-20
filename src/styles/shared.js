import { colors, fonts, radii, shadows } from "./theme";

/* ── Layout ─────────────────────────────────────────────── */

export const pageStyle = {
  minHeight: "100vh",
  background: `linear-gradient(170deg, ${colors.pageBg} 0%, ${colors.pageBgMid} 40%, ${colors.pageBgEnd} 100%)`,
  color: colors.textPrimary,
  fontFamily: fonts.body,
  position: "relative",
  overflow: "hidden",
};

export const containerStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 24px",
};

/* ── Buttons ────────────────────────────────────────────── */

export const btnPrimary = {
  background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
  color: colors.white,
  border: "none",
  padding: "14px 32px",
  borderRadius: radii.lg,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: 0.5,
  transition: "all 0.2s",
  boxShadow: shadows.glowPrimary,
};

export const btnSecondary = {
  background: "transparent",
  color: "#a0a0cc",
  border: `1px solid ${colors.borderSubtle}`,
  padding: "12px 28px",
  borderRadius: radii.lg,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  transition: "all 0.2s",
};

/* ── Cards / Surfaces ───────────────────────────────────── */

export const cardStyle = {
  background: colors.surfacePrimary,
  borderRadius: radii.xxl,
  padding: 32,
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.card,
};

/* ── Inputs ─────────────────────────────────────────────── */

export const inputStyle = {
  background: colors.surfaceInput,
  border: `1px solid ${colors.borderInput}`,
  color: colors.textPrimary,
  padding: "14px 18px",
  borderRadius: radii.lg,
  fontSize: 15,
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

/* ── Labels ─────────────────────────────────────────────── */

export const labelStyle = {
  display: "block",
  color: colors.textMuted,
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 1,
};

/* ── Admin-specific ─────────────────────────────────────── */

export const adminInputStyle = {
  background: colors.surfaceAdminInput,
  border: `1px solid ${colors.borderSubtle}`,
  color: colors.textPrimary,
  padding: "10px 14px",
  borderRadius: radii.md,
  fontSize: 14,
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
};

export const adminSectionStyle = {
  background: colors.surfaceSection,
  borderRadius: radii.lg,
  padding: 20,
  border: `1px solid ${colors.border}`,
};
