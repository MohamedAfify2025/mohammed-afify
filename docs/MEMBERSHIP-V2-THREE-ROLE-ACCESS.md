# Membership V2 — Three-role course permissions

## Intended access model

- **Visitor:** can read the active course catalog (`course_slug`, title and description). This is public course information only; no profile, subscription, payment, progress or private lesson data is returned.
- **Student:** can read their own profile and their own course-permission summary. Course entitlements require an approved, active student profile plus an active, paid/waived subscription whose plan includes the course. Per-student capability rows override the plan defaults for that student/course only.
- **Admin:** the existing active platform-admin predicate bypasses the student subscription checks in `membership_v2_private.my_course_access`, so admins can open course data protected by that function. Admin changes are recorded in `membership_audit_log`.

Capabilities are independent per course: page, video, download, assessment, certificate and progress. Page access is a prerequisite for the other capabilities.

## Deployment order

1. Take a Supabase LIVE database backup.
2. Run this read-only query in the LIVE SQL Editor and export/retain the result:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '(not explicitly set)') as function_settings,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'membership_v2_private' and p.proname in ('is_admin','my_course_access'))
   or (n.nspname = 'public' and p.proname in ('get_my_active_courses_v2','is_platform_admin'))
order by n.nspname, p.proname;
```

3. Review the returned `my_course_access(text,text)` and `get_my_active_courses_v2()` definitions against the V2 logic expected by the migration. The migration contains its own preflight guard and will abort the transaction if required V2 checks are missing. Do not remove that guard to force execution.
4. In Supabase LIVE > SQL Editor, run the entire file `sql/membership-v2-per-user-course-permissions.sql` in one execution. It is transactional; if it raises an exception, do not retry blindly. Save the exact error and review the live definitions.
5. Refresh the published site. The admin subscription page will show the per-student permissions panel once the new table is available. It only lists courses covered by an active paid/waived subscription.
6. Test with one approved student account and a course that is already included in that student's active subscription. Change one capability, verify the student view, then reset to plan defaults. Avoid using a real student's account for a temporary test unless the student is aware of the access change.

## What this migration does not do

- It does not create students, plans, subscriptions or payments.
- It does not grant a course to a student who has no active subscription for that course.
- It does not change the default capabilities of existing plans.
- It does not publish lesson videos or downloads.
- It does not make files committed to GitHub Pages private. GitHub Pages serves static files publicly by URL; hiding a link or gating a page with JavaScript is not a security boundary. Paid videos, PDFs and other confidential lesson files must be moved to a private storage bucket or authenticated content service and checked server-side before they can be treated as private.