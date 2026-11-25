(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TEST_CONFIG = window.MEMBERSHIP_CONFIG || {};
  const LIVE_URL = "https://ybsjnubrswqksvktgmay.supabase.co";
  const LIVE_PUBLISHABLE_KEY = "sb_publishable_lLJqfC6krPlgE9sLWQX98A_gPo0TiRj";
  const COURSE_SLUG = "odoo-training";
  const LESSON_BUCKET = "private-course-lessons";
  const ASSET_BUCKET = "public-course-assets";
  const LESSON_PREFIX = COURSE_SLUG + "/";
  const MAX_HTML_BYTES = 10 * 1024 * 1024;
  let testClient = null;
  let testUser = null;
  let busy = false;

  function setMessage(message, kind = "info") {
    const box = $("transferMessage");
    box.textContent = message;
    box.className = "notice " + kind;
    box.hidden = !message;
  }

  function setProgress(message) {
    $("transferProgress").textContent = message;
    $("transferProgress").hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    $("transferButton").disabled = value;
    $("transferButton").textContent = value ? "جارٍ نقل دورة Odoo..." : "نقل دورة Odoo إلى TEST";
  }

  function fail(message) {
    setMessage(message, "error");
    setProgress("");
  }

  async function verifyTestAdmin() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(TEST_CONFIG.supabaseUrl || "") ||
        window.isMembershipPublicKey?.(TEST_CONFIG.supabasePublishableKey || TEST_CONFIG.supabaseAnonKey) !== true) {
      throw new Error("إعداد اتصال TEST غير مكتمل.");
    }

    if (TEST_CONFIG.environment !== "preview") {
      throw new Error("هذه الأداة تعمل على نسخة TEST فقط. افتحها من رابط المعاينة التجريبية.");
    }

    testClient = window.supabase.createClient(TEST_CONFIG.supabaseUrl,
      TEST_CONFIG.supabasePublishableKey || TEST_CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });

    const { data: userData, error: userError } = await testClient.auth.getUser();
    if (userError || !userData?.user) {
      $("testLoginLink").hidden = false;
      throw new Error("سجّل الدخول أولًا بحساب مدير TEST، ثم افتح أداة نقل دورة Odoo مرة أخرى.");
    }

    const { data: profile, error: profileError } = await testClient
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin" || profile.status !== "approved" || profile.account_state !== "active") {
      throw new Error("الحساب الحالي ليس مدير TEST معتمدًا ونشطًا.");
    }

    const { data: isAdmin, error: adminError } = await testClient.rpc("is_platform_admin");
    if (adminError) throw adminError;
    if (isAdmin !== true) throw new Error("لم يتم تأكيد صلاحية مدير TEST.");

    testUser = userData.user;
    $("testAdminStatus").textContent = "تم التحقق من مدير TEST: " + (userData.user.email || "الحساب الحالي");
    $("testAdminStatus").className = "notice success";
    $("transferForm").hidden = false;
  }

  async function downloadSourceCourse(liveClient) {
    const { data: liveProfile, error: profileError } = await liveClient
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", (await liveClient.auth.getUser()).data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!liveProfile || liveProfile.role !== "admin" ||
        liveProfile.status !== "approved" || liveProfile.account_state !== "active") {
      throw new Error("حساب LIVE المستخدم ليس مديرًا معتمدًا ونشطًا.");
    }

    const { data: sourceAdmin, error: sourceAdminError } = await liveClient.rpc("is_platform_admin");
    if (sourceAdminError) throw sourceAdminError;
    if (sourceAdmin !== true) throw new Error("لم يتم تأكيد صلاحية مدير LIVE.");

    setProgress("تم التحقق من مدير LIVE. جارٍ قراءة بيانات دورة Odoo...");
    const { data: course, error: courseError } = await liveClient
      .from("course_catalog")
      .select("course_slug,title,description,is_active,guest_preview_enabled")
      .eq("course_slug", COURSE_SLUG)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course || course.is_active !== true) throw new Error("دورة Odoo غير موجودة أو غير نشطة في LIVE.");

    const { data: units, error: unitsError } = await liveClient
      .from("course_units")
      .select("id,course_slug,unit_slug,title,description,sort_order,is_published")
      .eq("course_slug", COURSE_SLUG)
      .order("sort_order", { ascending: true });
    if (unitsError) throw unitsError;
    if (!Array.isArray(units) || !units.length) throw new Error("لم يتم العثور على وحدات لدورة Odoo في LIVE.");

    const { data: lessons, error: lessonsError } = await liveClient
      .from("course_lessons")
      .select("id,course_slug,lesson_slug,title,description,storage_bucket,storage_path,content_type,file_size_bytes,is_published,sort_order,unit_id,source_path,source_base_url,lesson_type,youtube_url")
      .eq("course_slug", COURSE_SLUG)
      .order("sort_order", { ascending: true });
    if (lessonsError) throw lessonsError;
    if (!Array.isArray(lessons) || !lessons.length) throw new Error("لم يتم العثور على محاضرات لدورة Odoo في LIVE.");

    const files = [];
    for (const lesson of lessons) {
      if (lesson.storage_bucket !== LESSON_BUCKET ||
          typeof lesson.storage_path !== "string" ||
          !lesson.storage_path.startsWith(LESSON_PREFIX) ||
          lesson.content_type !== "text/html") {
        throw new Error("مسار أو نوع ملف غير متوقع في المحاضرة: " + (lesson.lesson_slug || "بدون رمز"));
      }
      setProgress("جارٍ تنزيل ملف المحاضرة من LIVE: " + lesson.title);
      const { data: blob, error: downloadError } = await liveClient.storage
        .from(lesson.storage_bucket)
        .download(lesson.storage_path);
      if (downloadError) throw downloadError;
      if (!blob || !blob.size || blob.size > MAX_HTML_BYTES) {
        throw new Error("حجم ملف المحاضرة غير صالح أو يتجاوز 10 ميجابايت.");
      }
      const html = await blob.text();
      if (!/<html[\s>]/i.test(html) || !/<head[\s>]/i.test(html)) {
        throw new Error("ملف المحاضرة لا يحتوي صفحة HTML صالحة: " + lesson.lesson_slug);
      }
      files.push({ lesson, blob, size: blob.size });
    }

    let cover = null;
    try {
      setProgress("جارٍ تنزيل غلاف دورة Odoo من LIVE...");
      const { data: imageBlob, error: imageError } = await liveClient.storage
        .from(ASSET_BUCKET)
        .download(COURSE_SLUG + "/hero-image");
      if (imageError) throw imageError;
      if (imageBlob && imageBlob.size && imageBlob.size <= MAX_HTML_BYTES) cover = imageBlob;
    } catch (_) {
      // The cover is optional; the private lesson content is the required payload.
    }

    return { course, units, files, cover };
  }

  async function writeTestCourse(payload) {
    const { course, units, files, cover } = payload;
    const uploadedPaths = [];
    let coverUploaded = false;

    try {
      setProgress("جارٍ تجهيز ملفات الدورة في مخزن TEST الخاص...");
      for (const item of files) {
        const { error: uploadError } = await testClient.storage
          .from(LESSON_BUCKET)
          .upload(item.lesson.storage_path, item.blob, {
            upsert: true,
            contentType: "text/html",
            cacheControl: "no-store"
          });
        if (uploadError) throw uploadError;
        uploadedPaths.push(item.lesson.storage_path);
      }

      if (cover) {
        const { error: coverError } = await testClient.storage
          .from(ASSET_BUCKET)
          .upload(COURSE_SLUG + "/hero-image", cover, {
            upsert: true,
            contentType: cover.type || "image/png",
            cacheControl: "300"
          });
        if (coverError) {
          setProgress("تم نقل ملف المحاضرة. تعذر نقل غلاف الصورة، وسيبقى الغلاف الافتراضي ظاهرًا.");
        } else {
          coverUploaded = true;
        }
      }

      setProgress("تم نقل الملفات. جارٍ إنشاء الوحدة وربط المحاضرة بها...");
      const unitIdMap = new Map();
      for (const unit of units) {
        const values = {
          course_slug: COURSE_SLUG,
          unit_slug: unit.unit_slug,
          title: unit.title,
          description: unit.description || "",
          sort_order: unit.sort_order || 1,
          is_published: unit.is_published === true,
          created_by: testUser.id
        };
        const { data: savedUnit, error: unitSaveError } = await testClient
          .from("course_units")
          .upsert(values, { onConflict: "course_slug,unit_slug" })
          .select("id,unit_slug")
          .single();
        if (unitSaveError) throw unitSaveError;
        unitIdMap.set(unit.id, savedUnit.id);
      }

      const { error: courseUpdateError } = await testClient
        .from("course_catalog")
        .update({
          title: course.title,
          description: course.description || "",
          is_active: true,
          guest_preview_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq("course_slug", COURSE_SLUG);
      if (courseUpdateError) throw courseUpdateError;

      for (const item of files) {
        const lesson = item.lesson;
        const values = {
          course_slug: COURSE_SLUG,
          lesson_slug: lesson.lesson_slug,
          title: lesson.title,
          description: lesson.description || "",
          storage_bucket: LESSON_BUCKET,
          storage_path: lesson.storage_path,
          content_type: "text/html",
          file_size_bytes: item.size,
          is_published: lesson.is_published === true,
          sort_order: lesson.sort_order || 1,
          created_by: testUser.id,
          unit_id: lesson.unit_id ? (unitIdMap.get(lesson.unit_id) || null) : null,
          source_path: lesson.source_path || null,
          source_base_url: lesson.source_base_url || null,
          lesson_type: lesson.lesson_type || "lesson",
          youtube_url: lesson.youtube_url || null
        };
        const { error: lessonSaveError } = await testClient
          .from("course_lessons")
          .upsert(values, { onConflict: "course_slug,lesson_slug" });
        if (lessonSaveError) throw lessonSaveError;
      }

      setProgress("جارٍ التحقق من بيانات الدورة وملفاتها في TEST...");
      const { data: verifyUnits, error: verifyUnitsError } = await testClient
        .from("course_units")
        .select("id,unit_slug,is_published")
        .eq("course_slug", COURSE_SLUG);
      if (verifyUnitsError) throw verifyUnitsError;
      const { data: verifyLessons, error: verifyLessonsError } = await testClient
        .from("course_lessons")
        .select("id,lesson_slug,is_published,storage_bucket,storage_path,file_size_bytes")
        .eq("course_slug", COURSE_SLUG);
      if (verifyLessonsError) throw verifyLessonsError;
      if ((verifyUnits || []).length !== units.length || (verifyLessons || []).length !== files.length) {
        throw new Error("لم يتطابق عدد الوحدات والمحاضرات بعد النقل.");
      }

      for (const lesson of verifyLessons || []) {
        const { data: checkBlob, error: checkError } = await testClient.storage
          .from(LESSON_BUCKET)
          .download(lesson.storage_path);
        if (checkError || !checkBlob || checkBlob.size !== Number(lesson.file_size_bytes)) {
          throw checkError || new Error("تعذر التحقق من الملف بعد رفعه إلى TEST.");
        }
      }

      return {
        units: verifyUnits.length,
        lessons: verifyLessons.length,
        publishedUnits: verifyUnits.filter((item) => item.is_published).length,
        publishedLessons: verifyLessons.filter((item) => item.is_published).length,
        coverUploaded
      };
    } catch (error) {
      // Remove only uploaded course files if metadata setup fails before completion.
      if (uploadedPaths.length) {
        try { await testClient.storage.from(LESSON_BUCKET).remove(uploadedPaths); } catch (_) {}
      }
      if (coverUploaded) {
        try { await testClient.storage.from(ASSET_BUCKET).remove([COURSE_SLUG + "/hero-image"]); } catch (_) {}
      }
      throw error;
    }
  }

  async function startTransfer(event) {
    event.preventDefault();
    if (busy || !testClient || !testUser) return;

    const email = $("liveAdminEmail").value.trim();
    const passwordInput = $("liveAdminPassword");
    const password = passwordInput.value;
    if (!email || !password) {
      fail("أدخل بريد مدير LIVE وكلمة مروره لإتمام النقل.");
      return;
    }

    setBusy(true);
    setMessage("", "info");
    setProgress("جارٍ إنشاء اتصال مؤقت وآمن بمشروع LIVE...");
    let liveClient = null;

    try {
      liveClient = window.supabase.createClient(LIVE_URL, LIVE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "ma-live-course-transfer-temporary"
        }
      });

      const { data: loginData, error: loginError } = await liveClient.auth.signInWithPassword({ email, password });
      passwordInput.value = "";
      if (loginError || !loginData?.user) throw loginError || new Error("تعذر تسجيل الدخول إلى LIVE.");

      const sourcePayload = await downloadSourceCourse(liveClient);
      const result = await writeTestCourse(sourcePayload);

      setProgress("");
      setMessage(
        "اكتمل نقل دورة Odoo إلى TEST بنجاح. الوحدات: " + result.units +
        "، المحاضرات: " + result.lessons +
        "، الوحدات المنشورة: " + result.publishedUnits +
        "، المحاضرات المنشورة: " + result.publishedLessons +
        (result.coverUploaded ? "، وتم نقل غلاف الدورة أيضًا." : "، والغلاف الافتراضي سيظل ظاهرًا.") +
        " لم يتم منح أي طالب جديد صلاحية؛ ستظل صلاحيات الطلاب المحددين فقط كما هي.",
        "success"
      );
      $("openOdooTestLink").hidden = false;
      $("transferButton").textContent = "تم النقل — يمكنك فتح دورة TEST";
    } catch (error) {
      passwordInput.value = "";
      const detail = String(error?.message || "حدث خطأ غير معروف أثناء النقل.");
      fail("تعذر إكمال نقل دورة Odoo: " + detail);
    } finally {
      if (liveClient) {
        try { await liveClient.auth.signOut(); } catch (_) {}
      }
      $("liveAdminPassword").value = "";
      setBusy(false);
      if ($("transferMessage").classList.contains("success")) {
        $("transferButton").textContent = "إعادة التحقق من دورة TEST";
      }
    }
  }

  $("transferForm").addEventListener("submit", startTransfer);
  $("liveAdminPassword").addEventListener("input", () => {
    if ($("liveAdminPassword").value) setMessage("", "info");
  });

  verifyTestAdmin().catch((error) => {
    $("testAdminStatus").textContent = error.message || "تعذر التحقق من مدير TEST.";
    $("testAdminStatus").className = "notice error";
  });
})();