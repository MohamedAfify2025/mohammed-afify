(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const BUCKET = "private-course-lessons";
  let client = null;
  let courses = [];
  let lessons = [];
  let selectedSlug = "";

  function message(text, error = false) {
    const host = $("pageMessage");
    host.textContent = text;
    host.className = "notice" + (error ? " error" : "");
    host.hidden = !text;
  }

  function validSlug(value, max = 100) {
    return typeof value === "string" &&
      value.length > 0 && value.length <= max &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  }

  function setBusy(button, busy, text) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? text : button.dataset.originalText;
  }

  async function verifyAdmin() {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!userData?.user) {
      const next = "admin-course-manager.html" + window.location.search;
      window.location.replace("student-login.html?next=" + encodeURIComponent(next));
      return false;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin" || profile.status !== "approved" || profile.account_state !== "active") {
      message("هذا القسم مخصص لمدير المنصة المعتمد والنشط فقط.", true);
      return false;
    }

    const { data: allowed, error: adminError } = await client.rpc("is_platform_admin");
    if (adminError) throw adminError;
    if (allowed !== true) {
      message("تعذر تأكيد صلاحية الإدارة من قاعدة البيانات.", true);
      return false;
    }
    return true;
  }

  function fillCourseSelects() {
    const main = $("courseSelect");
    const lesson = $("lessonCourse");
    const options = courses.map((course) => {
      const option = document.createElement("option");
      option.value = course.course_slug;
      option.textContent = course.title + (course.is_active ? "" : " — غير نشط");
      return option;
    });
    main.replaceChildren(...options.map((option) => option.cloneNode(true)));
    lesson.replaceChildren(...options.map((option) => option.cloneNode(true)));
    if (selectedSlug && courses.some((course) => course.course_slug === selectedSlug)) {
      main.value = selectedSlug;
      lesson.value = selectedSlug;
    } else if (courses.length) {
      main.value = courses[0].course_slug;
      lesson.value = courses[0].course_slug;
      selectedSlug = courses[0].course_slug;
    }
  }

  async function loadCourses() {
    const { data, error } = await client
      .from("course_catalog")
      .select("course_slug,title,description,is_active")
      .order("title");
    if (error) throw error;
    courses = Array.isArray(data) ? data : [];
    const requested = new URLSearchParams(window.location.search).get("course");
    if (!selectedSlug || !courses.some((course) => course.course_slug === selectedSlug)) {
      selectedSlug = requested && courses.some((course) => course.course_slug === requested)
        ? requested
        : (courses[0]?.course_slug || "");
    }
    fillCourseSelects();
    if (selectedSlug) await loadSelectedCourse();
    else resetCourseForm();
  }

  function resetCourseForm() {
    $("courseForm").reset();
    $("courseSlug").readOnly = false;
    $("courseActive").checked = true;
    $("saveCourseButton").textContent = "إضافة المقرر";
    $("courseSelect").value = "";
    $("lessonCourse").value = "";
    $("lessonList").replaceChildren();
    $("lessonList").innerHTML = '<div class="empty">أضف أول مقرر لبدء إدارة المحتوى.</div>';
  }

  async function loadSelectedCourse() {
    const course = courses.find((item) => item.course_slug === selectedSlug);
    if (!course) return;
    $("courseSelect").value = selectedSlug;
    $("lessonCourse").value = selectedSlug;
    $("courseSlug").value = course.course_slug;
    $("courseSlug").readOnly = true;
    $("courseTitle").value = course.title || "";
    $("courseDescription").value = course.description || "";
    $("courseActive").checked = course.is_active === true;
    $("saveCourseButton").textContent = "حفظ بيانات المقرر";
    $("openCourseContent").href = "student-space.html?course=" + encodeURIComponent(selectedSlug);
    await loadLessons();
  }

  async function loadLessons() {
    const { data, error } = await client
      .from("course_lessons")
      .select("id,course_slug,lesson_slug,title,description,storage_bucket,storage_path,sort_order,is_published,created_at")
      .eq("course_slug", selectedSlug)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    lessons = Array.isArray(data) ? data : [];
    renderLessons();
  }

  function renderLessons() {
    const host = $("lessonList");
    host.replaceChildren();
    if (!lessons.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "لا توجد محاضرات مسجلة لهذا المقرر حتى الآن. يمكنك إضافة أول محاضرة من النموذج أعلاه.";
      host.appendChild(empty);
      return;
    }

    for (const item of lessons) {
      const row = document.createElement("article");
      row.className = "lesson-row";
      const details = document.createElement("div");
      const title = document.createElement("div");
      title.className = "lesson-title";
      title.textContent = item.title || item.lesson_slug;
      const meta = document.createElement("div");
      meta.className = "lesson-meta";
      meta.textContent = item.lesson_slug + " · الترتيب " + item.sort_order + (item.storage_path ? " · " + item.storage_path : "");
      const state = document.createElement("span");
      state.className = "status" + (item.is_published ? " published" : "");
      state.textContent = item.is_published ? "منشورة للطلاب" : "مسودة / غير منشورة";
      details.append(title, meta, state);

      const actions = document.createElement("div");
      actions.className = "lesson-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "تعديل";
      edit.addEventListener("click", () => fillLessonForm(item));

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = item.is_published ? "secondary" : "primary";
      toggle.textContent = item.is_published ? "إلغاء النشر" : "نشر للطلاب";
      toggle.addEventListener("click", () => togglePublication(item, toggle));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "حذف";
      remove.addEventListener("click", () => deleteLesson(item, remove));

      actions.append(edit, toggle, remove);
      row.append(details, actions);
      host.appendChild(row);
    }
  }

  function fillLessonForm(item) {
    $("lessonCourse").value = item.course_slug;
    $("lessonCourse").disabled = true;
    $("lessonSlug").value = item.lesson_slug;
    $("lessonSlug").readOnly = true;
    $("lessonTitle").value = item.title || "";
    $("lessonDescription").value = item.description || "";
    $("lessonSort").value = item.sort_order || 1;
    $("lessonPublish").checked = item.is_published === true;
    $("lessonFile").value = "";
    $("saveLessonButton").textContent = "حفظ تعديل المحاضرة";
    $("lessonForm").dataset.editId = item.id;
    $("lessonForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetLessonForm() {
    $("lessonForm").reset();
    $("lessonSlug").readOnly = false;
    $("lessonCourse").disabled = false;
    $("lessonSort").value = "1";
    $("saveLessonButton").textContent = "حفظ المحاضرة";
    delete $("lessonForm").dataset.editId;
    if (selectedSlug) $("lessonCourse").value = selectedSlug;
  }

  async function saveCourse(event) {
    event.preventDefault();
    const slug = $("courseSlug").value.trim().toLowerCase();
    const title = $("courseTitle").value.trim();
    const description = $("courseDescription").value.trim();
    const isActive = $("courseActive").checked;
    const button = $("saveCourseButton");

    if (!validSlug(slug, 80)) return message("رمز المقرر يجب أن يتكون من أحرف إنجليزية صغيرة وأرقام وشرطات فقط.", true);
    if (title.length < 2) return message("اكتب اسمًا واضحًا للمقرر.", true);

    setBusy(button, true, "جارٍ الحفظ...");
    try {
      const exists = courses.some((course) => course.course_slug === slug);
      const result = exists
        ? await client.from("course_catalog").update({ title, description, is_active: isActive, updated_at: new Date().toISOString() }).eq("course_slug", slug)
        : await client.from("course_catalog").insert({ course_slug: slug, title, description, is_active: isActive });
      if (result.error) throw result.error;

      selectedSlug = slug;
      await loadCourses();
      message(exists ? "تم حفظ بيانات المقرر." : "تم إنشاء المقرر الجديد.");
    } catch (error) {
      message(error.message || "تعذر حفظ بيانات المقرر.", true);
    } finally {
      setBusy(button, false);
    }
  }

  async function saveLesson(event) {
    event.preventDefault();
    const courseSlug = $("lessonCourse").value;
    const lessonSlug = $("lessonSlug").value.trim().toLowerCase();
    const title = $("lessonTitle").value.trim();
    const description = $("lessonDescription").value.trim();
    const sortOrder = Number($("lessonSort").value);
    const isPublished = $("lessonPublish").checked;
    const file = $("lessonFile").files?.[0] || null;
    const editId = $("lessonForm").dataset.editId || "";
    const button = $("saveLessonButton");

    if (!courses.some((course) => course.course_slug === courseSlug)) return message("اختر مقررًا صحيحًا.", true);
    if (!editId && lessons.some((item) => item.course_slug === courseSlug && item.lesson_slug === lessonSlug)) {
      return message("رمز هذه المحاضرة مستخدم بالفعل داخل المقرر. اختر رمزًا آخر أو افتح المحاضرة الحالية للتعديل.", true);
    }
    if (!validSlug(lessonSlug)) return message("رمز المحاضرة يجب أن يتكون من أحرف إنجليزية صغيرة وأرقام وشرطات فقط.", true);
    if (title.length < 2) return message("اكتب عنوانًا واضحًا للمحاضرة.", true);
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 9999) return message("ترتيب المحاضرة يجب أن يكون رقمًا من 1 إلى 9999.", true);
    if (file && (!file.name.toLowerCase().endsWith(".html") || file.size > 10 * 1024 * 1024)) {
      return message("اختر ملف HTML صالحًا لا يتجاوز حجمه 10 ميجابايت.", true);
    }
    if (!editId && !file) return message("اختر ملف HTML للمحاضرة الجديدة.", true);

    setBusy(button, true, "جارٍ حفظ المحاضرة...");
    try {
      const existingLesson = editId ? lessons.find((item) => item.id === editId) : null;
      const storageBucket = existingLesson?.storage_bucket || BUCKET;
      const storagePath = existingLesson?.storage_path || (courseSlug + "/" + lessonSlug + ".html");
      if (file) {
        const { error: uploadError } = await client.storage.from(storageBucket).upload(storagePath, file, {
          upsert: true,
          contentType: "text/html"
        });
        if (uploadError) throw uploadError;
      }

      const values = {
        course_slug: courseSlug,
        lesson_slug: lessonSlug,
        title,
        description,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        content_type: "text/html",
        file_size_bytes: file?.size || undefined,
        is_published: isPublished,
        sort_order: sortOrder,
        updated_at: new Date().toISOString()
      };

      let result;
      if (editId) {
        result = await client.from("course_lessons").update(values).eq("id", editId);
      } else {
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData?.user) throw userError || new Error("تعذر التحقق من جلسة المدير.");
        result = await client.from("course_lessons").insert({ ...values, created_by: userData.user.id });
      }
      if (result.error) throw result.error;

      selectedSlug = courseSlug;
      await loadLessons();
      resetLessonForm();
      message(editId ? "تم تحديث المحاضرة وبياناتها." : "تمت إضافة المحاضرة بنجاح.");
    } catch (error) {
      message(error.message || "تعذر حفظ المحاضرة.", true);
    } finally {
      setBusy(button, false);
    }
  }

  async function togglePublication(item, button) {
    setBusy(button, true, "جارٍ التحديث...");
    try {
      const { error } = await client.from("course_lessons")
        .update({ is_published: !item.is_published, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;
      await loadLessons();
      message(item.is_published ? "تم إلغاء نشر المحاضرة؛ تظل متاحة للمدير." : "تم نشر المحاضرة للطلاب المصرّح لهم.");
    } catch (error) {
      message(error.message || "تعذر تغيير حالة النشر.", true);
    } finally {
      setBusy(button, false);
    }
  }

  async function deleteLesson(item, button) {
    if (!window.confirm("هل تريد حذف المحاضرة وملفها نهائيًا؟")) return;
    setBusy(button, true, "جارٍ الحذف...");
    try {
      const { error: storageError } = await client.storage.from(item.storage_bucket).remove([item.storage_path]);
      if (storageError) throw storageError;
      const { error } = await client.from("course_lessons").delete().eq("id", item.id);
      if (error) throw error;
      await loadLessons();
      resetLessonForm();
      message("تم حذف المحاضرة وملفها من التخزين الخاص.");
    } catch (error) {
      message(error.message || "تعذر حذف المحاضرة.", true);
    } finally {
      setBusy(button, false);
    }
  }

  async function boot() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      message("إعداد الاتصال بالمنصة غير مكتمل.", true);
      return;
    }

    client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const allowed = await verifyAdmin();
    if (!allowed) return;

    await loadCourses();
    $("managerContent").hidden = false;
    if (!courses.length) message("تم التحقق من المدير. ابدأ بإضافة أول مقرر ثم أضف المحاضرات.");
    else message("تم التحقق من صلاحية المدير. لديك تحكم كامل في جميع المقررات والمحاضرات والملفات المنشورة والمسودات.");
  }

  $("courseSelect").addEventListener("change", () => {
    selectedSlug = $("courseSelect").value;
    loadSelectedCourse().catch((error) => message(error.message || "تعذر تحميل المقرر.", true));
  });
  $("lessonCourse").addEventListener("change", () => {
    if (!$("lessonForm").dataset.editId) {
      selectedSlug = $("lessonCourse").value;
      $("courseSelect").value = selectedSlug;
      loadSelectedCourse().catch((error) => message(error.message || "تعذر تحميل المقرر.", true));
    }
  });
  $("courseForm").addEventListener("submit", saveCourse);
  $("lessonForm").addEventListener("submit", saveLesson);
  $("newCourseButton").addEventListener("click", () => {
    $("courseForm").reset();
    $("courseSlug").readOnly = false;
    $("courseActive").checked = true;
    $("courseSlug").value = "";
    $("courseTitle").value = "";
    $("courseDescription").value = "";
    $("saveCourseButton").textContent = "إضافة المقرر";
    $("courseSlug").focus();
  });
  $("resetLessonButton").addEventListener("click", resetLessonForm);
  $("logoutButton").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    window.location.replace("student-login.html");
  });

  boot().catch((error) => message(error.message || "تعذر فتح إدارة المقررات.", true));
})();
