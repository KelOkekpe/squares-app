import React, { useState } from "react";
import { DEFAULT_POOL_ENTRY } from "../../utils";
import { colors } from "../../styles";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";

export function BoardManagementSection({
  pools,
  setPools,
  createPool,
  updatePool,
  toggleArchivePool,
  activePoolId,
  onSwitchPool,
}) {
  const [newPoolName, setNewPoolName] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const activePools = pools.filter((p) => !p.archived);
  const archivedPools = pools.filter((p) => p.archived);

  const handleCreate = async () => {
    const name = newPoolName.trim();
    if (!name) return;

    if (createPool) {
      // Use database create function if available
      const newPool = await createPool(name);
      if (newPool) {
        setNewPoolName("");
        onSwitchPool(newPool.id);
      }
    } else {
      // Fallback to local state update
      const entry = DEFAULT_POOL_ENTRY(name);
      setPools((prev) => [...prev, entry]);
      setNewPoolName("");
      onSwitchPool(entry.id);
    }
  };

  const toggleArchive = async (id) => {
    if (toggleArchivePool) {
      // Use database toggle function if available
      await toggleArchivePool(id);
    } else {
      // Fallback to local state update
      setPools((prev) => prev.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)));
    }

    // If archiving the active pool, switch to first non-archived
    const target = pools.find((p) => p.id === id);
    if (target && !target.archived && id === activePoolId) {
      const next = pools.find((p) => p.id !== id && !p.archived);
      if (next) onSwitchPool(next.id);
    }
  };

  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Pool Management</label>

      {/* Create new pool */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newPoolName}
          onChange={(e) => setNewPoolName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{ ...adminInputStyle, flex: 1 }}
          placeholder="e.g. Week 5, Super Bowl..."
        />
        <button
          onClick={handleCreate}
          disabled={!newPoolName.trim()}
          style={{
            background: newPoolName.trim()
              ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
              : "#ffffff10",
            color: newPoolName.trim() ? colors.white : colors.textDim,
            border: "none",
            padding: "10px 20px",
            borderRadius: 8,
            cursor: newPoolName.trim() ? "pointer" : "default",
            fontWeight: 700,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          + New Pool
        </button>
      </div>

      {/* Active pools */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activePools.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: p.id === activePoolId ? "#6c5ce715" : "#ffffff04",
              borderRadius: 8,
              border: `1px solid ${p.id === activePoolId ? "#6c5ce730" : colors.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {p.id === activePoolId && (
                <span
                  style={{
                    color: colors.accentPurple,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 1,
                  }}
                >
                  ACTIVE
                </span>
              )}
              <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 600 }}>
                {p.name}
              </span>
              <span style={{ color: colors.textDim, fontSize: 11 }}>
                {new Date(p.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {p.id !== activePoolId && (
                <button
                  onClick={() => onSwitchPool(p.id)}
                  style={{
                    background: "#ffffff10",
                    border: "none",
                    color: colors.accentPurple,
                    padding: "5px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Switch
                </button>
              )}
              <button
                onClick={() => toggleArchive(p.id)}
                style={{
                  background: "#ff444410",
                  border: "none",
                  color: "#ff8888",
                  padding: "5px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Archive
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Archived pools */}
      {archivedPools.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              color: colors.textDim,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              marginBottom: showArchived ? 8 : 0,
            }}
          >
            {showArchived ? "▾" : "▸"} {archivedPools.length} archived pool
            {archivedPools.length !== 1 ? "s" : ""}
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {archivedPools.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 14px",
                    background: "#ffffff02",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    opacity: 0.6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: colors.textMuted, fontSize: 13 }}>{p.name}</span>
                    <span style={{ color: colors.textDim, fontSize: 11 }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleArchive(p.id)}
                    style={{
                      background: "#22aa4410",
                      border: "none",
                      color: "#66cc88",
                      padding: "5px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
