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
        location.href = "student-space.html";
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
