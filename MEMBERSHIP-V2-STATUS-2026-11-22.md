# Mohammed Afify Platform — Membership V2 Status

**Status date:** 22 November 2026  
**Working branch:** `work/waived-payment-guard-ui-2026-11-22`  
**Production / database writes:** None performed in this work session.

## Deployment boundaries

- The GitHub repository `MohamedAfify2025/mohammed-afify` is private. That protects source access, not the visibility of a static website after deployment.
- The repository contains an isolated public-site package in `public-site/`. The Cloudflare isolation commit added a public informational page for academy access and intentionally did not copy the private membership/admin pages into that package. Confirm the Cloudflare Pages build-directory setting in its dashboard before any deployment decision.
- The repository root contains the richer membership application and Supabase client integration. Do not assume that root files and the isolated `public-site/` package are interchangeable.
- GitHub Pages and Cloudflare Pages serve static files. Browser-side hiding is not a security boundary for paid lessons, private media, or student records.

## Current database baseline

- The active technical reference is Supabase Membership V2, not the early V1 starter schema.
- The reviewed schema-only export contains 14 application tables, 31 functions, 24 policies, and five application triggers. The `auth.users` trigger and Supabase-managed event triggers require separate handling during restoration.
- The raw schema-only export is not suitable for blind restoration: it includes `CREATE SCHEMA public` and default ACL statements that must be reviewed/removed; it contains no application row data.
- Do not run `sql/membership-schema.sql` or `sql/real-assessments-v1.sql` against the current V2 project.
- Use `sql/MEMBERSHIP_V2_REPAIR_PLAN.md` as the current database repair plan. Run the preflight and function-security audit as read-only checks before considering a TEST migration.

## Work completed on this branch

1. Updated `assets/js/admin-subscriptions.js`: `paymentRemaining()` now returns zero for `payment_state = 'waived'`, even when the historical `agreed_amount` is positive. Because the payment selector is built from this helper, waived subscriptions are excluded from the payable list.
2. Marked `SETUP-MEMBERSHIP.md` as a historical V1 guide so its old instructions cannot be mistaken for the V2 deployment procedure.
3. Marked `sql/membership-schema.sql` as a legacy V1 schema that must not be run over V2.

## Database patch prepared but not applied

- `sql/membership-v2-block-waived-payment-test.sql` contains the narrowly scoped TEST-only RPC guard for `record_subscription_payment_v3`. It rejects any new payment when the subscription payment state is `waived`.
- This SQL patch must only be evaluated against an isolated TEST database after verifying the current function signature and saving a backup.
- No SQL was run, no existing payments were modified, and no production database was touched.

## Remaining release gates

- Verify the TEST project identity and backup/restore status.
- Run the read-only preflight and capture results.
- Apply the TEST-only SQL guard in TEST, then test waived, unpaid, partial, zero-rounded, and over-balance cases.
- Verify the admin UI payment selector and payment submission flow against TEST.
- Complete role-specific checks for student, teacher, and admin, including RLS and private media storage.
- Confirm Cloudflare Pages build directory and environment before a controlled public-site deployment.
- Do not merge or deploy to production until TEST acceptance passes and the deployment target has been verified.

## Important security rule

The Supabase publishable/anon key may be present in browser configuration when RLS and grants are correctly configured. A service-role key, database password, or private media URL must never be placed in HTML, JavaScript, or a public static asset.
