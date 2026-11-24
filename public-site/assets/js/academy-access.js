(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let client = null;
  let isAdmin = false;
  let isActiveStudent = false;
  let coursePermissions = [];

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

  function learningHref(slug) {
    const query = "?course=" + encodeURIComponent(slug);
    if (slug === "business-administration") return "academy/business-administration.html";
    if (slug === "odoo-training") return "course-preview.html" + query;
    return "student-space.html" + query;
  }

  let allCourses = [];
  let activeCategory = "all";
  let searchQuery = "";

  const categoryInfo = {
    programming: { label: "البرمجة", icon: "⌘" },
    data: { label: "تحليل البيانات", icon: "▥" },
    digital: { label: "المهارات الرقمية", icon: "Aa" },
    business: { label: "الإدارة والأعمال", icon: "▤" },
    erp: { label: "أنظمة ERP", icon: "◈" }
  };

  function categoryFor(slug) {
    if (slug === "odoo-training") return "erp";
    if (slug === "data-analysis") return "data";
    if (["programming", "python", "scratch"].includes(slug)) return "programming";
    if (["business-administration", "projects", "content", "accounting"].includes(slug)) return "business";
    return "digital";
  }

  function renderCourses(rows) {
    allCourses = Array.isArray(rows) ? rows : [];
    applyCourseFilters();
  }

  function applyCourseFilters() {
    const query = searchQuery.trim().toLocaleLowerCase();
    const filtered = allCourses.filter(row => {
      const slug = String(row.course_slug || "");
      const category = categoryFor(slug);
      const searchable = [
        row.title || "",
        row.description || "",
        slug,
        categoryInfo[category]?.label || ""
      ].join(" ").toLocaleLowerCase();
      return (activeCategory === "all" || category === activeCategory) &&
        (!query || searchable.includes(query));
    });

    renderCourseCards(filtered);
    $("courseCount").textContent = String(filtered.length);
    $("courseFilterSummary").textContent = query || activeCategory !== "all"
      ? "يعرض " + filtered.length + " من " + allCourses.length + " دورة حسب البحث والتصفية الحالية."
      : "تصفّح " + allCourses.length + " مسارًا تعليميًا، واختر المجال المناسب لاهتمامك.";
  }

  function renderCourseCards(rows) {
    const list = $("courseList");
    list.replaceChildren();

    for (const row of rows) {
      const slugValue = String(row.course_slug || "");
      const category = categoryFor(slugValue);
      const visual = categoryInfo[category] || categoryInfo.digital;
      const courseQuery = "?course=" + encodeURIComponent(slugValue);
      const previewHref = "course-preview.html" + courseQuery;
      const subscribeHref = "student-subscribe.html" + courseQuery;
      const permission = coursePermissions.find(item => item.course_slug === slugValue);
      const hasStudentAccess = isActiveStudent && permission?.can_view_course_page === true;
      const openHref = (isAdmin || hasStudentAccess) ? learningHref(slugValue) : previewHref;

      const card = document.createElement("article");
      card.className = "course-card catalog-course-card site-clickable-surface";
      card.dataset.siteClickAction = "href";
      card.dataset.siteClickHref = openHref;
      card.dataset.courseCategory = category;
      card.tabIndex = 0;
      card.setAttribute("role", "group");
      card.setAttribute("aria-label", (isAdmin || hasStudentAccess ? "فتح محتوى " : "استعراض ") + (row.title || slugValue || "الدورة"));

      const visualHead = document.createElement("div");
      visualHead.className = "catalog-course-visual";
      const icon = document.createElement("span");
      icon.className = "catalog-course-icon";
      icon.textContent = visual.icon;
      icon.setAttribute("aria-hidden", "true");
      const categoryLabel = document.createElement("span");
      categoryLabel.className = "catalog-course-category";
      categoryLabel.textContent = visual.label;
      visualHead.append(icon, categoryLabel);

      const title = document.createElement("h2");
      title.textContent = row.title || slugValue || "دورة تعليمية";
      const description = document.createElement("p");
      description.textContent = row.description || "استكشف معلومات هذا المسار ومتطلبات الالتحاق به من صفحة تفاصيل الدورة.";
      const slug = document.createElement("small");
      slug.className = "catalog-course-slug";
      slug.textContent = slugValue;

      const actions = document.createElement("div");
      actions.className = "course-card-actions";
      const browse = document.createElement("a");
      browse.className = "course-card-browse";
      browse.href = openHref;
      browse.textContent = isAdmin ? "فتح المقرر بصلاحيات المدير" :
        hasStudentAccess ? "متابعة التعلّم" : "استعراض تفاصيل الدورة";
      browse.setAttribute("aria-label", (isAdmin || hasStudentAccess ? "فتح محتوى " : "تصفح تفاصيل ") + (row.title || slugValue || "الدورة"));
      actions.appendChild(browse);

      if (isAdmin || hasStudentAccess) {
        const status = document.createElement("span");
        status.className = "course-access-status";
        status.textContent = isAdmin ? "وصول إداري شامل" : "متاح ضمن اشتراكك";
        actions.appendChild(status);
      } else {
        const subscribe = document.createElement("a");
        subscribe.className = "course-card-action";
        subscribe.href = subscribeHref;
        subscribe.textContent = "طلب الاشتراك";
        subscribe.setAttribute("aria-label", "طلب الاشتراك في " + (row.title || slugValue || "الدورة"));
        actions.appendChild(subscribe);
      }

      card.append(visualHead, title, description, slug, actions);
      list.appendChild(card);
    }

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "catalog-empty-state";
      const title = document.createElement("strong");
      title.textContent = "لم نعثر على دورة مطابقة";
      const hint = document.createElement("p");
      hint.textContent = "جرّب كلمة بحث أخرى أو اختر «كل المجالات» لعرض القائمة كاملة.";
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "course-card-browse";
      reset.textContent = "عرض كل الدورات";
      reset.addEventListener("click", () => {
        searchQuery = "";
        activeCategory = "all";
        $("courseSearchInput").value = "";
        updateFilterButtons();
        applyCourseFilters();
      });
      empty.append(title, hint, reset);
      list.appendChild(empty);
    }
  }

  function updateFilterButtons() {
    document.querySelectorAll("[data-course-filter]").forEach(button => {
      const active = button.dataset.courseFilter === activeCategory;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
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
    const memberContext = await (window.MA_ACADEMY_MEMBER_ACCESS_READY || Promise.resolve(null));
    isActiveStudent = memberContext?.isActiveStudent === true;
    coursePermissions = Array.isArray(memberContext?.coursePermissions)
      ? memberContext.coursePermissions
      : [];

    let query = client
      .from("course_catalog")
      .select("course_slug,title,description")
      .order("title");
    if (!isAdmin) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw error;
    renderCourses(Array.isArray(data) ? data : []);
  }

  $("courseSearchInput").addEventListener("input", () => {
    searchQuery = $("courseSearchInput").value || "";
    applyCourseFilters();
  });
  $("courseCategoryFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-course-filter]");
    if (!button) return;
    activeCategory = button.dataset.courseFilter || "all";
    updateFilterButtons();
    applyCourseFilters();
  });

  $("retryCourses").addEventListener("click", () => {
    show("جارٍ تحميل الدورات...");
    load().catch(error => show(error.message || "تعذر تحميل الدورات.", true));
  });

  load().catch(error => show(error.message || "تعذر تحميل الدورات.", true));
})();
