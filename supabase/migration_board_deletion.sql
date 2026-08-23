-- Migration: deleting boards from the superadmin console
-- Run in the Supabase SQL Editor AFTER migration_pickem_privacy.sql
--
-- Why this isn't just DELETE FROM pools WHERE archived
-- ----------------------------------------------------
-- `spaces.pool_id` is TEXT and `pools.id` is UUID, and there is no foreign key
-- between them. Nothing cascades. Deleting the pools row therefore deletes the
-- board's *label* and orphans its payload: the grid, participants, the pending
-- queue, scores, headers, the pick'em slate and every submitted sheet all
-- survive, unreachable by any query the app can make.
--
-- That is the worst available outcome. The board disappears from every screen
-- while entrants' names, emails and phone numbers stay in the database forever
-- with nothing left to attribute them to. Any hard delete has to sweep spaces,
-- pickem_contacts and entry_request_log in the same breath.
--
-- So deletion happens in two steps:
--
--   soft  — superadmin_delete_archived_boards() stamps deleted_at. The board
--           vanishes from every UI immediately (RLS below), and nothing is
--           destroyed: pools.paid / paid_at / checkout_session_id are the only
--           record tying a Stripe charge to what it bought, and a mis-click
--           must not be able to destroy that.
--
--   hard  — superadmin_purge_deleted_boards() removes anything soft-deleted
--           longer than a retention window, sweeping every child table.
--
-- To wipe test data before launch, don't use either of these: run
-- RESET_ALL_DATA.sql, which clears everything rather than only what happens to
-- be archived.

ALTER TABLE pools ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pools_deleted ON pools(deleted_at);

COMMENT ON COLUMN pools.deleted_at IS
  'Soft delete. Hidden from every non-superadmin read by RLS; purged for real by superadmin_purge_deleted_boards().';

-- ============================================================
-- 1. Hide soft-deleted boards from everyone but a superadmin
--
-- Done in RLS rather than by filtering each query: there are a dozen places
-- that read pools, and one missed `deleted_at IS NULL` would put a deleted
-- board back on screen. This fails closed instead.
-- ============================================================
DROP POLICY IF EXISTS "pools_select" ON pools;

CREATE POLICY "pools_select" ON pools
  FOR SELECT USING (deleted_at IS NULL OR public.is_superadmin());

-- ============================================================
-- 2. Soft delete
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_delete_archived_boards(
  p_space_code TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  -- Only archived boards, and only ones not already deleted. An unarchived
  -- board is live: someone may be selling squares on it right now.
  WITH hit AS (
    UPDATE pools
       SET deleted_at = now(), updated_at = now()
     WHERE coalesce(archived, false)
       AND deleted_at IS NULL
       AND (p_space_code IS NULL OR space_code = p_space_code)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM hit;

  PERFORM public.log_admin_action(
    'delete_archived_boards', 'space', coalesce(p_space_code, '*'),
    jsonb_build_object('count', v_count));

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_restore_board(p_pool_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE pools SET deleted_at = NULL, updated_at = now() WHERE id = p_pool_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such board'; END IF;

  PERFORM public.log_admin_action('restore_board', 'pool', p_pool_id::text, '{}'::jsonb);
END;
$$;

-- ============================================================
-- 3. What is waiting to be purged
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_list_deleted_boards()
RETURNS TABLE (
  id UUID, space_code TEXT, name TEXT, game_type TEXT, paid BOOLEAN,
  deleted_at TIMESTAMPTZ, entry_count INT, state_rows BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.space_code, p.name, p.game_type, p.paid, p.deleted_at,
           coalesce((
             SELECT sum(jsonb_array_length(s.value))::int FROM spaces s
              WHERE s.pool_id = p.id::text AND s.type IN ('participants', 'picks')
                AND jsonb_typeof(s.value) = 'array'), 0),
           (SELECT count(*) FROM spaces s WHERE s.pool_id = p.id::text)
      FROM pools p
     WHERE p.deleted_at IS NOT NULL
     ORDER BY p.deleted_at DESC;
END;
$$;

-- ============================================================
-- 4. Hard purge
--
-- The sweep order doesn't matter (nothing cascades), but the completeness
-- does. Every table that stores a pool_id has to appear here, or this
-- reintroduces exactly the orphan problem it exists to avoid.
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_purge_deleted_boards(
  p_older_than_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids TEXT[];
  v_pools INT;
  v_spaces INT;
  v_contacts INT;
  v_log INT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_older_than_days IS NULL OR p_older_than_days < 0 THEN
    RAISE EXCEPTION 'retention window must be zero or more days';
  END IF;

  SELECT array_agg(id::text) INTO v_ids
    FROM pools
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - make_interval(days => p_older_than_days);

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('pools', 0, 'state_rows', 0, 'contacts', 0, 'log_rows', 0);
  END IF;

  DELETE FROM spaces WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_spaces = ROW_COUNT;

  DELETE FROM pickem_contacts WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_contacts = ROW_COUNT;

  DELETE FROM entry_request_log WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_log = ROW_COUNT;

  DELETE FROM pools WHERE id::text = ANY(v_ids);
  GET DIAGNOSTICS v_pools = ROW_COUNT;

  PERFORM public.log_admin_action(
    'purge_deleted_boards', 'pool', NULL,
    jsonb_build_object('pools', v_pools, 'state_rows', v_spaces,
                       'contacts', v_contacts, 'log_rows', v_log,
                       'older_than_days', p_older_than_days));

  RETURN jsonb_build_object('pools', v_pools, 'state_rows', v_spaces,
                            'contacts', v_contacts, 'log_rows', v_log);
END;
$$;

-- ============================================================
-- 5. Deleting a whole space missed two tables
--
-- superadmin_delete_space predates pickem_contacts and never cleared
-- entry_request_log, so deleting a space left entrants' email addresses behind
-- in a table nothing would ever look at again. Same sweep as the purge.
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_delete_space(p_space_code TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM spaces            WHERE space_code = p_space_code;
  DELETE FROM pickem_contacts   WHERE space_code = p_space_code;
  DELETE FROM entry_request_log WHERE space_code = p_space_code;
  DELETE FROM pools             WHERE space_code = p_space_code;
  DELETE FROM space_admins      WHERE space_code = p_space_code;
  DELETE FROM user_space_access WHERE space_code = p_space_code;
  DELETE FROM spaces_registry   WHERE code = p_space_code;
  PERFORM public.log_admin_action('delete_space', 'space', p_space_code, '{}'::jsonb);
END;
$$;

-- ============================================================
-- 6. Counts must not include deleted boards
--
-- These are SECURITY DEFINER and so bypass the RLS added above; without this
-- the dashboard would keep counting boards it no longer shows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'users_total',        (SELECT count(*) FROM user_profiles),
    'users_owners',       (SELECT count(*) FROM user_profiles WHERE role = 'owner'),
    'users_players',      (SELECT count(*) FROM user_profiles WHERE role = 'player'),
    'users_superadmins',  (SELECT count(*) FROM user_profiles WHERE role = 'superadmin'),
    'users_closed',       (SELECT count(*) FROM user_profiles WHERE closed_at IS NOT NULL),
    'users_new_30d',      (SELECT count(*) FROM user_profiles WHERE created_at > now() - interval '30 days'),

    'spaces_total',       (SELECT count(*) FROM spaces_registry),
    'spaces_private',     (SELECT count(*) FROM spaces_registry WHERE is_private),
    'spaces_ownerless',   (SELECT count(*) FROM spaces_registry WHERE owner_id IS NULL),
    'spaces_new_30d',     (SELECT count(*) FROM spaces_registry WHERE created_at > now() - interval '30 days'),

    'boards_total',       (SELECT count(*) FROM pools WHERE deleted_at IS NULL),
    'boards_unarchived',  (SELECT count(*) FROM pools
                            WHERE deleted_at IS NULL AND NOT coalesce(archived, false)),
    'boards_deleted',     (SELECT count(*) FROM pools WHERE deleted_at IS NOT NULL),
    'boards_with_entries',(
        SELECT count(*) FROM pools p
        WHERE p.deleted_at IS NULL AND EXISTS (
          SELECT 1 FROM spaces s
          WHERE s.pool_id = p.id::text AND s.type = 'participants'
            AND jsonb_typeof(s.value) = 'array' AND jsonb_array_length(s.value) > 0
        )),
    'boards_touched_30d', (
        SELECT count(DISTINCT s.pool_id) FROM spaces s
        WHERE s.pool_id <> '' AND s.updated_at > now() - interval '30 days'),

    'pending_entries',    (
        SELECT coalesce(sum(jsonb_array_length(value)), 0) FROM spaces
        WHERE type = 'pending' AND jsonb_typeof(value) = 'array'),
    'pending_stale_7d',   (
        SELECT count(*) FROM spaces
        WHERE type = 'pending' AND jsonb_typeof(value) = 'array'
          AND jsonb_array_length(value) > 0 AND updated_at < now() - interval '7 days'),

    'rows_spaces',        (SELECT count(*) FROM spaces)
  ) INTO r;

  RETURN r;
END;
$$;

-- The per-space board count on the Spaces tab, same reason.
CREATE OR REPLACE FUNCTION public.superadmin_list_spaces(
  p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0
)
RETURNS TABLE (
  code TEXT, admin_name TEXT, is_private BOOLEAN, owner_id UUID, owner_email TEXT,
  created_at TIMESTAMPTZ, board_count BIGINT, pending_count INT, last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT r.code, r.admin_name, coalesce(r.is_private, false), r.owner_id,
           (SELECT u.email FROM user_profiles u WHERE u.id = r.owner_id),
           r.created_at,
           (SELECT count(*) FROM pools p
             WHERE p.space_code = r.code AND p.deleted_at IS NULL),
           coalesce((SELECT sum(jsonb_array_length(s.value))::int FROM spaces s
                      WHERE s.space_code = r.code AND s.type = 'pending'
                        AND jsonb_typeof(s.value) = 'array'), 0),
           (SELECT max(s.updated_at) FROM spaces s WHERE s.space_code = r.code)
      FROM spaces_registry r
     WHERE p_search IS NULL OR trim(p_search) = ''
        OR r.code ILIKE '%' || trim(p_search) || '%'
        OR coalesce(r.admin_name, '') ILIKE '%' || trim(p_search) || '%'
     ORDER BY r.created_at DESC
     LIMIT greatest(1, least(p_limit, 200)) OFFSET greatest(0, p_offset);
END;
$$;

-- ============================================================
-- 7. Grants — authenticated only; each RPC re-checks is_superadmin() itself
--
-- Signatures are read back from pg_proc rather than typed out: a single typo
-- in a hand-written signature aborts the whole block, which is how the grants
-- silently went missing once before.
-- ============================================================
DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'superadmin_delete_archived_boards',
         'superadmin_restore_board',
         'superadmin_list_deleted_boards',
         'superadmin_purge_deleted_boards',
         'superadmin_delete_space',
         'superadmin_stats',
         'superadmin_list_spaces'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- Verify:
--   SELECT space_code, name, archived, deleted_at FROM pools ORDER BY space_code, created_at;
--
--   -- nothing orphaned: every spaces row still has a pool
--   SELECT count(*) FROM spaces s
--    WHERE s.pool_id IS NOT NULL AND s.pool_id <> ''
--      AND NOT EXISTS (SELECT 1 FROM pools p WHERE p.id::text = s.pool_id);
