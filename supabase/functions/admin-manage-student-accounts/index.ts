import { createClient } from "npm:@supabase/supabase-js@2";
import {
  normalizeStudentCourseSlugs,
  studentSyntheticEmail,
  validateStudentAccountInput,
  normalizeStudentUsername,
} from "../_shared/student-account-helpers.mjs";

const STUDENT_EMAIL_SUFFIX = "@students.invalid";
const SUSPENSION_DURATION = "876000h";
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Vary": "Origin",
};

function jsonResponse(status: number, payload: Record<string, unknown>, origin: string | null): Response {
  const headers = new Headers(HEADERS);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function readJsonKey(raw: string | undefined, name: string): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(name + " must be valid JSON.");
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).default === "string") {
    return ((parsed as Record<string, string>).default).trim() || null;
  }
  throw new Error(name + " does not contain a default key.");
}

function readRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  if (phone.length < 7 || phone.length > 30 || !/^[+0-9().\-\s]+$/.test(phone)) return null;
  return phone;
}

async function logAction(
  admin: any,
  actorId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await admin.from("membership_audit_log").insert({
      actor_user_id: actorId,
      action_key: action,
      target_user_id: targetId,
      entity_type: "student_account",
      details,
    });
    if (error) {
      console.error("Student account audit insert failed:", error.message);
    }
  } catch (error) {
    console.warn("Student account audit insert failed:", error instanceof Error ? error.message : "unknown");
  }
}

async function getManagedProfile(admin: any, userId: string) {
  if (!isUuid(userId)) throw new Error("معرّف حساب الطالب غير صالح.");
  const { data, error } = await admin
    .from("profiles")
    .select("user_id,full_name,email,phone,role,status,account_state,created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== "student" || !String(data.email || "").toLowerCase().endsWith(STUDENT_EMAIL_SUFFIX)) {
    throw new Error("الحساب غير موجود أو ليس من حسابات اسم المستخدم التي يديرها هذا القسم.");
  }
  return data;
}

async function getActiveCourses(admin: any, slugs: string[]) {
  if (!slugs.length) return [];
  const { data, error } = await admin
    .from("course_catalog")
    .select("course_slug,title,is_active")
    .in("course_slug", slugs)
    .eq("is_active", true);
  if (error) throw error;
  const courses = Array.isArray(data) ? data : [];
  if (courses.length !== slugs.length) throw new Error("إحدى الدورات المختارة غير موجودة أو غير نشطة.");
  return courses;
}

async function listAccounts(admin: any) {
  const [{ data: profiles, error: profileError }, { data: courses, error: courseError }] = await Promise.all([
    admin.from("profiles")
      .select("user_id,full_name,email,phone,status,account_state,created_at")
      .like("email", "%@students.invalid")
      .order("created_at", { ascending: false }),
    admin.from("course_catalog")
      .select("course_slug,title")
      .eq("is_active", true)
      .order("title"),
  ]);
  if (profileError) throw profileError;
  if (courseError) throw courseError;

  const rows = Array.isArray(profiles) ? profiles : [];
  const courseList = Array.isArray(courses) ? courses : [];
  const userIds = rows.map((row) => row.user_id);
  let subscriptions: Record<string, unknown>[] = [];
  let mappings: Record<string, unknown>[] = [];

  if (userIds.length) {
    const { data, error } = await admin.from("student_subscriptions")
      .select("id,user_id,plan_id,status,payment_state,starts_at,expires_at,created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    subscriptions = Array.isArray(data) ? data as Record<string, unknown>[] : [];

    const planIds = [...new Set(subscriptions.map((row) => String(row.plan_id || "")).filter(Boolean))];
    if (planIds.length) {
      const { data: planRows, error: planError } = await admin.from("subscription_plan_courses")
        .select("plan_id,course_slug")
        .in("plan_id", planIds);
      if (planError) throw planError;
      mappings = Array.isArray(planRows) ? planRows as Record<string, unknown>[] : [];
    }
  }

  const latestSubscription = new Map<string, Record<string, unknown>>();
  for (const subscription of subscriptions) {
    const userId = String(subscription.user_id || "");
    if (userId && !latestSubscription.has(userId)) latestSubscription.set(userId, subscription);
  }

  const titleBySlug = new Map(courseList.map((course) => [course.course_slug, course.title]));
  const mappingsByPlan = new Map<string, string[]>();
  for (const mapping of mappings) {
    const planId = String(mapping.plan_id || "");
    const slug = String(mapping.course_slug || "");
    if (!planId || !slug) continue;
    const slugs = mappingsByPlan.get(planId) || [];
    slugs.push(slug);
    mappingsByPlan.set(planId, slugs);
  }

  const accounts = rows.map((profile) => {
    const subscription = latestSubscription.get(profile.user_id);
    const courseSlugs = subscription ? (mappingsByPlan.get(String(subscription.plan_id)) || []) : [];
    return {
      user_id: profile.user_id,
      full_name: profile.full_name,
      username: String(profile.email || "").replace(STUDENT_EMAIL_SUFFIX, ""),
      phone: profile.phone,
      account_state: profile.account_state,
      created_at: profile.created_at,
      subscription_status: subscription?.status || "missing",
      payment_state: subscription?.payment_state || "missing",
      course_slugs: courseSlugs,
      course_titles: courseSlugs.map((slug) => titleBySlug.get(slug) || slug),
    };
  });

  return { success: true, accounts, courses: courseList };
}

async function updateCourseAccess(
  admin: any,
  profile: Record<string, unknown>,
  courseSlugs: string[],
  actorId: string,
) {
  const courses = await getActiveCourses(admin, courseSlugs);
  const { data: subscription, error: subscriptionError } = await admin.from("student_subscriptions")
    .select("id,plan_id,status")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription?.plan_id) throw new Error("لا يوجد اشتراك إداري مرتبط بهذا الحساب.");

  const { data: oldRows, error: oldError } = await admin.from("subscription_plan_courses")
    .select("course_slug,can_view_course_page,can_watch_video,can_download,can_take_assessments,can_receive_certificate,can_track_progress")
    .eq("plan_id", subscription.plan_id);
  if (oldError) throw oldError;

  const restoreOldCourses = async () => {
    await admin.from("subscription_plan_courses").delete().eq("plan_id", subscription.plan_id);
    if (Array.isArray(oldRows) && oldRows.length) {
      const { error: restoreError } = await admin.from("subscription_plan_courses").insert(
        oldRows.map((row) => ({ ...row, plan_id: subscription.plan_id })),
      );
      if (restoreError) console.error("Failed to restore previous direct-course mapping:", restoreError.message);
    }
  };

  const { error: deleteError } = await admin.from("subscription_plan_courses")
    .delete()
    .eq("plan_id", subscription.plan_id);
  if (deleteError) throw deleteError;

  if (courses.length) {
    const insertRows = courses.map((course) => ({
      plan_id: subscription.plan_id,
      course_slug: course.course_slug,
      can_view_course_page: true,
      can_watch_video: true,
      can_download: false,
      can_take_assessments: true,
      can_receive_certificate: false,
      can_track_progress: true,
    }));
    const { error: insertError } = await admin.from("subscription_plan_courses").insert(insertRows);
    if (insertError) {
      await restoreOldCourses();
      throw insertError;
    }
  }

  const requestedCourse = courses[0]?.course_slug || "عام";
  const { data: updatedProfile, error: profileError } = await admin.from("profiles")
    .update({ requested_course: requestedCourse, updated_at: new Date().toISOString() })
    .eq("user_id", profile.user_id)
    .select("user_id")
    .maybeSingle();
  if (profileError || !updatedProfile?.user_id) {
    await restoreOldCourses();
    throw profileError || new Error("لم يتم تحديث ملف الطالب؛ تمت استعادة صلاحيات الدورات السابقة.");
  }

  await logAction(admin, actorId, "admin_direct_student_courses_updated", String(profile.user_id), {
    username: String(profile.email || "").replace(STUDENT_EMAIL_SUFFIX, ""),
    course_slugs: courseSlugs,
  });
  return {
    success: true,
    course_slugs: courseSlugs,
    course_titles: courses.map((course) => course.title),
  };
}

function allowedOriginsForProject(configuredRaw: string, supabaseUrl: string): string[] {
  const configuredOrigins = configuredRaw
    .split(",").map((item) => item.trim()).filter(Boolean);
  const functionProjectUrl = supabaseUrl.replace(/\/+$/, "");
  const isIsolatedTestProject =
    functionProjectUrl === "https://jniekfbelqticopcotxg.supabase.co";
  const testPreviewOrigin = "https://feature-username-student-acc.mohammed-afify.pages.dev";
  return [...new Set([
    ...configuredOrigins,
    ...(isIsolatedTestProject ? [testPreviewOrigin] : []),
  ])];
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowedOrigins = allowedOriginsForProject(
    Deno.env.get("ALLOWED_ORIGINS") || "",
    Deno.env.get("SUPABASE_URL") || "",
  );

  if (!origin || !allowedOrigins.includes(origin)) {
    return jsonResponse(403, { error: "Origin is not allowed." }, null);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...HEADERS,
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage",
      },
    });
  }
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." }, origin);

  let createdUserId: string | null = null;
  let createdPlanId: string | null = null;
  let createdSubscriptionId: string | null = null;

  try {
    const authorization = req.headers.get("authorization") || "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i);
    if (!bearer) return jsonResponse(401, { error: "سجّل الدخول بحساب الإدارة أولًا." }, origin);

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(400, { error: "بيانات الطلب غير صالحة." }, origin);
    }
    const action = typeof body.action === "string" ? body.action : "";
    const allowedActions = ["list", "create", "reset_password", "set_courses", "suspend", "reactivate"];
    if (!allowedActions.includes(action)) return jsonResponse(400, { error: "العملية المطلوبة غير معروفة." }, origin);

    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const publishableKey = readJsonKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), "SUPABASE_PUBLISHABLE_KEYS") ||
      Deno.env.get("SUPABASE_ANON_KEY")?.trim();
    if (!publishableKey) throw new Error("Supabase publishable key is unavailable.");

    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: "Bearer " + bearer[1].trim() } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(bearer[1].trim());
    if (authError || !authData?.user?.id) return jsonResponse(401, { error: "جلسة الدخول غير صالحة أو انتهت." }, origin);

    const { data: isAdmin, error: adminRpcError } = await userClient.rpc("is_platform_admin");
    if (adminRpcError || isAdmin !== true) {
      return jsonResponse(403, { error: "هذه العملية متاحة لمدير المنصة المعتمد فقط." }, origin);
    }
    const { data: adminProfile, error: profileError } = await userClient
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError || adminProfile?.role !== "admin" ||
        adminProfile?.status !== "approved" || adminProfile?.account_state !== "active") {
      return jsonResponse(403, { error: "حساب الإدارة غير معتمد أو غير نشط." }, origin);
    }

    const secretKey = readJsonKey(Deno.env.get("SUPABASE_SECRET_KEYS"), "SUPABASE_SECRET_KEYS") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!secretKey) throw new Error("Supabase secret/service-role key is unavailable.");

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    if (action === "list") {
      const result = await listAccounts(admin);
      return jsonResponse(200, result, origin);
    }

    if (action === "create") {
      const normalized = validateStudentAccountInput(body);
      if (!normalized.ok) return jsonResponse(400, {
        error: "error" in normalized ? normalized.error : "بيانات الحساب غير صالحة.",
      }, origin);
      const input = normalized.value as {
        full_name: string;
        username: string;
        phone: string;
        password: string;
        course_slugs: string[];
      };
      const courses = await getActiveCourses(admin, input.course_slugs);
      const authEmail = studentSyntheticEmail(input.username);

      const { data: duplicate, error: duplicateError } = await admin.from("profiles")
        .select("user_id")
        .eq("email", authEmail)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) return jsonResponse(409, { error: "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر." }, origin);

      const { data: authResult, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.full_name,
          phone: input.phone,
          requested_course: input.course_slugs[0],
          requested_role: "student",
          login_username: input.username,
          account_created_by: "admin_username_account",
        },
      });
      if (createError || !authResult?.user?.id) {
        const duplicateMessage = /already|registered|exists|duplicate/i.test(createError?.message || "");
        return jsonResponse(duplicateMessage ? 409 : 400, {
          error: duplicateMessage ? "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر." : "تعذر إنشاء حساب الدخول. راجع البيانات وحاول مرة أخرى.",
        }, origin);
      }
      createdUserId = authResult.user.id;

      const { error: updateProfileError } = await admin.from("profiles")
        .update({
          full_name: input.full_name,
          email: authEmail,
          phone: input.phone,
          requested_course: input.course_slugs[0],
          requested_role: "student",
          role: "student",
          status: "approved",
          account_state: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", createdUserId);
      if (updateProfileError) throw updateProfileError;

      const planCode = "direct-" + createdUserId.replace(/-/g, "");
      const { data: plan, error: planError } = await admin.from("subscription_plans")
        .insert({
          code: planCode,
          name: "وصول إداري مباشر - " + input.username,
          description: "خطة فردية غير منشورة لحساب أنشأته إدارة المنصة.",
          plan_type: "custom",
          price: 0,
          currency: "EGP",
          duration_days: null,
          is_active: true,
          is_public: false,
          created_by: authData.user.id,
        })
        .select("id")
        .single();
      if (planError || !plan?.id) throw planError || new Error("تعذر إنشاء صلاحية الدورة.");

      createdPlanId = plan.id;
      const { error: mappingError } = await admin.from("subscription_plan_courses").insert(
        courses.map((course) => ({
          plan_id: createdPlanId,
          course_slug: course.course_slug,
          can_view_course_page: true,
          can_watch_video: true,
          can_download: false,
          can_take_assessments: true,
          can_receive_certificate: false,
          can_track_progress: true,
        })),
      );
      if (mappingError) throw mappingError;

      const activatedAt = new Date().toISOString();
      const { data: subscription, error: subscriptionError } = await admin.from("student_subscriptions")
        .insert({
          user_id: createdUserId,
          plan_id: createdPlanId,
          agreed_amount: 0,
          currency: "EGP",
          status: "active",
          payment_state: "waived",
          starts_at: activatedAt,
          expires_at: null,
          auto_renew: false,
          assigned_by: authData.user.id,
          activated_at: activatedAt,
          base_amount: 0,
          discount_type: "waive",
          discount_value: 0,
          discount_amount: 0,
          discount_reason: "منح وصول مباشر من إدارة المنصة",
        })
        .select("id")
        .single();
      if (subscriptionError || !subscription?.id) throw subscriptionError || new Error("تعذر تفعيل صلاحية الدورة.");

      createdSubscriptionId = subscription.id;
      await logAction(admin, authData.user.id, "admin_direct_student_created", createdUserId, {
        username: input.username,
        course_slugs: input.course_slugs,
        access_type: "waived_admin_grant",
      });

      return jsonResponse(200, {
        success: true,
        account: {
          user_id: createdUserId,
          full_name: input.full_name,
          username: input.username,
          phone: input.phone,
          account_state: "active",
          course_slugs: input.course_slugs,
          course_titles: courses.map((course) => course.title),
        },
      }, origin);
    }

    const targetId = body.user_id;
    const profile = await getManagedProfile(admin, targetId as string);
    const username = String(profile.email || "").replace(STUDENT_EMAIL_SUFFIX, "");

    if (action === "reset_password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 10 || password.length > 128) {
        return jsonResponse(400, { error: "كلمة المرور يجب أن تكون من 10 إلى 128 حرفًا." }, origin);
      }
      const { error } = await admin.auth.admin.updateUserById(String(profile.user_id), { password });
      if (error) throw error;
      await logAction(admin, authData.user.id, "admin_direct_student_password_reset", String(profile.user_id), { username });
      return jsonResponse(200, { success: true, message: "تم تغيير كلمة المرور بنجاح." }, origin);
    }

    if (action === "set_courses") {
      const normalizedCourses = normalizeStudentCourseSlugs(body.course_slugs, true);
      if (!normalizedCourses.ok) return jsonResponse(400, {
        error: "error" in normalizedCourses ? normalizedCourses.error : "قائمة الدورات غير صالحة.",
      }, origin);
      const result = await updateCourseAccess(admin, profile, normalizedCourses.value as string[], authData.user.id);
      return jsonResponse(200, result, origin);
    }

    if (action === "suspend") {
      const { error: banError } = await admin.auth.admin.updateUserById(String(profile.user_id), {
        ban_duration: SUSPENSION_DURATION,
      });
      if (banError) throw banError;

      const { error: profileUpdateError } = await admin.from("profiles")
        .update({ account_state: "suspended", updated_at: new Date().toISOString() })
        .eq("user_id", profile.user_id);
      if (profileUpdateError) throw profileUpdateError;

      const { error: subscriptionUpdateError } = await admin.from("student_subscriptions")
        .update({ status: "suspended", updated_at: new Date().toISOString() })
        .eq("user_id", profile.user_id);
      if (subscriptionUpdateError) throw subscriptionUpdateError;

      await logAction(admin, authData.user.id, "admin_direct_student_suspended", String(profile.user_id), { username });
      return jsonResponse(200, { success: true, message: "تم إيقاف الحساب ومنع تسجيل الدخول." }, origin);
    }

    if (action === "reactivate") {
      const { data: subscription, error: subscriptionReadError } = await admin.from("student_subscriptions")
        .select("id")
        .eq("user_id", profile.user_id)
        .limit(1)
        .maybeSingle();
      if (subscriptionReadError) throw subscriptionReadError;
      if (!subscription) return jsonResponse(409, { error: "لا يوجد اشتراك مرتبط بهذا الحساب لإعادة تفعيله." }, origin);

      const { error: unbanError } = await admin.auth.admin.updateUserById(String(profile.user_id), {
        ban_duration: "none",
      });
      if (unbanError) throw unbanError;

      const now = new Date().toISOString();
      const { error: profileUpdateError } = await admin.from("profiles")
        .update({ status: "approved", account_state: "active", updated_at: now })
        .eq("user_id", profile.user_id);
      if (profileUpdateError) throw profileUpdateError;

      const { error: subscriptionUpdateError } = await admin.from("student_subscriptions")
        .update({ status: "active", updated_at: now })
        .eq("user_id", profile.user_id);
      if (subscriptionUpdateError) throw subscriptionUpdateError;

      await logAction(admin, authData.user.id, "admin_direct_student_reactivated", String(profile.user_id), { username });
      return jsonResponse(200, { success: true, message: "تم إعادة تفعيل الحساب." }, origin);
    }

    return jsonResponse(400, { error: "العملية المطلوبة غير مدعومة." }, origin);
  } catch (error) {
    console.error(
      "Admin username student account request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    if (createdUserId) {
      try {
        if (createdSubscriptionId) {
          await createClient(readRequiredEnv("SUPABASE_URL"), readJsonKey(Deno.env.get("SUPABASE_SECRET_KEYS"), "SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
            auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
          }).from("student_subscriptions").delete().eq("id", createdSubscriptionId);
        }
        if (createdPlanId) {
          const cleanupClient = createClient(
            readRequiredEnv("SUPABASE_URL"),
            readJsonKey(Deno.env.get("SUPABASE_SECRET_KEYS"), "SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
            { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
          );
          await cleanupClient.from("subscription_plan_courses").delete().eq("plan_id", createdPlanId);
          await cleanupClient.from("subscription_plans").delete().eq("id", createdPlanId);
        }
        const cleanupAdmin = createClient(
          readRequiredEnv("SUPABASE_URL"),
          readJsonKey(Deno.env.get("SUPABASE_SECRET_KEYS"), "SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
          { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
        );
        await cleanupAdmin.from("profiles")
          .update({ status: "rejected", account_state: "suspended", updated_at: new Date().toISOString() })
          .eq("user_id", createdUserId);
        await cleanupAdmin.auth.admin.updateUserById(createdUserId, { ban_duration: SUSPENSION_DURATION });
      } catch (cleanupError) {
        console.error("Student account compensation failed:", cleanupError instanceof Error ? cleanupError.message : "Unknown error");
      }
    }

    return jsonResponse(500, {
      error: "تعذر إكمال إنشاء أو تعديل الحساب. راجع سجل التشغيل؛ وأي حساب بدأ إنشاؤه تم إيقافه تلقائيًا عند فشل التجهيز.",
    }, origin);
  }
});
