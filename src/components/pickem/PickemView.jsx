import React from "react";
import { containerStyle, colors } from "../../styles";
import { usePickem } from "../../hooks/usePickem";
import { isSlateLocked } from "../../utils";
import { PickSheet } from "./PickSheet";
import { Standings } from "./Standings";

/** A pick'em contest: the sheet while it's open, standings once it isn't. */
export function PickemView({ spaceCode, poolId, poolName, onBack }) {
  const { slate, picks, submit, submitting } = usePickem(spaceCode, poolId);

  if (!slate?.games?.length) {
    return (
      <main style={{ ...containerStyle, paddingTop: 40, paddingBottom: 60, textAlign: "center" }}>
        <p style={{ color: colors.textMuted, fontSize: 14 }}>
          This contest has no games yet — your admin is still setting it up.
        </p>
      </main>
    );
  }

  const locked = isSlateLocked(slate);

  return (
    <main style={{ ...containerStyle, paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: colors.accentViolet,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          ← Back
        </button>

        <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>
          {poolName || "Weekly picks"}
        </h2>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 22px" }}>
          {slate.label ? `${slate.label} · ` : ""}
          {slate.games.length} games · most correct wins
        </p>

        {/* The sheet sits collapsed above the standings — one bar rather than a
            screenful, so the table is visible without scrolling past it. Once
            picks close it drops below, since there's nothing left to fill in. */}
        {locked ? (
          <>
            <Standings slate={slate} entries={picks} />
            <div style={{ marginTop: 16 }}>
              <PickSheet slate={slate} onSubmit={submit} submitting={submitting} />
            </div>
          </>
        ) : (
          <>
            <PickSheet slate={slate} onSubmit={submit} submitting={submitting} />
            <div style={{ marginTop: 16 }}>
              <Standings slate={slate} entries={picks} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
