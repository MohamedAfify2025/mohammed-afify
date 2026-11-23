import assert from "node:assert/strict";
import {
  getCourseVideoUid,
  hasVideoCapability,
  isStreamOriginAllowed,
  isStreamVideoReadyAndPrivate,
  normalizeSlug,
  normalizeTokenTtl,
  parseCourseMediaManifest,
} from "../supabase/functions/_shared/course-playback.mjs";

const uid1 = "0123456789abcdef0123456789abcdef";
const uid2 = "abcdef0123456789abcdef0123456789";
const manifest = parseCourseMediaManifest(JSON.stringify({
  Excel: {
    "lesson-01": uid1,
    "lesson-02": uid2,
  },
}));

assert.equal(normalizeSlug(" Excel "), "excel");
assert.equal(normalizeSlug("../excel"), null);
assert.equal(getCourseVideoUid(manifest, "excel", "lesson-01"), uid1);
assert.equal(getCourseVideoUid(manifest, "excel", "missing"), null);
assert.equal(getCourseVideoUid(manifest, "unknown", "lesson-01"), null);

assert.equal(hasVideoCapability([
  { course_slug: "excel", can_view_course_page: true, can_watch_video: false },
], "excel"), false);
assert.equal(hasVideoCapability([
  { course_slug: "excel", can_view_course_page: true, can_watch_video: true },
], "excel"), true);
assert.equal(hasVideoCapability([
  { course_slug: "excel", can_view_course_page: false, can_watch_video: true },
], "excel"), false);
assert.equal(hasVideoCapability([], "excel"), false);

assert.equal(isStreamOriginAllowed(["example.com"], "https://example.com"), true);
assert.equal(isStreamOriginAllowed(["example.com"], "https://other.example.com"), false);
assert.equal(isStreamOriginAllowed(["*.example.com"], "https://test.example.com"), false);
assert.equal(isStreamOriginAllowed(["localhost:5500"], "http://localhost:5500"), true);
assert.equal(isStreamVideoReadyAndPrivate({
  readyToStream: true, requireSignedURLs: true, allowedOrigins: ["example.com"],
}, "https://example.com"), true);
assert.equal(isStreamVideoReadyAndPrivate({
  readyToStream: false, requireSignedURLs: true, allowedOrigins: ["example.com"],
}, "https://example.com"), false);
assert.equal(isStreamVideoReadyAndPrivate({
  readyToStream: true, requireSignedURLs: false, allowedOrigins: ["example.com"],
}, "https://example.com"), false);

assert.equal(normalizeTokenTtl(undefined), 3600);
assert.equal(normalizeTokenTtl("300"), 300);
assert.throws(() => normalizeTokenTtl("299"), /300 to 3600/);
assert.throws(() => normalizeTokenTtl("3601"), /300 to 3600/);

assert.throws(() => parseCourseMediaManifest("{not json"), /valid JSON/);
assert.throws(() => parseCourseMediaManifest("[]"), /JSON object/);
assert.throws(() => parseCourseMediaManifest(JSON.stringify({
  excel: { "lesson-01": "not-a-stream-uid" },
})), /invalid lesson or Stream video UID/);

console.log("PASS: manifest, course capability, private/ready Stream metadata, origin and token TTL checks.");
