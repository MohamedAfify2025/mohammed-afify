import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, adminHtml, adminJs, studentHtml, studentJs, guestHtml, guestJs] = await Promise.all([
  readFile(new URL("../sql/membership-v2-per-user-course-permissions.sql", import.meta.url), "utf8"),
  readFile(new URL("../public-site/admin-subscriptions.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-subscriptions.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/student-space.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/student-space.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/academy-access.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/academy-access.js", import.meta.url), "utf8"),
]);

// Migration is additive and requires an active paid/waived subscription.
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.student_course_permissions/i);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(migration, /student_course_permissions_self_admin_read_v2/i);
assert.match(migration, /membership_v2_private\.is_admin\(\)/i);
assert.match(migration, /ss\.payment_state IN \('paid', 'waived'\)/i);
assert.match(migration, /ss\.status = 'active'/i);
assert.match(migration, /p\.status = 'approved'/i);
assert.match(migration, /p\.account_state = 'active'/i);
assert.match(migration, /can_view_course_page OR NOT/i);
assert.match(migration, /student\.course_permissions\.updated/i);
assert.match(migration, /student\.course_permissions\.reset_to_plan/i);
assert.match(migration, /SELECT membership_v2_private\.is_admin\(\)\s+OR EXISTS/i);
assert.match(migration, /course_catalog_public_preview_v2[\s\S]*USING \(is_active = true\)/i);
assert.match(migration, /SET search_path TO ''/i);

// Admin can choose separate course capabilities for one student, without changing the package.
assert.match(adminHtml, /studentCoursePermissionsPanel/);
assert.match(adminHtml, /accessStudentSelect/);
assert.match(adminHtml, /accessCourseSelect/);
assert.match(adminHtml, /permCanVideo/);
assert.match(adminHtml, /permCanDownload/);
assert.match(adminHtml, /permCanAssessment/);
assert.match(adminHtml, /permCanCertificate/);
assert.match(adminHtml, /permCanProgress/);
assert.match(adminHtml, /resetStudentPermissionsBtn/);
assert.match(adminJs, /student_course_permissions/);
assert.match(adminJs, /admin_set_student_course_permissions_v2/);
assert.match(adminJs, /admin_reset_student_course_permissions_v2/);
assert.match(adminJs, /studentSubscriptionIsEntitled/);
assert.match(adminJs, /state\.permissionsReady/);
assert.match(adminJs, /can_view_course_page/);

// Students can view their own per-course permission summary.
assert.match(studentHtml, /course permissions|coursePanel|الدورات وصلاحيات حسابك/i);
assert.match(studentJs, /get_my_course_permissions_v2/);
assert.match(studentJs, /can_watch_video/);
assert.match(studentJs, /can_download/);
assert.match(studentJs, /can_take_assessments/);
assert.match(studentJs, /can_receive_certificate/);
assert.match(studentJs, /can_track_progress/);

// Visitors only load public course metadata, not profiles, subscriptions, or user records.
assert.match(guestHtml, /مكتبة الدورات|المكتبة التعليمية العامة/);
assert.match(guestJs, /from\("course_catalog"\)/);
assert.match(guestJs, /select\("course_slug,title,description"\)/);
assert.doesNotMatch(guestJs, /from\("profiles"\)|from\("student_subscriptions"\)|get_my_course_permissions_v2/);

console.log("PASS: visitor catalog, per-student course permissions, Membership V2 subscription gates, admin full-course access and student permission display.");
