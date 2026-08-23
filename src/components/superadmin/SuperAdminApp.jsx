import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSuperAdmin } from "../../hooks/useSuperAdmin";
import {
  colors,
  radii,
  pageStyle,
  containerStyle,
  cardStyle,
  inputStyle,
  btnSecondary,
} from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { AdminLanding } from "../admin/AdminLanding";
import { StatsGrid } from "./StatsGrid";
import { UsersSection } from "./UsersSection";
import { SpacesSection } from "./SpacesSection";
import { AuditSection } from "./AuditSection";
import { BoardsSection } from "./BoardsSection";
import { ViewAsBanner } from "./ViewAsBanner";
import { ThemeToggle } from "../common";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "spaces", label: "Spaces" },
  { key: "boards", label: "Boards" },
  { key: "audit", label: "Audit log" },
];

function Shell({ children, viewAs, onExitViewAs }) {
  return (
    <div style={pageStyle}>
      <BackgroundDecor />
      <ViewAsBanner viewAs={viewAs} onExit={onExitViewAs} />
      <div style={{ ...containerStyle, paddingTop: viewAs ? 70 : 40, paddingBottom: 60 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * /superadmin. The role check here is for the UI only — every RPC behind it
 * re-checks is_superadmin() server-side, so a tampered client gets nothing.
 */
export function SuperAdminApp() {
  const { isLoggedIn, isSuperadmin, loading: authLoading, profile, signOut } = useAuth();
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const sa = useSuperAdmin();

  if (authLoading) {
    return (
      <Shell>
        <p style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", paddingTop: 80 }}>
          Loading…
        </p>
      </Shell>
    );
  }

  if (!isLoggedIn) return <AdminLanding />;

  // Deliberately indistinguishable from "no such page" — don't confirm the
  // console exists to someone who isn't allowed in.
  if (!isSuperadmin) {
    return (
      <Shell>
        <div style={{ ...cardStyle, maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>Not found</h2>
          <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 20px" }}>
            No page exists at this address.
          </p>
          <a
            href="/admin"
            style={{ color: colors.accentViolet, fontWeight: 600, textDecoration: "none" }}
          >
            Go to the admin site
          </a>
        </div>
      </Shell>
    );
  }

  const submitSearch = (e) => {
    e.preventDefault();
    sa.refresh(search);
  };

  return (
    <Shell viewAs={sa.viewAs} onExitViewAs={sa.stopViewAs}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
            Superadmin
          </h1>
          <p style={{ margin: "4px 0 0", color: colors.textDim, fontSize: 12 }}>
            {profile?.email} · every action here is logged
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => sa.refresh(search)}
            style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12, color: colors.textDim }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* View-as detail */}
      {sa.viewAs && (
        <div style={{ ...cardStyle, marginBottom: 20, padding: 20 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>{sa.viewAs.email}</h3>
          <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 14px" }}>
            role {sa.viewAs.role}
            {sa.viewAs.closed_at ? " · closed" : ""} · this is a read-only view of what this account
            can reach, not a signed-in session
          </p>
          <p style={{ color: colors.textMuted, fontSize: 12, margin: "0 0 6px", fontWeight: 700 }}>
            Spaces ({(sa.viewAs.spaces || []).length})
          </p>
          {(sa.viewAs.spaces || []).length === 0 ? (
            <p style={{ color: colors.textDim, fontSize: 12, margin: 0 }}>None.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sa.viewAs.spaces.map((s) => (
                <a
                  key={s.code}
                  href={`/#${s.code}`}
                  style={{
                    background: colors.surface4,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.pill,
                    padding: "5px 14px",
                    fontSize: 12,
                    color: colors.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  #{s.code} · {s.role}
                  {s.is_private ? " 🔒" : ""}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: colors.surface3,
          borderRadius: radii.pill,
          border: `1px solid ${colors.border}`,
          padding: 4,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: "1 1 auto",
              padding: "9px 16px",
              borderRadius: radii.pill,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "inherit",
              background:
                tab === t.key
                  ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
                  : "transparent",
              color: tab === t.key ? colors.white : colors.textMuted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sa.error && (
        <p style={{ color: colors.accentRed, fontSize: 13, margin: "0 0 16px" }}>{sa.error}</p>
      )}

      {(tab === "users" || tab === "spaces") && (
        <form onSubmit={submitSearch} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "users" ? "Search email or name…" : "Search space code…"}
            style={{ ...inputStyle, padding: "9px 12px", fontSize: 13 }}
          />
          <button type="submit" style={{ ...btnSecondary, padding: "9px 18px", fontSize: 13 }}>
            Search
          </button>
        </form>
      )}

      {sa.loading ? (
        <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading…</p>
      ) : (
        <>
          {tab === "overview" && <StatsGrid stats={sa.stats} />}
          {tab === "users" && (
            <UsersSection
              users={sa.users}
              onClose={sa.closeAccount}
              onReopen={sa.reopenAccount}
              onSetRole={sa.setRole}
              onViewAs={sa.startViewAs}
            />
          )}
          {tab === "spaces" && (
            <SpacesSection
              spaces={sa.spaces}
              users={sa.users}
              onResetPassword={sa.resetSpacePassword}
              onTransfer={sa.transferSpace}
              onDelete={sa.deleteSpace}
            />
          )}
          {tab === "boards" && (
            <BoardsSection
              deletedBoards={sa.deletedBoards}
              spaces={sa.spaces}
              onDeleteArchived={sa.deleteArchivedBoards}
              onRestore={sa.restoreBoard}
              onPurge={sa.purgeDeletedBoards}
            />
          )}
          {tab === "audit" && <AuditSection audit={sa.audit} />}
        </>
      )}
    </Shell>
  );
}
