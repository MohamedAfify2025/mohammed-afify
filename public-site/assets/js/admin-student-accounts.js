(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").trim();
  const publicKey = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const FUNCTION_NAME = "admin-manage-student-accounts";
  let client = null;
  let courses = [];
  let accounts = [];
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function show(message, kind = "success", link = null) {
    const host = $("pageMessage");
    host.replaceChildren(document.createTextNode(message));
    host.className = "notice" + (kind === "error" ? " error" : kind === "warning" ? " warning" : "");
    if (link?.url) {
      host.appendChild(document.createElement("br"));
      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = link.label || "فتح WhatsApp وإرسال الرسالة";
      anchor.style.cssText = "display:inline-flex;margin-top:7px;color:#087c50;font-weight:900;text-decoration:underline";
      host.appendChild(anchor);
    }
    host.hidden = !message;
  }

  function selectedValues(select) {
    return [...select.selectedOptions].map((option) => option.value).filter(Boolean);
  }

  function fillCourses() {
    const select = $("courseSlugs");
    select.replaceChildren();
    for (const course of courses) {
      const option = document.createElement("option");
      option.value = course.course_slug;
      option.textContent = course.title || course.course_slug;
      select.appendChild(option);
    }
  }

  function phoneForWhatsApp(value) {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits) throw new Error("أدخل رقم WhatsApp صحيحًا.");

    let international = digits;
    if (raw.startsWith("+")) {
      international = digits;
    } else if (digits.startsWith("00")) {
      international = digits.slice(2);
    } else if (digits.startsWith("20") || digits.startsWith("966")) {
      international = digits;
    } else if (/^01[0125]\d{8}$/.test(digits)) {
      international = "20" + digits.slice(1);
    } else if (/^05\d{8}$/.test(digits)) {
      international = "966" + digits.slice(1);
    } else if (digits.startsWith("0")) {
      throw new Error("اكتب رقم مصر أو السعودية المحلي بصيغته المعروفة، أو أضف مفتاح الدولة بصيغة +.");
    }

    if (international.length < 10 || international.length > 15) {
      throw new Error("رقم WhatsApp يجب أن يتكون من 10 إلى 15 رقمًا بعد إضافة مفتاح الدولة.");
    }
    return international;
  }

  function directCourseUrl(courseSlug) {
    const base = new URL(".", window.location.href);
    const login = new URL("student-login.html", base);
    const destination = new URL("student-space.html", base);
    if (courseSlug) destination.searchParams.set("course", courseSlug);
    login.searchParams.set("next", destination.pathname.slice(base.pathname.length) + destination.search);
    return login.toString();
  }

  function whatsappLink(phone, message) {
    const digits = phoneForWhatsApp(phone);
    if (digits.length < 10 || digits.length > 15) {
      throw new Error("رقم WhatsApp غير صحيح. راجعه ثم حدّث رقم الهاتف من بيانات الطالب.");
    }
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(message);
  }

  function credentialMessage(account, password) {
    const firstCourse = account.course_slugs?.[0] || "";
    const courseName = account.course_titles?.[0] || firstCourse || "مساحتك التعليمية";
    const loginUrl = directCourseUrl(firstCourse);
    return [
      "مرحبًا " + (account.full_name || "بك") + ",",
      "تم إنشاء حسابك على منصة Mohammed Afify التعليمية.",
      "",
      "اسم المستخدم: " + account.username,
      "كلمة المرور: " + password,
      "",
      "رابط الدخول المباشر إلى " + courseName + ":",
      loginUrl,
      "",
      "احتفظ ببيانات الدخول ولا تشاركها مع أي شخص."
    ].join("\n");
  }

  async function callApi(body) {
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, { body });
    if (error) {
      const message = data?.error || error.message || "تعذر الاتصال بخدمة إدارة الحسابات.";
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "لم تكتمل العملية.");
    return data;
  }

  async function verifyAdmin() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) ||
        window.isMembershipPublicKey?.(publicKey) !== true) {
      throw new Error("إعداد الاتصال بالمنصة غير مكتمل.");
    }
    client = window.supabase.createClient(supabaseUrl, publicKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) {
      const next = "admin-student-accounts.html";
      window.location.replace("student-login.html?next=" + encodeURIComponent(next));
      return false;
    }

    const { data: isAdmin, error: adminError } = await client.rpc("is_platform_admin");
    if (adminError || isAdmin !== true) {
      window.location.replace("student-space.html");
      return false;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "admin" ||
        profile?.status !== "approved" || profile?.account_state !== "active") {
      window.location.replace("student-space.html");
      return false;
    }
    return true;
  }

  async function loadData() {
    $("refreshButton").disabled = true;
    $("accountsList").innerHTML = '<div class="empty">جارٍ تحديث الحسابات...</div>';
    try {
      const data = await callApi({ action: "list" });
      courses = Array.isArray(data.courses) ? data.courses : [];
      accounts = Array.isArray(data.accounts) ? data.accounts : [];
      fillCourses();
      renderAccounts();
    } finally {
      $("refreshButton").disabled = false;
    }
  }

  function renderAccounts() {
    $("accountCount").textContent = accounts.length + " حساب";
    const host = $("accountsList");
    host.replaceChildren();

    if (!accounts.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "لا توجد حسابات أُنشئت من قسم اسم المستخدم حتى الآن.";
      host.appendChild(empty);
      return;
    }

    for (const account of accounts) {
      const item = document.createElement("article");
      item.className = "account";
      item.dataset.userId = account.user_id;
      const isSuspended = account.account_state === "suspended";
      const courseOptions = courses.map((course) =>
        '<option value="' + escapeHtml(course.course_slug) + '"' +
        ((account.course_slugs || []).includes(course.course_slug) ? " selected" : "") + ">" +
        escapeHtml(course.title || course.course_slug) + "</option>"
      ).join("");
      const chips = (account.course_titles || []).map((title) =>
        '<span class="course-chip">' + escapeHtml(title) + "</span>"
      ).join("");
      item.innerHTML =
        '<div class="account-head">' +
          '<div><h3>' + escapeHtml(account.full_name || "طالب") + '</h3>' +
          '<span class="username">' + escapeHtml(account.username || "") + '</span></div>' +
          '<span class="status ' + (isSuspended ? "suspended" : "") + '">' +
          (isSuspended ? "موقوف" : "نشط") + '</span>' +
        '</div>' +
        '<div class="meta">رقم WhatsApp: <b dir="ltr">' + escapeHtml(account.phone || "—") + '</b><br>' +
          'نوع الصلاحية: ' + escapeHtml(account.payment_state === "waived" ? "منح إداري" : account.payment_state || "—") +
        '</div>' +
        '<div class="course-list">' + (chips || '<span class="muted">لا توجد دورات مسندة</span>') + '</div>' +
        '<div class="account-section">' +
          '<h4>تعديل الدورات المسموح بها</h4>' +
          '<select multiple data-account-courses aria-label="الدورات المسموح بها">' + courseOptions + '</select>' +
          '<div class="actions"><button class="btn teal" type="button" data-action="save-courses">حفظ الدورات</button></div>' +
        '</div>' +
        '<div class="account-section">' +
          '<h4>تعيين كلمة مرور جديدة</h4>' +
          '<div class="account-controls"><div class="field">' +
            '<input type="password" data-new-password minlength="10" maxlength="128" placeholder="كلمة مرور جديدة (10 أحرف على الأقل)" autocomplete="new-password">' +
          '</div><button class="btn secondary" type="button" data-action="reset-password">تغيير وإعداد WhatsApp</button></div>' +
        '</div>' +
        '<div class="actions">' +
          (isSuspended
            ? '<button class="btn teal" type="button" data-action="reactivate">إعادة تفعيل الحساب</button>'
            : '<button class="btn danger" type="button" data-action="suspend">إيقاف الحساب</button>') +
        '</div>';
      host.appendChild(item);
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    if (busy) return;
    const button = $("createButton");
    const payload = {
      action: "create",
      full_name: $("fullName").value.trim(),
      username: $("username").value.trim(),
      phone: $("phone").value.trim(),
      password: $("password").value,
      course_slugs: selectedValues($("courseSlugs")),
    };

    if (payload.course_slugs.length < 1) {
      show("اختر دورة واحدة على الأقل.", "error");
      return;
    }
    try {
      payload.phone = "+" + phoneForWhatsApp(payload.phone);
    } catch (error) {
      show(error.message || "راجع رقم WhatsApp.", "error");
      return;
    }
    busy = true;
    button.disabled = true;
    try {
      const data = await callApi(payload);
      const account = data.account;
      const message = credentialMessage(account, payload.password);
      const link = whatsappLink(account.phone, message);
      $("createForm").reset();
      let refreshWarning = "";
      try {
        await loadData();
      } catch (refreshError) {
        refreshWarning = " تعذر تحديث القائمة تلقائيًا؛ استخدم زر تحديث قائمة الحسابات.";
      }
      show("تم إنشاء حساب " + account.username + " بنجاح." + refreshWarning + " افتح الرابط لإرسال بيانات الدخول للطالب.", refreshWarning ? "warning" : "success", {
        url: link,
        label: "فتح WhatsApp وإرسال بيانات الحساب"
      });
    } catch (error) {
      show(error.message || "تعذر إنشاء الحساب.", "error");
    } finally {
      busy = false;
      button.disabled = false;
      $("password").value = "";
    }
  }

  async function handleAccountAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".account");
    if (!card) return;
    const account = accounts.find((item) => item.user_id === card.dataset.userId);
    if (!account || busy) return;

    const action = button.dataset.action;
    busy = true;
    button.disabled = true;
    try {
      if (action === "save-courses") {
        const select = card.querySelector("[data-account-courses]");
        const course_slugs = selectedValues(select);
        await callApi({ action: "set_courses", user_id: account.user_id, course_slugs });
        show("تم تحديث الدورات المسموح بها للحساب " + account.username + ".");
        await loadData();
        return;
      }

      if (action === "reset-password") {
        const input = card.querySelector("[data-new-password]");
        const password = input.value;
        if (password.length < 10 || password.length > 128) {
          throw new Error("اكتب كلمة مرور من 10 إلى 128 حرفًا.");
        }
        await callApi({ action: "reset_password", user_id: account.user_id, password });
        const message = credentialMessage(account, password);
        const link = whatsappLink(account.phone, message);
        input.value = "";
        show("تم تغيير كلمة المرور. أرسل بيانات الدخول الجديدة للطالب عبر WhatsApp.", "success", {
          url: link,
          label: "فتح WhatsApp وإرسال كلمة المرور الجديدة"
        });
        return;
      }

      if (action === "suspend") {
        if (!window.confirm("هل تريد إيقاف حساب " + account.username + " ومنعه من تسجيل الدخول؟")) return;
        await callApi({ action: "suspend", user_id: account.user_id });
        show("تم إيقاف الحساب ومنع تسجيل الدخول.");
        await loadData();
        return;
      }

      if (action === "reactivate") {
        if (!window.confirm("هل تريد إعادة تفعيل حساب " + account.username + "؟")) return;
        await callApi({ action: "reactivate", user_id: account.user_id });
        show("تمت إعادة تفعيل الحساب.");
        await loadData();
      }
    } catch (error) {
      show(error.message || "تعذر تنفيذ الإجراء.", "error");
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  async function boot() {
    try {
      const authorized = await verifyAdmin();
      if (!authorized) return;
      $("createForm").addEventListener("submit", createAccount);
      $("accountsList").addEventListener("click", handleAccountAction);
      $("refreshButton").addEventListener("click", () => loadData().then(() => show("تم تحديث قائمة الحسابات.")).catch((error) =>
        show(error.message || "تعذر تحديث الحسابات.", "error")
      ));
      await loadData();
    } catch (error) {
      show(error.message || "تعذر تحميل صفحة إدارة الحسابات.", "error");
    }
  }

  boot();
})();