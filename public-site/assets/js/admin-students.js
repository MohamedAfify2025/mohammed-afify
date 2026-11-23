(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").trim();
  const publishableKey = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

  let client = null;
  let adminReady = false;
  let previewFingerprint = "";

  function message(text, isError = false) {
    const host = $("adminMessage");
    host.textContent = text;
    host.className = "notice " + (isError ? "error" : "success");
    host.hidden = !text;
  }

  function isConfigured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) &&
      window.isMembershipPublicKey?.(publishableKey) === true;
  }

  function setVisible(id, visible) {
    $(id).hidden = !visible;
  }

  function parseCsv(source) {
    const text = String(source || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          value += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          value += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(value.trim());
        value = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(value.trim());
        value = "";
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
      } else {
        value += char;
      }
    }
    row.push(value.trim());
    if (row.some((cell) => cell !== "")) rows.push(row);

    if (!rows.length) return [];
    const first = rows[0].map((cell) => cell.toLowerCase());
    const hasHeader = first.includes("email") || first.includes("البريد الإلكتروني");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows.map((cells) => ({
      full_name: cells[0] || "",
      email: cells[1] || "",
      phone: cells[2] || "",
      requested_course: cells[3] || ""
    }));
  }

  function validateRows(rows) {
    const errors = [];
    const seen = new Set();
    if (!rows.length) errors.push("أضف طالبًا واحدًا على الأقل.");
    if (rows.length > 40) errors.push("الحد الأقصى 40 طالبًا في الدفعة الواحدة.");

    rows.forEach((row, index) => {
      const name = String(row.full_name || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      if (name.length < 2 || name.length > 120) {
        errors.push("السطر " + (index + 1) + ": الاسم مطلوب (2–120 حرفًا).");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        errors.push("السطر " + (index + 1) + ": البريد الإلكتروني غير صالح.");
      }
      if (seen.has(email)) errors.push("السطر " + (index + 1) + ": البريد مكرر في القائمة.");
      seen.add(email);
      if (String(row.phone || "").length > 30) {
        errors.push("السطر " + (index + 1) + ": رقم الهاتف أطول من المسموح.");
      }
      if (String(row.requested_course || "").length > 120) {
        errors.push("السطر " + (index + 1) + ": اسم الدورة أطول من المسموح.");
      }
    });
    return errors;
  }

  function renderPreview(rows) {
    const host = $("previewBody");
    host.replaceChildren();
    rows.forEach((row, index) => {
      const tr = document.createElement("tr");
      [index + 1, row.full_name, row.email, row.phone || "—", row.requested_course || "—"].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      });
      host.appendChild(tr);
    });
    $("previewCount").textContent = rows.length + " طالب";
    setVisible("previewPanel", rows.length > 0);
  }

  async function checkAdmin() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) {
      setVisible("loginPanel", true);
      setVisible("invitePanel", false);
      return false;
    }

    const { data: isAdmin, error: rpcError } = await client.rpc("is_platform_admin");
    if (rpcError || isAdmin !== true) {
      await client.auth.signOut();
      throw new Error("هذه الشاشة متاحة لمدير المنصة المعتمد فقط.");
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "admin" ||
        profile?.status !== "approved" || profile?.account_state !== "active") {
      await client.auth.signOut();
      throw new Error("حساب الإدارة غير معتمد أو غير نشط.");
    }

    $("adminIdentity").textContent = session.user.email || "مدير المنصة";
    setVisible("loginPanel", false);
    setVisible("invitePanel", true);
    adminReady = true;
    return true;
  }

  async function boot() {
    if (!window.supabase?.createClient || !isConfigured()) {
      $("configMessage").textContent =
        "لم يتم ربط بوابة الطلاب بمشروع Supabase حتى الآن. يلزم ضبط رابط المشروع وPublishable Key الصحيحين قبل تفعيل إنشاء الحسابات.";
      setVisible("configMessage", true);
      $("loginForm").querySelector("button").disabled = true;
      return;
    }

    client = window.supabase.createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    $("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      message("");
      const email = $("adminEmail").value.trim().toLowerCase();
      const password = $("adminPassword").value;
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await checkAdmin();
        if (adminReady) message("تم التحقق من صلاحية مدير المنصة.");
      } catch (error) {
        message(error.message || "تعذر تسجيل الدخول.", true);
      }
    });

    $("logoutButton").addEventListener("click", async () => {
      await client.auth.signOut();
      adminReady = false;
      setVisible("loginPanel", true);
      setVisible("invitePanel", false);
      message("تم تسجيل الخروج.");
    });

    $("csvFile").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        message("حجم ملف CSV يجب ألا يتجاوز 1MB.", true);
        event.target.value = "";
        return;
      }
      $("studentsCsv").value = await file.text();
      message("تم تحميل الملف. راجع معاينة الطلاب قبل إرسال الدعوات.");
    });

    $("previewButton").addEventListener("click", () => {
      message("");
      const rows = parseCsv($("studentsCsv").value);
      const errors = validateRows(rows);
      if (errors.length) {
        renderPreview([]);
        message(errors.slice(0, 8).join(" | "), true);
        return;
      }
      renderPreview(rows);
      previewFingerprint = JSON.stringify(rows);
      message("المعاينة جاهزة. راجع الأسماء والبريد الإلكتروني قبل إرسال الدعوات.");
    });

    $("sendInvitesButton").addEventListener("click", async () => {
      message("");
      if (!adminReady) {
        message("سجّل الدخول بحساب الإدارة أولًا.", true);
        return;
      }

      const rows = parseCsv($("studentsCsv").value);
      const errors = validateRows(rows);
      if (errors.length) {
        message(errors.slice(0, 8).join(" | "), true);
        return;
      }
      if (!previewFingerprint || previewFingerprint !== JSON.stringify(rows)) {
        message("اعرض معاينة القائمة أولًا، ثم راجع البيانات قبل إرسال الدعوات.", true);
        return;
      }

      const button = $("sendInvitesButton");
      button.disabled = true;
      button.textContent = "جارٍ إرسال الدعوات…";
      try {
        const { data, error } = await client.functions.invoke(
          "admin-create-student-invitations",
          { body: { students: rows } }
        );
        if (error) throw error;
        renderResults(data?.results || []);
        previewFingerprint = "";
        message(
          "تم إرسال " + Number(data?.invited_count || 0) +
          " دعوة، وتعذر إرسال " + Number(data?.failed_count || 0) + "."
        );
      } catch (error) {
        message(error.message || "تعذر إرسال الدعوات. راجع إعداد Edge Function.", true);
      } finally {
        button.disabled = false;
        button.textContent = "إرسال دعوات إعداد الحساب";
      }
    });

    try {
      await checkAdmin();
    } catch (error) {
      message(error.message || "تعذر التحقق من حساب الإدارة.", true);
    }
  }

  function renderResults(results) {
    const host = $("resultsBody");
    host.replaceChildren();
    results.forEach((item) => {
      const tr = document.createElement("tr");
      const values = [
        item.full_name || "",
        item.email || "",
        item.success ? "تم إرسال الدعوة" : (item.message || "تعذر الإرسال")
      ];
      values.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      });
      host.appendChild(tr);
    });
    setVisible("resultsPanel", results.length > 0);
  }

  boot().catch((error) => message(error.message || "تعذر تشغيل الشاشة.", true));
})();
