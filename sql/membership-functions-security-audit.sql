-- Mohammed Afify membership functions/security audit
-- READ ONLY. Run in Supabase SQL Editor. Does not change database objects or data.
-- Result 1: signatures, security mode, search_path, owners and EXECUTE grants.
-- Result 2: read-only source review of access, admin, teacher, payment and assessment RPCs.
-- This returns definitions only; it does not execute them or alter database objects.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as argument_signature,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '(not explicitly set)') as function_settings,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where
  (n.nspname = 'membership_v2_private'
   and p.proname in ('is_admin','my_course_access','teacher_can_view_student'))
  or
  (n.nspname = 'public'
   and p.proname in (
     'is_platform_admin',
     'is_approved_student',
     'set_student_status',
     'get_my_active_courses_v2',
     'get_admin_review_plans_v2',
     'approve_student_application_with_discount_v1',
     'review_membership_request_v2',
     'admin_assign_student_with_discount_v1',
     'record_subscription_payment_v3',
     'activate_student_subscription_v2',
     'set_profile_role_v2',
     'assign_teacher_course_v2',
     'set_teacher_permission_v2',
     'set_student_subscription_status_v2',
     'refund_subscription_payment_v2',
     'expire_due_subscriptions_v2',
     '_record_academy_assessment_v1',
     'submit_business_unit1_quiz',
     'submit_business_unit2_quiz',
     'submit_business_unit3_quiz',
     'submit_accounting_unit1_quiz',
     'submit_accounting_unit2_quiz',
     'submit_accounting_unit3_quiz',
     'submit_accounting_unit4_quiz',
     'submit_accounting_unit5_quiz'
   ))
order by n.nspname, p.proname, argument_signature;

-- Result 3: registration/profile triggers. This confirms which function creates
-- the profile row after Supabase Auth signup and whether the trigger is enabled.
select
  event_schema.nspname as table_schema,
  table_class.relname as table_name,
  trigger_row.tgname as trigger_name,
  trigger_row.tgenabled as trigger_enabled_mode,
  pg_get_triggerdef(trigger_row.oid, true) as trigger_definition,
  function_schema.nspname as function_schema,
  trigger_function.proname as trigger_function,
  trigger_function.prosecdef as trigger_security_definer,
  coalesce(array_to_string(trigger_function.proconfig, ', '), '(not explicitly set)') as function_settings,
  pg_get_functiondef(trigger_function.oid) as trigger_function_definition
from pg_trigger trigger_row
join pg_class table_class on table_class.oid = trigger_row.tgrelid
join pg_namespace event_schema on event_schema.oid = table_class.relnamespace
join pg_proc trigger_function on trigger_function.oid = trigger_row.tgfoid
join pg_namespace function_schema on function_schema.oid = trigger_function.pronamespace
where not trigger_row.tgisinternal
  and (
    (event_schema.nspname = 'auth' and table_class.relname = 'users')
    or (event_schema.nspname = 'public' and table_class.relname = 'profiles')
  )
order by event_schema.nspname, table_class.relname, trigger_row.tgname;
