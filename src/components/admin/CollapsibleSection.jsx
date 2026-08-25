import React, { useEffect, useRef, useState } from "react";
import { adminSectionStyle, radii } from "../../styles";
import { colors } from "../../styles";

/**
 * An admin section that can be folded away.
 *
 * Entries and the pending queue both grow without bound — a full board is a
 * hundred squares across however many people — and an admin scrolling past all
 * of it to reach the settings underneath is the common case, not the rare one.
 *
 * Defaults are per-section rather than uniform: a queue with something in it
 * opens, because it is work waiting; a list of past entries stays shut, because
 * it is a record.
 */
export function CollapsibleSection({
  icon,
  title,
  count,
  countTone,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  // defaultOpen is read once, but the queue it describes loads asynchronously —
  // so a console opened before the fetch lands would render "0 pending",
  // collapse, and then stay collapsed once the entries actually arrived. Open
  // on the transition into having work, and only on that edge: a section the
  // admin has deliberately folded away must stay folded.
  const hadWork = useRef(defaultOpen);
  useEffect(() => {
    if (defaultOpen && !hadWork.current) setOpen(true);
    hadWork.current = defaultOpen;
  }, [defaultOpen]);

  return (
    <div style={adminSectionStyle}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          margin: open ? "0 0 8px" : 0,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: 700,
          color: colors.textSecondary,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        {title}
        {count > 0 && (
          <span
            style={{
              background: countTone || colors.surface6,
              color: countTone ? "#1a1a2e" : colors.textMuted,
              borderRadius: radii.pill,
              padding: "1px 9px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {count}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span
          style={{
            color: colors.textDim,
            fontSize: 11,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {open && children}
    </div>
  );
}
