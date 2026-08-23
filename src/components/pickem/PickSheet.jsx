import React, { useState } from "react";
import { colors, radii, cardStyle, inputStyle, labelStyle, btnPrimary } from "../../styles";
import { isSlateLocked, tiebreakGame, missingPicks, PICK_AWAY, PICK_HOME } from "../../utils";
import { isValidEmail, isValidPhone } from "../join/NameStep";
import { TeamLogo } from "../common";

function TeamButton({ team, label, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        flex: 1,
        padding: "11px 10px",
        borderRadius: radii.md,
        border: `1px solid ${selected ? colors.accentPurple : colors.border}`,
        background: selected
          ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
          : colors.surface2,
        color: selected ? colors.white : colors.textSecondary,
        fontWeight: 700,
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      <TeamLogo team={team} size={18} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </button>
  );
}

/**
 * The weekly sheet. Every game must be picked before it can be submitted —
 * a partial sheet just scores lower, which nobody intends.
 */
export function PickSheet({ slate, onSubmit, submitting }) {
  const [sheet, setSheet] = useState({});
  const [tiebreak, setTiebreak] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  // Collapsed by default: sixteen games and four fields buried the standings,
  // which is what people come back to look at.
  const [open, setOpen] = useState(false);

  const locked = isSlateLocked(slate);
  const tb = tiebreakGame(slate);
  const remaining = missingPicks(sheet, slate);
  const contactOk = name.trim() && isValidEmail(email) && isValidPhone(phone);
  const ready = !remaining && tiebreak !== "" && contactOk && !locked;

  const submit = async () => {
    setError("");
    const result = await onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      picks: sheet,
      tiebreak,
    });
    if (result.error) return setError(result.error);
    setDone(result.entry);
  };

  if (done) {
    return (
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Picks are in</h3>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
          Standings update automatically as games finish. Submitting again with the same email
          replaces this sheet, right up until kickoff.
        </p>
      </div>
    );
  }

  if (locked) {
    return (
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Picks are closed</h3>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
          This week locked at the first kickoff. Check the standings below.
        </p>
      </div>
    );
  }

  const total = slate?.games?.length || 0;
  const picked = total - remaining;

  return (
    <div style={{ ...cardStyle, padding: open ? 32 : 0, overflow: "hidden" }}>
      {/* Collapsed, this is one tappable bar showing progress. Sixteen games
          plus four fields buried the standings, which is what people come
          back to look at. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: open ? "0 0 18px" : "20px 24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: colors.textPrimary }}
          >
            Make your picks
          </h3>
          <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>
            {picked === 0
              ? `${total} games · locks at the first kickoff`
              : remaining === 0
                ? "All games picked — open to submit"
                : `${picked} of ${total} picked · ${remaining} to go`}
          </p>
        </div>

        {picked > 0 && (
          <span
            style={{
              flexShrink: 0,
              background: remaining === 0 ? colors.accentGreenBright : colors.accentPurple,
              color: colors.white,
              borderRadius: radii.pill,
              padding: "3px 11px",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {picked}/{total}
          </span>
        )}

        <span
          aria-hidden
          style={{
            flexShrink: 0,
            color: colors.accentViolet,
            fontSize: 13,
            fontWeight: 800,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>

      {!open && (
        <div style={{ padding: "0 24px 20px" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ ...btnPrimary, width: "100%" }}
          >
            {picked === 0
              ? "Start picking"
              : remaining === 0
                ? "Review and submit"
                : "Continue picking"}
          </button>
        </div>
      )}

      {open && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {(slate?.games || []).map((game) => (
              <div key={game.id}>
                <div style={{ display: "flex", gap: 6 }}>
                  <TeamButton
                    team={game.away}
                    label={game.away?.abbr || game.away?.name}
                    selected={sheet[game.id] === PICK_AWAY}
                    onClick={() => setSheet((s) => ({ ...s, [game.id]: PICK_AWAY }))}
                  />
                  <span
                    style={{
                      alignSelf: "center",
                      color: colors.textDim,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    @
                  </span>
                  <TeamButton
                    team={game.home}
                    label={game.home?.abbr || game.home?.name}
                    selected={sheet[game.id] === PICK_HOME}
                    onClick={() => setSheet((s) => ({ ...s, [game.id]: PICK_HOME }))}
                  />
                </div>
                {tb?.id === game.id && (
                  <p
                    style={{
                      color: colors.accentGold,
                      fontSize: 10,
                      margin: "3px 0 0",
                      fontWeight: 700,
                    }}
                  >
                    TIEBREAKER GAME
                  </p>
                )}
              </div>
            ))}
          </div>

          <label style={labelStyle}>
            Tiebreaker — total points in {tb?.shortName || "the final game"}
          </label>
          <input
            type="number"
            min={0}
            max={200}
            value={tiebreak}
            onChange={(e) => setTiebreak(e.target.value)}
            style={inputStyle}
            placeholder="e.g. 47"
          />
          <p style={{ color: colors.textDim, fontSize: 11, margin: "5px 0 18px" }}>
            Both teams' scores added together. Closest without going over wins a tie.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Your name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                placeholder="Joe Okekpe"
              />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {error && (
            <p style={{ color: colors.accentRed, fontSize: 13, margin: "0 0 12px" }}>{error}</p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!ready || submitting}
            style={{ ...btnPrimary, width: "100%", opacity: ready && !submitting ? 1 : 0.45 }}
          >
            {submitting
              ? "Submitting…"
              : remaining
                ? `${remaining} game${remaining === 1 ? "" : "s"} left to pick`
                : "Submit picks"}
          </button>
        </>
      )}
    </div>
  );
}
