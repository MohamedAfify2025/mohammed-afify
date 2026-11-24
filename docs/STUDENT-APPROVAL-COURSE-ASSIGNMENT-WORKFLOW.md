# Student approval and course assignment workflow

## Purpose

The public admin workflow now carries a student's selected course from the invitation form into the existing Supabase Auth metadata, then presents pending student and teacher requests in the published admin subscriptions page.

No database schema or SQL migration is introduced by this change.

## Student flow

1. The administrator adds a student's name, email or WhatsApp phone, requested course, and invitation channel.
2. Email invitations call the existing `admin-create-student-invitations` Edge Function. The server validates the course slug and passes it as `requested_course` in Auth user metadata.
3. The existing Auth user trigger creates the student's profile in the pending state. The invitation does not approve the account or grant a subscription.
4. The admin opens `admin-subscriptions.html` and reviews the pending request.
5. The admin must choose a plan returned by `get_admin_review_plans_v2` that matches the requested course, then optionally applies a discount.
6. Approval calls `approve_student_application_with_discount_v1`, the existing transactional approval/assignment RPC.
7. A paid subscription stays unavailable until its payment is recorded and the subscription is activated. A free/fully waived subscription follows the existing waiver logic.
8. After the student has an approved, active profile and an eligible active subscription, individual course capabilities can be managed using the existing per-student permission RPCs.

## Teacher flow

- Pending teacher requests are shown in the same review queue with their specialties and requested teaching courses.
- Approval or rejection uses the existing `review_membership_request_v2` RPC.
- After approval, the administrator assigns one or more courses in the Teachers section and sets the teacher's allowed permissions.

## Invitation channels

- **Email:** creates the Supabase Auth invitation and profile workflow.
- **WhatsApp:** opens a prefilled message for the administrator to send manually. Without WhatsApp Business API, it does not create a Supabase Auth user. The recipient must reply with an email address; the administrator then sends the secure email invitation.

## CSV format

The supported five-column order is:

```csv
full_name,email,phone,delivery_method,requested_course
```

- `delivery_method` is `email` or `whatsapp`.
- `requested_course` must be an active `course_slug` from `course_catalog`.
- The previous four-column format with the requested course in column four is also accepted.

## Important safeguards and remaining release checks

- The invite Edge Function keeps JWT verification enabled and checks the caller's active admin profile.
- The browser continues to use only the Supabase publishable/anon key; no service-role secret is added to public files.
- Plan selection is restricted to matching active plans returned by the existing review RPC.
- The migration that provides per-student course overrides is separate from invitation and approval.
- Static files on GitHub Pages and public video URLs are not private. Confidential lessons and downloads still require private storage or a server-mediated access URL.
- Before changing the live database, verify the current definitions and grants for `approve_student_application_with_discount_v1`, `review_membership_request_v2`, `get_admin_review_plans_v2`, payment and activation RPCs, and the Auth user trigger.
- Test at least one student approval for a paid plan, a fully waived plan, a rejected request, a teacher request, a duplicate email, and a mismatched/inactive course before promoting this workflow to production.
