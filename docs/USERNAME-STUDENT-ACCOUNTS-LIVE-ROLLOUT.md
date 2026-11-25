# Username-Based Student Accounts — LIVE Rollout Runbook

## Current release state

- Source of truth: PR #32, branch `feature/username-student-accounts-20261125`.
- TEST project: `jniekfbelqticopcotxg` (`mohammed-afify-v2-test`).
- LIVE project: `ybsjnubrswqksvktgmay` (`mohammed-afify-learning`).
- TEST Edge Function `admin-manage-student-accounts`: version 2, ACTIVE, `verify_jwt=true`.
- LIVE Edge Function `admin-manage-student-accounts`: not deployed at the time this runbook was prepared.
- The completed one-time Odoo transfer utility is excluded from the product release.
- No LIVE student accounts, course access, passwords, or course content were changed by this release preparation.

## Release scope

The release contains the username-based student account UI and Edge Function, direct course routing after login, student-only course-room presentation, and the TEST/LIVE browser project selector.

It does not migrate the LIVE course catalog, students, subscriptions, or course files. The Odoo course content already exists in LIVE; the successful content transfer performed earlier was into TEST only.

## Production blockers found by read-only inspection

1. LIVE `service_role` lacks the table privileges needed by the new Edge Function. The TEST project has the minimal privileges listed in `sql/student-username-accounts-live-preflight.sql`.
2. The LIVE function needs an explicit `ALLOWED_ORIGINS` secret. The exact production website origin recorded in the existing LIVE deployment script is `https://mohamedafify2025.github.io`. Do not add preview domains or unverified custom domains.
3. The LIVE function needs to be deployed with `verify_jwt=true`.
4. LIVE backup must be verified before any production grant or deployment operation.

## Backup requirements

Do not assume an automatic backup exists. Check the actual project plan and Supabase Dashboard before rollout.

Export the LIVE database before changes. For a logical backup, Supabase documents these separate exports:

```powershell
supabase db dump --db-url "<LIVE_CONNECTION_STRING>" -f roles.sql --role-only
supabase db dump --db-url "<LIVE_CONNECTION_STRING>" -f schema.sql
supabase db dump --db-url "<LIVE_CONNECTION_STRING>" -f data.sql --use-copy --data-only
```

Obtain the connection string from the LIVE project's Connect dialog. Never commit it or paste it into chat. Store the exports off-site in an access-controlled location.

Back up Storage separately. Database dumps/backups do not contain Storage API object bytes. At minimum, inventory and export the LIVE buckets `private-course-lessons` and `public-course-assets`. Preserve object paths, MIME types, bucket visibility, size limits, and allowed MIME types. Verify file counts and representative file hashes/sizes after export.

Record the backup timestamp, export location, file counts, and the person responsible for restore.

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

The script requires:
- the exact repository and `main` branch;
- the exact LIVE project ref;
- explicit `BACKUP-VERIFIED`, `GRANTS-VERIFIED`, and `DEPLOY-LIVE` confirmations;
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
