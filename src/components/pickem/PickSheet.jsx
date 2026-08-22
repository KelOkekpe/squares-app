import React, { useState } from "react";
import { colors, radii, cardStyle, inputStyle, labelStyle, btnPrimary } from "../../styles";
import { isSlateLocked, tiebreakGame, missingPicks, PICK_AWAY, PICK_HOME } from "../../utils";
import { isValidEmail, isValidPhone } from "../join/NameStep";

function TeamButton({ label, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
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
      {label}
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

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800 }}>Make your picks</h3>
      <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 18px" }}>
        Pick a winner in all {slate?.games?.length || 0} games. Everything locks at the first
        kickoff.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {(slate?.games || []).map((game) => (
          <div key={game.id}>
            <div style={{ display: "flex", gap: 6 }}>
              <TeamButton
                label={game.away?.abbr || game.away?.name}
                selected={sheet[game.id] === PICK_AWAY}
                onClick={() => setSheet((s) => ({ ...s, [game.id]: PICK_AWAY }))}
              />
              <span
                style={{ alignSelf: "center", color: colors.textDim, fontSize: 11, flexShrink: 0 }}
              >
                @
              </span>
              <TeamButton
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
    </div>
  );
}
