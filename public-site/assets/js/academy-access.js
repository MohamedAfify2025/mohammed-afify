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
      const slugValue = String(row.course_slug || "");
      const courseQuery = "?course=" + encodeURIComponent(slugValue);
      const previewHref = "course-preview.html" + courseQuery;
      const subscribeHref = "student-subscribe.html" + courseQuery;

      const card = document.createElement("article");
      card.className = "course-card site-clickable-surface";
      card.dataset.siteClickAction = "href";
      card.dataset.siteClickHref = previewHref;
      card.tabIndex = 0;
      card.setAttribute("role", "group");
      card.setAttribute("aria-label", "استعراض دورة " + (row.title || slugValue || "تعليمية"));

      const title = document.createElement("h2");
      title.textContent = row.title || slugValue || "دورة تعليمية";

      const description = document.createElement("p");
      description.textContent = row.description || "تفاصيل الدورة قيد الإضافة.";

      const slug = document.createElement("small");
      slug.textContent = slugValue;

      const actions = document.createElement("div");
      actions.className = "course-card-actions";

      const browse = document.createElement("a");
      browse.className = "course-card-browse";
      browse.href = previewHref;
      browse.textContent = "تصفح الدورة";
      browse.setAttribute("aria-label", "تصفح تفاصيل " + (row.title || slugValue || "الدورة"));

      const subscribe = document.createElement("a");
      subscribe.className = "course-card-action";
      subscribe.href = subscribeHref;
      subscribe.textContent = "طلب الاشتراك في هذه الدورة";
      subscribe.setAttribute("aria-label", "طلب الاشتراك في " + (row.title || slugValue || "الدورة"));

      actions.append(browse, subscribe);
      card.append(title, description, slug, actions);
      list.appendChild(card);
    }
    $("courseCount").textContent = String(rows.length);
    show(rows.length
      ? "يمكنك تصفح تفاصيل كل دورة أولًا، ثم اختيار طلب الاشتراك عند رغبتك. الدروس الخاصة متاحة وفق صلاحيات حساب المتدرب."
      : "لا توجد دورات منشورة حاليًا.");
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
