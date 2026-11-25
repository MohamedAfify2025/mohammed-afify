-- Preflight + minimal server-side grants for username-based student accounts.
-- Target: LIVE Supabase project ybsjnubrswqksvktgmay.
-- Do not run until the LIVE database backup is verified and release is approved.
-- This script does not modify student rows, course assignments, passwords, or course content.

DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'public.profiles',
    'public.course_catalog',
    'public.subscription_plans',
    'public.subscription_plan_courses',
    'public.student_subscriptions',
    'public.membership_audit_log'
  ]
  LOOP
    IF to_regclass(required_table) IS NULL THEN
      RAISE EXCEPTION 'Required LIVE table is missing: %', required_table;
    END IF;
  END LOOP;
END
$$;

-- Minimal server-side privileges mirrored from the proven TEST configuration.
GRANT SELECT, UPDATE ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.course_catalog TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.subscription_plans TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.subscription_plan_courses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_subscriptions TO service_role;
GRANT INSERT ON TABLE public.membership_audit_log TO service_role;

-- Read-back verification: every returned column should be true.
SELECT
  has_table_privilege('service_role', 'public.profiles', 'SELECT') AS profiles_select,
  has_table_privilege('service_role', 'public.profiles', 'UPDATE') AS profiles_update,
  has_table_privilege('service_role', 'public.course_catalog', 'SELECT') AS course_catalog_select,
  has_table_privilege('service_role', 'public.subscription_plans', 'SELECT') AS plans_select,
  has_table_privilege('service_role', 'public.subscription_plans', 'INSERT') AS plans_insert,
  has_table_privilege('service_role', 'public.subscription_plans', 'DELETE') AS plans_delete,
  has_table_privilege('service_role', 'public.subscription_plan_courses', 'SELECT') AS plan_courses_select,
  has_table_privilege('service_role', 'public.subscription_plan_courses', 'INSERT') AS plan_courses_insert,
  has_table_privilege('service_role', 'public.subscription_plan_courses', 'DELETE') AS plan_courses_delete,
  has_table_privilege('service_role', 'public.student_subscriptions', 'SELECT') AS subscriptions_select,
  has_table_privilege('service_role', 'public.student_subscriptions', 'INSERT') AS subscriptions_insert,
  has_table_privilege('service_role', 'public.student_subscriptions', 'UPDATE') AS subscriptions_update,
  has_table_privilege('service_role', 'public.student_subscriptions', 'DELETE') AS subscriptions_delete,
  has_table_privilege('service_role', 'public.membership_audit_log', 'INSERT') AS audit_log_insert;

-- Rollback only if these grants were not used by any other LIVE service:
-- REVOKE SELECT, UPDATE ON TABLE public.profiles FROM service_role;
-- REVOKE SELECT ON TABLE public.course_catalog FROM service_role;
-- REVOKE SELECT, INSERT, DELETE ON TABLE public.subscription_plans FROM service_role;
-- REVOKE SELECT, INSERT, DELETE ON TABLE public.subscription_plan_courses FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_subscriptions FROM service_role;
-- REVOKE INSERT ON TABLE public.membership_audit_log FROM service_role;
