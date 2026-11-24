(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let client = null;
  let activeLessonUrl = "";

  function show(text, isError = false) {
    const el = $("pageMessage");
    el.textContent = text;
    el.className = "notice " + (isError ? "error" : "success");
    el.hidden = !text;
  }

  async function openLesson(lesson, button) {
    if (button) button.disabled = true;
    show("جارٍ تحميل المحاضرة والتحقق من صلاحية الوصول...");
    try {
      const { data, error } = await client.storage
        .from(lesson.storage_bucket)
        .download(lesson.storage_path);
      if (error || !data) throw error || new Error("لم يتم العثور على ملف المحاضرة.");
      if (data.size <= 0) throw new Error("ملف المحاضرة فارغ.");

      const nextUrl = URL.createObjectURL(data);
      const frame = $("lessonFrame");
      frame.src = "about:blank";
      if (activeLessonUrl) URL.revokeObjectURL(activeLessonUrl);
      activeLessonUrl = nextUrl;

      $("lessonTitle").textContent = lesson.title || "المحاضرة";
      $("lessonViewer").hidden = false;
      frame.src = nextUrl;
      $("lessonViewer").scrollIntoView({ behavior: "smooth", block: "start" });
      show("تم فتح المحاضرة داخل مساحتك التعليمية.");
    } catch (error) {
      show("تعذر فتح المحاضرة. تأكد من أن اشتراكك يتضمن صلاحية مشاهدة صفحة المقرر، ثم أعد المحاولة.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function closeLesson() {
    $("lessonViewer").hidden = true;
    $("lessonFrame").src = "about:blank";
    if (activeLessonUrl) URL.revokeObjectURL(activeLessonUrl);
    activeLessonUrl = "";
  }

  function addCourse(course, lessons) {
    const li = document.createElement("li");
    li.className = "course-item";

    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "course-name";
    name.textContent = course.course_title || course.title || course.course_slug || "دورة";
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

    if (lessons.length) {
      const lessonList = document.createElement("div");
      lessonList.className = "lesson-list";
      const lessonHeading = document.createElement("div");
      lessonHeading.className = "lesson-heading";
      lessonHeading.textContent = "المحاضرات المتاحة";
      lessonList.appendChild(lessonHeading);

      for (const lesson of lessons) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lesson-open";
        button.textContent = "فتح: " + (lesson.title || lesson.lesson_slug);
        button.addEventListener("click", () => openLesson(lesson, button));
        lessonList.appendChild(button);
      }
      li.appendChild(lessonList);
    }

    $("courseList").appendChild(li);
  }

  async function boot() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("بوابة الطلاب لم تُربط بمشروع Supabase بعد.", true);
      return;
    }

    client = window.supabase.createClient(url, key, {
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

    const { data: lessonRows, error: lessonError } = await client
      .from("course_lessons")
      .select("course_slug,lesson_slug,title,description,storage_bucket,storage_path,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (lessonError) throw lessonError;

    const lessonsByCourse = new Map();
    for (const lesson of (Array.isArray(lessonRows) ? lessonRows : [])) {
      const list = lessonsByCourse.get(lesson.course_slug) || [];
      list.push(lesson);
      lessonsByCourse.set(lesson.course_slug, list);
    }

    allowedCourses.forEach((course) => {
      addCourse(course, lessonsByCourse.get(course.course_slug) || []);
    });

    if (!allowedCourses.length) {
      show("حسابك معتمد، لكن لا يوجد اشتراك تدريبي نشط مسند إلى حسابك حاليًا.");
      return;
    }

    $("coursePanel").hidden = false;
  }

  $("logoutButton").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    location.href = "student-login.html";
  });
  $("closeLesson").addEventListener("click", closeLesson);

  boot().catch((error) => show(error.message || "تعذر تحميل مساحتك التعليمية.", true));
})();