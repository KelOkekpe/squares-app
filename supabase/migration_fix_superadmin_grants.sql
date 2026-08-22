-- Migration: Repair EXECUTE grants on the superadmin RPCs
-- Run in the Supabase SQL Editor. Safe to run repeatedly.
--
-- "permission denied for function superadmin_stats" means the function exists
-- but EXECUTE was never granted. That's distinct from not being a superadmin —
-- in that case the function runs and raises 'not authorized'.
--
-- migration_superadmin.sql granted these from a single DO block holding a
-- hand-written list of signatures. Any one mismatch raises, the block aborts,
-- and *none* of the grants apply — while the REVOKE of PUBLIC's default
-- EXECUTE may already have landed from an earlier run. The result is a set of
-- functions nobody can call.
--
-- Signatures are read from the catalog here, so there is nothing to mistype,
-- and each function is granted independently so one failure can't take the
-- rest down with it.

DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND (p.proname LIKE 'superadmin\_%' OR p.proname IN ('claim_owner_role', 'find_user_id_by_email'))
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated', r.sig);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not grant %: %', r.sig, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Granted EXECUTE on % function(s) to authenticated', n;
END $$;

-- These two are called by policies and by signed-out visitors, so they need a
-- wider grant than the RPCs above.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname IN ('is_superadmin', 'is_account_active', 'is_space_admin',
                         'is_space_owner', 'is_pool_active')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Verify: every superadmin_* function should list "authenticated" here.
SELECT p.oid::regprocedure AS function,
       COALESCE(
         (SELECT string_agg(DISTINCT a.grantee, ', ')
            FROM information_schema.routine_privileges a
           WHERE a.specific_name = p.proname || '_' || p.oid
             AND a.privilege_type = 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
       ) AS can_execute
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
 WHERE ns.nspname = 'public' AND p.proname LIKE 'superadmin\_%'
 ORDER BY 1;

-- Simplest check of all — this should return true for every row:
--   SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE')
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname LIKE 'superadmin\_%';
