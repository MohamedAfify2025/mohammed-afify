(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let client = null;
  let activeLessonUrl = "";
  let allowedCourses = [];
  let lessonsByCourse = new Map();
  let isAdminSession = false;
  let isActiveStudent = false;
  let currentUserId = "";
  let currentLesson = null;
  let progressByLesson = new Map();
  let selectedCourseSlug = "";

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

      currentLesson = lesson;
      $("lessonTitle").textContent = lesson.title || "المحاضرة";
      $("lessonViewer").hidden = false;
      frame.src = nextUrl;
      refreshCompleteButton(lesson);
      if (canTrackCourse(lesson.course_slug)) {
        saveLessonProgress(lesson, false).catch(() => {
          show("تم فتح المحاضرة، لكن تعذر تحديث سجل التقدم. تحقق من صلاحية متابعة التقدم في اشتراكك.", true);
        });
      }
      $("lessonViewer").scrollIntoView({ behavior: "smooth", block: "start" });
      show("تم فتح المحاضرة بصيغة HTML UTF-8 داخل إطار معزول.");
    } catch (error) {
      show("تعذر فتح المحاضرة. تأكد من صلاحية المشاهدة، ثم أعد المحاولة.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function progressKey(courseSlug, lessonSlug) {
    return String(courseSlug || "") + "::" + String(lessonSlug || "");
  }

  function canTrackCourse(courseSlug) {
    const course = allowedCourses.find(item => item.course_slug === courseSlug);
    return isActiveStudent && course?.can_track_progress === true;
  }

  function refreshCompleteButton(lesson) {
    const button = $("completeLessonButton");
    if (!button) return;
    const enabled = Boolean(lesson && canTrackCourse(lesson.course_slug));
    const saved = lesson ? progressByLesson.get(progressKey(lesson.course_slug, lesson.lesson_slug)) : null;
    button.hidden = !enabled;
    button.disabled = saved?.completed === true;
    button.textContent = saved?.completed === true ? "✓ تم إكمال المحاضرة" : "تم إكمال المحاضرة";
  }

  async function saveLessonProgress(lesson, completed) {
    if (!lesson || !canTrackCourse(lesson.course_slug) || !currentUserId) return;
    const key = progressKey(lesson.course_slug, lesson.lesson_slug);
    const previous = progressByLesson.get(key);
    const payload = {
      user_id: currentUserId,
      course_slug: lesson.course_slug,
      lesson_slug: lesson.lesson_slug,
      lesson_title: lesson.title || lesson.lesson_slug,
      seconds_watched: Number(previous?.seconds_watched || 0),
      completed: completed === true || previous?.completed === true,
      updated_at: new Date().toISOString()
    };
    const { error } = await client
      .from("learning_progress")
      .upsert(payload, { onConflict: "user_id,course_slug,lesson_slug" });
    if (error) throw error;
    progressByLesson.set(key, payload);
    refreshCompleteButton(lesson);
    refreshCourseProgress(lesson.course_slug);
    return payload;
  }

  function refreshCourseProgress(courseSlug) {
    const item = [...$("courseList").querySelectorAll(".course-item")]
      .find(row => row.dataset.courseSlug === courseSlug);
    if (!item) return;
    const host = item.querySelector(".course-progress");
    const lessons = lessonsByCourse.get(courseSlug) || [];
    if (!host || !lessons.length) return;
    const completed = lessons.filter(lesson =>
      progressByLesson.get(progressKey(courseSlug, lesson.lesson_slug))?.completed === true
    ).length;
    const percent = Math.round((completed / lessons.length) * 100);
    const label = host.querySelector(".course-progress-top strong");
    const fill = host.querySelector(".course-progress-fill");
    if (label) label.textContent = completed + " من " + lessons.length + " محاضرة";
    if (fill) fill.style.width = percent + "%";
  }

  function closeLesson() {
    $("lessonViewer").hidden = true;
    $("lessonFrame").src = "about:blank";
    if (activeLessonUrl) URL.revokeObjectURL(activeLessonUrl);
    activeLessonUrl = "";
    currentLesson = null;
    refreshCompleteButton(null);
  }

  function updateCourseUrl(slug, replace = false) {
    const next = new URL(window.location.href);
    if (slug) next.searchParams.set("course", slug);
    else next.searchParams.delete("course");
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", next.pathname + next.search + next.hash);
  }

  function renderCourseTabs() {
    const host = $("courseTabs");
    host.replaceChildren();

    const all = document.createElement("button");
    all.type = "button";
    all.className = "course-tab";
    all.setAttribute("role", "tab");
    all.setAttribute("aria-selected", selectedCourseSlug ? "false" : "true");
    all.textContent = "كل المقررات";
    all.addEventListener("click", () => {
      selectedCourseSlug = "";
      updateCourseUrl("");
      renderCourseTabs();
      renderCourseContent(false);
    });
    host.appendChild(all);

    for (const course of allowedCourses) {
      const slug = course.course_slug;
      const count = (lessonsByCourse.get(slug) || []).length;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "course-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", selectedCourseSlug === slug ? "true" : "false");
      tab.setAttribute("aria-controls", "courseList");
      tab.dataset.courseSlug = slug;

      const label = document.createElement("strong");
      label.textContent = course.course_title || course.title || slug;
      const badge = document.createElement("span");
      badge.className = "course-tab-count";
      badge.textContent = String(count);
      badge.setAttribute("aria-label", count + " محاضرات");
      tab.append(label, badge);
      tab.addEventListener("click", () => {
        selectedCourseSlug = slug;
        updateCourseUrl(slug);
        renderCourseTabs();
        renderCourseContent(true);
      });
      host.appendChild(tab);
    }
  }

  function renderCourseContent(autoOpenFirstLesson = false) {
    const host = $("courseList");
    host.replaceChildren();

    const visibleCourses = selectedCourseSlug
      ? allowedCourses.filter(course => course.course_slug === selectedCourseSlug)
      : allowedCourses;

    if (selectedCourseSlug && !visibleCourses.length) {
      $("coursePanelTitle").textContent = "المقرر غير متاح";
      $("coursePanelDescription").textContent = "لا توجد صلاحية وصول لهذا المقرر في حسابك الحالي.";
      show("المقرر المطلوب غير مسند إلى حسابك أو لم يعد متاحًا.", true);
      selectedCourseSlug = "";
      updateCourseUrl("", true);
      renderCourseTabs();
      return;
    }

    const selected = visibleCourses.length === 1 && selectedCourseSlug
      ? visibleCourses[0]
      : null;

    $("coursePanelTitle").textContent = selected
      ? (selected.course_title || selected.title || selected.course_slug)
      : (isAdminSession ? "كل المقررات التعليمية" : "مساراتك التعليمية");

    if (selected) {
      const count = (lessonsByCourse.get(selected.course_slug) || []).length;
      $("coursePanelDescription").textContent = count
        ? "يعرض هذا القسم محاضرات ومواد هذا المقرر فقط. اختر المحاضرة لفتحها، وستظل بقية المقررات في تبويباتها."
        : "هذا المقرر متاح لحسابك، لكن لم تُسجّل له محاضرات في مكتبة المحتوى بعد.";
      $("courseOverviewLink").href = "student-space.html";
      $("courseOverviewLink").textContent = "عرض كل المقررات";
      const managerLink = $("adminCourseManagerLink");
      if (isAdminSession && managerLink) {
        managerLink.href = "admin-course-manager.html?course=" + encodeURIComponent(selected.course_slug);
      }
    } else {
      $("coursePanelDescription").textContent = isAdminSession
        ? "اختر مقررًا من التبويبات لعرض محتواه منفصلًا، أو اعرض القائمة الكاملة."
        : "هذه هي المقررات المسندة إلى حسابك. اختر أي مقرر لعرض دروسه ومواده.";
      $("courseOverviewLink").href = "student-space.html";
      $("courseOverviewLink").textContent = "عرض المقررات";
    }

    for (const course of visibleCourses) {
      addCourse(course, lessonsByCourse.get(course.course_slug) || [], isAdminSession);
    }

    if (selected && autoOpenFirstLesson) {
      if (selected.course_slug === "business-administration") {
        const link = host.querySelector('a[href="academy/business-administration.html"]');
        link?.focus();
      } else {
        const courseLessons = lessonsByCourse.get(selected.course_slug) || [];
        const recentLesson = courseLessons
          .map(lesson => ({
            lesson,
            progress: progressByLesson.get(progressKey(lesson.course_slug, lesson.lesson_slug))
          }))
          .filter(item => item.progress?.updated_at)
          .sort((a, b) => new Date(b.progress.updated_at).getTime() - new Date(a.progress.updated_at).getTime())[0]?.lesson;
        const targetSlug = recentLesson?.lesson_slug;
        const targetButton = targetSlug
          ? [...host.querySelectorAll("[data-lesson-slug]")].find(button => button.dataset.lessonSlug === targetSlug)
          : null;
        const firstLesson = host.querySelector('[data-first-lesson="true"]');
        if (targetButton) targetButton.click();
        else if (firstLesson) firstLesson.click();
        else if (selected.course_slug === "odoo-training") {
          const intro = host.querySelector(".odoo-intro-link");
          intro?.focus();
        }
      }
      $("coursePanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
        show("هذا المقرر ظاهر في حسابك، لكن لا توجد له محاضرات مسجلة في مكتبة المحتوى بعد.", true);
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

    if (isActiveStudent && course.can_track_progress === true && lessons.length) {
      const completed = lessons.filter(lesson =>
        progressByLesson.get(progressKey(course.course_slug, lesson.lesson_slug))?.completed === true
      ).length;
      const percent = Math.round((completed / lessons.length) * 100);
      const progress = document.createElement("div");
      progress.className = "course-progress";
      const top = document.createElement("div");
      top.className = "course-progress-top";
      const label = document.createElement("span");
      label.textContent = "تقدمك في هذا المقرر";
      const value = document.createElement("strong");
      value.textContent = completed + " من " + lessons.length + " محاضرة";
      top.append(label, value);
      const track = document.createElement("div");
      track.className = "course-progress-track";
      const fill = document.createElement("div");
      fill.className = "course-progress-fill";
      fill.style.width = percent + "%";
      track.appendChild(fill);
      progress.append(top, track);
      li.appendChild(progress);
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

      lessons.forEach((lesson, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lesson-open";
        const draftLabel = isAdmin && lesson.is_published !== true ? " · مسودة / غير منشورة" : "";
        const lessonProgress = progressByLesson.get(progressKey(lesson.course_slug, lesson.lesson_slug));
        button.textContent = (lessonProgress?.completed === true ? "✓ " : "") + "فتح: " + (lesson.title || lesson.lesson_slug) + draftLabel;
        button.dataset.lessonSlug = lesson.lesson_slug;
        if (lessonProgress?.completed === true) button.classList.add("completed");
        if (index === 0) button.dataset.firstLesson = "true";
        button.addEventListener("click", () => openLesson(lesson, button));
        lessonList.appendChild(button);
      });
      li.appendChild(lessonList);
    } else if (!hasBusinessCoursePage && !hasOdooIntro) {
      const empty = document.createElement("div");
      empty.className = "lesson-list";
      empty.innerHTML = '<div class="lesson-heading">المحتوى التعليمي</div><p class="muted">لم تُضف محاضرات لهذا المقرر بعد. ستظهر هنا تلقائيًا عند نشر أول مادة تعليمية.</p>';
      li.appendChild(empty);
    }

    host.appendChild(li);
    return li;
  }

  window.addEventListener("popstate", () => {
    const requested = new URLSearchParams(window.location.search).get("course") || "";
    selectedCourseSlug = allowedCourses.some(course => course.course_slug === requested) ? requested : "";
    renderCourseTabs();
    renderCourseContent(false);
  });

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
      const next = "student-space.html" + window.location.search + window.location.hash;
      location.href = "student-login.html?next=" + encodeURIComponent(next);
      return;
    }

    currentUserId = sessionData.session.user.id;
    $("studentEmail").textContent = sessionData.session.user.email || "";
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("full_name,role,status,account_state")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error("لم يتم العثور على ملف الحساب.");
    }
    if (profile.role === "teacher") {
      location.replace("teacher-space.html" + window.location.search);
      return;
    }
    if (!["student", "admin"].includes(profile.role)) {
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

    isAdminSession = isAdmin;
    isActiveStudent = !isAdmin && profile.role === "student" &&
      profile.status === "approved" && profile.account_state === "active";
    if (isAdmin) {
      $("adminDashboardLink").hidden = false;
      $("adminCourseManagerLink").hidden = false;
      $("adminStudentsLink").hidden = false;
      $("adminSubscriptionsLink").hidden = false;
      $("adminUploadLink").hidden = false;
      show("تم التحقق من دور مدير المنصة. لديك وصول إداري شامل لجميع المقررات والمحاضرات والمسودات.");
    } else {
      show("تم التحقق من حسابك. ستظهر هنا المقررات التي يسمح بها اشتراكك وصلاحياته.");
    }

    if (isAdmin) {
      const { data: adminCourses, error: adminCoursesError } = await client
        .from("course_catalog")
        .select("course_slug,title,is_active,description")
        .order("title");
      if (adminCoursesError) throw adminCoursesError;
      allowedCourses = (Array.isArray(adminCourses) ? adminCourses : []).map(course => ({
        course_slug: course.course_slug,
        course_title: course.title,
        title: course.title,
        description: course.description,
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
      } else {
        allowedCourses = Array.isArray(permissions) ? permissions : [];
      }
    }

    allowedCourses = allowedCourses.filter(course => course && /^[a-z0-9-]+$/i.test(String(course.course_slug || "")));
    if (!allowedCourses.length) {
      $("coursePanel").hidden = true;
      show(isAdmin
        ? "لا توجد مقررات مسجلة في فهرس المنصة حاليًا."
        : "حسابك معتمد، لكن لا يوجد اشتراك تدريبي نشط مسند إلى حسابك حاليًا.");
      return;
    }

    let lessonQuery = client
      .from("course_lessons")
      .select("course_slug,lesson_slug,title,description,storage_bucket,storage_path,sort_order,is_published")
      .in("course_slug", allowedCourses.map(course => course.course_slug))
      .order("sort_order", { ascending: true });
    if (!isAdmin) lessonQuery = lessonQuery.eq("is_published", true);

    const { data: lessonRows, error: lessonError } = await lessonQuery;
    if (lessonError) throw lessonError;

    lessonsByCourse = new Map();
    for (const lesson of (Array.isArray(lessonRows) ? lessonRows : [])) {
      const list = lessonsByCourse.get(lesson.course_slug) || [];
      list.push(lesson);
      lessonsByCourse.set(lesson.course_slug, list);
    }

    if (isActiveStudent) {
      const trackableSlugs = allowedCourses
        .filter(course => course.can_track_progress === true)
        .map(course => course.course_slug);
      if (trackableSlugs.length) {
        const { data: progressRows, error: progressError } = await client
          .from("learning_progress")
          .select("course_slug,lesson_slug,lesson_title,seconds_watched,completed,updated_at")
          .eq("user_id", currentUserId)
          .in("course_slug", trackableSlugs)
          .order("updated_at", { ascending: false });
        if (progressError) throw progressError;
        progressByLesson = new Map((Array.isArray(progressRows) ? progressRows : []).map(row => [
          progressKey(row.course_slug, row.lesson_slug), row
        ]));
      }
    }

    const requestedCourse = new URLSearchParams(window.location.search).get("course") || "";
    selectedCourseSlug = allowedCourses.some(course => course.course_slug === requestedCourse)
      ? requestedCourse
      : "";

    if (requestedCourse && !selectedCourseSlug) {
      show("لا يملك هذا الحساب صلاحية فتح المقرر المطلوب. يمكنك استعراض المقررات المتاحة فقط.", true);
    }

    $("coursePanel").hidden = false;
    renderCourseTabs();
    renderCourseContent(Boolean(selectedCourseSlug));
    if (selectedCourseSlug && isAdmin) {
      $("adminCourseManagerLink").href = "admin-course-manager.html?course=" + encodeURIComponent(selectedCourseSlug);
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
  $("completeLessonButton").addEventListener("click", async () => {
    const button = $("completeLessonButton");
    if (!currentLesson || button.disabled) return;
    button.disabled = true;
    button.textContent = "جارٍ حفظ الإنجاز...";
    try {
      await saveLessonProgress(currentLesson, true);
      show("تم حفظ إكمال المحاضرة في حسابك.");
    } catch (error) {
      button.disabled = false;
      button.textContent = "تم إكمال المحاضرة";
      show(error?.message || "تعذر حفظ إكمال المحاضرة. راجع صلاحية متابعة التقدم.", true);
    }
  });

  boot().catch((error) => show(error.message || "تعذر تحميل مساحتك التعليمية.", true));
})();