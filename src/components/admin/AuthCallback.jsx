import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { authErrorFromHash } from "../../utils/routes";
import { colors, pageStyle, containerStyle, cardStyle, btnPrimary } from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";

/**
 * Lands the Supabase email-confirmation / magic-link redirect.
 *
 * supabase-js reads the token fragment on load and then clears it, so the
 * error message is captured once on mount — by the time we render it, the
 * fragment may already be gone.
 */
export function AuthCallback({ onDone }) {
  const { isLoggedIn, loading } = useAuth();
  const [error] = useState(() => authErrorFromHash(window.location.hash));
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (error) return undefined;
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (error || loading || !isLoggedIn) return;
    onDone();
  }, [error, loading, isLoggedIn, onDone]);

  const failed = error || timedOut;

  return (
    <div style={pageStyle}>
      <BackgroundDecor />
      <div style={{ ...containerStyle, paddingTop: 120 }}>
        <div style={{ ...cardStyle, maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
          {failed ? (
            <>
              <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>
                Couldn't complete sign-in
              </h2>
              <p
                style={{
                  color: colors.textMuted,
                  fontSize: 14,
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                {error ||
                  "This link didn't sign you in. It may have already been used or expired — try signing in directly."}
              </p>
              <button type="button" onClick={onDone} style={{ ...btnPrimary, width: "100%" }}>
                Go to sign in
              </button>
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>Signing you in…</h2>
              <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
                Confirming your email and opening your dashboard.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
