import assert from "node:assert/strict";
import {
  isExactAllowedOrigin,
  normalizeOriginAllowlist,
  normalizeStudentEmail,
  normalizeStudentRecord,
  validateInvitationBatch,
  validateInviteRedirect,
} from "../supabase/functions/_shared/student-invites.mjs";

assert.equal(normalizeStudentEmail(" Student@Example.com "), "student@example.com");
assert.equal(normalizeStudentEmail("not-an-email"), null);
assert.equal(normalizeStudentEmail("x".repeat(250) + "@example.com"), null);

assert.deepEqual(normalizeStudentRecord({
  full_name: " أحمد محمد ",
  email: " AHMED@EXAMPLE.COM ",
  phone: "01000000000",
  requested_course: "excel",
}), {
  ok: true,
  value: {
    full_name: "أحمد محمد",
    email: "ahmed@example.com",
    phone: "01000000000",
    requested_course: "excel",
  },
});
assert.equal(normalizeStudentRecord({ full_name: "A", email: "a@example.com" }).ok, false);
assert.equal(normalizeStudentRecord({ full_name: "Ahmed", email: "bad" }).ok, false);
assert.equal(normalizeStudentRecord({
  full_name: "Ahmed", email: "ahmed@example.com", requested_course: ""
}).ok, false);
assert.equal(normalizeStudentRecord({
  full_name: "Ahmed", email: "ahmed@example.com", requested_course: "../private"
}).ok, false);

const goodBatch = validateInvitationBatch([
  { full_name: "Ahmed One", email: "ONE@example.com", requested_course: "excel" },
  { full_name: "Ahmed Two", email: "two@example.com", requested_course: "excel" },
]);
assert.equal(goodBatch.ok, true);
assert.equal(goodBatch.students.length, 2);

const duplicateBatch = validateInvitationBatch([
  { full_name: "Ahmed One", email: "same@example.com", requested_course: "excel" },
  { full_name: "Ahmed Two", email: "SAME@example.com", requested_course: "excel" },
]);
assert.equal(duplicateBatch.ok, false);
assert.match(duplicateBatch.errors[0].error, /مكرر/);

assert.equal(validateInvitationBatch([]).ok, false);
assert.equal(validateInvitationBatch(Array.from({ length: 41 }, (_, index) => ({
  full_name: "Student " + index,
  email: "student" + index + "@example.com",
  requested_course: "excel",
}))).ok, false);

const allowed = normalizeOriginAllowlist("https://example.com,http://localhost:5500");
assert.equal(isExactAllowedOrigin("https://example.com", allowed), true);
assert.equal(isExactAllowedOrigin("https://sub.example.com", allowed), false);
assert.equal(isExactAllowedOrigin("https://example.com/path", allowed), false);
assert.equal(isExactAllowedOrigin("https://example.com", ["*"]), false);

assert.equal(
  validateInviteRedirect(
    "https://example.com/student-set-password.html",
    allowed,
  ),
  "https://example.com/student-set-password.html",
);
assert.throws(
  () => validateInviteRedirect("https://other.com/student-set-password.html", allowed),
  /not in ALLOWED_ORIGINS/,
);
assert.throws(
  () => validateInviteRedirect("https://example.com/login.html", allowed),
  /must end with/,
);

console.log("PASS: student invitation validation, duplicate prevention, batch limit, origin and redirect checks.");
