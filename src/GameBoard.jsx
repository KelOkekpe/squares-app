import React, { useState, useCallback, useEffect } from "react";
import {
  splitPools,
  isPoolCompleted,
  STORAGE_KEYS,
  SPACE_META_KEY,
  DEFAULT_CONFIG,
  generateHeaders,
  getInitialBoard,
  getEmptySquares,
  placeParticipant,
  calculateSquares,
} from "./utils";
import {
  usePersistedState,
  usePools,
  useAuth,
  useSpacesRegistry,
  useSpaceAccess,
  useUserSpaces,
  usePoolAdmin,
} from "./hooks";
import { supabase, isSupabaseEnabled } from "./lib/supabase";
import { cellsToCoordinates, buildApprovalMessage } from "./utils/notify";
import { pageStyle, containerStyle } from "./styles";
import { colors, cardStyle, inputStyle, btnPrimary, btnSecondary } from "./styles";
import {
  Header,
  Footer,
  BackgroundDecor,
  HomeView,
  JoinView,
  BoardView,
  PastBoardsModal,
} from "./components/layout";
import { AdminPanel } from "./components/admin";
import { PasswordInput } from "./components/common";

export function GameBoard({ spaceCode, onExit }) {
  const { isSpaceAdmin, isOwner } = useAuth();
  const { spaces, loading: registryLoading } = useSpacesRegistry();
  const { hasAccess, verifyAndGrantAccess, refetch: refetchAccess } = useSpaceAccess();
  const { spaces: userSpaces, loading: userSpacesLoading } = useUserSpaces();

  const space = spaces.find((s) => s.code === spaceCode);
  const isOwnerOrAdmin = userSpaces.some((s) => s.code === spaceCode);
  const checkingAccess = registryLoading || userSpacesLoading;
  const needsPassword =
    !checkingAccess && space?.isPrivate && !hasAccess(spaceCode) && !isOwnerOrAdmin;

  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");

  // Surface a way out if the access check stalls rather than spinning forever
  const [accessSlow, setAccessSlow] = useState(false);
  useEffect(() => {
    if (!checkingAccess) {
      setAccessSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setAccessSlow(true), 9000);
    return () => clearTimeout(timer);
  }, [checkingAccess]);

  const handleGateSubmit = useCallback(async () => {
    if (!gatePassword.trim()) return;
    const { ok, error: verifyError } = await verifyAndGrantAccess(spaceCode, gatePassword);
    if (ok) {
      setGateError("");
      setGatePassword("");
      refetchAccess();
    } else {
      setGateError(verifyError || "Incorrect password");
    }
  }, [spaceCode, gatePassword, verifyAndGrantAccess, refetchAccess]);

  // ── Load pools from database ────────
  const {
    pools: dbPools,
    createPool: createPoolInDb,
    updatePool: updatePoolInDb,
    toggleArchivePool,
    loading: poolsLoading,
  } = usePools(spaceCode);
  const poolAdmin = usePoolAdmin(spaceCode);

  // ── space-level meta (active pool only) ────────
  const [spaceMeta, setSpaceMeta] = usePersistedState(SPACE_META_KEY(spaceCode), {
    activePoolId: null,
  });

  // Use pools from database
  const pools = dbPools;
  const { active: activePools, completed: completedPools } = splitPools(pools);

  // Which board you're looking at is per-viewer, not shared state. It used to
  // be written to `spaces`, which players have no write access to — so their
  // clicks silently failed. The space default still lives in spaceMeta and is
  // set from the admin panel; this only seeds the initial view.
  const [viewingPoolId, setViewingPoolId] = useState(null);

  const defaultPoolId = pools.find((p) => p.id === spaceMeta.activePoolId)?.id;
  const activePoolId =
    (viewingPoolId && pools.find((p) => p.id === viewingPoolId)?.id) ||
    defaultPoolId ||
    activePools[0]?.id ||
    pools[0]?.id;

  const currentPool = pools.find((p) => p.id === activePoolId) || null;
  const viewingCompleted = isPoolCompleted(currentPool);

  const setPools = useCallback(
    (updater) => {
      const newPools = typeof updater === "function" ? updater(pools) : updater;
      // Update each pool in database
      newPools.forEach((pool) => {
        const existing = pools.find((p) => p.id === pool.id);
        if (!existing) {
          // Creation goes through createPool, which requires an expiry date
          console.warn("setPools cannot create boards — use createPool with an expiry");
        } else if (existing.name !== pool.name || existing.archived !== pool.archived) {
          // Pool changed - update it
          updatePoolInDb(pool.id, {
            name: pool.name,
            archived: pool.archived || false,
          });
        }
      });
    },
    [pools, createPoolInDb, updatePoolInDb]
  );

  // Reset a board to its starting state. Config is deliberately preserved —
  // price, teams and payment instructions survive; the game does not.
  //
  // The previous version cleared the board, scores and participants but left
  // the pending queue intact and never reshuffled the numbers, so a "reset"
  // board could immediately regain entries and kept the old coordinates.
  const resetPool = useCallback(
    async (poolId) => {
      const targetId = poolId || activePoolId;
      const freshBoard = getInitialBoard();
      const freshHeaders = generateHeaders();

      if (targetId === activePoolId) {
        // Go through the loaded state so the UI updates immediately
        setBoard(freshBoard);
        setHeaders(freshHeaders);
        setParticipants([]);
        setPending([]);
        setScores({});
        setApprovalNotice(null);
        return { ok: true };
      }
      return poolAdmin.resetRemotePool(targetId, { board: freshBoard, headers: freshHeaders });
    },
    [activePoolId, setBoard, setHeaders, setParticipants, setPending, setScores, poolAdmin]
  );

  const toggleSubmissions = useCallback(
    async (poolId, disabled) => {
      if (poolId === activePoolId) {
        setConfig((c) => ({ ...c, submissionsDisabled: !!disabled }));
        poolAdmin.refetchConfigs();
        return { ok: true };
      }
      return poolAdmin.setSubmissionsDisabled(poolId, disabled);
    },
    [activePoolId, setConfig, poolAdmin]
  );

  // Local — works for anonymous players, who cannot write to `spaces`
  const switchPool = (id) => setViewingPoolId(id);

  // Admin-only: the board this space opens on for everyone
  const setDefaultPool = (id) => setSpaceMeta((prev) => ({ ...prev, activePoolId: id }));

  // ── pool-level persistent state (scoped by poolId) ──
  const keys = STORAGE_KEYS(spaceCode, activePoolId);
  // Use function initializers to prevent regeneration on every render
  const [headers, setHeaders] = usePersistedState(keys.headers, () => generateHeaders());
  const [board, setBoard] = usePersistedState(keys.board, () => getInitialBoard());
  const [config, setConfig] = usePersistedState(keys.admin, DEFAULT_CONFIG);
  const [scores, setScores] = usePersistedState(keys.scores, {});
  const [participants, setParticipants] = usePersistedState(keys.participants, []);
  // Entry requests awaiting admin payment confirmation
  const [pending, setPending] = usePersistedState(keys.pending, []);

  // ── ephemeral UI state ────────────────────────────────
  const [view, setView] = useState("home");
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutHandles, setPayoutHandles] = useState({});
  // Set on approval so the admin can send the player their coordinates
  const [approvalNotice, setApprovalNotice] = useState(null);
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [amount, setAmount] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestedCount, setRequestedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [adminAuth, setAdminAuth] = useState(false);
  const [showPastBoards, setShowPastBoards] = useState(false);

  // ── derived ───────────────────────────────────────────
  const fullName = [firstName.trim(), middleInitial ? `${middleInitial}.` : "", lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const squaresForAmount = calculateSquares(Number(amount), config.pricePerSquare);
  const emptyCount = getEmptySquares(board).length;
  // A completed board is closed to entries for the same reason a disabled one is
  const effectiveConfig = viewingCompleted ? { ...config, submissionsDisabled: true } : config;

  // ── handlers ──────────────────────────────────────────
  const resetJoinFlow = () => {
    setFirstName("");
    setMiddleInitial("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPayoutMethod("");
    setPayoutHandles({});
    setNameSubmitted(false);
    setAmount("");
    setRequestSubmitted(false);
    setRequestedCount(0);
    setSubmitError("");
  };

  // Players are anonymous and have no write access to `spaces` — the request is
  // appended server-side by submit_entry_request, which also serialises
  // simultaneous submissions. Nothing touches the board until an admin approves.
  const submitEntryRequest = useCallback(async () => {
    if (!amount || squaresForAmount < 1) return;
    const requested = Math.min(squaresForAmount, emptyCount);

    setSubmitting(true);
    setSubmitError("");
    const { error } = await supabase.rpc("submit_entry_request", {
      p_space_code: spaceCode,
      p_pool_id: activePoolId,
      p_name: fullName,
      p_amount: Number(amount),
      p_squares: requested,
      p_contact: {
        firstName: firstName.trim(),
        middleInitial,
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        payoutMethod,
        payoutHandles,
      },
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(error.message || "Could not submit your request. Try again.");
      return;
    }
    setRequestedCount(requested);
    setRequestSubmitted(true);
  }, [
    amount,
    squaresForAmount,
    emptyCount,
    fullName,
    spaceCode,
    activePoolId,
    firstName,
    middleInitial,
    lastName,
    email,
    phone,
    payoutMethod,
    payoutHandles,
  ]);

  // Admin confirmed the money arrived — assign squares and record the entry.
  const approveEntry = useCallback(
    (id) => {
      const entry = pending.find((p) => p.id === id);
      if (!entry) return;
      const { board: newBoard, placed, cells } = placeParticipant(board, entry.name, entry.squares);
      setBoard(newBoard);

      // The grid stores only names, so this is the one moment the assigned
      // squares are knowable — capture them for the player's notification.
      if (entry.email) {
        const coords = cellsToCoordinates(cells, headers);
        setApprovalNotice({
          entry,
          coords,
          message: buildApprovalMessage({
            entry,
            coords,
            config,
            poolName: pools.find((pl) => pl.id === activePoolId)?.name,
            spaceCode,
          }),
        });
      }
      setParticipants((p) => [
        ...p,
        {
          name: entry.name,
          email: entry.email || null,
          phone: entry.phone || null,
          payoutMethod: entry.payoutMethod || null,
          payoutHandles: entry.payoutHandles || null,
          amount: entry.amount,
          squares: placed,
          time: Date.now(),
        },
      ]);
      setPending((list) => list.filter((p) => p.id !== id));
    },
    [
      pending,
      board,
      headers,
      config,
      pools,
      activePoolId,
      spaceCode,
      setBoard,
      setParticipants,
      setPending,
    ]
  );

  const rejectEntry = useCallback(
    (id) => setPending((list) => list.filter((p) => p.id !== id)),
    [setPending]
  );

  // Remove a confirmed entry. The board stores only names, so it can't tell
  // which entry a square came from — if this is the person's last entry we
  // clear every square in their name, otherwise just the count this entry
  // bought. Both stores have to change or the entry lingers in Recent Entries.
  const removeEntry = useCallback(
    (index) => {
      const entry = participants[index];
      if (!entry) return;

      const hasOtherEntries = participants.some((p, i) => i !== index && p.name === entry.name);

      setBoard((current) => {
        const next = current.map((row) => [...row]);
        let toClear = hasOtherEntries ? entry.squares : Infinity;
        for (let r = 0; r < next.length; r++) {
          for (let c = 0; c < next[r].length; c++) {
            if (toClear > 0 && next[r][c] === entry.name) {
              next[r][c] = null;
              toClear--;
            }
          }
        }
        return next;
      });

      setParticipants((list) => list.filter((_, i) => i !== index));
    },
    [participants, setBoard, setParticipants]
  );

  // ── Checking access or private space password gate ──
  if (checkingAccess) {
    return (
      <div style={pageStyle}>
        <BackgroundDecor />
        <div
          style={{
            ...containerStyle,
            paddingTop: 120,
            textAlign: "center",
            color: colors.textMuted,
            fontSize: 14,
          }}
        >
          <p style={{ margin: 0 }}>Checking access…</p>
          {accessSlow && (
            <p style={{ margin: "16px 0 0", fontSize: 13 }}>
              Taking longer than usual.{" "}
              <span
                onClick={() => window.location.reload()}
                style={{ color: colors.accentViolet, cursor: "pointer", fontWeight: 700 }}
              >
                Reload
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }
  // Typo'd or deleted space code in the URL
  if (!space) {
    return (
      <div style={pageStyle}>
        <BackgroundDecor />
        <div style={{ ...containerStyle, paddingTop: 120, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>Space not found</h2>
          <p style={{ color: colors.textMuted, fontSize: 15, margin: "0 0 24px" }}>
            No space exists at <strong>#{spaceCode}</strong>. Check the code with whoever shared it
            with you.
          </p>
          <button type="button" onClick={onExit} style={btnPrimary}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div style={pageStyle}>
        <BackgroundDecor />
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: colors.overlay,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{ ...cardStyle, maxWidth: 360, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Private Space</h3>
            <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 16px" }}>
              Enter the password for <strong>#{spaceCode}</strong>
            </p>
            <PasswordInput
              value={gatePassword}
              onChange={(e) => {
                setGatePassword(e.target.value);
                setGateError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleGateSubmit()}
              placeholder="Space password"
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            {gateError && (
              <p style={{ color: colors.accentRed, fontSize: 12, margin: "0 0 12px" }}>
                {gateError}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onExit} style={{ ...btnSecondary, flex: 1 }}>
                Cancel
              </button>
              <button type="button" onClick={handleGateSubmit} style={{ ...btnPrimary, flex: 1 }}>
                Enter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <BackgroundDecor />

      <Header
        view={view}
        spaceCode={spaceCode}
        onHome={() => {
          setView("home");
          resetJoinFlow();
        }}
        onViewBoard={() => {
          setView("board");
          resetJoinFlow();
        }}
        onAdmin={() => {
          // Global owners and space admins can access; non-Supabase mode falls back to isOwner
          if (isOwner) {
            setAdminAuth(true);
            setView("admin");
            return;
          }
          isSpaceAdmin(spaceCode).then((ok) => {
            if (ok) {
              setAdminAuth(true);
              setView("admin");
            }
          });
        }}
        onExit={onExit}
      />

      {view === "admin" && adminAuth && (
        <AdminPanel
          config={config}
          setConfig={setConfig}
          board={board}
          setBoard={setBoard}
          headers={headers}
          scores={scores}
          setScores={setScores}
          pools={pools}
          setPools={setPools}
          createPool={createPoolInDb}
          updatePool={updatePoolInDb}
          toggleArchivePool={toggleArchivePool}
          activePoolId={activePoolId}
          onSwitchPool={switchPool}
          onClose={() => setView("home")}
          spaceCode={spaceCode}
          pending={pending}
          emptyCount={emptyCount}
          onApproveEntry={approveEntry}
          onRejectEntry={rejectEntry}
          approvalNotice={approvalNotice}
          onDismissNotice={() => setApprovalNotice(null)}
          onResetPool={resetPool}
          onToggleSubmissions={toggleSubmissions}
          poolConfigs={poolAdmin.configs}
          poolBusyId={poolAdmin.busyPoolId}
          participants={participants}
          setParticipants={setParticipants}
          onRemoveEntry={removeEntry}
        />
      )}

      <main style={{ ...containerStyle, paddingTop: 40, paddingBottom: 60 }}>
        {view === "home" && (
          <HomeView
            config={effectiveConfig}
            emptyCount={emptyCount}
            participants={participants}
            pools={pools}
            activePoolId={activePoolId}
            onSwitchPool={switchPool}
            completedPools={completedPools}
            onOpenPastBoards={() => setShowPastBoards(true)}
            onJoin={() => setView("join")}
            onViewBoard={() => setView("board")}
          />
        )}

        {view === "join" && (
          <JoinView
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            nameSubmitted={nameSubmitted}
            setNameSubmitted={setNameSubmitted}
            middleInitial={middleInitial}
            setMiddleInitial={setMiddleInitial}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            payoutMethod={payoutMethod}
            setPayoutMethod={setPayoutMethod}
            payoutHandles={payoutHandles}
            setPayoutHandles={setPayoutHandles}
            fullName={fullName}
            config={effectiveConfig}
            emptyCount={emptyCount}
            amount={amount}
            setAmount={setAmount}
            squaresForAmount={squaresForAmount}
            requestSubmitted={requestSubmitted}
            requestedCount={requestedCount}
            submitting={submitting}
            submitError={submitError}
            onSubmitRequest={submitEntryRequest}
            onViewBoard={() => setView("board")}
            onBack={() => {
              setView("home");
              resetJoinFlow();
            }}
            onDone={() => {
              setView("home");
              resetJoinFlow();
            }}
          />
        )}

        {view === "board" && (
          <BoardView
            board={board}
            headers={headers}
            config={effectiveConfig}
            scores={scores}
            emptyCount={emptyCount}
            onJoin={() => setView("join")}
          />
        )}
      </main>

      {showPastBoards && (
        <PastBoardsModal
          pools={completedPools}
          activePoolId={activePoolId}
          onSelect={(id) => {
            switchPool(id);
            setView("home");
          }}
          onClose={() => setShowPastBoards(false)}
        />
      )}

      <Footer
        pricePerSquare={config.pricePerSquare}
        filledCount={100 - emptyCount}
        poolName={pools.find((p) => p.id === activePoolId)?.name}
      />
    </div>
  );
}
