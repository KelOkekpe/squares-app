import React, { useState, useCallback, useEffect } from "react";
import {
  splitPools,
  isPoolCompleted,
  isPastDeadline,
  invitedPoolId,
  loadProfile,
  saveProfile,
  inviteUrl,
  inviteMessage,
  generatePaymentRef,
  buildPaymentNote,
  applySmartFill,
  scaledPayouts,
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
  usePickemEntries,
  useEntryContacts,
  usePools,
  useAuth,
  useSpacesRegistry,
  useSpaceAccess,
  useUserSpaces,
  usePoolAdmin,
  useCheckout,
  useLiveScores,
} from "./hooks";
import { supabase, isSupabaseEnabled } from "./lib/supabase";
import {
  cellsToCoordinates,
  formatCoordinates,
  buildApprovalMessage,
  sendConfirmationEmail,
} from "./utils/notify";
import { playerFacingError } from "./utils/errors";
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
import { AdminPanel, NewBoardModal } from "./components/admin";
import { PasswordInput } from "./components/common";
import { PickemView } from "./components/pickem";
import { EmptySpace } from "./components/layout";
import { InviteModal, GameTicker, TICKER_HEIGHT } from "./components/common";

export function GameBoard({ spaceCode, onExit }) {
  const { isSpaceAdmin, isOwner } = useAuth();
  const { spaces, loading: registryLoading } = useSpacesRegistry();
  const { hasAccess, verifyAndGrantAccess, refetch: refetchAccess } = useSpaceAccess();
  const { spaces: userSpaces, loading: userSpacesLoading } = useUserSpaces();

  const space = spaces.find((s) => s.code === spaceCode);
  const isOwnerOrAdmin = userSpaces.some((s) => s.code === spaceCode);
  // Once access has resolved once, later refreshes happen behind the board
  // rather than replacing it. Gating on in-flight requests meant every tab
  // focus threw the player back to "Checking access…".
  const [accessResolved, setAccessResolved] = useState(false);
  useEffect(() => {
    if (!registryLoading && !userSpacesLoading) setAccessResolved(true);
  }, [registryLoading, userSpacesLoading]);

  const checkingAccess = !accessResolved && (registryLoading || userSpacesLoading);
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
  const { startCheckout, startingFor, error: checkoutError } = useCheckout();

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
  // An invite link names a board. Seeded once, so it doesn't fight the picker
  // if the visitor then switches boards themselves.
  const [viewingPoolId, setViewingPoolId] = useState(() =>
    typeof window !== "undefined" ? invitedPoolId(window.location.search) : null
  );

  const defaultPoolId = pools.find((p) => p.id === spaceMeta.activePoolId)?.id;
  const activePoolId =
    (viewingPoolId && pools.find((p) => p.id === viewingPoolId)?.id) ||
    defaultPoolId ||
    activePools[0]?.id ||
    pools[0]?.id;

  const currentPool = pools.find((p) => p.id === activePoolId) || null;
  const viewingCompleted = isPoolCompleted(currentPool);
  const isPickem = currentPool?.gameType === "pickem";

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

  // Local — works for anonymous players, who cannot write to `spaces`.
  // Reset the view too: a squares board has no pick'em screen and vice versa.
  const switchPool = (id) => {
    setViewingPoolId(id);
    setView("home");
  };

  // The admin console selects a board to *edit* it. Sending the view home
  // closes the panel the selection was just made in, which reads as the board
  // and pick'em settings having disappeared.
  const selectPoolForAdmin = (id) => setViewingPoolId(id);

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
  // Pick'em contests keep their slate and sheets alongside the squares state,
  // so the admin panel can manage whichever type is selected.
  const [slate, setSlate] = usePersistedState(keys.slate, null);
  // Sheets come from an RPC, not the row: they're admin-only in the database
  // so they can stay hidden until the slate locks.
  const {
    entries: picks,
    refresh: refreshPicks,
    setPaid: setPickPaid,
    removeEntry: removePickEntry,
    clearEntries: clearPickEntries,
  } = usePickemEntries(spaceCode, activePoolId);

  // Entrant contact details live outside the participants blob, which players
  // can read. Admin-only by RLS, so this is empty for everyone else.
  const {
    contacts: entryContacts,
    saveContact,
    removeContact,
    clearContacts,
  } = useEntryContacts(spaceCode, activePoolId, isOwnerOrAdmin);

  // ── ephemeral UI state ────────────────────────────────
  const [view, setView] = useState("home");
  const [showInvite, setShowInvite] = useState(false);
  // Which half of the pick'em screen they asked for.
  const [pickemIntent, setPickemIntent] = useState("standings");
  // Prefilled from whatever this browser last submitted. Players have no
  // account, so without this they retype all of it for every board they join.
  const remembered = useState(loadProfile)[0];
  const [firstName, setFirstName] = useState(remembered.firstName);
  const [middleInitial, setMiddleInitial] = useState(remembered.middleInitial);
  const [lastName, setLastName] = useState(remembered.lastName);
  const [email, setEmail] = useState(remembered.email);
  const [payoutMethod, setPayoutMethod] = useState(remembered.payoutMethod);
  const [payoutHandles, setPayoutHandles] = useState(remembered.payoutHandles);
  // Generated up front: the player pays before submitting, so the reference has
  // to exist at payment time to appear in the note the admin reconciles against.
  const [paymentRef] = useState(generatePaymentRef);
  // Set on approval so the admin can send the player their coordinates
  const [approvalNotice, setApprovalNotice] = useState(null);

  // Scores refresh from whoever has the board open. A scheduled job would need
  // a paid Vercel tier, and the server throttles, so extra viewers cost nothing.
  useLiveScores({
    spaceCode,
    poolId: activePoolId,
    game: config.game,
    enabled: !viewingCompleted,
  });

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
        if (currentPool?.gameType === "pickem") {
          // Clear the sheets and un-grade the week, but keep the slate — the
          // games are the contest, and refetching them isn't a reset.
          //
          // The clear is a server round trip, so it can fail. Reporting ok here
          // would tell the admin a contest was reset while every sheet is still
          // in it.
          const cleared = await clearPickEntries();
          if (cleared?.error) return { ok: false, error: cleared.error };
          setSlate((s) =>
            s
              ? {
                  ...s,
                  games: (s.games || []).map(
                    ({ winner, total, awayScore, homeScore, ...game }) => game
                  ),
                }
              : s
          );
          return { ok: true };
        }

        setBoard(freshBoard);
        setHeaders(freshHeaders);
        setParticipants([]);
        clearContacts();
        setPending([]);
        setScores({});
        setApprovalNotice(null);
        return { ok: true };
      }
      return poolAdmin.resetRemotePool(targetId, { board: freshBoard, headers: freshHeaders });
    },
    [
      activePoolId,
      currentPool,
      setBoard,
      setHeaders,
      setParticipants,
      setPending,
      setScores,
      clearPickEntries,
      clearContacts,
      setSlate,
      poolAdmin,
    ]
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
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [amount, setAmount] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestedCount, setRequestedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [adminAuth, setAdminAuth] = useState(false);
  const [showPastBoards, setShowPastBoards] = useState(false);
  // Set when the header's + Board is used, so the panel opens ready to type
  const [showNewBoard, setShowNewBoard] = useState(false);
  // Preselects the contest type when the choice was already made on the way in.
  const [newBoardType, setNewBoardType] = useState("squares");

  // Every handle this space last used, so a new board starts with all of them
  // filled in rather than only the first.
  const lastPayment = config?.paymentHandles || null;

  // Both header buttons open the same panel, so the access check lives once here
  const openAdmin = useCallback(
    (after) => {
      const grant = () => {
        setAdminAuth(true);
        setView("admin");
        after?.();
      };
      if (isOwner) return grant();
      isSpaceAdmin(spaceCode).then((ok) => ok && grant());
    },
    [isOwner, isSpaceAdmin, spaceCode]
  );

  // ── derived ───────────────────────────────────────────
  const fullName = [firstName.trim(), middleInitial ? `${middleInitial}.` : "", lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const squaresForAmount = calculateSquares(Number(amount), config.pricePerSquare);
  const emptyCount = getEmptySquares(board).length;
  // A completed board is closed to entries for the same reason a disabled one is
  // Entries close ten minutes before kickoff, on top of the admin's own switch
  // and the board's expiry. Derived from the linked game rather than stored, so
  // a rescheduled game moves the deadline with it.
  const pastDeadline = isPastDeadline({ config, slate, pool: currentPool });
  const effectiveConfig =
    viewingCompleted || pastDeadline ? { ...config, submissionsDisabled: true } : config;

  // ── handlers ──────────────────────────────────────────
  // Back to what this browser knows, not to blank — clearing the form on every
  // exit is what made re-entry tedious in the first place.
  const resetJoinFlow = () => {
    const known = loadProfile();
    setFirstName(known.firstName);
    setMiddleInitial(known.middleInitial);
    setLastName(known.lastName);
    setEmail(known.email);
    setPayoutMethod(known.payoutMethod);
    setPayoutHandles(known.payoutHandles);
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
        paymentRef,
        firstName: firstName.trim(),
        middleInitial,
        lastName: lastName.trim(),
        email: email.trim(),
        payoutMethod,
        payoutHandles,
      },
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(playerFacingError(error, "Could not submit your request. Try again."));
      return;
    }
    // Only after it was accepted — remembering details from a rejected attempt
    // would prefill something the server just refused.
    saveProfile({
      firstName: firstName.trim(),
      middleInitial,
      lastName: lastName.trim(),
      name: fullName,
      email: email.trim(),
      payoutMethod,
      payoutHandles,
    });
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
    payoutMethod,
    payoutHandles,
    paymentRef,
  ]);

  // Admin confirmed the money arrived — assign squares and record the entry.
  const approveEntry = useCallback(
    async (id) => {
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
      // Contact and payout details deliberately do NOT go in here. This blob is
      // world-readable — the board draws its names from it — so they go to
      // entry_contacts, which only admins can read. The id is what ties the two
      // together.
      const entryId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `e${Date.now()}${Math.round(Math.random() * 1e6)}`;

      setParticipants((p) => [
        ...p,
        {
          id: entryId,
          name: entry.name,
          amount: entry.amount,
          squares: placed,
          time: Date.now(),
        },
      ]);
      // Awaited before the email, not fired alongside it. send-confirmation
      // looks the recipient up by entry id rather than trusting the caller, so
      // sending first raced the write and the server found no contact row —
      // and said so only in a log nobody was reading.
      const saved = await saveContact(entryId, entry);

      // The coordinates only exist here: the grid stores names, so which
      // squares this player owns is knowable at this moment and nowhere after.
      if (!saved?.error) {
        sendConfirmationEmail({
          spaceCode,
          poolId: activePoolId,
          entryId,
          kind: "squares",
          amount: entry.amount,
          coords: formatCoordinates(cellsToCoordinates(cells, headers), config),
        });
      }

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
      saveContact,
    ]
  );

  const smartFill = useCallback(() => {
    // Payouts must be computed from the board *before* filling it — afterwards
    // it reads as fully sold and the reduction would be lost.
    const scaled = scaledPayouts(config, board);
    const { board: filled, placed } = applySmartFill(board);
    if (!placed) return;

    setBoard(filled);
    setConfig((c) => ({
      ...c,
      totalPot: scaled.totalPot,
      quarterlyPayout: scaled.quarterlyPayout,
      smartFilledAt: Date.now(),
    }));
  }, [board, config, setBoard, setConfig]);

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

      const removed = participants[index];
      setParticipants((list) => list.filter((_, i) => i !== index));
      if (removed?.id) removeContact(removed.id);
    },
    [participants, setBoard, setParticipants, removeContact]
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
        onNewBoard={() => setShowNewBoard(true)}
        onAdmin={() => openAdmin()}
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
          onSwitchPool={selectPoolForAdmin}
          onClose={() => setView("home")}
          spaceCode={spaceCode}
          pending={pending}
          emptyCount={emptyCount}
          onApproveEntry={approveEntry}
          onRejectEntry={rejectEntry}
          approvalNotice={approvalNotice}
          onDismissNotice={() => setApprovalNotice(null)}
          onSmartFill={smartFill}
          onResetPool={resetPool}
          onToggleSubmissions={toggleSubmissions}
          poolConfigs={poolAdmin.configs}
          poolBusyId={poolAdmin.busyPoolId}
          pendingCounts={poolAdmin.pendingCounts}
          isPickem={currentPool?.gameType === "pickem"}
          slate={slate}
          setSlate={setSlate}
          picks={picks}
          onSetPickPaid={setPickPaid}
          onRemovePickEntry={removePickEntry}
          onActivateBoard={(poolId) => startCheckout(spaceCode, poolId)}
          checkoutStartingFor={startingFor}
          checkoutError={checkoutError}
          participants={participants}
          entryContacts={entryContacts}
          setParticipants={setParticipants}
          onRemoveEntry={removeEntry}
        />
      )}

      {/* A pick'em contest is a different game, so it gets its own view rather
          than trying to render a grid that doesn't apply. It's entered from the
          home screen rather than replacing it, so there's somewhere to go back
          to — the contest picker lives there. */}
      {isPickem && view === "pickem" ? (
        <PickemView
          spaceCode={spaceCode}
          poolId={activePoolId}
          poolName={currentPool.name}
          config={effectiveConfig}
          intent={pickemIntent}
          entries={picks}
          onEntriesChanged={refreshPicks}
          onBack={() => setView("home")}
        />
      ) : (
        <main style={{ ...containerStyle, paddingTop: 40, paddingBottom: 60 }}>
          {/* A space with nothing in it asks what to run rather than showing a
              board that doesn't exist. Checked before the view switch, since
              every view below assumes a pool. */}
          {view === "home" && !pools.length && (
            <EmptySpace
              spaceCode={spaceCode}
              canCreate={isOwnerOrAdmin}
              onCreate={(gameType) => {
                setNewBoardType(gameType);
                setShowNewBoard(true);
              }}
            />
          )}

          {view === "home" && pools.length > 0 && (
            <HomeView
              config={effectiveConfig}
              emptyCount={emptyCount}
              participants={participants}
              pools={pools}
              activePoolId={activePoolId}
              onSwitchPool={switchPool}
              completedPools={completedPools}
              onOpenPastBoards={() => setShowPastBoards(true)}
              isPickem={isPickem}
              onOpenPickem={(intent) => {
                setPickemIntent(intent === "picks" ? "picks" : "standings");
                setView("pickem");
              }}
              onInvite={currentPool ? () => setShowInvite(true) : undefined}
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
              paymentRef={paymentRef}
              paymentNote={buildPaymentNote({
                playerName: fullName,
                poolName: pools.find((pl) => pl.id === activePoolId)?.name,
                ref: paymentRef,
              })}
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
              onBack={() => setView("home")}
            />
          )}
        </main>
      )}

      {showNewBoard && (
        <NewBoardModal
          pools={pools}
          initialGameType={newBoardType}
          lastPayment={lastPayment}
          onClose={() => setShowNewBoard(false)}
          onCreate={async ({ name, expiresAt, game, gameType, slate, payment, entryFee }) => {
            // Linking at creation means the board is wired for live scores and
            // smart fill before anyone has to open the admin console. The
            // payment handle is required at creation for the same reason —
            // otherwise the first player to reach the payment step is told to
            // go and ask, which is where entries get abandoned.
            const initialConfig = {
              ...(payment && Object.keys(payment).length ? { paymentHandles: payment } : {}),
              ...(entryFee === undefined ? {} : { entryFee }),
              ...(game
                ? {
                    teamX: game.away?.name,
                    teamY: game.home?.name,
                    game: {
                      provider: "espn",
                      id: game.id,
                      name: game.name,
                      startsAt: game.startsAt,
                      xTeamId: game.away?.id,
                      yTeamId: game.home?.id,
                    },
                  }
                : {}),
            };

            const { pool, error } = await createPoolInDb(name, expiresAt, initialConfig, {
              gameType,
              slate,
            });
            if (pool) switchPool(pool.id);
            return { error };
          }}
        />
      )}

      {showInvite && currentPool && (
        <InviteModal
          url={inviteUrl(spaceCode, currentPool.id)}
          message={inviteMessage({
            pool: currentPool,
            config: effectiveConfig,
            slate,
            squaresLeft: emptyCount,
          })}
          isPrivate={space?.isPrivate}
          onClose={() => setShowInvite(false)}
        />
      )}

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

      {/* Mounted once here rather than in each view: home, board and pick'em
          all render inside this component, so they can't drift apart, and the
          scoreboard is fetched once instead of three times. The spacer keeps
          the fixed bar off the last row of content. */}
      <div style={{ height: TICKER_HEIGHT }} />
      <GameTicker />
    </div>
  );
}
