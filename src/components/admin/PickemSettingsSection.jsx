import React, { useState } from "react";
import { adminSectionStyle, adminInputStyle, labelStyle, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";
import { tiebreakGame, slateLocksAt, isSlateLocked, gradedCount, rankEntries } from "../../utils";
import { usePickemContacts } from "../../hooks";
import { TeamLogo } from "../common";
import { PaymentDetailsSection } from "./PaymentDetailsSection";

/**
 * Managing a pick'em contest.
 *
 * Deliberately small: a squares board's controls — price per square, team
 * colours, quarter scores, override cell — mean nothing here, and showing them
 * invited an admin to change settings that don't apply.
 */
export function PickemSettingsSection({
  spaceCode,
  poolId,
  slate,
  setSlate,
  picks,
  config,
  setConfig,
  onSetPaid,
  onRemove,
}) {
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [error, setError] = useState("");
  // Entrants' details are not in the sheets any more; they come from the
  // admin-only table, so this is empty for anyone who shouldn't see them.
  const contacts = usePickemContacts(spaceCode, poolId);

  const games = slate?.games || [];
  const tb = tiebreakGame(slate);
  const lock = slateLocksAt(slate);
  const locked = isSlateLocked(slate);
  const graded = gradedCount(slate);
  const standings = rankEntries(picks || [], slate);
  const paidCount = (picks || []).filter((p) => p.paid).length;
  const chargesEntry = Number(config?.entryFee) > 0;
  const awaitingCount = (picks || []).length - paidCount;

  const togglePaid = async (id, paid) => {
    const result = await onSetPaid?.(id, !paid);
    setError(result?.error || "");
  };

  const remove = async (id) => {
    const result = await onRemove?.(id);
    setError(result?.error || "");
    setConfirmRemove(null);
  };

  const setTiebreak = (gameId) => setSlate((s) => ({ ...s, tiebreakGameId: gameId }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* status */}
      <div style={adminSectionStyle}>
        <label style={labelStyle}>Contest status</label>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, marginTop: 6 }}>
          <span style={{ color: colors.textMuted }}>
            Games <strong style={{ color: colors.textPrimary }}>{games.length}</strong>
          </span>
          <span style={{ color: colors.textMuted }}>
            Final <strong style={{ color: colors.textPrimary }}>{graded}</strong>
          </span>
          <span style={{ color: colors.textMuted }}>
            Entries <strong style={{ color: colors.textPrimary }}>{picks?.length || 0}</strong>
          </span>
          <span style={{ color: colors.textMuted }}>
            Confirmed{" "}
            <strong style={{ color: paidCount ? colors.accentGreenBright : colors.textPrimary }}>
              {paidCount}
            </strong>
          </span>
          {/* The number that needs the admin to do something. Unconfirmed
              sheets are recorded but kept out of the standings, so this is a
              queue rather than a statistic. */}
          {chargesEntry && awaitingCount > 0 && (
            <span style={{ color: colors.accentOrange, fontWeight: 700 }}>
              {awaitingCount} awaiting confirmation
            </span>
          )}
        </div>
        <p
          style={{
            color: locked ? colors.accentOrange : colors.textDim,
            fontSize: 12,
            margin: "10px 0 0",
          }}
        >
          {locked
            ? "Picks are closed — the week has kicked off."
            : lock
              ? `Picks lock ${new Date(lock).toLocaleString()}, at the first kickoff.`
              : "No kickoff times on this slate."}
        </p>
      </div>

      {/* tiebreaker */}
      <div style={adminSectionStyle}>
        <label style={labelStyle}>Tiebreaker game</label>
        <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 8px" }}>
          Ties break on this game's combined total — closest without going over. Defaults to the
          last kickoff of the week.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {games.map((g) => {
            const chosen = tb?.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                disabled={locked}
                onClick={() => setTiebreak(g.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: radii.md,
                  border: `1px solid ${chosen ? colors.accentGold : colors.border}`,
                  background: chosen ? colors.surface5 : colors.surface2,
                  color: colors.textPrimary,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: locked ? "default" : "pointer",
                }}
              >
                <TeamLogo team={g.away} size={18} />
                <span>{g.away?.abbr || "?"}</span>
                <span style={{ color: colors.textDimmest }}>@</span>
                <TeamLogo team={g.home} size={18} />
                <span>{g.home?.abbr || "?"}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: colors.textDim, fontWeight: 500 }}>
                  {g.startsAt
                    ? `${new Date(g.startsAt).toLocaleDateString([], { weekday: "short" })} ${new Date(g.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : ""}
                </span>
                {chosen && <span style={{ color: colors.accentGold, fontWeight: 900 }}>TB</span>}
              </button>
            );
          })}
        </div>
        {locked && (
          <p style={{ color: colors.textDim, fontSize: 11, margin: "6px 0 0" }}>
            Locked — changing it after picks are in would move the target.
          </p>
        )}
      </div>

      {/* Entry fee and where to send it — a pick'em winner is owed money
          exactly as a squares winner is. */}
      <div style={adminSectionStyle}>
        <label style={labelStyle}>Entry fee</label>
        <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 10px" }}>
          What each sheet costs. Leave at 0 for a free contest — players then see no payment step.
        </p>
        <input
          type="number"
          min="0"
          value={config?.entryFee ?? 0}
          onChange={(e) =>
            setConfig((c) => ({ ...c, entryFee: Math.max(0, Number(e.target.value)) }))
          }
          style={adminInputStyle}
        />
      </div>

      {Number(config?.entryFee) > 0 && (
        <PaymentDetailsSection config={config} setConfig={setConfig} />
      )}

      {/* entries */}
      <div style={adminSectionStyle}>
        <label style={labelStyle}>Entries</label>
        <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 12px" }}>
          Standings order. Mark who's paid; removing an entry drops it from the standings.
        </p>

        {/* These edits go to the server one entry at a time, so a failure has to
            be visible — the list won't have changed. */}
        {error && (
          <p style={{ color: colors.accentRed, fontSize: 12, margin: "0 0 12px" }}>{error}</p>
        )}

        {!picks?.length ? (
          <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>No entries yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {standings.map((row) => {
              const p = row.entry;
              return (
                <div
                  key={p.id}
                  style={{
                    background: colors.surface2,
                    border: `1px solid ${
                      chargesEntry && !p.paid ? colors.borderGold : colors.border
                    }`,
                    borderRadius: radii.lg,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ color: colors.textDim, fontSize: 12, width: 20 }}>
                      {row.rank}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                        {p.name}
                        {row.busted && (
                          <span
                            style={{
                              color: colors.accentRed,
                              fontSize: 10,
                              marginLeft: 8,
                              fontWeight: 800,
                            }}
                          >
                            OVER
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>
                        {contacts[p.id]?.email ? (
                          <a
                            href={`mailto:${contacts[p.id].email}`}
                            style={{ color: colors.accentBrandAlt, textDecoration: "none" }}
                          >
                            {contacts[p.id].email}
                          </a>
                        ) : (
                          <span style={{ color: colors.textDimmest }}>contact hidden</span>
                        )}
                        {contacts[p.id]?.payoutMethod
                          ? ` · pays via ${contacts[p.id].payoutMethod}`
                          : ""}
                        {contacts[p.id]?.paymentRef ? ` · ref ${contacts[p.id].paymentRef}` : ""}
                        {" · "}TB {p.tiebreak ?? "—"}
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: colors.textPrimary }}>
                      {row.correct}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePaid(p.id, p.paid)}
                      title={
                        p.paid ? "Confirmed — click to undo" : "Confirm their entry fee arrived"
                      }
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: p.paid ? colors.accentGreenBright : colors.accentGold,
                        borderColor: p.paid ? colors.borderSuccess : colors.borderGold,
                      }}
                    >
                      {/* "Unpaid" described a state, so it read as a label and
                          nobody realised it was the control that confirms
                          payment. The unconfirmed side now names the action. */}
                      {p.paid ? "✓ Paid" : "Mark as Paid"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(p.id)}
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: colors.textDim,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {confirmRemove === p.id && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <span style={{ color: colors.accentRed, fontSize: 11, flex: 1 }}>
                        Remove {p.name}'s entry?
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        style={{
                          ...btnSecondary,
                          padding: "4px 10px",
                          fontSize: 11,
                          color: colors.accentRed,
                        }}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(null)}
                        style={{ ...btnSecondary, padding: "4px 10px", fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
