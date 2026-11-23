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

  function addCourse(slug) {
    const li = document.createElement("li");
    li.textContent = slug;
    $("courseList").appendChild(li);
  }

  async function boot() {
    if (!window.supabase?.createClient || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        !window.isMembershipPublicKey?.(key) === true) {
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

    const { data: courses, error: coursesError } = await client.rpc("get_my_active_courses_v2");
    if (coursesError) throw coursesError;
    const allowedCourses = Array.isArray(courses) ? courses : [];
    allowedCourses.forEach((course) => addCourse(course.course_slug || "دورة"));

    if (!allowedCourses.length) {
      show("حسابك معتمد، لكن لم يتم إسناد اشتراك تدريبي نشط بعد. تواصل مع الإدارة لاستكمال التفعيل.");
      return;
    }

    show("حسابك نشط. ستظهر المحاضرات والمواد بعد نشرها وربطها باشتراكك.");
    $("coursePanel").hidden = false;
  }

  $("logoutButton").addEventListener("click", async () => {
    if (!window.supabase?.createClient || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        !(key.startsWith("sb_publishable_") || key.startsWith("eyJ"))) {
      location.href = "student-login.html";
      return;
    }
    const client = window.supabase.createClient(url, key);
    await client.auth.signOut();
    location.href = "student-login.html";
  });

  boot().catch((error) => show(error.message || "تعذر تحميل مساحتك التعليمية.", true));
})();
