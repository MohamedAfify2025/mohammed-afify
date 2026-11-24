(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let client = null;
  let isAdmin = false;

  function show(text, error = false) {
    const host = $("courseListMessage");
    host.textContent = text;
    host.className = "notice" + (error ? " error" : "");
    host.hidden = !text;
  }

  async function checkAdmin() {
    // This boolean RPC does not expose profile or subscription records to visitors.
    const { data: allowed, error } = await client.rpc("is_platform_admin");
    if (error) return false;
    return allowed === true;
  }

  function renderCourses(rows) {
    const list = $("courseList");
    list.replaceChildren();

    for (const row of rows) {
      const slugValue = String(row.course_slug || "");
      const courseQuery = "?course=" + encodeURIComponent(slugValue);
      const previewHref = "course-preview.html" + courseQuery;
      const adminHref = "admin-course-manager.html" + courseQuery;
      const subscribeHref = "student-subscribe.html" + courseQuery;
      const openHref = isAdmin ? adminHref : previewHref;

      const card = document.createElement("article");
      card.className = "course-card site-clickable-surface";
      card.dataset.siteClickAction = "href";
      card.dataset.siteClickHref = openHref;
      card.tabIndex = 0;
      card.setAttribute("role", "group");
      card.setAttribute("aria-label", (isAdmin ? "فتح محتوى " : "استعراض ") + (row.title || slugValue || "الدورة"));

      const title = document.createElement("h2");
      title.textContent = row.title || slugValue || "دورة تعليمية";

      const slug = document.createElement("small");
      slug.textContent = slugValue;

      const actions = document.createElement("div");
      actions.className = "course-card-actions";

      const browse = document.createElement("a");
      browse.className = "course-card-browse";
      browse.href = openHref;
      browse.textContent = isAdmin ? "دخول المحتوى بصلاحيات المدير" : "تصفح الدورة";
      browse.setAttribute("aria-label", (isAdmin ? "فتح محتوى " : "تصفح تفاصيل ") + (row.title || slugValue || "الدورة"));

      actions.appendChild(browse);

      if (isAdmin) {
        const status = document.createElement("small");
        status.className = "course-admin-status";
        status.textContent = "وصول إداري شامل";
        actions.appendChild(status);
      } else {
        const subscribe = document.createElement("a");
        subscribe.className = "course-card-action";
        subscribe.href = subscribeHref;
        subscribe.textContent = "طلب الاشتراك في هذه الدورة";
        subscribe.setAttribute("aria-label", "طلب الاشتراك في " + (row.title || slugValue || "الدورة"));
        actions.appendChild(subscribe);
      }

      if (isAdmin) card.append(title, slug, actions);
      else card.append(title, Object.assign(document.createElement("p"), { textContent: row.description || "تفاصيل الدورة قيد الإضافة." }), slug, actions);
      list.appendChild(card);
    }

    $("courseCount").textContent = String(rows.length);
    show(isAdmin
      ? "تم التحقق من صلاحية المدير. الضغط على أي مقرر يفتح لوحة إدارته الكاملة دون صفحة الوصف العامة."
      : (rows.length
          ? "يمكنك تصفح تفاصيل كل دورة أولًا، ثم اختيار طلب الاشتراك عند رغبتك. الدروس الخاصة متاحة وفق صلاحيات حساب المتدرب."
          : "لا توجد دورات منشورة حاليًا."));
  }

  async function load() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("تعذر تحميل فهرس الدورات؛ إعداد الاتصال العام غير مكتمل.", true);
      return;
    }

    client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    isAdmin = await checkAdmin();

    let query = client
      .from("course_catalog")
      .select("course_slug,title,description")
      .order("title");
    if (!isAdmin) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw error;
    renderCourses(Array.isArray(data) ? data : []);
  }

  $("retryCourses").addEventListener("click", () => {
    show("جارٍ تحميل الدورات...");
    load().catch(error => show(error.message || "تعذر تحميل الدورات.", true));
  });

  load().catch(error => show(error.message || "تعذر تحميل الدورات.", true));
})();
