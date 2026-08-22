-- Why is "new row violates row-level security policy for table pools" happening?
--
-- pools_insert requires is_space_admin(space_code). That returns true if you're
-- a superadmin, an accepted member of the space, OR the owner in
-- spaces_registry. Run this in the SQL Editor to see which of those hold.

-- 1. Is the INSERT policy the one we expect?
SELECT policyname, cmd, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'pools'
 ORDER BY cmd, policyname;

-- 2. Does is_space_admin still accept the registry owner?
--    Look for "spaces_registry" in the body. If it's absent, a migration was
--    re-run out of order and reverted the function.
SELECT prosrc LIKE '%spaces_registry%' AS accepts_registry_owner,
       prosrc LIKE '%superadmin%'      AS accepts_superadmin
  FROM pg_proc WHERE proname = 'is_space_admin';

-- 3. For each space: who owns it, and does that owner also have a membership
--    row? Ownership alone should be enough, but this shows both.
SELECT r.code,
       r.owner_id,
       u.email AS owner_email,
       EXISTS (SELECT 1 FROM space_admins sa
                WHERE sa.space_code = r.code
                  AND sa.user_id = r.owner_id
                  AND sa.accepted) AS owner_has_membership
  FROM spaces_registry r
  LEFT JOIN user_profiles u ON u.id = r.owner_id
 ORDER BY r.code;

-- 4. THE ANSWER. Run this while signed in as yourself in the SQL Editor's
--    "impersonate" mode, or compare the ids by hand: this is what the policy
--    actually evaluates. Replace the code with the space you're creating in.
SELECT public.is_space_admin('scriberfam') AS may_insert_here,
       auth.uid()                          AS acting_as;
