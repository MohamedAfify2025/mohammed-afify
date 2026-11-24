(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

  function show(text, isError = false) {
    const el = $("pageMessage");
    el.textContent = text;
    el.className = "notice " + (isError ? "error" : "success");
    el.hidden = !text;
  }

  function requestedAdminDestination() {
    const candidate = new URLSearchParams(window.location.search).get("next") || "";
    const match = candidate.match(/^(admin-course-manager\.html|admin-students\.html|admin-subscriptions\.html|lesson-admin-upload\.html)(\?course=([a-z0-9-]+))?$/);
    return match ? candidate : "";
  }

  async function boot() {
    if (!window.supabase?.createClient || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("بوابة الدخول لم تُربط بمشروع Supabase بعد.", true);
      return;
    }

    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    $("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $("loginButton");
      button.disabled = true;
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: $("email").value.trim().toLowerCase(),
          password: $("password").value
        });
        if (error) throw error;
        if (!data.user) throw new Error("تعذر التحقق من الحساب.");

        const destination = requestedAdminDestination();
        if (destination) {
          const { data: profile, error: profileError } = await client
            .from("profiles")
            .select("role,status,account_state")
            .eq("user_id", data.user.id)
            .maybeSingle();
          if (profileError) throw profileError;
          if (profile?.role === "admin" && profile.status === "approved" && profile.account_state === "active") {
            const { data: isAdmin, error: adminError } = await client.rpc("is_platform_admin");
            if (adminError) throw adminError;
            if (isAdmin === true) {
              window.location.replace(destination);
              return;
            }
          }
          show("تم تسجيل الدخول، لكن هذا القسم يتطلب حساب مدير معتمد. سيتم فتح مساحتك حسب صلاحيات حسابك.");
        }
        window.location.replace("student-space.html");
      } catch (error) {
        show("تعذر تسجيل الدخول. راجع البريد وكلمة المرور أو استخدم استعادة كلمة المرور.", true);
      } finally {
        button.disabled = false;
      }
    });

    $("resetButton").addEventListener("click", async () => {
      const email = $("email").value.trim().toLowerCase();
      if (!email) return show("اكتب البريد الإلكتروني أولًا ثم اضغط استعادة كلمة المرور.", true);
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("student-set-password.html", location.href).href
        });
        if (error) throw error;
        show("إذا كان البريد مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.");
      } catch (error) {
        show(error.message || "تعذر إرسال رسالة الاستعادة.", true);
      }
    });
  }

  boot().catch(() => show("تعذر تشغيل بوابة الدخول.", true));
})();
