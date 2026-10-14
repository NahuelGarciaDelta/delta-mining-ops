-- Review and apply manually AFTER the frontend and Apps Script migration.
-- The new application authenticates against the same authority that changes passwords.
-- Leaving the old bcrypt RPC publicly callable could still accept an obsolete password.
-- This only removes public/client EXECUTE permissions for this specific RPC.
-- No function, table, user, password or operational read RPC is deleted or modified.
BEGIN;
DO $migration$
DECLARE
  routine record;
  client_role record;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'app_authenticate_user'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', routine.signature);
    FOR client_role IN
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I', routine.signature, client_role.rolname);
    END LOOP;
  END LOOP;
END;
$migration$;
COMMIT;
