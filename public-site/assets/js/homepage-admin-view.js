(() => {
  "use strict";

  const config = window.MEMBERSHIP_CONFIG || {};
  const projectUrl = String(config.supabaseUrl || "").trim();
  const publishableKey = String(
    config.supabasePublishableKey || config.supabaseAnonKey || ""
  ).trim();

  let client = null;
  let checking = false;

  function isConfigured() {
    return Boolean(
      window.supabase?.createClient &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl) &&
      window.isMembershipPublicKey?.(publishableKey) === true
    );
  }

  function enableAdminHome() {
    document.body.classList.add("ma-admin-session");

    const accountLink = document.getElementById("maAccountLink");
    const joinLink = document.getElementById("maJoinLink");

    if (accountLink) {
      accountLink.href = "admin-dashboard.html";
      accountLink.setAttribute("aria-label", "فتح لوحة إدارة المنصة الشاملة");
    }

    if (joinLink) {
      joinLink.href = "admin-dashboard.html";
      joinLink.setAttribute("aria-label", "فتح لوحة إدارة المنصة الشاملة");
    }
  }

  function enableStudentHome() {
    const accountLink = document.getElementById("maAccountLink");
    const joinLink = document.getElementById("maJoinLink");

    if (accountLink) {
      accountLink.href = "student-space.html";
      accountLink.setAttribute("aria-label", "فتح مساحتي التعليمية");
    }

    if (joinLink) {
      joinLink.href = "student-space.html";
      joinLink.setAttribute("aria-label", "متابعة التعلّم في مساحتي التعليمية");
    }
  }

  function resetGuestHome() {
    document.body.classList.remove("ma-admin-session");
    const accountLink = document.getElementById("maAccountLink");
    const joinLink = document.getElementById("maJoinLink");
    if (accountLink) {
      accountLink.href = "student-login.html";
      accountLink.setAttribute("aria-label", "تسجيل الدخول إلى حسابي");
    }
    if (joinLink) {
      joinLink.href = "student-login.html";
      joinLink.setAttribute("aria-label", "ابدأ التعلّم");
    }
  }

  async function refreshHomeAccess() {
    if (!client || checking) return;
    checking = true;

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError || !sessionData?.session?.user?.id) {
        resetGuestHome();
        return;
      }

      const userId = sessionData.session.user.id;
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role,status,account_state")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError || !profile) {
        resetGuestHome();
        return;
      }

      if (profile.role === "student") {
        enableStudentHome();
        return;
      }

      if (profile.role !== "admin" ||
          profile.status !== "approved" ||
          profile.account_state !== "active") {
        resetGuestHome();
        return;
      }

      // The database is the authority for admin status; do not trust frontend metadata.
      const { data: isAdmin, error: adminError } =
        await client.rpc("is_platform_admin");

      if (adminError || isAdmin !== true) {
        resetGuestHome();
        return;
      }

      enableAdminHome();
    } catch (_) {
      // Fail closed: visitors retain the normal public course-request notice.
      resetGuestHome();
    } finally {
      checking = false;
    }
  }

  if (!isConfigured()) return;

  client = window.supabase.createClient(projectUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  refreshHomeAccess();

  client.auth.onAuthStateChange((event) => {
    if (["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
      refreshHomeAccess();
    }
  });
})();