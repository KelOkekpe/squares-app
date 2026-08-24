import React, { useState } from "react";
import { colors, radii, btnPrimary, btnSecondary, cardStyle } from "../../styles";
import { smsHref, mailtoHref } from "../../utils";
import { useIsMobile } from "../../hooks/useMediaQuery";

/**
 * Inviting people to a board.
 *
 * There is no "send a text" on a desktop, so the two cases get different
 * primary actions rather than one compromise:
 *
 *   phone   — the native share sheet, which already contains Messages,
 *             WhatsApp and everything else they actually use. A direct SMS
 *             link sits underneath for anyone who just wants to text.
 *   desktop — copy the message, which is what a person does anyway before
 *             pasting it into Slack or iMessage. Email is offered because it
 *             is the one thing a desktop can genuinely send.
 *
 * The share sheet is used wherever it exists — recent macOS Safari and Windows
 * have it too — so the desktop path is a fallback, not a second-class one.
 */
export function InviteModal({ message, url, isPrivate, onClose }) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState("");
  const full = `${message} ${url}`;

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const share = async () => {
    try {
      // Text and url are kept apart: apps that understand both render a proper
      // link preview, and putting the url in the text as well duplicates it.
      await navigator.share({ title: "SquarePool", text: message, url });
    } catch (err) {
      // Dismissing the sheet rejects with AbortError. That's not a failure.
      if (err?.name !== "AbortError") setCopied("Couldn't open the share sheet");
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2400);
    } catch {
      setCopied("Couldn't copy — select the text below instead");
    }
  };

  const action = (label, onClick, href, primary) => {
    const style = {
      ...(primary ? btnPrimary : btnSecondary),
      width: "100%",
      textAlign: "center",
      textDecoration: "none",
      display: "block",
      boxSizing: "border-box",
    };
    return href ? (
      <a href={href} style={style} onClick={onClose}>
        {label}
      </a>
    ) : (
      <button type="button" onClick={onClick} style={style}>
        {label}
      </button>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, maxWidth: 420, width: "100%", textAlign: "left" }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Invite to this board</h3>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 16px" }}>
          {isMobile
            ? "They'll land straight on this board — no account needed."
            : "Send them the message below. They'll land straight on this board — no account needed."}
        </p>

        {/* Shown, not hidden behind the button: people want to know what is
            about to go out under their name. */}
        <div
          style={{
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.lg,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: colors.textSecondary,
              wordBreak: "break-word",
            }}
          >
            {message}
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: colors.accentViolet,
              wordBreak: "break-all",
            }}
          >
            {url}
          </p>
        </div>

        {isPrivate && (
          <p style={{ color: colors.accentGold, fontSize: 12, margin: "0 0 14px" }}>
            This space is private — they'll need the password as well. It isn't included in the
            message.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {isMobile ? (
            <>
              {canShare && action("Share", share, null, true)}
              {action("Send as a text", null, smsHref(full), !canShare)}
              {action(copied === "link" ? "Link copied" : "Copy link", () => copy(url, "link"))}
            </>
          ) : (
            <>
              {action(
                copied === "message" ? "Copied — paste it anywhere" : "Copy invite",
                () => copy(full, "message"),
                null,
                true
              )}
              {canShare && action("Share", share)}
              {action("Email it", null, mailtoHref("Join my SquarePool board", full))}
            </>
          )}
        </div>

        {copied && copied !== "link" && copied !== "message" && (
          <p style={{ color: colors.accentRed, fontSize: 12, margin: "12px 0 0" }}>{copied}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            ...btnSecondary,
            width: "100%",
            marginTop: 8,
            boxSizing: "border-box",
            color: colors.textDim,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
