(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

  function show(text, isError = false) {
    const el = $("pageMessage");
    el.textContent = text;
    el.className = "notice " + (isError ? "error" : "success");
    el.hidden = !text;
  }

  function addCourse(course) {
    const li = document.createElement("li");
    li.className = "course-item";

    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "course-name";
    name.textContent = course.course_title || course.course_slug || "دورة";
    const slug = document.createElement("small");
    slug.className = "course-slug";
    slug.textContent = course.course_slug || "";
    details.append(name, slug);

    const permissions = [
      ["مشاهدة الصفحة", "can_view_course_page"],
      ["الفيديو", "can_watch_video"],
      ["التنزيل", "can_download"],
      ["الاختبارات", "can_take_assessments"],
      ["الشهادة", "can_receive_certificate"],
      ["متابعة التقدم", "can_track_progress"]
    ];
    const badges = document.createElement("div");
    badges.className = "permission-list";
    for (const [label, keyName] of permissions) {
      const badge = document.createElement("span");
      const allowed = course[keyName] === true;
      badge.className = "permission-badge" + (allowed ? " yes" : "");
      badge.textContent = label + (allowed ? " · متاح" : " · غير متاح");
      badges.appendChild(badge);
    }
    li.append(details, badges);
    $("courseList").appendChild(li);
  }

  async function boot() {
    if (!window.supabase?.createClient || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("بوابة الطلاب لم تُربط بمشروع Supabase بعد.", true);
      return;
    }

    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      location.href = "student-login.html";
      return;
    }

    $("studentEmail").textContent = sessionData.session.user.email || "";
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("full_name,role,status,account_state")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== "student") {
      throw new Error("تعذر العثور على ملف طالب صالح لهذا الحساب.");
    }

    $("studentName").textContent = profile.full_name || "متدرب";
    if (profile.status !== "approved") {
      show("حسابك أُنشئ بنجاح، وطلبك بانتظار اعتماد الإدارة. ستظهر المحاضرات بعد الاعتماد وإسناد الاشتراك.");
      return;
    }
    if (profile.account_state !== "active") {
      show("حسابك موقوف حاليًا. تواصل مع إدارة المنصة.");
      return;
    }

    let allowedCourses = [];
    const { data: permissions, error: permissionsError } = await client.rpc("get_my_course_permissions_v2");

    if (permissionsError) {
      const migrationNotApplied = permissionsError.code === "PGRST202" ||
        /get_my_course_permissions_v2.*(not found|does not exist)|could not find the function/i.test(permissionsError.message || "");
      if (!migrationNotApplied) throw permissionsError;
      const { data: legacyCourses, error: legacyError } = await client.rpc("get_my_active_courses_v2");
      if (legacyError) throw legacyError;
      allowedCourses = Array.isArray(legacyCourses) ? legacyCourses : [];
      show("يتم عرض صلاحيات الباقة الحالية. ستظهر الصلاحيات الفردية لكل طالب بعد تحديث إعدادات المنصة.");
    } else {
      allowedCourses = Array.isArray(permissions) ? permissions : [];
      show("هذه هي الصلاحيات المفعّلة لحسابك في كل دورة. لا يمكن للحساب تعديلها بنفسه.");
    }

    allowedCourses.forEach((course) => addCourse(course));
    if (!allowedCourses.length) {
      show("حسابك معتمد، لكن لا يوجد اشتراك تدريبي نشط مسند إلى حسابك حاليًا.");
      return;
    }

    $("coursePanel").hidden = false;
  }

  $("logoutButton").addEventListener("click", async () => {
    if (!window.supabase?.createClient || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      location.href = "student-login.html";
      return;
    }
    const client = window.supabase.createClient(url, key);
    await client.auth.signOut();
    location.href = "student-login.html";
  });

  boot().catch((error) => show(error.message || "تعذر تحميل مساحتك التعليمية.", true));
})();
