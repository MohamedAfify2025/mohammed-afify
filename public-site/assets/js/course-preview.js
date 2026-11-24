(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const slug = String(new URLSearchParams(window.location.search).get("course") || "").trim();

  function showMessage(message, isError = false) {
    const host = $("courseMessage");
    host.textContent = message;
    host.classList.toggle("error", isError);
    host.hidden = !message;
  }

  async function redirectMemberToLearning(client) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const user = userData?.user;
    if (!user) return false;

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const activeProfile = profile?.status === "approved" && profile?.account_state === "active";
    if (!activeProfile) return false;

    if (profile.role === "admin") {
      const { data: allowed, error: adminError } = await client.rpc("is_platform_admin");
      if (adminError) throw adminError;
      if (allowed !== true) return false;
      // Odoo has a self-contained introductory presentation; keep it visible.
      if (slug === "odoo-training") return false;
      window.location.replace("student-space.html?course=" + encodeURIComponent(slug));
      return true;
    }

    if (profile.role !== "student") return false;

    let permissionsResult = await client.rpc("get_my_course_permissions_v2");
    if (permissionsResult.error) {
      const migrationNotApplied = permissionsResult.error.code === "PGRST202" ||
        /get_my_course_permissions_v2.*(not found|does not exist)|could not find the function/i.test(permissionsResult.error.message || "");
      if (!migrationNotApplied) throw permissionsResult.error;
      permissionsResult = await client.rpc("get_my_active_courses_v2");
    }
    if (permissionsResult.error) throw permissionsResult.error;

    const permission = (Array.isArray(permissionsResult.data) ? permissionsResult.data : [])
      .find(item => item.course_slug === slug && item.can_view_course_page === true);
    if (!permission) return false;

    if (slug === "odoo-training") return false;
    if (slug === "business-administration") {
      window.location.replace("academy/business-administration.html");
      return true;
    }

    window.location.replace("student-space.html?course=" + encodeURIComponent(slug));
    return true;
  }

  async function loadCourse() {
    if (!slug || slug.length > 120) {
      showMessage("رابط الدورة غير مكتمل. ارجع إلى مكتبة الدورات لاختيار دورة.", true);
      $("courseNotFound").hidden = false;
      return;
    }
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      showMessage("تعذر تحميل معلومات الدورة؛ إعداد الاتصال العام غير مكتمل.", true);
      return;
    }

    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    // A verified active administrator goes straight to the full course workspace,
    // not the visitor-facing description page.
    const redirected = await redirectMemberToLearning(client);
    if (redirected) return;

    const { data, error } = await client
      .from("course_catalog")
      .select("course_slug,title,description")
      .eq("course_slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      showMessage("لم نعثر على دورة منشورة بهذا الرابط.", true);
      $("courseNotFound").hidden = false;
      return;
    }

    const title = data.title || data.course_slug || "دورة تعليمية";
    $("courseTitle").textContent = title;
    $("courseDescription").textContent = data.description || "لم تُضف الإدارة وصفًا تفصيليًا لهذه الدورة بعد.";
    $("subscribeLink").href = "student-subscribe.html?course=" + encodeURIComponent(data.course_slug);
    document.title = title + " | Mohammed Afify Learning";
    $("courseDetails").hidden = false;

    if (data.course_slug === "odoo-training") {
      const introSection = $("odooIntroPresentation");
      const introFrame = $("odooIntroFrame");
      if (introSection && introFrame) {
        introFrame.src = introFrame.dataset.src || "odoo-training-intro.html";
        introSection.hidden = false;
      }
    }

    showMessage("تم تحميل معلومات الدورة بنجاح.");
  }

  loadCourse().catch((error) => {
    showMessage(error?.message || "تعذر تحميل معلومات الدورة الآن. أعد المحاولة أو ارجع إلى مكتبة الدورات.", true);
  });
})();
