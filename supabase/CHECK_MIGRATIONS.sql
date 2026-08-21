-- Which migrations have been applied?
--
-- These files are hand-run in the SQL Editor and nothing tracks which have
-- landed, so a missing one only shows up as a runtime error in the app. This
-- checks for an artifact of each and tells you what's outstanding.
--
-- Run the whole thing; read the `status` column.

WITH checks(step, migration, artifact, present) AS (
  VALUES
    (1, 'schema.sql', 'spaces table',
      to_regclass('public.spaces') IS NOT NULL),
    (2, 'migration_user_roles.sql', 'user_profiles table',
      to_regclass('public.user_profiles') IS NOT NULL),
    (3, 'migration_private_spaces.sql', 'spaces_registry.password_hash',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='spaces_registry' AND column_name='password_hash')),
    (4, 'migration_tighten_rls.sql', 'is_space_admin()',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_space_admin')),
    (5, 'migration_superadmin.sql', 'admin_audit_log table',
      to_regclass('public.admin_audit_log') IS NOT NULL),
    (6, 'migration_pool_lifecycle.sql', 'pools.expires_at',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='pools' AND column_name='expires_at')),
    (7, 'migration_google_oauth.sql', 'claim_owner_role()',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname='claim_owner_role')),
    (8, 'migration_entry_contact.sql', 'entry_request_log table',
      to_regclass('public.entry_request_log') IS NOT NULL),
    (9, 'migration_billing.sql', 'pools.paid',
      EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='pools' AND column_name='paid'))
)
SELECT
  step,
  migration,
  artifact,
  CASE WHEN present THEN '✅ applied' ELSE '❌ NOT RUN' END AS status
FROM checks
ORDER BY step;
