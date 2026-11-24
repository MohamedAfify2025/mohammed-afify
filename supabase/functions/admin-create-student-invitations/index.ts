import { createClient } from "npm:@supabase/supabase-js@2";
import {
  isExactAllowedOrigin,
  normalizeOriginAllowlist,
  validateInvitationBatch,
  validateInviteRedirect,
} from "../_shared/student-invites.mjs";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Vary": "Origin",
};

function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  origin: string | null,
): Response {
  const headers = new Headers(HEADERS);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage",
    );
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function readJsonKey(raw: string | undefined, name: string): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(name + " must be a valid JSON object.");
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    typeof (parsed as Record<string, unknown>).default === "string"
  ) {
    return ((parsed as Record<string, string>).default).trim() || null;
  }
  throw new Error(name + " does not contain a default key.");
}

function readRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowedOrigins = normalizeOriginAllowlist(Deno.env.get("ALLOWED_ORIGINS"));

  if (!origin || !isExactAllowedOrigin(origin, allowedOrigins)) {
    return jsonResponse(403, { error: "Origin is not allowed." }, null);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...HEADERS,
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage",
      },
    });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin);
  }

  try {
    const authorization = req.headers.get("authorization") || "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i);
    if (!bearer) {
      return jsonResponse(401, { error: "سجّل الدخول بحساب الإدارة أولًا." }, origin);
    }
    const accessToken = bearer[1].trim();

    const body = await req.json().catch(() => null);
    const batch = validateInvitationBatch(body?.students);
    if (!batch.ok || !Array.isArray(batch.students)) {
      return jsonResponse(400, {
        error: "راجع قائمة المتدربين قبل الإرسال.",
        details: batch.errors || batch.error,
      }, origin);
    }
    const studentsToInvite = batch.students;

    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const publishableKey =
      readJsonKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), "SUPABASE_PUBLISHABLE_KEYS") ||
      Deno.env.get("SUPABASE_ANON_KEY")?.trim();
    if (!publishableKey) throw new Error("Supabase publishable/anon key is unavailable.");

    // User-context client: the caller JWT is used for Auth + admin authorization.
    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: "Bearer " + accessToken },
      },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !authData?.user?.id) {
      return jsonResponse(401, { error: "جلسة الدخول غير صالحة أو انتهت." }, origin);
    }

    // Require both the V2 admin RPC and the caller's own approved admin profile.
    const { data: isAdmin, error: adminRpcError } = await userClient.rpc("is_platform_admin");
    if (adminRpcError || isAdmin !== true) {
      return jsonResponse(403, { error: "هذه العملية متاحة لمدير المنصة المعتمد فقط." }, origin);
    }

    const { data: adminProfile, error: profileError } = await userClient
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (
      profileError ||
      adminProfile?.role !== "admin" ||
      adminProfile?.status !== "approved" ||
      adminProfile?.account_state !== "active"
    ) {
      return jsonResponse(403, { error: "حساب الإدارة غير معتمد أو غير نشط." }, origin);
    }

    // Secret key is used only in this server-side function, never returned to the browser.
    const secretKey =
      readJsonKey(Deno.env.get("SUPABASE_SECRET_KEYS"), "SUPABASE_SECRET_KEYS") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!secretKey) throw new Error("Supabase secret/service-role key is unavailable in the Edge Function environment.");

    const redirectTo = validateInviteRedirect(
      readRequiredEnv("STUDENT_INVITE_REDIRECT_URL"),
      allowedOrigins,
    );

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const results: Array<Record<string, unknown>> = [];
    for (const student of studentsToInvite) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        student.email,
        {
          redirectTo,
          data: {
            full_name: student.full_name,
            phone: student.phone,
            requested_course: student.requested_course,
            requested_role: "student",
            invite_source: "admin_student_invitation",
          },
        },
      );

      if (error || !data?.user?.id) {
        const safeMessage = /already|registered|exists|duplicate/i.test(error?.message || "")
          ? "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل."
          : "تعذر إرسال الدعوة لهذا البريد. راجع إعدادات البريد أو سجل Auth.";
        console.warn("Student invitation failed:", {
          code: error?.code || "unknown",
          status: error?.status || null,
        });
        results.push({
          email: student.email,
          full_name: student.full_name,
          success: false,
          message: safeMessage,
        });
        continue;
      }

      results.push({
        email: student.email,
        full_name: student.full_name,
        success: true,
        message: "تم إرسال دعوة إعداد الحساب.",
      });
    }

    const invitedCount = results.filter((item) => item.success === true).length;
    return jsonResponse(200, {
      success: invitedCount > 0,
      invited_count: invitedCount,
      failed_count: results.length - invitedCount,
      results,
    }, origin);
  } catch (error) {
    console.error(
      "Admin student invitation request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(500, {
      error: "تعذر تنفيذ دعوات الطلاب. راجع إعدادات Edge Function وسجل التشغيل.",
    }, origin);
  }
});
