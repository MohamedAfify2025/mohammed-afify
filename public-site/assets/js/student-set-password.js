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
        !(key.startsWith("sb_publishable_") || key.startsWith("eyJ"))) {
      show("لم يتم إعداد بوابة الدخول على مشروع Supabase بعد. تواصل مع إدارة المنصة.", true);
      return;
    }

    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const params = new URLSearchParams(location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (tokenHash && type === "invite") {
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
      if (error) {
        show("رابط الدعوة غير صالح أو انتهت صلاحيته. اطلب من الإدارة إعادة إرسال الدعوة.", true);
        return;
      }
      history.replaceState({}, document.title, location.pathname);
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      show("تعذر التحقق من رابط الدعوة. افتح الرابط مرة أخرى أو اطلب دعوة جديدة.", true);
      return;
    }
    if (!data.session) {
      show("افتح رابط الدعوة الأصلي من بريدك الإلكتروني باستخدام هذا المتصفح. إذا انتهت صلاحيته، اطلب دعوة جديدة.", true);
      return;
    }

    $("studentEmail").textContent = data.session.user.email || "";
    $("passwordForm").hidden = false;
    show("تم التحقق من الدعوة. اختر كلمة مرور خاصة بك.");
    $("passwordForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = $("newPassword").value;
      const confirmation = $("confirmPassword").value;
      if (password.length < 10) return show("كلمة المرور يجب ألا تقل عن 10 أحرف.", true);
      if (password !== confirmation) return show("تأكيد كلمة المرور غير مطابق.", true);

      const button = $("savePasswordButton");
      button.disabled = true;
      try {
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;
        show("تم إعداد كلمة المرور بنجاح. سيتم فتح مساحتك التعليمية.");
        setTimeout(() => { location.href = "student-space.html"; }, 900);
      } catch (updateError) {
        show(updateError.message || "تعذر حفظ كلمة المرور.", true);
      } finally {
        button.disabled = false;
      }
    });
  }

  boot().catch(() => show("تعذر تفعيل الدعوة. تواصل مع إدارة المنصة.", true));
})();
