-- ONE-TIME PRE-LAUNCH WIPE — removes every pool, space and entry.
--
-- This is not a migration. Run it once, by hand, when you want the test data
-- gone. It is deliberately separate from the superadmin delete/purge actions,
-- which only ever touch archived boards; this clears everything, including the
-- live boards and the spaces themselves.
--
-- WHAT SURVIVES: your login. auth.users and user_profiles are untouched, so
-- you keep your account and your superadmin role. Section 3 removes the other
-- accounts and is commented out — read it before deciding.
--
-- WHAT DOES NOT: every board, grid, entry, pending request, score, pick'em
-- slate, submitted sheet, entrant email and phone, space, invite and unlock.
-- There is no undo. Take a backup first:
--   Supabase dashboard → Database → Backups, or `pg_dump` from Project Settings.

-- ------------------------------------------------------------
-- 1. LOOK FIRST. Run this on its own and read the numbers.
-- ------------------------------------------------------------
SELECT 'pools'             AS table_name, count(*) FROM pools
UNION ALL SELECT 'spaces (game state)',   count(*) FROM spaces
UNION ALL SELECT 'spaces_registry',       count(*) FROM spaces_registry
UNION ALL SELECT 'space_admins',          count(*) FROM space_admins
UNION ALL SELECT 'user_space_access',     count(*) FROM user_space_access
UNION ALL SELECT 'pickem_contacts',       count(*) FROM pickem_contacts
UNION ALL SELECT 'entry_contacts',        count(*) FROM entry_contacts
UNION ALL SELECT 'entry_request_log',     count(*) FROM entry_request_log
UNION ALL SELECT 'admin_audit_log',       count(*) FROM admin_audit_log
UNION ALL SELECT 'user_profiles (KEPT)',  count(*) FROM user_profiles;

-- ------------------------------------------------------------
-- 2. THE WIPE
--
-- One transaction: this either all happens or none of it does. A half-applied
-- wipe is the orphan problem again — pools gone, their state left behind.
--
-- Every table holding a space_code or pool_id is listed. If you add another
-- one later, add it here too.
-- ------------------------------------------------------------
BEGIN;

DELETE FROM spaces;
DELETE FROM pickem_contacts;
DELETE FROM entry_contacts;
DELETE FROM entry_request_log;
DELETE FROM pools;
DELETE FROM space_admins;
DELETE FROM user_space_access;
DELETE FROM spaces_registry;

-- The audit log is a record of what was done to accounts, not game data.
-- Uncomment if you also want the test-era admin actions gone.
-- DELETE FROM admin_audit_log;

COMMIT;

-- ------------------------------------------------------------
-- 3. OPTIONAL — remove the other accounts too
--
-- Only do this if the test signups shouldn't exist at launch. It keeps every
-- superadmin (including you) and deletes the rest. Deleting from auth.users
-- cascades to user_profiles, space_admins and user_space_access.
--
-- Check who would go first:
--
--   SELECT u.email, p.role
--     FROM auth.users u
--     LEFT JOIN user_profiles p ON p.id = u.id
--    WHERE coalesce(p.role, 'player') <> 'superadmin';
--
-- Then, if that list looks right:
--
-- DELETE FROM auth.users u
--  WHERE NOT EXISTS (
--    SELECT 1 FROM user_profiles p WHERE p.id = u.id AND p.role = 'superadmin'
--  );

-- ------------------------------------------------------------
-- 4. CONFIRM — every count should be 0 except user_profiles
-- ------------------------------------------------------------
SELECT 'pools' AS table_name, count(*) FROM pools
UNION ALL SELECT 'spaces (game state)', count(*) FROM spaces
UNION ALL SELECT 'spaces_registry',     count(*) FROM spaces_registry
UNION ALL SELECT 'space_admins',        count(*) FROM space_admins
UNION ALL SELECT 'user_space_access',   count(*) FROM user_space_access
UNION ALL SELECT 'pickem_contacts',     count(*) FROM pickem_contacts
UNION ALL SELECT 'entry_contacts',      count(*) FROM entry_contacts
UNION ALL SELECT 'entry_request_log',   count(*) FROM entry_request_log
UNION ALL SELECT 'user_profiles (KEPT)', count(*) FROM user_profiles;
