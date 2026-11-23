(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

  function show(text, error = false) {
    const host = $("courseListMessage");
    host.textContent = text;
    host.className = "notice" + (error ? " error" : "");
    host.hidden = !text;
  }

  function renderCourses(rows) {
    const list = $("courseList");
    list.replaceChildren();
    for (const row of rows) {
      const card = document.createElement("article");
      card.className = "course-card";
      const title = document.createElement("h2");
      title.textContent = row.title || row.course_slug || "دورة تعليمية";
      const description = document.createElement("p");
      description.textContent = row.description || "تفاصيل الدورة قيد الإضافة.";
      const slug = document.createElement("small");
      slug.textContent = row.course_slug || "";
      card.append(title, description, slug);
      list.appendChild(card);
    }
    $("courseCount").textContent = String(rows.length);
    show(rows.length ? "يمكنك تصفح جميع الدورات ومعلوماتها التعريفية. الدروس الخاصة متاحة وفق صلاحيات حساب المتدرب." : "لا توجد دورات منشورة حاليًا.");
  }

  async function load() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("تعذر تحميل فهرس الدورات؛ إعداد الاتصال العام غير مكتمل.", true);
      return;
    }
    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data, error } = await client
      .from("course_catalog")
      .select("course_slug,title,description")
      .eq("is_active", true)
      .order("title");
    if (error) throw error;
    renderCourses(Array.isArray(data) ? data : []);
  }

  $("retryCourses").addEventListener("click", () => {
    show("جارٍ تحميل الدورات...");
    load().catch(error => show(error.message || "تعذر تحميل الدورات.", true));
  });

  load().catch(error => show(error.message || "تعذر تحميل الدورات.", true));
})();
