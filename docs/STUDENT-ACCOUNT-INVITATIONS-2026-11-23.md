# Student account invitations — TEST-first setup

**Status:** draft implementation; not deployed to Supabase and not enabled for the live website.  
**Data model:** existing Membership V2 / Supabase Auth. No new password table and no SQL migration.  
**Username:** the student's own email address.  
**Password:** chosen by the student after receiving an invitation email.

## What the feature provides

- An admin-only invitation screen at \`/admin-students.html\`.
- Single or bulk student invitations (up to 40 per request).
- CSV columns: \`full_name,email,phone,requested_course\`.
- Server-side authorization through the signed-in user JWT, the existing \`is_platform_admin()\` RPC, and the caller's own approved/active admin profile.
- Student invitations through Supabase Auth Admin \`inviteUserByEmail\`, using the platform-injected server secret key inside the Edge Function only.
- A student password setup page at \`/student-set-password.html\`.
- Student sign-in at \`/student-login.html\` and an initial student area at \`/student-space.html\`.
- Per-student result rows. A duplicate/previously registered email is not invited again.

## Important account lifecycle

1. The administrator sends an invitation to the student's email.
2. Supabase sends the invitation link to that address.
3. The student opens the link and chooses a private password (minimum 10 characters in this UI).
4. The existing Membership V2 Auth trigger creates the student's profile. The trigger—not browser input—sets the actual role to student and starts the profile in the configured pending state.
5. An administrator approves the student and assigns/activates the appropriate course subscription using the existing V2 membership workflow.
6. Only after approval and an active subscription with the required course capabilities can the student receive course access through \`get_my_active_courses_v2()\`.

**Sending an invitation does not approve the student, grant a course subscription, or reveal paid lessons.** The invitation form never accepts a role, profile status, payment status, or password from the CSV.

## Deploy to TEST using PowerShell

Prerequisites:
- The selected Supabase project is the isolated TEST project and already contains the current Membership V2 schema.
- The TEST project has a working admin user whose profile is \`role=admin\`, \`status=approved\`, and \`account_state=active\`, and whose \`is_platform_admin()\` RPC returns true.
- Supabase Auth email delivery is configured and test messages can be received.
- Node.js 20+ and Git are installed.

Run from PowerShell:

~~~powershell
git clone https://github.com/MohamedAfify2025/mohammed-afify.git
cd mohammed-afify
git checkout feature/student-invitations-and-login-2026-11-23

node tests/student-invites.test.mjs

Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Deploy-StudentInvitations-TEST.ps1
~~~

The script:
1. Confirms the dedicated TEST branch and requires the operator to type \`TEST\`.
2. Rejects the Supabase project currently configured in the public website source.
3. Requests the TEST Project Ref, exact website origin, student invite redirect URL, and Supabase TEST Publishable Key.
4. Validates that the browser key is Publishable or a legacy \`anon\` key; it rejects secret/service-role keys.
5. Writes a local-only \`public-site/assets/js/membership-config.local.js\` file, which is listed in \`.gitignore\` and must never be committed.
6. Sets only \`ALLOWED_ORIGINS\` and \`STUDENT_INVITE_REDIRECT_URL\` as Edge Function secrets.
7. Deploys only \`admin-create-student-invitations\` to the specified TEST project.

The function reads Supabase's injected \`SUPABASE_SECRET_KEYS\` dictionary on the server. Do not create or paste a service-role key into browser configuration, GitHub, PowerShell script files, or CSV files. No SQL is run by this deployment script.

## Supabase Auth redirect setting

Before sending a real invitation, add the exact redirect URL entered in the script to:

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**

For the local PowerShell test server, the default is:

\`http://localhost:5500/student-set-password.html\`

The redirect URL must be an exact allowed URL. After TEST acceptance, configure the equivalent public GitHub Pages redirect URL for the correct target Supabase project.

## Run the local browser test

The deployment script creates a local-only Publishable-key config. Start a simple static server in a separate PowerShell window:

~~~powershell
cd <path-to-repository>
npx --yes http-server public-site -p 5500 -c-1
~~~

Then open:

- Admin invitation page: \`http://localhost:5500/admin-students.html\`
- Student login: \`http://localhost:5500/student-login.html\`

Sign in using the existing TEST admin account. The page checks both \`is_platform_admin()\` and the admin profile before showing the invitation form.

Use a CSV file with this header and sample row:

~~~csv
full_name,email,phone,requested_course
Ahmed Mohamed,ahmed@example.com,01000000000,Excel
~~~

Upload the file or paste its rows into the text area, preview the rows, correct any duplicates/invalid emails, and then send invitations. Use an email address you control for the first test; do not use a real trainee list until delivery and the password page are verified.

## Email delivery and duplicate users

- The invitation is sent by Supabase Auth. Configure SMTP/custom email delivery and the Invite User email template before sending invitations to the whole cohort; the default mail service may be restrictive for production volumes.
- If an email already belongs to an Auth user, Supabase rejects a second invitation. The current UI reports that the address is already registered; it does not create a duplicate identity or reset that user's password.
- An existing student who has forgotten their password should use the password reset flow on the student login page.

## Files added

- \`supabase/functions/admin-create-student-invitations/index.ts\`
- \`supabase/functions/_shared/student-invites.mjs\`
- \`public-site/admin-students.html\`
- \`public-site/student-login.html\`
- \`public-site/student-set-password.html\`
- \`public-site/student-space.html\`
- \`public-site/assets/js/admin-students.js\`
- \`public-site/assets/js/student-login.js\`
- \`public-site/assets/js/student-set-password.js\`
- \`public-site/assets/js/student-space.js\`
- \`scripts/Deploy-StudentInvitations-TEST.ps1\`
- \`tests/student-invites.test.mjs\`

## Known limitations / release gates

- The public browser config is intentionally a placeholder in this branch. A TEST publishable key is written only to the ignored local config by the PowerShell script.
- No Edge Function has been deployed, no invitation email has been sent, and no Auth user/profile has been created by this repository change.
- The real TEST project must be checked for the V2 admin RPC and profile trigger before sending invitations.
- The admin/student pages are not active on the live site until this PR is reviewed and merged, and the correct production project's public config, Edge Function secrets, Auth redirect URL, and email provider are separately configured.
- This first version creates student identities only. Course assignment/approval remains in the existing Membership V2 process; private lesson/video delivery is a separate release gate.
- Student emails are personal data. Keep the CSV local, restrict access, and delete temporary exports after invitations have been sent.
