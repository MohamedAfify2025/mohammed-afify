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
      accountLink.href = "student-space.html";
      accountLink.setAttribute("aria-label", "فتح المساحة التعليمية للمدير");
    }

    if (joinLink) {
      joinLink.href = "student-space.html";
      joinLink.setAttribute("aria-label", "فتح كل المحتوى التعليمي");
    }
  }

  async function refreshHomeAccess() {
    if (!client || checking) return;
    checking = true;

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError || !sessionData?.session?.user?.id) {
        document.body.classList.remove("ma-admin-session");
        return;
      }

      const userId = sessionData.session.user.id;
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role,status,account_state")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError || !profile ||
          profile.role !== "admin" ||
          profile.status !== "approved" ||
          profile.account_state !== "active") {
        document.body.classList.remove("ma-admin-session");
        return;
      }

      // The database is the authority for admin status; do not trust frontend metadata.
      const { data: isAdmin, error: adminError } =
        await client.rpc("is_platform_admin");

      if (adminError || isAdmin !== true) {
        document.body.classList.remove("ma-admin-session");
        return;
      }

      enableAdminHome();
    } catch (_) {
      // Fail closed: visitors retain the normal public course-request notice.
      document.body.classList.remove("ma-admin-session");
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