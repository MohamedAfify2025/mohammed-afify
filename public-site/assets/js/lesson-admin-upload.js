(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const BUCKET = "private-course-lessons";
  const PATH = "accounting/lecture-01.html";
  const COURSE = "accounting";
  const LESSON = "lecture-01";
  let client = null;

  function show(text, isError = false) {
    const el = $("pageMessage");
    el.textContent = text;
    el.className = "notice" + (isError ? " error" : "");
    el.hidden = !text;
  }

  async function verifyAdmin() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      $("loginPanel").hidden = false;
      $("uploadPanel").hidden = true;
      return false;
    }

    const user = sessionData.session.user;
    const { data: isAdmin, error: adminError } = await client.rpc("is_platform_admin");
    if (adminError || isAdmin !== true) {
      await client.auth.signOut();
      throw new Error("هذه الصفحة مخصصة لمدير المنصة المعتمد فقط.");
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== "admin" ||
        profile.status !== "approved" || profile.account_state !== "active") {
      await client.auth.signOut();
      throw new Error("حساب الإدارة غير معتمد أو غير نشط.");
    }

    $("loginPanel").hidden = true;
    $("uploadPanel").hidden = false;
    show("تم التحقق من صلاحيات مدير المنصة.");
    return true;
  }

  async function boot() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("إعداد اتصال Supabase غير مكتمل.", true);
      return;
    }
    client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    await verifyAdmin();
  }

  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("loginButton");
    button.disabled = true;
    show("جارٍ التحقق من بيانات الدخول...");
    try {
      const { error } = await client.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });
      if (error) throw error;
      await verifyAdmin();
    } catch (error) {
      show(error.message || "تعذر تسجيل الدخول.", true);
    } finally {
      button.disabled = false;
    }
  });

  $("uploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("uploadButton");
    const file = $("lessonFile").files?.[0];
    if (!file) return show("اختر ملف المحاضرة أولًا.", true);
    if (!/\.html?$/i.test(file.name)) return show("الملف يجب أن يكون بصيغة HTML.", true);
    if (file.size > 10 * 1024 * 1024) return show("حجم الملف يتجاوز الحد المسموح (10 ميجابايت).", true);
    if (file.size === 0) return show("الملف فارغ.", true);

    button.disabled = true;
    show("جارٍ رفع الملف إلى التخزين الخاص...");
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new Error("انتهت جلسة الدخول. سجّل الدخول من جديد.");

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(PATH, file, {
          upsert: true,
          contentType: "text/html",
          cacheControl: "0"
        });
      if (uploadError) throw uploadError;

      show("اكتمل رفع الملف. جارٍ تسجيل المحاضرة وربطها بالمقرر...");
      const { error: rowError } = await client
        .from("course_lessons")
        .upsert({
          course_slug: COURSE,
          lesson_slug: LESSON,
          title: "المحاسبة العملية على Odoo — المحاضرة الأولى",
          description: "المعادلة المحاسبية، شجرة الحسابات، اليوميات، البطاقات الأساسية، تطبيق عملي واختبار تفاعلي.",
          storage_bucket: BUCKET,
          storage_path: PATH,
          content_type: "text/html",
          file_size_bytes: file.size,
          is_published: $("publishNow").checked,
          sort_order: 1,
          created_by: userData.user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "course_slug,lesson_slug" });
      if (rowError) throw rowError;

      const { data: verifyBlob, error: verifyError } = await client.storage
        .from(BUCKET)
        .download(PATH);
      if (verifyError || !verifyBlob || verifyBlob.size !== file.size) {
        throw new Error("تم الرفع لكن فشل التحقق من الملف المخزّن. لا تنشر الرابط قبل المراجعة.");
      }

      show($("publishNow").checked
        ? "تم رفع المحاضرة والتحقق من حجم الملف وربطها بالمقرر. أصبحت ظاهرة داخل مساحات الطلاب الذين لديهم صلاحية مشاهدة صفحة مقرر المحاسبة."
        : "تم رفع المحاضرة والتحقق منها، لكنها ما زالت غير منشورة للطلاب.");
    } catch (error) {
      show(error.message || "تعذر رفع المحاضرة. راجع صلاحيات التخزين ثم أعد المحاولة.", true);
    } finally {
      button.disabled = false;
    }
  });

  $("logoutButton").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    $("uploadPanel").hidden = true;
    $("loginPanel").hidden = false;
    show("تم تسجيل الخروج.");
  });

  boot().catch((error) => show(error.message || "تعذر تهيئة صفحة إدارة المحاضرات.", true));
})();