(() => {
  "use strict";
  const cfg = window.MEMBERSHIP_CONFIG || {};
  const apiUrl = String(cfg.supabaseUrl || "").trim();
  const publicKey = String(cfg.supabasePublishableKey || cfg.supabaseAnonKey || "").trim();
  const courseSlug = "business-administration";
  const main = document.querySelector("main");
  const statusBox = document.getElementById("baAccessStatus");

  function reveal(message = "", isAdmin = false) {
    document.documentElement.classList.remove("ba-access-checking");
    if (statusBox && message) {
      statusBox.hidden = false;
      statusBox.textContent = message;
      statusBox.classList.toggle("admin", isAdmin);
    }
    if (isAdmin) {
      const link = document.getElementById("baAdminDashboardLink");
      if (link) link.hidden = false;
    }
  }

  function deny(message) {
    document.documentElement.classList.remove("ba-access-checking");
    if (!main) return;
    main.replaceChildren();
    const card = document.createElement("section");
    card.className = "ba-panel";
    const heading = document.createElement("h1");
    heading.textContent = "المحتوى غير متاح لهذا الحساب";
    const text = document.createElement("p");
    text.textContent = message;
    const link = document.createElement("a");
    link.className = "ba-button primary";
    link.href = "../student-space.html";
    link.textContent = "العودة إلى مساحتي التعليمية";
    card.append(heading, text, link);
    main.appendChild(card);
  }

  function login() {
    const next = encodeURIComponent("academy/business-administration.html");
    window.location.replace("../student-login.html?next=" + next);
  }

  async function boot() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(apiUrl) ||
        !window.isMembershipPublicKey?.(publicKey)) {
      deny("تعذر إعداد الاتصال الآمن بالمنصة. حدّث الصفحة أو تواصل مع مدير النظام.");
      return;
    }

    const client = window.supabase.createClient(apiUrl, publicKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!userData?.user) {
      login();
      return;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      deny("لم يتم العثور على ملف الحساب. سجّل الخروج ثم ادخل مرة أخرى.");
      return;
    }

    if (profile.role === "admin") {
      const { data: isAdmin, error: adminError } = await client.rpc("is_platform_admin");
      if (adminError) throw adminError;
      if (isAdmin === true) {
        reveal("تم التحقق من صلاحية مدير المنصة. يمكنك استعراض محتوى الإدارة والأعمال كاملًا.", true);
        return;
      }
      deny("حساب المدير غير نشط أو لم يتم اعتماد صلاحياته في قاعدة البيانات.");
      return;
    }

    if (profile.role !== "student" || profile.status !== "approved" || profile.account_state !== "active") {
      deny("هذه الدورة متاحة للمدير أو للمتدرب المعتمد الذي لديه صلاحية مشاهدة مقرر الإدارة والأعمال.");
      return;
    }

    let permissionResult = await client.rpc("get_my_course_permissions_v2");
    if (permissionResult.error &&
        (permissionResult.error.code === "PGRST202" ||
         /get_my_course_permissions_v2.*(not found|does not exist)|could not find the function/i.test(permissionResult.error.message || ""))) {
      permissionResult = await client.rpc("get_my_active_courses_v2");
    }
    if (permissionResult.error) throw permissionResult.error;
    const permission = (Array.isArray(permissionResult.data) ? permissionResult.data : []).find((item) =>
      item.course_slug === courseSlug && (item.can_view_course_page === true || typeof item.can_view_course_page === "undefined")
    );
    if (!permission) {
      deny("لا توجد صلاحية مشاهدة مفعّلة لمقرر الإدارة والأعمال في اشتراكك الحالي. راجع إدارة الاشتراكات.");
      return;
    }

    reveal("مرحبًا بك في مسار الإدارة والأعمال. صلاحية الدورة مفعّلة لحسابك.");
  }

  boot().catch((error) => {
    deny(error?.message || "تعذر التحقق من صلاحيات الحساب.");
  });
})();
