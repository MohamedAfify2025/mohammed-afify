-- ============================================================================
-- MEMBERSHIP V2 — PHASE 1 PREFLIGHT
-- READ ONLY. Run this before considering membership-v2-phase1-review-draft.sql.
-- This file does not create, alter, update, delete, revoke, or grant anything.
-- It reports schema metadata and aggregate consistency counts only.
-- ============================================================================

-- RESULT 1: exact columns used by the candidate Phase 1 functions.
SELECT
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
      'profiles',
      'course_catalog',
      'subscription_plans',
      'subscription_plan_courses',
      'student_subscriptions',
      'subscription_payments',
      'subscription_admin_notes',
      'membership_audit_log'
  )
ORDER BY c.table_name, c.ordinal_position;


-- RESULT 2: verify exact current function signatures before CREATE OR REPLACE.
WITH expected_functions(function_name, regprocedure_signature) AS (
    VALUES
      ('create_student_subscription_v2',
       'public.create_student_subscription_v2(uuid,uuid,text)'),
      ('activate_student_subscription_v2',
       'public.activate_student_subscription_v2(uuid,timestamptz,timestamptz,boolean)'),
      ('record_subscription_payment_v3',
       'public.record_subscription_payment_v3(uuid,numeric,text,text,text)'),
      ('admin_assign_plan_to_approved_student_v2',
       'public.admin_assign_plan_to_approved_student_v2(uuid,uuid,text)'),
      ('approve_student_application_with_plan_v2',
       'public.approve_student_application_with_plan_v2(uuid,uuid,text)')
)
SELECT
    e.function_name,
    e.regprocedure_signature,
    to_regprocedure(e.regprocedure_signature) IS NOT NULL AS exact_signature_exists,
    p.prosecdef AS security_definer,
    COALESCE(array_to_string(p.proconfig, ', '), '(not explicitly set)') AS function_settings,
    CASE WHEN p.oid IS NOT NULL THEN pg_get_function_arguments(p.oid) END AS full_arguments,
    CASE WHEN p.oid IS NOT NULL THEN pg_get_function_result(p.oid) END AS return_type
FROM expected_functions e
LEFT JOIN pg_proc p
  ON p.oid = to_regprocedure(e.regprocedure_signature)
ORDER BY e.function_name;


-- RESULT 3: aggregate subscription/ledger consistency baseline.
-- No student names, email addresses, phone numbers, or UUIDs are returned.
WITH paid_ledger AS (
    SELECT
        sp.subscription_id,
        COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'paid'), 0) AS paid_total,
        BOOL_OR(sp.status = 'refunded') AS has_refunded_payment
    FROM public.subscription_payments sp
    GROUP BY sp.subscription_id
)
SELECT
    COUNT(*) FILTER (
        WHERE ss.status = 'active'
          AND ss.expires_at IS NOT NULL
          AND ss.expires_at <= now()
    ) AS active_but_date_expired_count,

    COUNT(*) FILTER (
        WHERE ss.status IN ('pending','active','suspended')
          AND ss.agreed_amount > 0
          AND ss.payment_state = 'paid'
          AND COALESCE(pl.paid_total, 0) < ss.agreed_amount
    ) AS marked_paid_but_ledger_below_due_count,

    COUNT(*) FILTER (
        WHERE ss.status IN ('pending','active','suspended')
          AND ss.agreed_amount > 0
          AND ss.payment_state IN ('unpaid','partial')
          AND COALESCE(pl.paid_total, 0) >= ss.agreed_amount
    ) AS ledger_fully_paid_but_state_not_paid_count,

    COUNT(*) FILTER (
        WHERE ss.payment_state = 'waived'
          AND COALESCE(pl.paid_total, 0) > 0
    ) AS waived_with_paid_ledger_count,

    COUNT(*) FILTER (
        WHERE ss.agreed_amount < 0
    ) AS negative_agreed_amount_count,

    COUNT(*) AS total_subscription_rows
FROM public.student_subscriptions ss
LEFT JOIN paid_ledger pl
  ON pl.subscription_id = ss.id;


-- RESULT 4: count student/course overlaps among pending, active, or suspended
-- subscriptions. Counts only; it does not expose student identifiers.
SELECT COUNT(*) AS overlapping_student_course_pair_count
FROM (
    SELECT
        ss.user_id,
        pc.course_slug
    FROM public.student_subscriptions ss
    JOIN public.subscription_plan_courses pc
      ON pc.plan_id = ss.plan_id
    WHERE ss.status IN ('pending','active','suspended')
    GROUP BY ss.user_id, pc.course_slug
    HAVING COUNT(*) > 1
) overlapping_pairs;


-- RESULT 5: current grants on teacher_permissions, to retain a baseline
-- before deciding whether service_role TRUNCATE should be removed.
SELECT
    r.rolname AS database_role,
    has_table_privilege(r.rolname, 'public.teacher_permissions', 'SELECT') AS can_select,
    has_table_privilege(r.rolname, 'public.teacher_permissions', 'INSERT') AS can_insert,
    has_table_privilege(r.rolname, 'public.teacher_permissions', 'UPDATE') AS can_update,
    has_table_privilege(r.rolname, 'public.teacher_permissions', 'DELETE') AS can_delete,
    has_table_privilege(r.rolname, 'public.teacher_permissions', 'TRUNCATE') AS can_truncate
FROM pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role','postgres')
ORDER BY r.rolname;
