# Student invitations — LIVE deployment

**Scope:** deploy the account invitation feature to the existing production Supabase project and connect the public GitHub Pages UI.  
**Not included:** SQL changes, student imports, account creation, bulk invitations, private lesson/video upload, or any TEST deployment.

## Preflight review completed

The production database was reviewed using read-only SQL supplied by the platform owner:

- public.profiles contains all eight fields required by the invitation feature.
- profiles has RLS enabled.
- public.is_platform_admin() exists, is SECURITY DEFINER, has an empty search path, returns boolean, and is executable by authenticated users.
- public.handle_new_auth_user() is the enabled auth.users insert trigger function. It creates a profile with actual role='student', status='pending', and account_state='active'.
- membership_v2_private.is_admin() checks the authenticated UID against the caller's own approved, active admin profile.
- One eligible admin profile exists.
- public.is_approved_student() and public.get_my_active_courses_v2() require approved and active student status; active subscription, eligible payment state, dates, active plan/course, and course-view capability are also required.

No SQL or data writes have been performed.

## Supabase Edge Function auth mode

The invitation endpoint is invoked by a signed-in administrator through supabase.functions.invoke. The browser sends the user access token in Authorization: Bearer ... and the project's publishable key in apikey.

The function keeps verify_jwt = true and also validates the caller with auth.getUser(accessToken), the is_platform_admin() RPC, and the caller's own approved/active admin profile.

Supabase's current authorization-header documentation (updated 2026-11-20) says verify_jwt validates legacy HS256 and current asymmetric-signed user JWTs. Do not disable this check for this endpoint.

## Target values and safety check

The existing TEST deployment script contains a guard for the Supabase project previously identified as the project connected to the public website:

ybsjnubrswqksvktgmay

The LIVE deployment script accepts only that exact project ref. Confirm it matches the production project's Project Ref in Supabase Dashboard before running. If it does not match, stop and update the expected ref only after verifying which project is production.

The public GitHub Pages origin and invitation redirect are fixed:

- Allowed origin: https://mohamedafify2025.github.io
- Invite redirect: https://mohamedafify2025.github.io/mohammed-afify/student-set-password.html

Add the exact invite redirect to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Configure and test custom SMTP/email delivery before confirming AUTH_READY.

## Deploy using PowerShell

After this PR is merged, use a clean checkout of main:

~~~powershell
git switch main
git pull --ff-only origin main

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\Deploy-StudentInvitations-LIVE.ps1
~~~

The script:

1. Requires a clean main checkout and the expected GitHub origin.
2. Re-runs the local student input tests.
3. Requires typing LIVE and checks the exact production project ref.
4. Requires confirmation that the Auth redirect and custom SMTP have been configured.
5. Accepts only an sb_publishable_... key or a legacy JWT with role anon. Secret and service-role keys are rejected.
6. Checks the supplied project URL/key pair.
7. Uses Supabase CLI login and sets only ALLOWED_ORIGINS and STUDENT_INVITE_REDIRECT_URL.
8. Deploys only admin-create-student-invitations to the exact allowed production project.
9. Writes the public project URL and publishable key to public-site/assets/js/membership-config.js. The key is designed for browser use and is not a service-role secret.
10. Requires typing PUBLISH before committing and pushing the browser configuration to main, which triggers GitHub Pages deployment.

Supabase automatically injects SUPABASE_URL, SUPABASE_PUBLISHABLE_KEYS, and SUPABASE_SECRET_KEYS into hosted Edge Functions. The script does not create or expose a service-role key.

## First production acceptance

After GitHub Pages reports a successful deployment:

1. Open the admin page and sign in with the existing approved administrator account.
2. Confirm the admin identity is shown and the invitation panel is available.
3. Prepare one invitation to an email address controlled by the platform owner.
4. Review the preview and send exactly one invitation.
5. Verify email receipt, the password setup link, successful password creation, and login.
6. Verify the new profile is role='student', status='pending', account_state='active'.
7. Verify the student sees no course access before approval and subscription assignment.
8. Only after that acceptance, prepare the actual trainee list.

Do not paste secret/service-role keys into GitHub or browser files. Do not run sql/membership-schema.sql, any old V1 SQL, or any new migration for this feature.
