import React from "react";
import { colors, radii } from "../../styles";

function Tile({ label, value, hint, tone }) {
  return (
    <div
      style={{
        background: colors.surface3,
        border: `1px solid ${tone ? tone + "40" : colors.border}`,
        borderRadius: radii.lg,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: tone || colors.textPrimary,
          lineHeight: 1.1,
        }}
      >
        {value ?? "—"}
      </div>
      <div
        style={{
          fontSize: 11,
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 700,
          marginTop: 6,
        }}
      >
        {label}
      </div>
      {hint && <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/**
 * "Active" is ambiguous, so boards are reported three ways rather than as one
 * number that hides its own definition.
 */
export function StatsGrid({ stats }) {
  const s = stats || {};
  const group = (title, tiles) => (
    <div style={{ marginBottom: 24 }}>
      <p
        style={{
          color: colors.textDim,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          fontWeight: 700,
          margin: "0 0 10px",
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {tiles}
      </div>
    </div>
  );

  return (
    <div>
      {group("Users", [
        <Tile key="u" label="Registered" value={s.users_total} />,
        <Tile key="o" label="Owners" value={s.users_owners} tone={colors.accentGold} />,
        <Tile key="p" label="Players" value={s.users_players} />,
        <Tile key="n" label="New (30d)" value={s.users_new_30d} tone={colors.accentGreenBright} />,
        <Tile
          key="c"
          label="Closed"
          value={s.users_closed}
          tone={s.users_closed ? colors.accentRed : null}
        />,
      ])}

      {group("Spaces", [
        <Tile key="t" label="Total" value={s.spaces_total} />,
        <Tile key="pr" label="Private" value={s.spaces_private} tone={colors.accentGold} />,
        <Tile key="n" label="New (30d)" value={s.spaces_new_30d} tone={colors.accentGreenBright} />,
        <Tile
          key="ow"
          label="Ownerless"
          value={s.spaces_ownerless}
          tone={s.spaces_ownerless ? colors.accentRed : null}
          hint={s.spaces_ownerless ? "needs transfer" : null}
        />,
      ])}

      {group("Alpha gate", [
        <Tile
          key="ou"
          label="Organisers"
          value={s.owners_cap == null ? s.owners_used : `${s.owners_used} / ${s.owners_cap}`}
          tone={
            s.owners_cap != null && s.owners_used >= s.owners_cap
              ? colors.accentRed
              : colors.accentGreenBright
          }
          hint={
            s.owners_cap == null
              ? "no cap set"
              : s.owners_used >= s.owners_cap
                ? "full — new organisers refused"
                : `${s.owners_cap - s.owners_used} slots left`
          }
        />,
        <Tile key="oa" label="Allowlisted" value={s.owners_allowlisted} />,
      ])}

      {group("Boards", [
        <Tile key="t" label="Total" value={s.boards_total} />,
        <Tile key="u" label="Not archived" value={s.boards_unarchived} />,
        <Tile
          key="e"
          label="With entries"
          value={s.boards_with_entries}
          tone={colors.accentBrandAlt}
        />,
        <Tile
          key="r"
          label="Touched (30d)"
          value={s.boards_touched_30d}
          tone={colors.accentGreenBright}
        />,
        <Tile
          key="d"
          label="Deleted"
          value={s.boards_deleted}
          tone={s.boards_deleted ? colors.accentGold : null}
          hint={s.boards_deleted ? "restorable" : null}
        />,
      ])}

      {group("Operations", [
        <Tile
          key="p"
          label="Pending entries"
          value={s.pending_entries}
          tone={colors.accentOrange}
        />,
        <Tile
          key="s"
          label="Stale queues"
          value={s.pending_stale_7d}
          tone={s.pending_stale_7d ? colors.accentRed : null}
          hint="untouched 7d+"
        />,
        <Tile key="r" label="State rows" value={s.rows_spaces} hint="free-tier usage" />,
      ])}
    </div>
  );
}
