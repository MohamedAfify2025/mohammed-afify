(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").trim();
  const publishableKey = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const SITE_URL = "https://mohamedafify2025.github.io/mohammed-afify/";

  let client = null;
  let adminReady = false;
  let previewFingerprint = "";
  let previewRows = [];

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

  function invalidatePreview() {
    previewFingerprint = "";
    previewRows = [];
    setVisible("previewPanel", false);
    setVisible("resultsPanel", false);
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
      phone: cells[2] || ""
    }));
  }

  function addStudentRow(student = {}) {
    const row = document.createElement("div");
    row.className = "student-row";

    const number = document.createElement("div");
    number.className = "row-number";
    number.textContent = "متدرب " + ($("studentRows").children.length + 1);
    row.appendChild(number);

    const fields = [
      { key: "full_name", label: "اسم المتدرب", type: "text", placeholder: "الاسم بالكامل", required: true },
      { key: "email", label: "البريد الإلكتروني", type: "email", placeholder: "name@example.com" },
      { key: "phone", label: "رقم الهاتف / WhatsApp", type: "tel", placeholder: "+2010xxxxxxxx" }
    ];

    fields.forEach((field) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = document.createElement("input");
      input.type = field.type;
      input.className = "student-" + field.key;
      input.placeholder = field.placeholder;
      input.autocomplete = field.key === "email" ? "email" : (field.key === "phone" ? "tel" : "name");
      input.value = String(student[field.key] || "");
      if (field.required) input.required = true;
      wrap.append(label, input);
      row.appendChild(wrap);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "حذف";
    remove.setAttribute("aria-label", "حذف هذا المتدرب");
    remove.addEventListener("click", () => {
      row.remove();
      if (!$("studentRows").children.length) addStudentRow();
      renumberRows();
      invalidatePreview();
    });
    row.appendChild(remove);

    row.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", invalidatePreview);
    });
    $("studentRows").appendChild(row);
    return row;
  }

  function renumberRows() {
    [...$("studentRows").children].forEach((row, index) => {
      const label = row.querySelector(".row-number");
      if (label) label.textContent = "متدرب " + (index + 1);
    });
  }

  function collectRows() {
    return [...$("studentRows").querySelectorAll(".student-row")].map((row) => ({
      full_name: row.querySelector(".student-full_name").value.trim(),
      email: row.querySelector(".student-email").value.trim().toLowerCase(),
      phone: row.querySelector(".student-phone").value.trim()
    })).filter((row) => row.full_name || row.email || row.phone);
  }

  function phoneDigits(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    // Convert common Egyptian local mobile format 01xxxxxxxxx to country code 20.
    if (/^01[0125]\d{8}$/.test(digits)) digits = "2" + digits;
    return digits;
  }

  function validateRows(rows) {
    const errors = [];
    const seenEmails = new Set();

    if (!rows.length) errors.push("أضف بيانات متدرب واحد على الأقل.");
    if (rows.length > 40) errors.push("الحد الأقصى 40 متدربًا في الدفعة الواحدة.");

    rows.forEach((row, index) => {
      const line = index + 1;
      const name = String(row.full_name || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      const phone = String(row.phone || "").trim();
      const digits = phoneDigits(phone);

      if (name.length < 2 || name.length > 120) {
        errors.push("المتدرب " + line + ": اكتب الاسم من حرفين إلى 120 حرفًا.");
      }
      if (!email && !phone) {
        errors.push("المتدرب " + line + ": أدخل البريد الإلكتروني أو رقم WhatsApp.");
      }
      if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
        errors.push("المتدرب " + line + ": البريد الإلكتروني غير صالح.");
      }
      if (email && seenEmails.has(email)) {
        errors.push("المتدرب " + line + ": البريد الإلكتروني مكرر في القائمة.");
      }
      if (email) seenEmails.add(email);
      if (phone && (digits.length < 8 || digits.length > 15)) {
        errors.push("المتدرب " + line + ": رقم الهاتف غير صالح؛ أدخله مع كود الدولة.");
      }
      if (phone && !/^\+|^00|^0/.test(phone.replace(/[\s()-]/g, "")) && digits.length < 10) {
        errors.push("المتدرب " + line + ": راجع كود الدولة لرقم WhatsApp.");
      }
    });
    return errors;
  }

  function whatsappUrl(student) {
    const number = phoneDigits(student.phone);
    const text = [
      "مرحبًا " + student.full_name + " 👋",
      "",
      "يسعدنا دعوتك للانضمام إلى منصة Mohammed Afify التعليمية.",
      "تعرّف على المنصة والدورات من هنا:",
      SITE_URL,
      "",
      "لاستكمال إنشاء حساب المتدرب وإرسال رابط التفعيل الآمن، يرجى الرد على هذه الرسالة ببريدك الإلكتروني."
    ].join("\n");
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  }

  function renderPreview(rows) {
    const host = $("previewBody");
    host.replaceChildren();

    rows.forEach((student, index) => {
      const tr = document.createElement("tr");
      const method = student.email && student.phone ? "البريد + WhatsApp" :
        (student.email ? "البريد الإلكتروني" : "WhatsApp");

      [index + 1, student.full_name, student.email || "—", student.phone || "—", method].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      });

      const actionCell = document.createElement("td");
      if (student.phone) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = "فتح WhatsApp";
        button.dataset.whatsappIndex = String(index);
        actionCell.appendChild(button);
      } else {
        actionCell.textContent = "—";
      }
      tr.appendChild(actionCell);
      host.appendChild(tr);
    });

    $("previewCount").textContent = rows.length + " متدرب";
    setVisible("previewPanel", rows.length > 0);
  }

  async function checkAdmin() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) {
      adminReady = false;
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
        "لم يتم ربط بوابة الطلاب بمشروع Supabase. راجع رابط المشروع وPublishable Key قبل تفعيل الدعوات.";
      setVisible("configMessage", true);
      $("loginForm").querySelector("button").disabled = true;
      return;
    }

    client = window.supabase.createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    addStudentRow();

    $("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      message("");
      try {
        const { error } = await client.auth.signInWithPassword({
          email: $("adminEmail").value.trim().toLowerCase(),
          password: $("adminPassword").value
        });
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

    $("addStudentButton").addEventListener("click", () => {
      const row = addStudentRow();
      invalidatePreview();
      row.querySelector(".student-full_name").focus();
    });

    $("importCsvButton").addEventListener("click", () => $("csvFile").click());

    $("csvFile").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        message("حجم ملف CSV يجب ألا يتجاوز 1MB.", true);
        event.target.value = "";
        return;
      }
      try {
        const imported = parseCsv(await file.text());
        if (!imported.length) throw new Error("لم نعثر على صفوف داخل ملف CSV.");
        if (imported.length > 40) throw new Error("الحد الأقصى 40 متدربًا في الدفعة الواحدة.");
        $("studentRows").replaceChildren();
        imported.forEach(addStudentRow);
        renumberRows();
        invalidatePreview();
        message("تم استيراد " + imported.length + " متدربًا. راجع البيانات ثم اضغط مراجعة قائمة الدعوات.");
      } catch (error) {
        message(error.message || "تعذر قراءة ملف CSV.", true);
      } finally {
        event.target.value = "";
      }
    });

    $("previewButton").addEventListener("click", () => {
      message("");
      const rows = collectRows();
      const errors = validateRows(rows);
      if (errors.length) {
        invalidatePreview();
        message(errors.slice(0, 8).join(" | "), true);
        return;
      }
      previewRows = rows;
      renderPreview(rows);
      previewFingerprint = JSON.stringify(rows);
      const emailCount = rows.filter((row) => row.email).length;
      const phoneCount = rows.filter((row) => row.phone).length;
      message("القائمة جاهزة: " + rows.length + " متدربًا؛ " +
        emailCount + " دعوة بريد إلكتروني و" + phoneCount + " رسالة WhatsApp يمكن فتحها يدويًا.");
    });

    $("previewBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-whatsapp-index]");
      if (!button) return;
      const index = Number(button.dataset.whatsappIndex);
      const student = previewRows[index];
      if (!student?.phone) return;
      const opened = window.open(whatsappUrl(student), "_blank");
      if (opened) opened.opener = null;
      else message("المتصفح منع فتح WhatsApp. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.", true);
    });

    $("sendInvitesButton").addEventListener("click", async () => {
      message("");
      if (!adminReady) {
        message("سجّل الدخول بحساب الإدارة أولًا.", true);
        return;
      }

      const rows = collectRows();
      const errors = validateRows(rows);
      if (errors.length) {
        message(errors.slice(0, 8).join(" | "), true);
        return;
      }
      if (!previewFingerprint || previewFingerprint !== JSON.stringify(rows)) {
        message("راجع قائمة الدعوات أولًا، ثم تأكد من البيانات قبل الإرسال.", true);
        return;
      }

      const emailStudents = rows.filter((row) => row.email);
      if (!emailStudents.length) {
        message("لا توجد عناوين بريد إلكتروني في القائمة. استخدم زر «فتح WhatsApp» بجوار كل رقم؛ رسالة WhatsApp لا تُرسل تلقائيًا.", true);
        return;
      }

      if (!window.confirm("سيتم إرسال دعوات إنشاء الحساب إلى " + emailStudents.length +
          " بريد إلكتروني. هل تريد المتابعة؟")) return;

      const button = $("sendInvitesButton");
      button.disabled = true;
      button.textContent = "جارٍ إرسال الدعوات…";
      try {
        const { data, error } = await client.functions.invoke(
          "admin-create-student-invitations",
          { body: { students: emailStudents } }
        );
        if (error) throw error;

        renderResults(data?.results || []);
        previewFingerprint = "";
        message(
          "تم إرسال " + Number(data?.invited_count || 0) +
          " دعوة عبر البريد، وتعذر إرسال " + Number(data?.failed_count || 0) +
          ". أرقام WhatsApp ظلت جاهزة للإرسال اليدوي من جدول المراجعة."
        );
      } catch (error) {
        message(error.message || "تعذر إرسال الدعوات. راجع إعداد Edge Function.", true);
      } finally {
        button.disabled = false;
        button.textContent = "إرسال دعوات البريد الإلكتروني";
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
      const status = item.success === true
        ? "تم إرسال الدعوة"
        : (item.message || "تعذر الإرسال");
      [item.full_name || "", item.email || "", status].forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        if (index === 2) td.className = "status" + (item.success === true ? "" : " error");
        tr.appendChild(td);
      });
      host.appendChild(tr);
    });
    setVisible("resultsPanel", results.length > 0);
  }

  boot().catch((error) => message(error.message || "تعذر تشغيل الشاشة.", true));
})();
