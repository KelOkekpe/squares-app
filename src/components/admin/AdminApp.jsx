import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { colors, pageStyle, containerStyle } from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { AdminLanding } from "./AdminLanding";
import { AdminDashboard } from "./AdminDashboard";

/**
 * The /admin site. Signed out → sign in / sign up. Signed in → dashboard of
 * the spaces you own or were invited to admin.
 */
export function AdminApp({ onOpenSpace }) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div style={pageStyle}>
        <BackgroundDecor />
        <div style={{
          ...containerStyle,
          paddingTop: 120,
          textAlign: "center",
          color: colors.textMuted,
          fontSize: 14,
        }}>
          Loading…
        </div>
      </div>
    );
  }

  return isLoggedIn ? <AdminDashboard onOpenSpace={onOpenSpace} /> : <AdminLanding />;
}
