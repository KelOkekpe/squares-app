import React, { useState } from "react";
import { adminSectionStyle, labelStyle, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";
import { allocateFill, scaledPayouts } from "../../utils";

/**
 * Fills an undersold board and drops the payout to match the money in.
 *
 * Nobody pays for the extra squares — the pot shrinks instead, so every dollar
 * already paid keeps the same share of it.
 */
export function SmartFillSection({ config, board, onSmartFill }) {
  const [confirming, setConfirming] = useState(false);

  const { allocations, empty, sold } = allocateFill(board);
  const scaled = scaledPayouts(config, board);
  const alreadyFilled = !!config.smartFilledAt;
  const canFill = empty > 0 && sold > 0 && !alreadyFilled;
  const kickoff = config.game?.startsAt ? new Date(config.game.startsAt).getTime() : null;
  const scheduled = kickoff && !alreadyFilled ? kickoff - 5 * 60 * 1000 : null;

  const money = (n) => `$${Number(n || 0).toLocaleString()}`;

  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Smart fill</label>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 10px" }}>
        Hands the empty squares to people who already bought in, proportional to what they paid, and
        drops the payout to the money actually collected. Nobody is charged for the extra squares.
      </p>

      {/* Automatic, once, shortly before kickoff — late enough that stragglers
          can still buy in, early enough that Q1 never lands on an empty square. */}
      <div
        style={{
          padding: "10px 14px",
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.md,
          marginBottom: 10,
          fontSize: 12,
          color: colors.textMuted,
        }}
      >
        {alreadyFilled ? (
          <>
            <strong style={{ color: colors.accentGreenBright }}>Filled</strong>{" "}
            {new Date(config.smartFilledAt).toLocaleString()} — payout is now{" "}
            <strong style={{ color: colors.textPrimary }}>{money(config.totalPot)}</strong>.
          </>
        ) : scheduled ? (
          <>
            Runs automatically at{" "}
            <strong style={{ color: colors.textPrimary }}>
              {new Date(scheduled).toLocaleString()}
            </strong>
            , five minutes before kickoff. Nothing to do.
          </>
        ) : (
          <>
            Link a game under <strong>Live scores</strong> and this runs itself five minutes before
            kickoff. Without a kickoff time it has to be run by hand.
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          padding: "10px 14px",
          background: colors.surface3,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.lg,
          marginBottom: 10,
          fontSize: 12,
        }}
      >
        <span style={{ color: colors.textMuted }}>
          Sold <strong style={{ color: colors.textPrimary }}>{sold}/100</strong>
        </span>
        <span style={{ color: colors.textMuted }}>
          Empty{" "}
          <strong style={{ color: empty ? colors.accentOrange : colors.textPrimary }}>
            {empty}
          </strong>
        </span>
        <span style={{ color: colors.textMuted }}>
          Utilisation{" "}
          <strong style={{ color: colors.textPrimary }}>
            {Math.round(scaled.utilization * 100)}%
          </strong>
        </span>
      </div>

      {!canFill ? (
        <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>
          {alreadyFilled
            ? "Smart fill has already run on this board. It only runs once."
            : empty === 0
              ? "The board is full — nothing to fill."
              : "No entries yet. Smart fill shares squares among existing players, so it needs at least one."}
        </p>
      ) : !confirming ? (
        <>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{ ...btnSecondary, width: "100%", padding: "10px", fontSize: 13 }}
          >
            {scheduled ? "Run it now instead" : "Preview smart fill"}
          </button>
        </>
      ) : (
        <div>
          <p
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              margin: "0 0 8px",
              fontWeight: 700,
            }}
          >
            Each player receives:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {[...allocations]
              .sort((a, b) => b[1] - a[1])
              .map(([name, extra]) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: colors.textMuted,
                  }}
                >
                  <span>{name}</span>
                  <span style={{ color: colors.accentGreenBright, fontWeight: 700 }}>+{extra}</span>
                </div>
              ))}
          </div>

          <div
            style={{
              padding: "10px 14px",
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.md,
              marginBottom: 12,
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            Payout drops from <strong>{money(config.totalPot)}</strong> to{" "}
            <strong style={{ color: colors.accentGreenBright }}>{money(scaled.totalPot)}</strong>
            {config.quarterlyPayout ? (
              <>
                {" "}
                · quarterly {money(config.quarterlyPayout)} →{" "}
                <strong style={{ color: colors.accentGreenBright }}>
                  {money(scaled.quarterlyPayout)}
                </strong>
              </>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                onSmartFill();
                setConfirming(false);
              }}
              style={{
                ...btnSecondary,
                flex: 1,
                padding: "10px",
                fontSize: 13,
                color: colors.accentGreenBright,
                borderColor: "#4ade8040",
              }}
            >
              Fill {empty} square{empty === 1 ? "" : "s"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{ ...btnSecondary, flex: 1, padding: "10px", fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
