import React, { useState } from "react";
import { adminSectionStyle, adminInputStyle, labelStyle, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";
import { tiebreakGame, slateLocksAt, isSlateLocked, gradedCount, rankEntries } from "../../utils";

/**
 * Managing a pick'em contest.
 *
 * Deliberately small: a squares board's controls — price per square, team
 * colours, quarter scores, override cell — mean nothing here, and showing them
 * invited an admin to change settings that don't apply.
 */
export function PickemSettingsSection({ slate, setSlate, picks, setPicks }) {
  const [confirmRemove, setConfirmRemove] = useState(null);

  const games = slate?.games || [];
  const tb = tiebreakGame(slate);
  const lock = slateLocksAt(slate);
  const locked = isSlateLocked(slate);
  const graded = gradedCount(slate);
  const standings = rankEntries(picks || [], slate);
  const paidCount = (picks || []).filter((p) => p.paid).length;

  const togglePaid = (id) =>
    setPicks((list) => list.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)));

  const remove = (id) => {
    setPicks((list) => list.filter((p) => p.id !== id));
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
            Paid{" "}
            <strong style={{ color: paidCount ? colors.accentGreenBright : colors.textPrimary }}>
              {paidCount}
            </strong>
          </span>
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
        <select
          value={tb?.id || ""}
          onChange={(e) => setTiebreak(e.target.value)}
          disabled={locked}
          style={adminInputStyle}
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.shortName}
              {g.startsAt
                ? ` — ${new Date(g.startsAt).toLocaleDateString([], { weekday: "short" })} ${new Date(g.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : ""}
            </option>
          ))}
        </select>
        {locked && (
          <p style={{ color: colors.textDim, fontSize: 11, margin: "6px 0 0" }}>
            Locked — changing it after picks are in would move the target.
          </p>
        )}
      </div>

      {/* entries */}
      <div style={adminSectionStyle}>
        <label style={labelStyle}>Entries</label>
        <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 12px" }}>
          Standings order. Mark who's paid; removing an entry drops it from the standings.
        </p>

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
                    border: `1px solid ${colors.border}`,
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
                        <a
                          href={`mailto:${p.email}`}
                          style={{ color: colors.accentViolet, textDecoration: "none" }}
                        >
                          {p.email}
                        </a>
                        {p.phone ? ` · ${p.phone}` : ""} · TB {p.tiebreak}
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: colors.textPrimary }}>
                      {row.correct}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePaid(p.id)}
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: p.paid ? colors.accentGreenBright : colors.textDim,
                        borderColor: p.paid ? "#4ade8040" : colors.border,
                      }}
                    >
                      {p.paid ? "Paid" : "Unpaid"}
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
