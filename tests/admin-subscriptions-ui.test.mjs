import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public-site/admin-subscriptions.html", import.meta.url), "utf8");
const js = await readFile(new URL("../public-site/assets/js/admin-subscriptions.js", import.meta.url), "utf8");
const adminHtml = await readFile(new URL("../public-site/admin-students.html", import.meta.url), "utf8");
const adminStudentsJs = await readFile(new URL("../public-site/assets/js/admin-students.js", import.meta.url), "utf8");

assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
assert.match(html, /assets\/js\/membership-config\.js/);
assert.match(html, /assets\/js\/admin-subscriptions\.js/);
assert.doesNotMatch(html, /\.\.\/assets\/js\/supabase-config\.js/);
assert.doesNotMatch(html, /admin-requests\.html|student-dashboard\.html/);
assert.match(html, /admin-students\.html/);
assert.match(html, /pendingStudentRequestsPanel/);
assert.match(html, /pendingStudentsBody/);
assert.match(html, /panels.length !== 10/);
assert.match(js, /get_admin_review_plans_v2/);
assert.match(js, /approve_student_application_with_discount_v1/);
assert.match(js, /review_membership_request_v2/);
assert.match(js, /requested_role !== 'teacher'/);
assert.match(js, /data-request-role/);
assert.match(js, /requested_teaching_courses/);
assert.match(js, /p_decision:action === 'approve'/);
assert.match(adminHtml, /الدورة المطلوبة/);
assert.match(adminStudentsJs, /student-requested_course/);
assert.match(adminStudentsJs, /requested_course/);
assert.match(adminStudentsJs, /from\("course_catalog"\)/);
assert.match(adminHtml, /href="admin-subscriptions\.html"/);

assert.match(js, /cfg\.supabasePublishableKey \|\| cfg\.supabaseAnonKey/);
assert.match(js, /rpc\('is_platform_admin'/);
assert.match(js, /adminProfile\?\.role !== 'admin'/);
assert.match(js, /adminProfile\?\.status !== 'approved'/);
assert.match(js, /adminProfile\?\.account_state !== 'active'/);

assert.match(js, /admin_assign_student_with_discount_v1/);
assert.match(js, /record_subscription_payment_v3/);
assert.match(js, /activate_student_subscription_v2/);
assert.match(js, /set_student_subscription_status_v2/);
assert.match(js, /refund_subscription_payment_v2/);
assert.match(js, /expire_due_subscriptions_v2/);
assert.match(js, /if \(sub\.payment_state === 'waived'\) return 0;/);
assert.match(js, /location\.href = 'admin-students\.html'/);

console.log("PASS: public admin subscription page uses Membership V2 config, admin-only guards, expected RPCs, and blocks collection on waived subscriptions.");
