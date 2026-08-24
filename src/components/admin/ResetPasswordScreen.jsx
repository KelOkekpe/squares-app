import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  colors,
  pageStyle,
  containerStyle,
  cardStyle,
  labelStyle,
  inputStyle,
  btnPrimary,
  btnSecondary,
} from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { PasswordInput } from "../common";

/**
 * Choosing a new password, after arriving from a recovery link.
 *
 * By the time this renders the user is already signed in — supabase-js consumed
 * the token from the fragment — so this is an ordinary authenticated update
 * rather than anything token-aware. That also means leaving without setting one
 * would drop them into the dashboard still signed in, which is why the only way
 * out is to finish or sign out.
 */
export function ResetPasswordScreen({ onDone }) {
  const { updatePassword, endRecovery, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Those two passwords don't match");

    setSaving(true);
    const { error: updateError } = await updatePassword(password);
    setSaving(false);
    if (updateError) return setError(updateError.message || "Could not change your password");
    onDone?.();
  };

  return (
    <div style={pageStyle}>
      <BackgroundDecor />
      <div style={{ ...containerStyle, paddingTop: 100, paddingBottom: 60 }}>
        <div style={{ ...cardStyle, maxWidth: 420, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>
            Choose a new password
          </h2>
          <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 22px", lineHeight: 1.6 }}>
            You're signed in from the link in your email. Set a password and you're back in.
          </p>

          <label style={labelStyle}>New password</label>
          <PasswordInput
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            style={inputStyle}
            placeholder="At least 6 characters"
          />

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Confirm it</label>
            <PasswordInput
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={inputStyle}
              placeholder="Type it again"
            />
          </div>

          {error && (
            <p style={{ color: colors.accentRed, fontSize: 13, margin: "14px 0 0" }}>{error}</p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            style={{ ...btnPrimary, width: "100%", marginTop: 20, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>

          {/* The recovery link already signed them in, so "cancel" has to mean
              sign out — otherwise it hands the account to whoever opened the
              link without ever proving they know a password. */}
          <button
            type="button"
            onClick={() => {
              endRecovery();
              signOut();
            }}
            style={{ ...btnSecondary, width: "100%", marginTop: 8, color: colors.textDim }}
          >
            Cancel and sign out
          </button>
        </div>
      </div>
    </div>
  );
}
