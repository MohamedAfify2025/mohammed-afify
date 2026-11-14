-- Mohammed Afify membership functions/security audit
-- READ ONLY: these three SELECT statements do not change database objects or data.
-- Run each SELECT separately in Supabase SQL Editor and export each result as CSV.

-- RESULT 1: required RPC names, signatures, SECURITY DEFINER, search_path,
-- owners, EXECUTE grants, and CREATE privilege on public schema.
with required_functions(schema_name, function_name) as (
  values
    ('public','is_platform_admin'),
    ('public','is_approved_student'),
    ('public','set_student_status'),
    ('public','get_my_active_courses_v2'),
    ('public','get_admin_review_plans_v2'),
    ('public','approve_student_application_with_discount_v1'),
    ('public','review_membership_request_v2'),
    ('public','admin_assign_student_with_discount_v1'),
    ('public','record_subscription_payment_v3'),
    ('public','activate_student_subscription_v2'),
    ('public','set_profile_role_v2'),
    ('public','assign_teacher_course_v2'),
    ('public','set_teacher_permission_v2'),
    ('public','set_student_subscription_status_v2'),
    ('public','refund_subscription_payment_v2'),
    ('public','expire_due_subscriptions_v2'),
    ('public','_record_academy_assessment_v1'),
    ('public','submit_business_unit1_quiz'),
    ('public','submit_business_unit2_quiz'),
    ('public','submit_business_unit3_quiz'),
    ('public','submit_accounting_unit1_quiz'),
    ('public','submit_accounting_unit2_quiz'),
    ('public','submit_accounting_unit3_quiz'),
    ('public','submit_accounting_unit4_quiz'),
    ('public','submit_accounting_unit5_quiz'),
    ('membership_v2_private','is_admin'),
    ('membership_v2_private','my_course_access'),
    ('membership_v2_private','teacher_can_view_student')
)
select
  rf.schema_name,
  rf.function_name,
  p.oid is not null as function_exists,
  case when p.oid is not null then pg_get_function_identity_arguments(p.oid) end as argument_signature,
  case when p.oid is not null then pg_get_function_result(p.oid) end as return_type,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '(not explicitly set)') as function_settings,
  case when p.oid is not null then pg_get_userbyid(p.proowner) end as function_owner,
  case when p.oid is not null then
    array(
      select
        (case when acl.grantee = 0 then 'PUBLIC'
              else coalesce(role_entry.rolname, acl.grantee::text) end)
        || ':' || acl.privilege_type
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      left join pg_roles role_entry on role_entry.oid = acl.grantee
      where acl.privilege_type = 'EXECUTE'
      order by 1
    )
  end as execute_grants,
  has_schema_privilege('anon', 'public', 'CREATE') as anon_can_create_public_schema,
  has_schema_privilege('authenticated', 'public', 'CREATE') as authenticated_can_create_public_schema
from required_functions rf
left join pg_namespace n on n.nspname = rf.schema_name
left join pg_proc p on p.pronamespace = n.oid and p.proname = rf.function_name
order by rf.schema_name, rf.function_name, argument_signature;


-- RESULT 2: source code for important admin, student-access, teacher,
-- subscription/payment, and quiz RPCs. Review returned definitions only.
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


-- RESULT 3: auth/profile triggers and their function definitions.
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
