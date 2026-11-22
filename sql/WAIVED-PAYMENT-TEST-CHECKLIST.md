# TEST Acceptance Checklist — Waived Subscription Payment Guard

**Scope:** `record_subscription_payment_v3` and the administrator collection UI.  
**Target:** isolated Supabase TEST project only.  
**Status:** prepared; not executed.

## Preconditions

- [ ] Confirm the project reference belongs to the isolated TEST project, not the source or LIVE project.
- [ ] Confirm the TEST project has the restored Membership V2 schema and the expected tables.
- [ ] Save a verified backup/export before changing the function.
- [ ] Run `sql/membership-v2-phase1-preflight.sql` and save all result sets.
- [ ] Confirm the exact signature exists:
  `public.record_subscription_payment_v3(uuid,numeric,text,text,text)`.
- [ ] Review the current function definition and grants against the source schema export.
- [ ] Do not run `sql/membership-schema.sql` or `sql/real-assessments-v1.sql`.

## Apply the narrow TEST patch

After all preconditions pass, review and apply only:

`sql/membership-v2-block-waived-payment-test.sql`

The patch replaces one function body. It is designed to preserve the existing signature and ACL. It must not be copied to LIVE as part of this phase.

## Functional acceptance tests

Use dedicated test accounts and synthetic TEST subscriptions. Do not use real student accounts or real payment references.

| Case | Test setup | Expected result |
|---|---|---|
| Waived, positive original amount | `payment_state='waived'`, `agreed_amount > 0` | RPC rejects with SQLSTATE `22023`; no payment row is created |
| Unpaid | Positive due amount, no paid ledger | Valid payment within due amount succeeds |
| Partial | Paid ledger below due amount | Remaining amount is calculated correctly; valid balance payment succeeds |
| Rounded zero | Attempt amount `0.004` | RPC rejects; no zero-value payment is created |
| Over balance | Attempt amount greater than remaining balance | RPC rejects; no payment row is created |
| Concurrent payment | Two admin sessions attempt payments against the same remaining balance | Row lock prevents both transactions from overshooting the due amount |
| UI selector | Waived subscription with positive `agreed_amount` | It does not appear in the payable-subscription selector |
| Historical reporting | View waived subscription in the subscriptions table | Original agreed amount remains visible; collectible remaining balance is zero |

## Post-test checks

- [ ] Verify the waived subscription has no new payment row.
- [ ] Verify existing payment rows and amounts are unchanged.
- [ ] Verify unpaid and partial subscriptions still calculate balances correctly.
- [ ] Verify the admin UI displays zero remaining for waived subscriptions.
- [ ] Re-run the relevant read-only function/grant audit and retain the output.
- [ ] Record screenshots/logs for each test case and the exact TEST project reference.

## Release decision

Do not merge this PR or deploy the change to LIVE until the TEST acceptance cases pass. If any schema signature, function owner, ACL, or expected column differs, stop and reconcile against the current schema export before proceeding.
