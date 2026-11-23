const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const STREAM_UID_PATTERN = /^[a-f0-9]{32}$/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSlug(value) {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return SLUG_PATTERN.test(slug) ? slug : null;
}

export function parseCourseMediaManifest(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("COURSE_MEDIA_MAP_JSON is missing.");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("COURSE_MEDIA_MAP_JSON must be valid JSON.");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("The course media manifest must be a JSON object.");
  }

  const manifest = Object.create(null);
  for (const [rawCourseSlug, rawLessons] of Object.entries(parsed)) {
    const courseSlug = normalizeSlug(rawCourseSlug);
    if (!courseSlug || !isPlainObject(rawLessons)) {
      throw new Error("The course media manifest contains an invalid course entry.");
    }

    const lessons = Object.create(null);
    for (const [rawLessonSlug, rawUid] of Object.entries(rawLessons)) {
      const lessonSlug = normalizeSlug(rawLessonSlug);
      if (!lessonSlug || typeof rawUid !== "string" || !STREAM_UID_PATTERN.test(rawUid.trim())) {
        throw new Error("The course media manifest contains an invalid lesson or Stream video UID.");
      }
      lessons[lessonSlug] = rawUid.trim();
    }

    if (Object.keys(lessons).length === 0) {
      throw new Error("Each course in the media manifest must contain at least one lesson.");
    }
    manifest[courseSlug] = Object.freeze(lessons);
  }

  if (Object.keys(manifest).length === 0) {
    throw new Error("The course media manifest is empty.");
  }
  return Object.freeze(manifest);
}

export function getCourseVideoUid(manifest, courseSlug, lessonSlug) {
  const course = normalizeSlug(courseSlug);
  const lesson = normalizeSlug(lessonSlug);
  if (!course || !lesson || !isPlainObject(manifest)) return null;
  const lessons = manifest[course];
  if (!isPlainObject(lessons)) return null;
  const uid = lessons[lesson];
  return typeof uid === "string" && STREAM_UID_PATTERN.test(uid) ? uid : null;
}

export function hasVideoCapability(rows, courseSlug) {
  const target = normalizeSlug(courseSlug);
  if (!target || !Array.isArray(rows)) return false;
  return rows.some((row) =>
    row &&
    normalizeSlug(row.course_slug) === target &&
    row.can_view_course_page === true &&
    row.can_watch_video === true
  );
}

export function isStreamOriginAllowed(allowedOrigins, requestOrigin) {
  if (!Array.isArray(allowedOrigins) || typeof requestOrigin !== "string") return false;
  let host;
  try {
    const parsed = new URL(requestOrigin);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.origin !== requestOrigin) return false;
    host = parsed.host;
  } catch {
    return false;
  }
  // Intentionally do not accept wildcards for paid course embeds.
  return allowedOrigins.some((value) =>
    typeof value === "string" && value.trim() === host && !value.includes("*")
  );
}

export function normalizeTokenTtl(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return 300;
  const ttl = Number(rawValue);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 600) {
    throw new Error("STREAM_TOKEN_TTL_SECONDS must be an integer from 60 to 600.");
  }
  return ttl;
}
