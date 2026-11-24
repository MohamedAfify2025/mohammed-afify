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

  function requestedDestination() {
    const candidate = new URLSearchParams(window.location.search).get("next") || "";
    if (!candidate || candidate.length > 700) return "";
    try {
      const base = new URL(".", window.location.href);
      const target = new URL(candidate, base);
      if (target.origin !== window.location.origin || !target.pathname.startsWith(base.pathname)) return "";
      const relative = target.pathname.slice(base.pathname.length);
      const allowed = /^(?:student-space|course-preview|admin-dashboard|admin-course-manager|admin-students|admin-subscriptions|lesson-admin-upload)\.html$/.test(relative) ||
        /^academy\/[a-z0-9-]+\.html$/i.test(relative);
      return allowed ? target.pathname + target.search + target.hash : "";
    } catch (_) {
      return "";
    }
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

        const destination = requestedDestination();
        const { data: profile, error: profileError } = await client
          .from("profiles")
          .select("role,status,account_state")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const isAdminProfile = profile?.role === "admin" &&
          profile.status === "approved" &&
          profile.account_state === "active";

        if (isAdminProfile) {
          const { data: isAdmin, error: adminError } = await client.rpc("is_platform_admin");
          if (adminError) throw adminError;
          if (isAdmin === true) {
            let adminTarget = destination || "admin-dashboard.html";
            if (adminTarget.endsWith("/admin-course-manager.html") || adminTarget.startsWith("admin-course-manager.html")) {
              const course = new URL(adminTarget, window.location.href).searchParams.get("course");
              adminTarget = "admin-dashboard.html" + (course ? "?course=" + encodeURIComponent(course) : "");
            }
            window.location.replace(adminTarget);
            return;
          }
        }

        const isActiveStudent = profile?.role === "student" &&
          profile.status === "approved" && profile.account_state === "active";
        const destinationIsAdminOnly = destination && /\/(?:admin-dashboard|admin-course-manager|admin-students|admin-subscriptions|lesson-admin-upload)\.html$/.test(new URL(destination, window.location.href).pathname);
        if (isActiveStudent && destination && !destinationIsAdminOnly) {
          window.location.replace(destination);
          return;
        }
        if (destinationIsAdminOnly) {
          show("هذا القسم يتطلب حساب مدير معتمد. سيتم فتح مساحتك حسب صلاحيات حسابك.");
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
