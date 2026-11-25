import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const [loginHtml, loginJs, adminJs, accountHtml, accountJs, edge, config, membershipConfigJs, studentSpaceJs, courseRoomHtml, businessAccessJs] = await Promise.all([
  readFile(new URL("../public-site/student-login.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/student-login.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-dashboard.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/admin-student-accounts.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-student-accounts.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/admin-manage-student-accounts/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/membership-config.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/student-space.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/course-room.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/business-administration-access.js", import.meta.url), "utf8"),
]);

assert.match(loginHtml, /اسم المستخدم أو البريد الإلكتروني/);
assert.match(loginHtml, /id="email" type="text"/);
assert.match(loginJs, /return raw \+ "@students\.invalid"/);
assert.match(loginJs, /signInWithPassword/);
assert.match(loginJs, /admin-student-accounts/);
assert.match(loginJs, /students\.invalid/);
assert.match(loginJs, /resetPasswordForEmail/);
assert.match(loginJs, /حسابات اسم المستخدم لا تستخدم البريد الإلكتروني/);
assert.match(loginJs, /course-room/);

assert.match(adminJs, /client\.auth\.getSession\(\)/);
assert.match(adminJs, /Auth session missing/);
assert.match(adminJs, /student-login\.html\?next=admin-dashboard\.html/);
assert.match(adminJs, /admin-student-accounts\.html/);
assert.match(studentSpaceJs, /directCourseView =/);
assert.match(studentSpaceJs, /direct-course-view/);
assert.match(studentSpaceJs, /لا يملك هذا الحساب صلاحية فتح هذا المقرر/);
assert.match(studentSpaceJs, /window\.location\.replace\("academy\/business-administration\.html"\)/);
assert.match(courseRoomHtml, /MOHAMMED AFIFY · LEARNING ROOM/);
assert.match(courseRoomHtml, /id="logoutButton"/);
assert.match(courseRoomHtml, /\[hidden\]\{display:none!important\}/);
assert.match(courseRoomHtml, /id="adminDashboardLink" href="admin-dashboard\.html" hidden/);
assert.match(businessAccessJs, /get_my_active_courses_v2/);
assert.match(accountHtml, /id="createForm"/);
assert.match(accountHtml, /id="courseSlugs"/);
assert.match(accountJs, /functions\.invoke\(FUNCTION_NAME/);
assert.match(accountJs, /action: "create"/);
assert.match(accountJs, /action: "reset_password"/);
assert.match(accountJs, /action: "set_courses"/);
assert.match(accountJs, /action: "suspend"/);
assert.match(accountJs, /action: "reactivate"/);
assert.match(accountJs, /"مرحبًا " \+ \(account\.full_name \|\| "بك"\) \+ ","/);
assert.doesNotMatch(accountJs, /🌷/);
assert.match(accountJs, /"odoo-training": "academy\/odoo-training\.html"/);
assert.match(accountJs, /"business-administration": "academy\/business-administration\.html"/);
assert.match(accountJs, /const destinationPath = routes\[courseSlug\] \|\| "course-room\.html"/);

const directCourseFunction = accountJs.match(/  function directCourseUrl\(courseSlug\) \{[\s\S]*?\n  \}/);
assert.ok(directCourseFunction, "direct course login URL helper exists");
const buildDirectCourseUrl = runInNewContext("(" + directCourseFunction[0].trim() + ")", {
  URL,
  window: { location: { href: "https://feature-username-student-acc.mohammed-afify.pages.dev/admin-student-accounts.html" } }
});
const odooLoginUrl = new URL(buildDirectCourseUrl("odoo-training"));
assert.equal(odooLoginUrl.searchParams.get("next"), "academy/odoo-training.html");
const businessLoginUrl = new URL(buildDirectCourseUrl("business-administration"));
assert.equal(businessLoginUrl.searchParams.get("next"), "academy/business-administration.html");
const genericLoginUrl = new URL(buildDirectCourseUrl("excel"));
assert.equal(genericLoginUrl.searchParams.get("next"), "course-room.html?course=excel");
assert.match(accountJs, /https:\/\/wa\.me\//);
assert.match(accountJs, /payload\.phone = "\+" \+ phoneForWhatsApp\(payload\.phone\)/);
assert.match(accountHtml, /السعودية: 05xxxxxxxx/);
assert.match(accountHtml, /أدخل الرقم بمفتاح الدولة/);

// Exercise the actual browser helper: Egyptian and Saudi local mobile formats
// must map correctly before the account is created.
const phoneFunction = accountJs.match(/  function phoneForWhatsApp\(value\) \{[\s\S]*?\n  \}/);
assert.ok(phoneFunction, "WhatsApp phone normalization helper exists");
const normalizeWhatsAppPhone = runInNewContext("(" + phoneFunction[0].trim() + ")");
assert.equal(normalizeWhatsAppPhone("01012345678"), "201012345678");
assert.equal(normalizeWhatsAppPhone("01112345678"), "201112345678");
assert.equal(normalizeWhatsAppPhone("01512345678"), "201512345678");
assert.equal(normalizeWhatsAppPhone("0512345678"), "966512345678");
assert.equal(normalizeWhatsAppPhone("+966512345678"), "966512345678");
assert.equal(normalizeWhatsAppPhone("00966512345678"), "966512345678");
assert.equal(normalizeWhatsAppPhone("201012345678"), "201012345678");
assert.throws(() => normalizeWhatsAppPhone("12345"), /10 إلى 15/);
assert.throws(() => normalizeWhatsAppPhone("05123"), /أضف مفتاح الدولة/);
assert.throws(() => normalizeWhatsAppPhone("0201234567"), /مفتاح الدولة/);
assert.doesNotMatch(accountJs, /localStorage|sessionStorage/);

assert.match(edge, /admin\.auth\.admin\.createUser/);
assert.match(edge, /admin\.auth\.admin\.updateUserById/);
assert.match(edge, /is_platform_admin/);
assert.match(edge, /function allowedOriginsForProject/);
const corsHelper = edge.match(/function allowedOriginsForProject\(configuredRaw: string, supabaseUrl: string\): string\[\] \{[\s\S]*?\n\}/);
assert.ok(corsHelper, "CORS origin allowlist helper exists");
const corsHelperJavaScript = corsHelper[0]
  .replace("configuredRaw: string", "configuredRaw")
  .replace("supabaseUrl: string", "supabaseUrl")
  .replace("): string[] {", ") {");
const resolveAllowedOrigins = runInNewContext("(" + corsHelperJavaScript + ")", {});
const testOrigins = resolveAllowedOrigins("", "https://jniekfbelqticopcotxg.supabase.co");
assert.deepEqual(Array.from(testOrigins), ["https://feature-username-student-acc.mohammed-afify.pages.dev"]);
const liveOrigins = resolveAllowedOrigins("", "https://ybsjnubrswqksvktgmay.supabase.co");
assert.deepEqual(Array.from(liveOrigins), []);
const configuredLiveOrigins = resolveAllowedOrigins("https://mohammed-afify.pages.dev, https://mohamedafify.com", "https://ybsjnubrswqksvktgmay.supabase.co");
assert.deepEqual(Array.from(configuredLiveOrigins), ["https://mohammed-afify.pages.dev", "https://mohamedafify.com"]);
assert.match(edge, /x-retry-count/);
assert.match(edge, /payment_state: "waived"/);
assert.match(edge, /is_public: false/);
assert.match(edge, /admin_direct_student_created/);
assert.match(edge, /const \{ error \} = await admin\.from\("membership_audit_log"\)\.insert/);
assert.match(edge, /if \(error\) \{\s*console\.error\("Student account audit insert failed:", error\.message\)/);
assert.doesNotMatch(edge, /password.*(insert|update|details)/i);
assert.match(config, /\[functions\.admin-manage-student-accounts\]\s+verify_jwt = true/);

// Cloudflare preview deployments must use TEST; the root Pages domain and
// custom production domains must keep using LIVE.
const branchPreviewWindow = { location: { hostname: "feature-username-student-acc.mohammed-afify.pages.dev" } };
const hashPreviewWindow = { location: { hostname: "0fbee368.mohammed-afify.pages.dev" } };
const productionWindow = { location: { hostname: "mohammed-afify.pages.dev" } };
const customDomainWindow = { location: { hostname: "mohamedafify.com" } };
for (const targetWindow of [branchPreviewWindow, hashPreviewWindow, productionWindow, customDomainWindow]) {
  runInNewContext(membershipConfigJs, { window: targetWindow });
}
assert.equal(branchPreviewWindow.MEMBERSHIP_CONFIG.supabaseUrl, "https://jniekfbelqticopcotxg.supabase.co");
assert.equal(branchPreviewWindow.MEMBERSHIP_CONFIG.environment, "preview");
assert.equal(hashPreviewWindow.MEMBERSHIP_CONFIG.supabaseUrl, "https://jniekfbelqticopcotxg.supabase.co");
assert.equal(productionWindow.MEMBERSHIP_CONFIG.supabaseUrl, "https://ybsjnubrswqksvktgmay.supabase.co");
assert.equal(customDomainWindow.MEMBERSHIP_CONFIG.supabaseUrl, "https://ybsjnubrswqksvktgmay.supabase.co");
assert.equal(
  branchPreviewWindow.isMembershipPublicKey(branchPreviewWindow.MEMBERSHIP_CONFIG.supabasePublishableKey),
  true
);
assert.equal(
  productionWindow.isMembershipPublicKey(productionWindow.MEMBERSHIP_CONFIG.supabasePublishableKey),
  true
);
assert.notEqual(
  branchPreviewWindow.MEMBERSHIP_CONFIG.supabasePublishableKey,
  productionWindow.MEMBERSHIP_CONFIG.supabasePublishableKey
);

console.log("PASS: username login routing, admin controls, WhatsApp link, and server-only account management checks.");
