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
    show("جارٍ تحميل المحاضرة وتجهيز عرض HTML بالعربية...");
    try {
      // Storage RLS validates the signed-in user before returning the private object.
      const { data, error } = await client.storage
        .from(lesson.storage_bucket)
        .download(lesson.storage_path);
      if (error || !data) throw error || new Error("تعذر تحميل ملف المحاضرة.");

      // Force the browser MIME type and UTF-8 encoding instead of trusting a generic Storage Blob type.
      const source = await data.text();
      if (!/<html[\s>]/i.test(source) || !/<head[\s>]/i.test(source)) {
        throw new Error("محتوى الملف لا يبدو صفحة HTML صالحة.");
      }

      // Keep the iframe sandboxed with an opaque origin. Bridge only the lesson's progress key.
      const progressKey = "ma_lecture1_visited";
      let initialProgress = null;
      try {
        const stored = localStorage.getItem(progressKey);
        const parsed = stored ? JSON.parse(stored) : null;
        if (Array.isArray(parsed) && parsed.length <= 100 &&
            parsed.every((item) => typeof item === "string" && item.length <= 100)) {
          initialProgress = JSON.stringify(parsed);
        }
      } catch (_) {
        initialProgress = null;
      }

      const bridge = '<script>(function(){' +
        'var key="ma_lecture1_visited";' +
        'var initial=' + JSON.stringify(initialProgress) + ';' +
        'var values={}; if(initial!==null){values[key]=initial;}' +
        'var store={' +
          'getItem:function(k){return Object.prototype.hasOwnProperty.call(values,k)?values[k]:null;},' +
          'setItem:function(k,v){v=String(v);values[k]=v;parent.postMessage({type:"ma-lecture1-storage",key:k,value:v},"*");},' +
          'removeItem:function(k){delete values[k];parent.postMessage({type:"ma-lecture1-storage-remove",key:k},"*");},' +
          'clear:function(){values={};parent.postMessage({type:"ma-lecture1-storage-remove",key:key},"*");}' +
        '};' +
        'try{Object.defineProperty(window,"localStorage",{configurable:true,value:store});}' +
        'catch(e){window.localStorage=store;}' +
      '})();</' + 'script>';

      const injected = source.replace(/<head\b[^>]*>/i, (head) => head + bridge);
      if (injected === source) throw new Error("تعذر تهيئة صفحة المحاضرة.");

      const blob = new Blob([injected], { type: "text/html;charset=utf-8" });
      const nextUrl = URL.createObjectURL(blob);
      const frame = $("lessonFrame");
      frame.src = "about:blank";
      if (activeLessonUrl) URL.revokeObjectURL(activeLessonUrl);
      activeLessonUrl = nextUrl;

      $("lessonTitle").textContent = lesson.title || "المحاضرة";
      $("lessonViewer").hidden = false;
      frame.src = nextUrl;
      $("lessonViewer").scrollIntoView({ behavior: "smooth", block: "start" });
      show("تم فتح المحاضرة بصيغة HTML UTF-8 داخل إطار معزول.");
    } catch (error) {
      show("تعذر فتح المحاضرة. تأكد من صلاحية المشاهدة، ثم أعد المحاولة.", true);
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

  function addCourse(course, lessons, isAdmin = false) {
    const li = document.createElement("li");
    li.className = "course-item";
    li.dataset.courseSlug = course.course_slug || "";

    const details = document.createElement("div");
    const name = document.createElement("button");
    name.type = "button";
    name.className = "course-name course-open";
    name.textContent = course.course_title || course.title || course.course_slug || "دورة";
    const hasBusinessCoursePage = course.course_slug === "business-administration" &&
      (isAdmin || course.can_view_course_page === true);
    const hasOdooIntro = course.course_slug === "odoo-training";
    name.title = hasBusinessCoursePage
      ? "افتح منهج الإدارة والأعمال"
      : (lessons.length ? "اضغط لفتح أول محاضرة في هذا المقرر" :
        (hasOdooIntro ? "افتح العرض الافتتاحي لدورة Odoo" : "لا توجد محاضرات مضافة لهذا المقرر بعد"));
    name.addEventListener("click", () => {
      if (hasBusinessCoursePage) {
        window.location.href = "academy/business-administration.html";
      } else if (lessons.length) {
        openLesson(lessons[0], name);
      } else if (hasOdooIntro) {
        window.location.href = "course-preview.html?course=odoo-training";
      } else {
        show("لا توجد محاضرات مسجلة لهذا المقرر حتى الآن.", true);
      }
    });
    const slug = document.createElement("small");
    slug.className = "course-slug";
    slug.textContent = course.course_slug || "";
    details.append(name, slug);

    li.appendChild(details);

    if (hasBusinessCoursePage) {
      const businessLink = document.createElement("a");
      businessLink.className = "lesson-open";
      businessLink.href = "academy/business-administration.html";
      businessLink.textContent = "فتح المنهج التعليمي الكامل";
      li.appendChild(businessLink);
    }

    if (isAdmin) {
      const access = document.createElement("span");
      access.className = "admin-access-badge";
      access.textContent = "وصول إداري شامل";
      li.appendChild(access);

      const state = document.createElement("span");
      state.className = "permission-badge" + (course.is_active ? " yes" : "");
      state.textContent = course.is_active ? "المقرر نشط" : "المقرر غير نشط";
      li.appendChild(state);
    } else {
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
      li.appendChild(badges);
    }

    if (hasOdooIntro) {
      const actionRow = document.createElement("div");
      actionRow.className = "course-action-row";

      const odooIntroLink = document.createElement("a");
      odooIntroLink.className = "lesson-open odoo-intro-link";
      odooIntroLink.href = "course-preview.html?course=odoo-training";
      odooIntroLink.textContent = "▶ ابدأ العرض الافتتاحي لدورة Odoo";
      odooIntroLink.setAttribute("aria-label", "ابدأ العرض الافتتاحي لدورة Odoo");
      actionRow.appendChild(odooIntroLink);
      li.appendChild(actionRow);
    }

    if (lessons.length) {
      const lessonList = document.createElement("div");
      lessonList.className = "lesson-list";
      const lessonHeading = document.createElement("div");
      lessonHeading.className = "lesson-heading";
      lessonHeading.textContent = isAdmin ? "كل المحاضرات والمواد" : "المحاضرات المتاحة";
      lessonList.appendChild(lessonHeading);

      for (const lesson of lessons) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lesson-open";
        const draftLabel = isAdmin && lesson.is_published !== true ? " · مسودة / غير منشورة" : "";
        button.textContent = "فتح: " + (lesson.title || lesson.lesson_slug) + draftLabel;
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
    if (profileError || !profile || !["student", "admin"].includes(profile.role)) {
      throw new Error("هذا الحساب غير مخصص لمساحة الطلاب أو إدارة المحاضرات.");
    }
    let isAdmin = false;
    if (profile.role === "admin") {
      const { data: isPlatformAdmin, error: adminCheckError } = await client.rpc("is_platform_admin");
      if (adminCheckError) throw adminCheckError;
      if (isPlatformAdmin !== true) {
        throw new Error("حساب المدير غير معتمد أو غير نشط. راجع إعدادات إدارة المنصة.");
      }
      isAdmin = true;
    }

    $("studentName").textContent = profile.full_name || (isAdmin ? "مدير المنصة" : "متدرب");
    if (profile.status !== "approved") {
      show("حسابك أُنشئ بنجاح، وطلبك بانتظار اعتماد الإدارة. ستظهر المحاضرات بعد الاعتماد وإسناد الاشتراك.");
      return;
    }
    if (profile.account_state !== "active") {
      show("حسابك موقوف حاليًا. تواصل مع إدارة المنصة.");
      return;
    }

    if (isAdmin) {
      $("adminDashboardLink").hidden = false;
      $("adminCourseManagerLink").hidden = false;
      $("adminStudentsLink").hidden = false;
      $("adminSubscriptionsLink").hidden = false;
      $("adminUploadLink").hidden = false;
      $("coursePanelTitle").textContent = "كل محتوى المنصة";
      $("coursePanelDescription").textContent = "لديك وصول إداري شامل لجميع المقررات والمحاضرات والمواد، بما فيها المسودات وغير المنشورة. لا تحتاج إلى إسناد صلاحيات طالب إلى حساب المدير.";
      show("تم التحقق من دور مدير المنصة. كل المحتوى متاح لك إداريًا دون إعداد صلاحيات فردية.");
    } else {
      $("coursePanelTitle").textContent = "الدورات وصلاحيات حسابك";
      $("coursePanelDescription").textContent = "تعرض هذه القائمة صلاحياتك لكل دورة. لن تتمكن من فتح أي درس أو ملف إلا إذا كانت صلاحيته مفعّلة.";
    }

    let allowedCourses = [];
    if (isAdmin) {
      const { data: adminCourses, error: adminCoursesError } = await client
        .from("course_catalog")
        .select("course_slug,title,is_active")
        .order("title");
      if (adminCoursesError) throw adminCoursesError;
      allowedCourses = (Array.isArray(adminCourses) ? adminCourses : []).map((course) => ({
        course_slug: course.course_slug,
        course_title: course.title,
        is_active: course.is_active === true
      }));
    } else {
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
    }

    let lessonQuery = client
      .from("course_lessons")
      .select("course_slug,lesson_slug,title,description,storage_bucket,storage_path,sort_order,is_published")
      .order("sort_order", { ascending: true });
    if (!isAdmin) {
      lessonQuery = lessonQuery.eq("is_published", true);
    }
    const { data: lessonRows, error: lessonError } = await lessonQuery;
    if (lessonError) throw lessonError;

    const lessonsByCourse = new Map();
    for (const lesson of (Array.isArray(lessonRows) ? lessonRows : [])) {
      const list = lessonsByCourse.get(lesson.course_slug) || [];
      list.push(lesson);
      lessonsByCourse.set(lesson.course_slug, list);
    }

    allowedCourses.forEach((course) => {
      addCourse(course, lessonsByCourse.get(course.course_slug) || [], isAdmin);
    });

    if (!allowedCourses.length) {
      show(isAdmin
        ? "لا توجد مقررات مسجلة في فهرس المنصة حاليًا."
        : "حسابك معتمد، لكن لا يوجد اشتراك تدريبي نشط مسند إلى حسابك حاليًا.");
      return;
    }

    $("coursePanel").hidden = false;

    // Course links selected by an administrator open this full-access workspace
    // focused on the requested course rather than showing its public description.
    const requestedCourse = new URLSearchParams(window.location.search).get("course");
    if (requestedCourse === "business-administration") {
      const businessCourse = allowedCourses.find((course) => course.course_slug === requestedCourse);
      if (isAdmin || businessCourse?.can_view_course_page === true) {
        window.location.replace("academy/business-administration.html");
        return;
      }
    }
    if (isAdmin && requestedCourse) {
      $("adminCourseManagerLink").href = "admin-course-manager.html?course=" + encodeURIComponent(requestedCourse);
      const targetCourse = allowedCourses.find((course) => course.course_slug === requestedCourse);
      const targetItem = [...$("courseList").querySelectorAll(".course-item")]
        .find((item) => item.dataset.courseSlug === requestedCourse);
      if (targetItem) {
        targetItem.classList.add("course-item-selected");
        targetItem.scrollIntoView({ behavior: "smooth", block: "center" });
        const courseLessons = lessonsByCourse.get(requestedCourse) || [];
        if (courseLessons.length) {
          openLesson(courseLessons[0], null);
        } else {
          show("تم فتح المقرر بصلاحيات المدير الكاملة. لا توجد محاضرات أو ملفات مسجلة لهذا المقرر حتى الآن.");
        }
      } else if (!targetCourse) {
        show("المقرر المطلوب غير موجود في فهرس المنصة.", true);
      }
    }
  }

  window.addEventListener("message", (event) => {
    const frame = $("lessonFrame");
    if (event.source !== frame.contentWindow) return;
    const message = event.data;
    const keyName = "ma_lecture1_visited";

    if (message?.type === "ma-lecture1-storage" && message.key === keyName &&
        typeof message.value === "string" && message.value.length <= 5000) {
      try {
        const parsed = JSON.parse(message.value);
        if (Array.isArray(parsed) && parsed.length <= 100 &&
            parsed.every((item) => typeof item === "string" && item.length <= 100)) {
          localStorage.setItem(keyName, JSON.stringify(parsed));
        }
      } catch (_) {
        // Ignore malformed progress messages from the sandboxed frame.
      }
    } else if (message?.type === "ma-lecture1-storage-remove" && message.key === keyName) {
      localStorage.removeItem(keyName);
    }
  });

  $("logoutButton").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    location.href = "student-login.html";
  });
  $("closeLesson").addEventListener("click", closeLesson);

  boot().catch((error) => show(error.message || "تعذر تحميل مساحتك التعليمية.", true));
})();