(() => {
  "use strict";

  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

  window.MA_ACADEMY_MEMBER_ACCESS_READY = (async () => {
    const anonymous = {
      isSignedIn: false,
      profile: null,
      isActiveStudent: false,
      coursePermissions: []
    };
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) return anonymous;

    let context = anonymous;
    try {
      const client = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData?.user) return anonymous;

      // Preserve signed-in state even if the own-profile lookup temporarily fails.
      context = {
        isSignedIn: true,
        profile: null,
        isActiveStudent: false,
        coursePermissions: []
      };

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role,status,account_state")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      // Only return the signed-in user's own role/status; never expose another member's data.
      context.profile = profile ? {
        role: profile.role,
        status: profile.status,
        account_state: profile.account_state
      } : null;

      if (!profile ||
          profile.role !== "student" ||
          profile.status !== "approved" ||
          profile.account_state !== "active") return context;

      let result = await client.rpc("get_my_course_permissions_v2");
      if (result.error) {
        const migrationNotApplied = result.error.code === "PGRST202" ||
          /get_my_course_permissions_v2.*(not found|does not exist)|could not find the function/i.test(result.error.message || "");
        if (!migrationNotApplied) throw result.error;
        result = await client.rpc("get_my_active_courses_v2");
      }
      if (result.error) throw result.error;

      context.isActiveStudent = true;
      context.coursePermissions = Array.isArray(result.data) ? result.data : [];
      return context;
    } catch (error) {
      console.warn("Academy member context could not be loaded:", error?.message || error);
      return context;
    }
  })();
})();
