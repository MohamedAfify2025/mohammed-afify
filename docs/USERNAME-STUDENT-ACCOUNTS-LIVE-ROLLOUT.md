# Username-Based Student Accounts — LIVE Rollout Runbook

## Current release state

- Source of truth: PR #32, branch `feature/username-student-accounts-20261125`.
- TEST project: `jniekfbelqticopcotxg` (`mohammed-afify-v2-test`).
- LIVE project: `ybsjnubrswqksvktgmay` (`mohammed-afify-learning`).
- TEST Edge Function `admin-manage-student-accounts`: version 3, ACTIVE, `verify_jwt=true` (verified 2026-11-25).
- LIVE Edge Function `admin-manage-student-accounts`: not deployed at the time this runbook was prepared.
- The completed one-time Odoo transfer utility is excluded from the product release.
- No LIVE student accounts, course access, passwords, or course content were changed by this release preparation.


## TEST browser verification record — 2026-11-25

Using the existing synthetic TEST student account only (no additional student was created during the first round of checks), the manager confirmed:

1. Admin account list loads and displays the student account.
2. Saving the existing Odoo-only course selection succeeds.
3. Student login succeeds and the student can access the assigned Odoo course.
4. Password reset succeeds; the new password successfully authenticates.
5. Suspension blocks student login, and reactivation restores login.

A second, separate TEST student account (`moaz`) was then created with Odoo-only access. The manager confirmed that the credential message was sent through WhatsApp and that the student can log in and use the account. The database shows one creation audit entry for this account, and function logs for the creation window show successful POST requests without HTTP 4xx/5xx or matching handler/audit error events.

A direct URL attempt to open the unassigned Business Administration course was denied, showing the “content unavailable for this account” message. During that visual check, the header still displayed a “لوحة المدير” link even though the student was not authorized for it. This was traced to the global navigation CSS overriding the HTML hidden attribute. The branch now includes a scoped hidden-state CSS rule and a regression assertion so role-gated admin navigation remains hidden.

WhatsApp links are opened for manual sending; the platform does not send messages automatically.

## Release scope

The release contains the username-based student account UI and Edge Function, direct course routing after login, student-only course-room presentation, and the TEST/LIVE browser project selector.

It does not migrate the LIVE course catalog, students, subscriptions, or course files. The Odoo course content already exists in LIVE; the successful content transfer performed earlier was into TEST only.

## Production blockers found by read-only inspection

1. LIVE `service_role` lacks the table privileges needed by the new Edge Function. The TEST project has the minimal privileges listed in `sql/student-username-accounts-live-preflight.sql`.
2. The LIVE function needs an explicit `ALLOWED_ORIGINS` secret. The exact production website origin recorded in the existing LIVE deployment script is `https://mohamedafify2025.github.io`. Do not add preview domains or unverified custom domains.
3. The LIVE function needs to be deployed with `verify_jwt=true`.
4. LIVE backup must be verified before any production grant or deployment operation.

## Backup requirements — verified 2026-11-25

The Supabase organization is currently on the **Free** plan. Do not assume scheduled daily database backups are available; verify the Dashboard's **Database → Backups** page and record what restore points are actually offered.

Important CLI limitation: Supabase CLI v3 `db dump` excludes Supabase-managed schemas, including `auth` and `storage`, as well as extension-managed schemas. The SQL files are therefore a logical export of the application database and roles, **not a complete project backup**. Supabase CLI v3 targets the local stack by default; commands that must read LIVE need an explicit `--remote` flag. References:
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- https://supabase.com/docs/guides/platform/backups

Run these commands with Supabase CLI v3.4.0 from the repository root. For v3, `--remote=<project-ref>` selects the exact hosted project directly; a prior `supabase link` is not required for these commands. Keep the explicit LIVE ref on every remote read:

```powershell
supabase db dump --remote=ybsjnubrswqksvktgmay -f roles.sql --role-only
supabase db dump --remote=ybsjnubrswqksvktgmay -f schema.sql
supabase db dump --remote=ybsjnubrswqksvktgmay -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

These commands do not export Auth users/password hashes/tokens or Storage object bytes. For this project, the helper lists both LIVE buckets with the CLI, creates a short-lived signed URL for each private object through `/storage/v1/object/sign/<bucket>/<path>`, then downloads that URL; public files use `/storage/v1/object/public/<bucket>/<path>`. The private-file route mirrors the Dashboard/SDK signed-URL approach after a direct authenticated GET returned `NoSuchKey` for an object that the Dashboard could download. It asks for the LIVE legacy `service_role` JWT through a masked PowerShell prompt only when private objects exist; the key is not written to disk or console output. Do not paste it in chat, source files, environment files, or logs. This key is highly privileged, so run only on a trusted workstation and rotate it if exposed. Failed object downloads are recorded in `inventory/storage-download-failures.csv`; the helper continues with other files but marks Storage backup partial and never calls it verified. The two LIVE buckets discovered by read-only inspection are `private-course-lessons` and `public-course-assets`; preserve object paths, MIME types, bucket visibility, size limits, and allowed MIME types. Verify object counts, total bytes, and SHA-256 hashes after export. Supabase documents signed URLs for private files, public URL access for public files, and recommends S3-compatible clients for bulk downloads: https://supabase.com/docs/guides/storage/serving/downloads and https://supabase.com/docs/guides/storage/management/download-objects.

### Operator diagnostic — 2026-11-25
The Storage inventory and limited Auth/database inventories completed successfully. A download request for `private-course-lessons/accounting/lecture-01.html` returned `NoSuchKey` even though a read-only SQL query showed the exact object row, `version` UUID, `is_versioned=false`, `archived_at IS NULL`, `is_delete_marker=false`, size `2,538,795`, MIME type `text/html`, and `service_role` SELECT privilege on `storage.objects`. This confirms a mismatch between Storage metadata and the attempted object read; it does not, by itself, prove whether the bytes are absent from the backing provider or the request is denied. Do not edit/delete Storage rows or make the bucket public to work around it. Check whether the same object downloads from the Supabase Dashboard; retain the failure CSV and investigate through the Storage Dashboard/S3 endpoint or Supabase support if the Dashboard also fails.

A sanitized Auth user/identity inventory can support manual recovery, but it is not an Auth backup: password hashes, confirmation/recovery tokens, MFA secrets, and sessions are intentionally omitted. If no platform-level full restore path is available for the Free project, document and approve a manual Auth recovery process (including password resets and MFA re-enrollment) before classifying recovery as acceptable.

The script prepared for this step writes a clear INCOMPLETE status marker by design. It must not be treated as complete until the Dashboard restore path/Auth recovery is resolved and the exported files have been copied off-device to access-controlled storage. Record timestamp, output location, file counts, byte totals, hashes, and restore owner.

## Ordered LIVE rollout

### 1. Review and merge the code

- Review PR #32 and require all CI checks to pass.
- Confirm the final PR diff does not include `admin-course-transfer.html` or `admin-course-transfer.js`.
- Merge only after the user explicitly approves LIVE activation.
- Publish the website from `main` using the normal Pages workflow.
- Confirm the live domain selects `ybsjnubrswqksvktgmay` and the branch preview continues selecting `jniekfbelqticopcotxg`.

### 2. Back up LIVE

Complete both database and Storage exports described above. Do not continue if either backup is missing or unverified.

### 3. Apply the minimal database grants

Open the LIVE Supabase SQL Editor and review `sql/student-username-accounts-live-preflight.sql`. Confirm its project ref comment is `ybsjnubrswqksvktgmay`, then run it only after backup verification.

The script checks required tables, applies only the privileges used by the new Edge Function, and returns a privilege verification row. Every required result must be `true`.

The script does not change user rows, student roles, subscriptions, course mappings, passwords, or content. It does not create any RLS policy and does not disable RLS.

### 4. Set the LIVE function origin and deploy the function

Run `scripts/Deploy-UsernameStudentAccounts-LIVE.ps1` from a clean clone after PR #32 is merged into `main`.

The script supports either a globally installed `supabase` command or Windows `npx.cmd`; when only `npx.cmd` is available it invokes the pinned `supabase@3.4.0` package. The current tested Windows machine has Node/npm/npx but does not have a global Supabase CLI command. Secret configuration is explicitly targeted with `--project-ref ybsjnubrswqksvktgmay`; it does not depend on whichever project may be linked locally.

The script requires:
- the exact repository and `main` branch;
- the exact LIVE project ref;
- a verified off-site database + Storage export;
- a documented and approved Auth recovery path (platform restore point or manual recovery procedure);
- the minimal LIVE service-role grants to be applied and read-back verified;
- explicit `BACKUP-VERIFIED`, `AUTH-RECOVERY-VERIFIED`, `GRANTS-VERIFIED`, and `DEPLOY-LIVE` confirmations;
- Supabase CLI login.

It sets only `ALLOWED_ORIGINS=https://mohamedafify2025.github.io` and deploys only `admin-manage-student-accounts` with `--use-api`. It does not run SQL, alter browser config, create users, or push site changes.

In the Supabase Dashboard, confirm the function is ACTIVE and `verify_jwt=true`. Confirm function secrets are present without revealing their values. Supabase injects the `SUPABASE_URL`, publishable-key, and secret-key variables; never add a service-role/secret key to browser code.

### 5. Controlled post-deployment test

Use the existing approved LIVE administrator identity, not the TEST administrator identity.

Create one clearly named internal test student:
- username distinct from all real students;
- strong temporary password;
- assign only the Odoo course;
- use a controlled company-owned WhatsApp number if WhatsApp delivery needs to be checked.

Verify:
1. The admin account list loads.
2. Creating the test student creates exactly one Auth user, profile, private plan, plan-course mapping, and active waived subscription.
3. The WhatsApp link redirects after login directly to the Odoo course.
4. The student cannot access a course not assigned to that account, including by direct URL.
5. Password reset works and the old password no longer authenticates.
6. Suspension prevents login/content access.
7. Reactivation restores access only to the assigned course.
8. Audit actions are visible in `membership_audit_log` and function logs show no failed audit insert.
9. No other LIVE student records or course assignments were changed.

After testing, reset or suspend the test account according to the operator's data-retention decision. Do not delete a student unless the admin function's user-deletion/retention process has been separately reviewed.

## Rollback

- If website behavior fails, revert the website commit on `main` and allow Pages to redeploy.
- If the Edge Function fails before any test account is created, remove the function from LIVE using the reviewed Supabase CLI command or deploy a reviewed rollback version. Do not delete unrelated functions.
- If only the LIVE grants were applied and the feature is abandoned, use the commented REVOKE section of the SQL preflight file only after confirming no other LIVE service relies on those grants.
- If real data was modified unexpectedly, stop writes and follow the verified database/Storage restore plan. Do not restore the entire database for a code-only issue.

## Explicit non-goals

- No deployment to LIVE occurs by this runbook automatically.
- No production student account is created by the deployment script.
- No production student receives a course assignment automatically.
- No production Odoo content is copied or overwritten.
- No TEST preview origin is allowed by the LIVE function unless an operator deliberately adds it to LIVE `ALLOWED_ORIGINS` (not recommended).


## Approved manual Auth recovery path — 2026-11-25

The operator approved a manual Auth recovery procedure for emergency recovery if a platform-level restore point is unavailable. This approval is for the recovery approach; it is not evidence that a complete Auth backup has been exported or restore-tested.

1. Preserve the original Auth user UUIDs. Existing application tables reference `auth.users.id` (including `public.profiles.user_id`, `public.learning_progress.user_id`, `public.assessment_results.user_id`, and `public.course_lessons.created_by`). Do not recreate existing users with new UUIDs through `auth.admin.createUser()` as a substitute for restoring the original Auth records.
2. Keep a separately protected export of the Auth records required for recovery, at minimum `auth.users` and `auth.identities`, including the original IDs and password hashes if password continuity is required. Never export plaintext passwords or place credential material in GitHub, browser files, or chat.
3. Restore the Auth records into a compatible replacement Supabase project before restoring public application rows that reference those users. Confirm all original IDs are present before restoring dependent rows.
4. Treat existing access/refresh tokens as invalid unless the signing-key migration path is explicitly supported and verified. Plan for users to authenticate again. Review MFA factors separately and require MFA re-enrollment where factor recovery is unavailable.
5. Preserve an operator-only mapping and recovery log. Do not create student accounts or alter LIVE users as part of a disaster-recovery test.

Supabase's current migration guidance describes migrating Auth data (including hashed passwords) through a full backup or SQL export/import. It also warns that tokens depend on project signing keys. See [Migrating Auth Users Between Supabase Projects](https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects).

### Auth recovery evidence still required

- Confirm the locally retained backup contains the necessary Auth tables and columns; a sanitized user/identity inventory alone is not a restorable Auth backup.
- Keep a protected copy in synchronized off-device storage and verify its hashes after synchronization.
- Do not mark the full project backup complete until the Auth export and the off-device copy are confirmed.
