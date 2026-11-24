(() => {
  "use strict";

  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

  window.MA_ACADEMY_MEMBER_ACCESS_READY = (async () => {
    const anonymous = { isActiveStudent: false, coursePermissions: [] };
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) return anonymous;

    try {
      const client = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) return anonymous;

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role,status,account_state")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (profileError || !profile ||
          profile.role !== "student" ||
          profile.status !== "approved" ||
          profile.account_state !== "active") return anonymous;

      let result = await client.rpc("get_my_course_permissions_v2");
      if (result.error) {
        const migrationNotApplied = result.error.code === "PGRST202" ||
          /get_my_course_permissions_v2.*(not found|does not exist)|could not find the function/i.test(result.error.message || "");
        if (!migrationNotApplied) throw result.error;
        result = await client.rpc("get_my_active_courses_v2");
      }
      if (result.error) throw result.error;

      return {
        isActiveStudent: true,
        coursePermissions: Array.isArray(result.data) ? result.data : []
      };
    } catch (error) {
      console.warn("Academy member context could not be loaded:", error?.message || error);
      return anonymous;
    }
  })();
})();