# Dynamic trainee permissions — Membership V2

## Scope

This additive release introduces reusable permission definitions, per-trainee assignments, time and course scopes, audit history, an administrator UI, and a trainee-facing permission summary. It keeps Supabase Auth and Membership V2 subscriptions in place.

## Permission modes

- **inherit** is the default for every existing account. It preserves current Membership V2 behavior.
- **custom** limits only the features that explicitly call has_platform_permission(permission_code, course_slug) to the active grants for that user.
- Administrators pass the permission check. Visitors continue to use public catalogue and public course-information pages without a login.

## Non-negotiable access rules

1. A grant such as course.lesson.view does not create a subscription and cannot bypass payment. Protected lesson, assessment, download, and video handlers must continue checking the current Membership V2 subscription and course capabilities.
2. Custom mode is an additional restriction layer. It does not edit subscription rows or payment state.
3. Public GitHub Pages files are not private. Hiding a link or rendering a card conditionally is not security for a public HTML file or media URL.
4. Endpoints and RLS policies must call has_platform_permission for each protected feature. Permission codes created in the admin screen are metadata only until a server route or RLS policy checks that exact code.
5. New permissions are never evaluated as SQL identifiers, function names, or executable code.
6. All administrative writes are performed by SECURITY DEFINER RPCs that check membership_v2_private.is_admin(). Direct client writes to the new permission tables are not granted.
7. Every definition, mode, grant, and revocation change is recorded in platform_permission_audit_log.

## Tables

- platform_permission_definitions: permission key, Arabic label, category, resource, action, and status.
- user_permission_profiles: per-user mode (inherit/custom).
- user_permission_grants: per-user grant with optional course scope and validity interval.
- platform_permission_audit_log: append-only administrative audit records.

## Migration

File: supabase/migrations/202611230001_dynamic_user_permissions.sql

Apply to an isolated Membership V2 TEST database only after confirming a restorable backup. The migration requires the existing membership_v2_private.is_admin() helper, profiles fields (user_id, role, status, account_state), and course_catalog.course_slug. It is additive; it does not alter the existing subscription or payment functions.

## Admin workflow

1. Open admin-students.html and sign in using the existing approved administrator account.
2. Choose إدارة الصلاحيات.
3. Select a trainee and keep inherit mode until the individual access design is ready.
4. Change to custom mode to start applying explicit permission grants to features that use the shared permission checker.
5. Grant one or more permissions globally or for a selected course; an optional expiration timestamp is supported.
6. Revoke access by disabling a grant. The audit history retains the change.
7. Create a new permission definition when a new feature needs a key, then integrate the key in the server-side feature handler or RLS policy.

## Trainee workflow

The student workspace calls get_my_platform_permissions() and shows the trainee's own mode and active grants only. A trainee cannot read another user's grants or alter their own settings.

## Test and release gates

- Validate schema prerequisites and run the SQL migration on TEST.
- Verify administrator-only access to all admin RPCs.
- Verify an inherit-mode trainee keeps existing V2 access behavior.
- Verify a custom-mode trainee is allowed only explicit active grants where the feature calls the shared checker.
- Verify course-scoped grants do not become global grants.
- Verify start/expiry dates are honored.
- Verify direct table INSERT/UPDATE/DELETE from an authenticated trainee is denied.
- Verify audit rows are created for definition changes, mode changes, grants, and revocations.
- Verify lesson/media access still fails for missing, expired, suspended, or unpaid subscriptions even when the user has course.lesson.view.
- Only after TEST acceptance should a separate, reviewed production migration be considered.

No Supabase database was modified and no LIVE deployment was performed by creating this branch or pull request.
