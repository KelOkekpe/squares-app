import React, { useState } from "react";
import { colors, radii, btnSecondary, adminInputStyle } from "../../styles";

const RETENTION_DAYS = 30;

function when(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function daysSince(ts) {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function Panel({ title, tone, children }) {
  return (
    <div
      style={{
        background: colors.surface2,
        border: `1px solid ${tone || colors.border}`,
        borderRadius: radii.lg,
        padding: 18,
      }}
    >
      <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Deleting boards.
 *
 * Two separate actions on purpose. Deleting is reversible and destroys nothing
 * — a board's `paid` / `checkout_session_id` is the only record tying a Stripe
 * charge to what it bought, so a mis-click here must not be able to lose it.
 * Purging is the irreversible one, and it only reaches boards that have been
 * deleted long enough to notice the mistake.
 */
export function BoardsSection({ deletedBoards, spaces, onDeleteArchived, onRestore, onPurge }) {
  const [scope, setScope] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");

  const purgeable = deletedBoards.filter((b) => daysSince(b.deleted_at) >= RETENTION_DAYS);

  const run = async (label, fn, describe) => {
    setBusy(label);
    setResult("");
    const outcome = await fn();
    setBusy("");
    setConfirmDelete(false);
    setConfirmPurge(false);
    if (outcome?.ok) setResult(describe);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {result && (
        <p style={{ color: colors.accentGreenBright, fontSize: 13, margin: 0 }}>{result}</p>
      )}

      <Panel title="Delete archived boards">
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 12px", lineHeight: 1.6 }}>
          Hides every <strong>archived</strong> board from its space. Live boards are never touched.
          Nothing is destroyed — entries, scores and the payment record stay, and any board can be
          put back below.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            style={{ ...adminInputStyle, width: "auto", minWidth: 190, margin: 0 }}
          >
            <option value="">Every space</option>
            {spaces.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ ...btnSecondary, color: colors.accentGold }}
            >
              Delete archived
            </button>
          ) : (
            <>
              <span style={{ color: colors.accentGold, fontSize: 12 }}>
                Delete every archived board {scope ? `in ${scope}` : "in every space"}?
              </span>
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={() =>
                  run(
                    "delete",
                    () => onDeleteArchived(scope),
                    `Archived boards ${scope ? `in ${scope} ` : ""}were deleted. They can be restored below.`
                  )
                }
                style={{ ...btnSecondary, color: colors.accentGold }}
              >
                {busy === "delete" ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{ ...btnSecondary, color: colors.textDim }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </Panel>

      <Panel title={`Deleted boards (${deletedBoards.length})`}>
        {!deletedBoards.length ? (
          <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>
            Nothing is deleted right now.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {deletedBoards.map((b) => {
              const age = daysSince(b.deleted_at);
              return (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                    padding: "9px 12px",
                    background: colors.surface3,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.md,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: colors.textPrimary, fontWeight: 700 }}>{b.name}</span>
                  <span style={{ color: colors.textDim }}>{b.space_code}</span>
                  <span style={{ color: colors.textDimmest }}>
                    {b.game_type === "pickem" ? "pick'em" : "squares"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, color: colors.textDim }}>
                    {b.entry_count} {b.entry_count === 1 ? "entry" : "entries"} · {b.state_rows}{" "}
                    state rows
                  </span>
                  <span
                    style={{ color: age >= RETENTION_DAYS ? colors.accentRed : colors.textDimmest }}
                  >
                    deleted {when(b.deleted_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => run("restore", () => onRestore(b.id), `${b.name} was restored.`)}
                    style={{ ...btnSecondary, padding: "4px 10px", fontSize: 11 }}
                  >
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Purge for good" tone={colors.borderDanger}>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 12px", lineHeight: 1.6 }}>
          Permanently erases boards deleted more than {RETENTION_DAYS} days ago, along with every
          grid, entry, pending request, score, pick'em sheet and stored email address belonging to
          them. This cannot be undone, and it removes your own record of what a Stripe charge paid
          for.
        </p>

        {!purgeable.length ? (
          <p style={{ color: colors.textDim, fontSize: 12, margin: 0 }}>
            Nothing is old enough to purge. Boards become eligible {RETENTION_DAYS} days after they
            are deleted.
          </p>
        ) : !confirmPurge ? (
          <button
            type="button"
            onClick={() => setConfirmPurge(true)}
            style={{ ...btnSecondary, color: colors.accentRed }}
          >
            Purge {purgeable.length} board{purgeable.length === 1 ? "" : "s"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: colors.accentRed, fontSize: 12, flex: 1, minWidth: 200 }}>
              Permanently erase {purgeable.length} board
              {purgeable.length === 1 ? "" : "s"} and everything on{" "}
              {purgeable.length === 1 ? "it" : "them"}? There is no undo.
            </span>
            <button
              type="button"
              disabled={busy === "purge"}
              onClick={() =>
                run("purge", () => onPurge(RETENTION_DAYS), "Purged. The data is gone for good.")
              }
              style={{ ...btnSecondary, color: colors.accentRed }}
            >
              {busy === "purge" ? "Purging…" : "Yes, purge"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmPurge(false)}
              style={{ ...btnSecondary, color: colors.textDim }}
            >
              Cancel
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
