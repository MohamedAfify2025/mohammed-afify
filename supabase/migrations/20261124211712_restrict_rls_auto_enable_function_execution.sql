-- rls_auto_enable is a PostgreSQL event-trigger callback, not a public RPC.
-- Event trigger execution remains attached to ensure_rls; browser roles do not need EXECUTE.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
