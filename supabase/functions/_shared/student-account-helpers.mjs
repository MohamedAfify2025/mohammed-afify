export const STUDENT_LOGIN_DOMAIN = "students.invalid";

export function normalizeStudentUsername(value) {
  if (typeof value !== "string") return { ok: false, error: "اسم المستخدم غير صالح." };
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return { ok: false, error: "اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا، ويمكن استخدام النقطة والشرطة والشرطة السفلية." };
  }
  if (username.includes("..") || username.includes("--") || username.includes("__") ||
      username.endsWith(".") || username.endsWith("-") || username.endsWith("_")) {
    return { ok: false, error: "راجع تنسيق اسم المستخدم." };
  }
  return { ok: true, value: username };
}

export function studentSyntheticEmail(username) {
  const normalized = normalizeStudentUsername(username);
  if (!normalized.ok) throw new Error(normalized.error);
  return normalized.value + "@" + STUDENT_LOGIN_DOMAIN;
}

export function normalizeStudentCourseSlugs(raw, allowEmpty = false) {
  if (!Array.isArray(raw) || raw.length > 12) {
    return { ok: false, error: "اختر من دورة واحدة إلى 12 دورة." };
  }
  const values = [];
  for (const item of raw) {
    if (typeof item !== "string") return { ok: false, error: "توجد دورة غير صالحة." };
    const slug = item.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) {
      return { ok: false, error: "رمز إحدى الدورات غير صالح." };
    }
    if (!values.includes(slug)) values.push(slug);
  }
  if (!allowEmpty && values.length === 0) {
    return { ok: false, error: "يجب اختيار دورة واحدة على الأقل." };
  }
  return { ok: true, value: values };
}

export function validateStudentAccountInput(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "بيانات الحساب غير صالحة." };
  }
  const fullName = typeof raw.full_name === "string" ? raw.full_name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const username = normalizeStudentUsername(raw.username);
  const courses = normalizeStudentCourseSlugs(raw.course_slugs, false);

  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "الاسم يجب أن يكون من حرفين إلى 120 حرفًا." };
  }
  if (!username.ok) return username;
  const phoneDigits = phone.replace(/\D/g, "");
  if (phone.length < 7 || phone.length > 30 || !/^[+0-9().\-\s]+$/.test(phone) ||
      phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, error: "أدخل رقم WhatsApp من 10 إلى 15 رقمًا مع مفتاح الدولة عند الحاجة." };
  }
  if (password.length < 10 || password.length > 128) {
    return { ok: false, error: "كلمة المرور يجب أن تكون من 10 إلى 128 حرفًا." };
  }
  if (!courses.ok) return courses;

  return {
    ok: true,
    value: {
      full_name: fullName,
      username: username.value,
      phone,
      password,
      course_slugs: courses.value,
    },
  };
}
