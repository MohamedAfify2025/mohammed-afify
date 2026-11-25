import assert from "node:assert/strict";
import {
  STUDENT_LOGIN_DOMAIN,
  normalizeStudentUsername,
  studentSyntheticEmail,
  normalizeStudentCourseSlugs,
  validateStudentAccountInput,
} from "../supabase/functions/_shared/student-account-helpers.mjs";

assert.equal(STUDENT_LOGIN_DOMAIN, "students.invalid");
assert.deepEqual(normalizeStudentUsername(" Ahmed.Mohamed "), { ok: true, value: "ahmed.mohamed" });
assert.deepEqual(normalizeStudentUsername("a_123"), { ok: true, value: "a_123" });
for (const username of ["ab", "bad name", "x@example.com", "-student", "student.", "a..b", "a--b", "a__b", "student!".repeat(4)]) {
  assert.equal(normalizeStudentUsername(username).ok, false, "reject " + username);
}
assert.equal(studentSyntheticEmail("Test_Student"), "test_student@students.invalid");
assert.throws(() => studentSyntheticEmail("bad name"), /اسم المستخدم/);

assert.deepEqual(normalizeStudentCourseSlugs(["excel", "python", "excel"]), {
  ok: true, value: ["excel", "python"],
});
assert.equal(normalizeStudentCourseSlugs([], false).ok, false);
assert.deepEqual(normalizeStudentCourseSlugs([], true), { ok: true, value: [] });
assert.equal(normalizeStudentCourseSlugs(["../private"], true).ok, false);

const good = validateStudentAccountInput({
  full_name: " أحمد محمد  علي ",
  username: "Ahmed_2026",
  phone: "01012345678",
  password: "A-long-test-pass",
  course_slugs: ["excel", "python"],
});
assert.equal(good.ok, true);
assert.equal(good.value.full_name, "أحمد محمد علي");
assert.equal(good.value.username, "ahmed_2026");
assert.deepEqual(good.value.course_slugs, ["excel", "python"]);
assert.equal(validateStudentAccountInput({
  full_name: "A", username: "student01", phone: "01012345678",
  password: "A-long-test-pass", course_slugs: ["excel"],
}).ok, false);
assert.equal(validateStudentAccountInput({
  full_name: "Ahmed Student", username: "student01", phone: "bad phone",
  password: "A-long-test-pass", course_slugs: ["excel"],
}).ok, false);
assert.equal(validateStudentAccountInput({
  full_name: "Ahmed Student", username: "student01", phone: "1234567",
  password: "A-long-test-pass", course_slugs: ["excel"],
}).ok, false);
assert.equal(validateStudentAccountInput({
  full_name: "Ahmed Student", username: "student01", phone: "01012345678",
  password: "short", course_slugs: ["excel"],
}).ok, false);

console.log("PASS: username account validation, internal identity mapping, course selection, and password rules.");
