import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [loginHtml, loginJs, adminJs, accountHtml, accountJs, edge, config] = await Promise.all([
  readFile(new URL("../public-site/student-login.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/student-login.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-dashboard.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/admin-student-accounts.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-student-accounts.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/admin-manage-student-accounts/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
]);

assert.match(loginHtml, /اسم المستخدم أو البريد الإلكتروني/);
assert.match(loginHtml, /id="email" type="text"/);
assert.match(loginJs, /return raw \+ "@students\.invalid"/);
assert.match(loginJs, /signInWithPassword/);
assert.match(loginJs, /admin-student-accounts/);
assert.match(loginJs, /students\.invalid/);
assert.match(loginJs, /resetPasswordForEmail/);
assert.match(loginJs, /حسابات اسم المستخدم لا تستخدم البريد الإلكتروني/);

assert.match(adminJs, /admin-student-accounts\.html/);
assert.match(accountHtml, /id="createForm"/);
assert.match(accountHtml, /id="courseSlugs"/);
assert.match(accountJs, /functions\.invoke\(FUNCTION_NAME/);
assert.match(accountJs, /action: "create"/);
assert.match(accountJs, /action: "reset_password"/);
assert.match(accountJs, /action: "set_courses"/);
assert.match(accountJs, /action: "suspend"/);
assert.match(accountJs, /action: "reactivate"/);
assert.match(accountJs, /https:\/\/wa\.me\//);
assert.doesNotMatch(accountJs, /localStorage|sessionStorage/);

assert.match(edge, /admin\.auth\.admin\.createUser/);
assert.match(edge, /admin\.auth\.admin\.updateUserById/);
assert.match(edge, /is_platform_admin/);
assert.match(edge, /payment_state: "waived"/);
assert.match(edge, /is_public: false/);
assert.match(edge, /admin_direct_student_created/);
assert.doesNotMatch(edge, /password.*(insert|update|details)/i);
assert.match(config, /\[functions\.admin-manage-student-accounts\]\s+verify_jwt = true/);

console.log("PASS: username login routing, admin controls, WhatsApp link, and server-only account management checks.");
