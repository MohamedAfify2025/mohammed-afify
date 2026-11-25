import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const [loginHtml, loginJs, adminJs, accountHtml, accountJs, edge, config, membershipConfigJs] = await Promise.all([
  readFile(new URL("../public-site/student-login.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/student-login.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-dashboard.js", import.meta.url), "utf8"),
  readFile(new URL("../public-site/admin-student-accounts.html", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/admin-student-accounts.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/admin-manage-student-accounts/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
  readFile(new URL("../public-site/assets/js/membership-config.js", import.meta.url), "utf8"),
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
assert.match(edge, /feature-username-student-acc\\.mohammed-afify\\.pages\\.dev/);
assert.match(edge, /x-retry-count/);
assert.match(edge, /payment_state: "waived"/);
assert.match(edge, /is_public: false/);
assert.match(edge, /admin_direct_student_created/);
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
