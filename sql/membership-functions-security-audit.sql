-- Mohammed Afify membership functions/security audit
-- READ ONLY. Run in Supabase SQL Editor. Does not change database objects or data.
-- Result 1: signatures, security mode, search_path, owners and EXECUTE grants.
-- Result 2: definitions for the critical access-control helper functions.

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
    ('public','submit_business_unit1_quiz'),
    ('public','submit_business_unit2_quiz'),
    ('public','submit_business_unit3_quiz'),
    ('public','submit_accounting_unit1_quiz'),
    ('public','submit_accounting_unit2_quiz'),
    ('public','submit_accounting_unit3_quiz'),
    ('public','submit_accounting_unit4_quiz'),
    ('public','submit_accounting_unit5_quiz'),
    ('public','_record_academy_assessment_v1'),
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
        (case when acl.grantee = 0 then 'PUBLIC' else coalesce(role_entry.rolname, acl.grantee::text) end)
        || ':' || acl.privilege_type
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      left join pg_roles role_entry on role_entry.oid = acl.grantee
      where acl.privilege_type = 'EXECUTE'
      order by 1
    )
  end as execute_grants
from required_functions rf
left join pg_namespace n on n.nspname = rf.schema_name
left join pg_proc p on p.pronamespace = n.oid and p.proname = rf.function_name
order by rf.schema_name, rf.function_name, argument_signature;

-- Result 2: source of the private helper functions used by RLS policies.
-- Review these definitions to confirm identity, entitlement, teacher scope,
-- SECURITY DEFINER and fixed search_path behavior.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as argument_signature,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '(not explicitly set)') as function_settings,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'membership_v2_private'
       and p.proname in ('is_admin','my_course_access','teacher_can_view_student'))
   or (n.nspname = 'public'
       and p.proname in ('get_my_active_courses_v2','get_admin_review_plans_v2'))
order by n.nspname, p.proname, argument_signature;
