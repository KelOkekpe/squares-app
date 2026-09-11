import React, { useState } from "react";
import { adminSectionStyle, adminInputStyle, labelStyle, btnPrimary, colors } from "../../styles";

/**
 * Assign or clear a single square.
 *
 * The digits are pickers rather than number inputs, and that is the whole
 * point. The board is stored by position, but the axis digits are shuffled, so
 * position is never what an admin reads off the grid. This section used to take
 * "Row (0-9)" and "Col (0-9)" and write them straight into `board[row][col]` —
 * indistinguishable from the digits printed on the board, and wrong by an
 * arbitrary amount on every board. Picking from the digits that are actually on
 * this board's axes makes the wrong square unselectable rather than merely
 * discouraged.
 */
export function OverrideCellSection({ headers, board, overrideCell }) {
  const rows = headers?.y ?? [];
  const cols = headers?.x ?? [];
  const [rowDigit, setRowDigit] = useState(null);
  const [colDigit, setColDigit] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const rowIndex = rows.indexOf(rowDigit);
  const colIndex = cols.indexOf(colDigit);
  const chosen = rowIndex >= 0 && colIndex >= 0;
  const occupant = chosen ? (board?.[rowIndex]?.[colIndex] ?? null) : null;

  const apply = () => {
    setError("");
    setDone("");
    if (!chosen) {
      setError("Pick a row digit and a column digit.");
      return;
    }
    const res = overrideCell(rowIndex, colIndex, name);
    if (res?.error) {
      setError(res.error);
      return;
    }
    const target = `row ${rowDigit}, column ${colDigit}`;
    setDone(
      name.trim()
        ? `${name.trim()} now holds ${target}.`
        : `Cleared ${target}${res?.previous ? ` — was ${res.previous}` : ""}.`
    );
    setName("");
  };

  if (!rows.length || !cols.length) {
    return (
      <div style={adminSectionStyle}>
        <label style={labelStyle}>Override Cell</label>
        <p style={{ color: colors.textMuted, fontSize: 12, margin: "6px 0 0" }}>
          This board has no axis digits yet, so there is no square to name.
        </p>
      </div>
    );
  }

  const pickerStyle = { ...adminInputStyle, width: "100%" };

  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Override Cell</label>
      <p style={{ color: colors.textMuted, fontSize: 11.5, margin: "2px 0 10px" }}>
        Pick the digits as they appear on the board's edges.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 10 }} htmlFor="override-row">
            Row digit
          </label>
          <select
            id="override-row"
            value={rowDigit ?? ""}
            onChange={(e) => setRowDigit(e.target.value === "" ? null : Number(e.target.value))}
            style={pickerStyle}
          >
            <option value="">—</option>
            {rows.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 10 }} htmlFor="override-col">
            Column digit
          </label>
          <select
            id="override-col"
            value={colDigit ?? ""}
            onChange={(e) => setColDigit(e.target.value === "" ? null : Number(e.target.value))}
            style={pickerStyle}
          >
            <option value="">—</option>
            {cols.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ ...labelStyle, fontSize: 10 }} htmlFor="override-name">
            Name
          </label>
          <input
            id="override-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={adminInputStyle}
            placeholder="Name (blank to clear)"
          />
        </div>
      </div>

      {/* Which square that actually is, and who is in it — an override is
          usually a correction, and overwriting the wrong person silently is the
          failure worth preventing. */}
      {chosen && (
        <p style={{ color: colors.textSecondary, fontSize: 11.5, margin: "8px 0 0" }}>
          Row {rowDigit}, column {colDigit} —{" "}
          {occupant ? <strong>currently {occupant}</strong> : "currently empty"}
        </p>
      )}

      <button
        onClick={apply}
        disabled={!chosen}
        style={{
          ...btnPrimary,
          marginTop: 10,
          width: "100%",
          opacity: chosen ? 1 : 0.5,
          cursor: chosen ? "pointer" : "default",
        }}
      >
        Apply Override
      </button>

      {error && (
        <p style={{ color: colors.accentRed, fontSize: 11.5, margin: "8px 0 0" }}>{error}</p>
      )}
      {done && <p style={{ color: colors.textMuted, fontSize: 11.5, margin: "8px 0 0" }}>{done}</p>}
    </div>
  );
}
