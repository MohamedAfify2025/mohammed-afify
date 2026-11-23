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

  function renderPermissions(profileData) {
    const panel = $("permissionPanel");
    const list = $("permissionList");
    const mode = profileData?.mode === "custom" ? "custom" : "inherit";
    const grants = Array.isArray(profileData?.permissions) ? profileData.permissions : [];
    const labels = {
      "student.dashboard.view":"مشاهدة لوحة المتدرب",
      "profile.view":"مشاهدة البيانات الشخصية",
      "profile.edit":"تعديل البيانات الشخصية",
      "course.catalog.view":"مشاهدة فهرس الدورات",
      "course.lesson.view":"مشاهدة الدروس",
      "course.lesson.download":"تحميل مواد الدروس",
      "assessment.take":"دخول الاختبارات",
      "certificate.view":"مشاهدة الشهادات",
      "progress.view":"مشاهدة التقدم",
      "project.view":"مشاهدة المشروعات",
      "resource.download":"تحميل الموارد"
    };
    list.replaceChildren();
    if (mode === "inherit") {
      $("permissionModeText").textContent =
        "حسابك يعمل بوضع الصلاحيات الموروثة؛ ويظل الوصول خاضعًا لاشتراكك النشط وقواعد Membership V2.";
      const item = document.createElement("li");
      item.textContent = "تُحدد الميزات المتاحة تلقائيًا وفق إعدادات اشتراكك.";
      list.appendChild(item);
    } else {
      $("permissionModeText").textContent =
        "حسابك يعمل بوضع الصلاحيات المخصصة. تظهر هنا المنح النشطة فقط، ويظل اشتراك الدورة شرطًا مستقلًا.";
      if (!grants.length) {
        const item = document.createElement("li");
        item.textContent = "لا توجد صلاحيات مخصصة نشطة حاليًا. تواصل مع إدارة المنصة.";
        list.appendChild(item);
      }
      grants.forEach((grant) => {
        const item = document.createElement("li");
        const name = labels[grant.permission_code] || grant.permission_name || grant.permission_code;
        const scope = grant.scope_course_slug ? " — " + grant.scope_course_slug : " — كل الدورات";
        const expiry = grant.valid_until
          ? " — حتى " + new Date(grant.valid_until).toLocaleDateString("ar-EG")
          : "";
        item.textContent = name + scope + expiry;
        list.appendChild(item);
      });
      if (!grants.some((grant) => grant.permission_code === "course.lesson.view")) {
        const note = document.createElement("p");
        note.className = "muted";
        note.textContent = "لا يظهر إذن مشاهدة الدروس ضمن منحك الحالية. وحتى مع منحه، يلزم وجود اشتراك نشط وصالح للدورة.";
        list.appendChild(note);
      }
    }
    panel.hidden = false;
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

    // Optional until the additive permissions migration has been applied.
    // A missing RPC must not interrupt existing Membership V2 access.
    const { data: permissionProfile, error: permissionError } =
      await client.rpc("get_my_platform_permissions");
    if (!permissionError) renderPermissions(permissionProfile);

    const { data: courses, error: coursesError } = await client.rpc("get_my_active_courses_v2");
    if (coursesError) throw coursesError;
    const entitledCourses = Array.isArray(courses) ? courses : [];
    let allowedCourses = entitledCourses;

    // The permission grant is an additional gate; get_my_active_courses_v2
    // remains the independent subscription/payment/capability gate.
    if (!permissionError && permissionProfile?.mode === "custom") {
      const checks = await Promise.all(entitledCourses.map((course) =>
        client.rpc("has_platform_permission", {
          p_permission_code: "course.lesson.view",
          p_course_slug: course.course_slug
        })
      ));
      const failedCheck = checks.find(result => result.error);
      if (failedCheck) throw failedCheck.error;
      allowedCourses = entitledCourses.filter((course, index) => checks[index].data === true);
    }

    allowedCourses.forEach((course) => addCourse(course.course_slug || "دورة"));

    if (!entitledCourses.length) {
      show("حسابك معتمد، لكن لم يتم إسناد اشتراك تدريبي نشط بعد. تواصل مع الإدارة لاستكمال التفعيل.");
      return;
    }
    if (!allowedCourses.length) {
      show("اشتراكك موجود، لكن لم تُمنح صلاحية مشاهدة الدروس لهذه الدورة بعد. تواصل مع إدارة المنصة.");
      return;
    }

    show("حسابك نشط. ستظهر المحاضرات والمواد بعد نشرها وربطها باشتراكك.");
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
