-- Mohammed Afify membership preflight audit
-- READ ONLY: run in Supabase Dashboard > SQL Editor.
-- This script does not create, alter, delete, or update database objects or rows.
-- It compares the current database with the tables/functions referenced by the
-- membership, approval, subscription, teacher, progress, and assessment code.

-- RESULT SET 1: required tables/columns.
with required_columns(table_name, column_name) as (
  values
    ('profiles','user_id'),
    ('profiles','full_name'),
    ('profiles','email'),
    ('profiles','phone'),
    ('profiles','requested_course'),
    ('profiles','status'),
    ('profiles','role'),
    ('profiles','created_at'),
    ('profiles','updated_at'),
    ('profiles','requested_role'),
    ('profiles','teacher_specialties'),
    ('profiles','requested_teaching_courses'),
    ('profiles','account_state'),

    ('learning_progress','id'),
    ('learning_progress','user_id'),
    ('learning_progress','course_slug'),
    ('learning_progress','lesson_slug'),
    ('learning_progress','lesson_title'),
    ('learning_progress','seconds_watched'),
    ('learning_progress','completed'),
    ('learning_progress','updated_at'),

    ('assessment_results','id'),
    ('assessment_results','user_id'),
    ('assessment_results','course_slug'),
    ('assessment_results','assessment_title'),
    ('assessment_results','score_percent'),
    ('assessment_results','created_at'),

    ('course_catalog','course_slug'),
    ('course_catalog','title'),
    ('course_catalog','is_active'),

    ('subscription_plans','id'),
    ('subscription_plans','code'),
    ('subscription_plans','name'),
    ('subscription_plans','description'),
    ('subscription_plans','plan_type'),
    ('subscription_plans','price'),
    ('subscription_plans','currency'),
    ('subscription_plans','duration_days'),
    ('subscription_plans','is_active'),
    ('subscription_plans','is_public'),
    ('subscription_plans','created_at'),

    ('subscription_plan_courses','plan_id'),
    ('subscription_plan_courses','course_slug'),
    ('subscription_plan_courses','can_view_course_page'),
    ('subscription_plan_courses','can_watch_video'),
    ('subscription_plan_courses','can_download'),
    ('subscription_plan_courses','can_take_assessments'),
    ('subscription_plan_courses','can_receive_certificate'),
    ('subscription_plan_courses','can_track_progress'),

    ('student_subscriptions','id'),
    ('student_subscriptions','user_id'),
    ('student_subscriptions','plan_id'),
    ('student_subscriptions','base_amount'),
    ('student_subscriptions','discount_type'),
    ('student_subscriptions','discount_value'),
    ('student_subscriptions','discount_amount'),
    ('student_subscriptions','discount_reason'),
    ('student_subscriptions','agreed_amount'),
    ('student_subscriptions','currency'),
    ('student_subscriptions','status'),
    ('student_subscriptions','payment_state'),
    ('student_subscriptions','starts_at'),
    ('student_subscriptions','expires_at'),
    ('student_subscriptions','created_at'),

    ('subscription_payments','id'),
    ('subscription_payments','subscription_id'),
    ('subscription_payments','student_user_id'),
    ('subscription_payments','amount'),
    ('subscription_payments','currency'),
    ('subscription_payments','payment_method'),
    ('subscription_payments','payment_reference'),
    ('subscription_payments','status'),
    ('subscription_payments','paid_at'),
    ('subscription_payments','created_at'),
    ('subscription_payments','note'),

    ('teacher_course_assignments','id'),
    ('teacher_course_assignments','teacher_user_id'),
    ('teacher_course_assignments','course_slug'),
    ('teacher_course_assignments','is_active'),
    ('teacher_course_assignments','assigned_at'),

    ('teacher_permissions','teacher_user_id'),
    ('teacher_permissions','permission_key'),
    ('teacher_permissions','enabled'),
    ('teacher_permissions','updated_at')
)
select
  rc.table_name,
  count(*) as expected_columns,
  count(c.column_name) as existing_columns,
  count(*) - count(c.column_name) as missing_columns,
  string_agg(rc.column_name, ', ' order by rc.column_name)
    filter (where c.column_name is null) as missing_column_names
from required_columns rc
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = rc.table_name
 and c.column_name = rc.column_name
group by rc.table_name
order by rc.table_name;

-- RESULT SET 2: row-level security status for every membership data table.
with required_tables(table_name) as (
  values
    ('profiles'),
    ('learning_progress'),
    ('assessment_results'),
    ('course_catalog'),
    ('subscription_plans'),
    ('subscription_plan_courses'),
    ('student_subscriptions'),
    ('subscription_payments'),
    ('teacher_course_assignments'),
    ('teacher_permissions')
)
select
  rt.table_name,
  (c.oid is not null) as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(p.policy_count, 0) as policy_count
from required_tables rt
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
 and c.relname = rt.table_name
 and c.relkind in ('r','p')
left join lateral (
  select count(*)::integer as policy_count
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename = rt.table_name
) p on true
order by rt.table_name;

-- RESULT SET 3: RPC/functions called by the current browser code.
with required_functions(function_name) as (
  values
    ('is_platform_admin'),
    ('is_approved_student'),
    ('set_student_status'),
    ('get_my_active_courses_v2'),
    ('get_admin_review_plans_v2'),
    ('approve_student_application_with_discount_v1'),
    ('review_membership_request_v2'),
    ('admin_assign_student_with_discount_v1'),
    ('record_subscription_payment_v3'),
    ('activate_student_subscription_v2'),
    ('set_profile_role_v2'),
    ('assign_teacher_course_v2'),
    ('set_teacher_permission_v2'),
    ('set_student_subscription_status_v2'),
    ('refund_subscription_payment_v2'),
    ('expire_due_subscriptions_v2'),
    ('submit_business_unit1_quiz'),
    ('submit_business_unit2_quiz'),
    ('submit_business_unit3_quiz'),
    ('submit_accounting_unit1_quiz'),
    ('submit_accounting_unit2_quiz'),
    ('submit_accounting_unit3_quiz'),
    ('submit_accounting_unit4_quiz'),
    ('submit_accounting_unit5_quiz')
)
select
  rf.function_name,
  count(p.oid) as matching_function_count,
  (count(p.oid) > 0) as exists
from required_functions rf
left join pg_namespace n on n.nspname = 'public'
left join pg_proc p
  on p.pronamespace = n.oid
 and p.proname = rf.function_name
group by rf.function_name
order by rf.function_name;

-- RESULT SET 4: policies currently defined for membership tables.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'learning_progress',
    'assessment_results',
    'course_catalog',
    'subscription_plans',
    'subscription_plan_courses',
    'student_subscriptions',
    'subscription_payments',
    'teacher_course_assignments',
    'teacher_permissions'
  )
order by tablename, policyname;
