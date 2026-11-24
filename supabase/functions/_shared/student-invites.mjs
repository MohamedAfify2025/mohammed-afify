const MAX_BATCH_SIZE = 40;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStudentEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function normalizeStudentRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "بيانات الطالب غير صالحة." };
  }

  const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
  const email = normalizeStudentEmail(raw.email);
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const requestedCourse = typeof raw.requested_course === "string"
    ? raw.requested_course.trim()
    : "";

  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "اكتب اسم الطالب من حرفين إلى 120 حرفًا." };
  }
  if (!email) return { ok: false, error: "البريد الإلكتروني غير صالح." };
  if (phone.length > 30) return { ok: false, error: "رقم الهاتف أطول من المسموح." };
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(requestedCourse)) {
    return { ok: false, error: "اختر دورة صحيحة من فهرس الدورات قبل إرسال الدعوة." };
  }

  return {
    ok: true,
    value: {
      full_name: fullName,
      email,
      phone,
      requested_course: requestedCourse,
    },
  };
}

export function validateInvitationBatch(rawStudents) {
  if (!Array.isArray(rawStudents) || rawStudents.length === 0) {
    return { ok: false, error: "أضف طالبًا واحدًا على الأقل." };
  }
  if (rawStudents.length > MAX_BATCH_SIZE) {
    return { ok: false, error: "الحد الأقصى 40 طالبًا في الدفعة الواحدة." };
  }

  const seen = new Set();
  const students = [];
  const errors = [];

  rawStudents.forEach((raw, index) => {
    const normalized = normalizeStudentRecord(raw);
    if (!normalized.ok) {
      errors.push({ row: index + 1, error: normalized.error });
      return;
    }

    const student = normalized.value;
    if (seen.has(student.email)) {
      errors.push({ row: index + 1, error: "البريد الإلكتروني مكرر داخل القائمة." });
      return;
    }
    seen.add(student.email);
    students.push(student);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, students };
}

export function normalizeOriginAllowlist(raw) {
  if (typeof raw !== "string") return [];
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export function isExactAllowedOrigin(origin, allowedOrigins) {
  if (typeof origin !== "string" || !Array.isArray(allowedOrigins)) return false;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) {
      return false;
    }
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

export function validateInviteRedirect(rawRedirect, allowedOrigins) {
  if (typeof rawRedirect !== "string" || !rawRedirect.trim()) {
    throw new Error("STUDENT_INVITE_REDIRECT_URL is not configured.");
  }
  let parsed;
  try {
    parsed = new URL(rawRedirect);
  } catch {
    throw new Error("STUDENT_INVITE_REDIRECT_URL is invalid.");
  }
  if (!isExactAllowedOrigin(parsed.origin, allowedOrigins)) {
    throw new Error("The invite redirect origin is not in ALLOWED_ORIGINS.");
  }
  if (!parsed.pathname.endsWith("/student-set-password.html")) {
    throw new Error("The invite redirect must end with /student-set-password.html.");
  }
  return parsed.toString();
}
