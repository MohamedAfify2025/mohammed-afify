(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").trim();
  const publishableKey = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const SITE_URL = "https://mohamedafify2025.github.io/mohammed-afify/";

  let client = null;
  let adminReady = false;
  let activeCourses = [];
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

    const normalizeHeader = (value) => String(value || "").trim().toLowerCase();
    const first = rows[0].map(normalizeHeader);
    const hasHeader = first.some((cell) =>
      ["full_name", "name", "الاسم", "اسم المتدرب", "email", "البريد الإلكتروني"].includes(cell)
    );

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const indexOf = (names, fallback) => {
      if (!hasHeader) return fallback;
      const index = first.findIndex((cell) => names.includes(cell));
      return index >= 0 ? index : fallback;
    };

    const nameIndex = indexOf(["full_name", "name", "الاسم", "اسم المتدرب"], 0);
    const emailIndex = indexOf(["email", "البريد الإلكتروني", "البريد"], 1);
    const phoneIndex = indexOf(["phone", "mobile", "whatsapp", "الهاتف", "رقم الهاتف"], 2);
    const methodIndex = indexOf(["delivery_method", "method", "channel", "طريقة الدعوة", "القناة"], 3);
    const courseIndex = indexOf(["requested_course", "course_slug", "course", "الدورة", "الدورة المطلوبة"], 4);

    return dataRows.map((cells) => {
      const rawMethod = normalizeHeader(cells[methodIndex] || "");
      const isChannel = ["email", "mail", "البريد الإلكتروني", "whatsapp", "واتساب"].includes(rawMethod);
      // Support the previous four-column CSV layout where column four was the requested course.
      const legacyCourse = !hasHeader && methodIndex === 3 && !isChannel ? (cells[3] || "") : "";
      const courseValue = cells[courseIndex] || legacyCourse;
      const course = activeCourses.find((item) =>
        item.course_slug.toLowerCase() === String(courseValue).trim().toLowerCase() ||
        item.title.trim().toLowerCase() === String(courseValue).trim().toLowerCase()
      );

      return {
        full_name: cells[nameIndex] || "",
        email: cells[emailIndex] || "",
        phone: cells[phoneIndex] || "",
        delivery_method: ["whatsapp", "واتساب"].includes(rawMethod)
          ? "whatsapp"
          : ((cells[emailIndex] || "").trim() ? "email" : "whatsapp"),
        requested_course: course?.course_slug || ""
      };
    });
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

    const courseWrap = document.createElement("div");
    courseWrap.className = "field";
    const courseLabel = document.createElement("label");
    courseLabel.textContent = "الدورة المطلوبة";
    const courseSelect = document.createElement("select");
    courseSelect.className = "student-requested_course";
    const coursePlaceholder = document.createElement("option");
    coursePlaceholder.value = "";
    coursePlaceholder.textContent = activeCourses.length ? "اختر الدورة" : "لا توجد دورات نشطة";
    courseSelect.appendChild(coursePlaceholder);
    activeCourses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.course_slug;
      option.textContent = course.title;
      courseSelect.appendChild(option);
    });
    const requestedCourse = String(student.requested_course || "");
    const matchingCourse = activeCourses.find((course) =>
      course.course_slug === requestedCourse ||
      course.title.trim().toLowerCase() === requestedCourse.trim().toLowerCase()
    );
    courseSelect.value = matchingCourse?.course_slug || "";
    courseWrap.append(courseLabel, courseSelect);
    row.appendChild(courseWrap);

    const methodWrap = document.createElement("div");
    methodWrap.className = "field";
    const methodLabel = document.createElement("label");
    methodLabel.textContent = "طريقة الدعوة";
    const methodSelect = document.createElement("select");
    methodSelect.className = "student-delivery_method";
    [
      { value: "email", label: "البريد الإلكتروني" },
      { value: "whatsapp", label: "WhatsApp" }
    ].forEach((optionData) => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      methodSelect.appendChild(option);
    });
    methodSelect.value = student.delivery_method ||
      (student.email ? "email" : (student.phone ? "whatsapp" : "email"));
    methodWrap.append(methodLabel, methodSelect);
    row.appendChild(methodWrap);

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
    methodSelect.addEventListener("change", invalidatePreview);
    courseSelect.addEventListener("change", invalidatePreview);
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
      phone: row.querySelector(".student-phone").value.trim(),
      delivery_method: row.querySelector(".student-delivery_method").value,
      requested_course: row.querySelector(".student-requested_course").value,
      course_title: activeCourses.find((course) => course.course_slug === row.querySelector(".student-requested_course").value)?.title || ""
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
      if (!row.requested_course) {
        errors.push("المتدرب " + line + ": اختر الدورة المطلوبة من القائمة.");
      }
      if (row.delivery_method === "email" && !email) {
        errors.push("المتدرب " + line + ": اخترت البريد الإلكتروني؛ أدخل عنوان البريد.");
      }
      if (row.delivery_method === "whatsapp" && !phone) {
        errors.push("المتدرب " + line + ": اخترت WhatsApp؛ أدخل رقم الهاتف مع كود الدولة.");
      }
      if (!["email", "whatsapp"].includes(row.delivery_method)) {
        errors.push("المتدرب " + line + ": اختر طريقة دعوة صحيحة.");
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
      "الدورة المطلوبة: " + (student.course_title || "الدورة التدريبية"),
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
      const method = student.delivery_method === "whatsapp" ? "WhatsApp" : "البريد الإلكتروني";

      [index + 1, student.full_name, student.email || "—", student.phone || "—", student.course_title || "—", method].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      });

      const actionCell = document.createElement("td");
      if (student.delivery_method === "whatsapp" && student.phone) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = "فتح WhatsApp";
        button.dataset.whatsappIndex = String(index);
        actionCell.appendChild(button);
      } else {
        actionCell.textContent = "يُرسل تلقائيًا عند تنفيذ دعوات البريد";
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

    const { data: courses, error: coursesError } = await client
      .from("course_catalog")
      .select("course_slug,title")
      .eq("is_active", true)
      .order("title");
    if (coursesError) throw new Error("تعذر تحميل قائمة الدورات النشطة: " + coursesError.message);
    activeCourses = Array.isArray(courses) ? courses : [];
    if (!activeCourses.length) throw new Error("لا توجد دورات نشطة في فهرس الدورات. أضف الدورة قبل دعوة المتدربين.");

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

    $("adminPromotionForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $("promoteAdminButton");
      const host = $("promotionMessage");
      const emailInput = $("promoteAdminEmail");
      const email = emailInput.value.trim().toLowerCase();

      const showPromotion = (text, isError = false) => {
        host.textContent = text;
        host.className = "promotion-message" + (isError ? " error" : "");
        host.hidden = !text;
      };

      if (!adminReady) {
        showPromotion("هذه العملية متاحة لمدير المنصة المعتمد فقط.", true);
        return;
      }
      if (!email || email.length > 254 || !emailInput.checkValidity()) {
        showPromotion("اكتب بريدًا إلكترونيًا صحيحًا.", true);
        return;
      }

      const confirmation = "سيتم منح دور مدير المنصة للحساب: " + email +
        ". يجب أن يكون البريد مؤكّدًا، وسيتم تسجيل الترقية في سجل التدقيق. هل تريد المتابعة؟";
      if (!window.confirm(confirmation)) return;

      button.disabled = true;
      button.textContent = "جارٍ التحقق والترقية…";
      showPromotion("جارٍ التحقق من الحساب وتأكيد البريد وصلاحية المدير الحالي…");
      try {
        const { data, error } = await client.rpc("promote_verified_user_to_admin", {
          p_target_email: email
        });
        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        if (!result) throw new Error("لم تُرجع قاعدة البيانات نتيجة واضحة للترقية.");

        if (result.already_admin === true) {
          showPromotion("هذا الحساب مدير معتمد ونشط بالفعل. لم يتم إجراء أي تغيير.");
        } else {
          showPromotion("تمت ترقية الحساب " + email + " إلى مدير منصة بنجاح. استخدم هذا البريد لتسجيل الدخول في تبويب جديد.");
          $("adminPromotionForm").reset();
        }
      } catch (error) {
        const raw = String(error?.message || "");
        let safeMessage = "تعذر ترقية الحساب. تحقق من البريد وحالة الحساب ثم أعد المحاولة.";
        if (/not found/i.test(raw)) safeMessage = "لم يتم العثور على حساب بهذا البريد. أنشئ الحساب أولًا من نموذج التسجيل ثم أكّد بريده الإلكتروني.";
        else if (/not verified|not confirmed|email is not verified/i.test(raw)) safeMessage = "البريد الإلكتروني غير مؤكد بعد. افتح رسالة التأكيد أولًا، ثم أعد الترقية.";
        else if (/Only an active platform administrator/i.test(raw)) safeMessage = "يلزم أن تكون داخلًا بحساب مدير معتمد ونشط لتنفيذ هذه العملية.";
        else if (/suspended/i.test(raw)) safeMessage = "الحساب المستهدف موقوف. أعد تفعيله ومراجعة حالته قبل الترقية.";
        else if (/rejected/i.test(raw)) safeMessage = "هذا الحساب لديه طلب مرفوض. راجع حالة الطلب قبل ترقيته.";
        showPromotion(safeMessage, true);
      } finally {
        button.disabled = false;
        button.textContent = "ترقية إلى مدير";
      }
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
      const emailCount = rows.filter((row) => row.delivery_method === "email").length;
      const whatsappCount = rows.filter((row) => row.delivery_method === "whatsapp").length;
      message("القائمة جاهزة: " + rows.length + " متدربًا؛ " +
        emailCount + " دعوة بريد إلكتروني و" + whatsappCount + " رسالة WhatsApp. تم ربط كل طلب بالدورة التي اخترتها.");
    });

    $("previewBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-whatsapp-index]");
      if (!button) return;
      const index = Number(button.dataset.whatsappIndex);
      const student = previewRows[index];
      if (!student?.phone || student.delivery_method !== "whatsapp") return;
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

      const emailStudents = rows
        .filter((row) => row.delivery_method === "email")
        .map(({ full_name, email, phone, requested_course }) => ({ full_name, email, phone, requested_course }));
      const whatsappCount = rows.filter((row) => row.delivery_method === "whatsapp").length;
      if (!emailStudents.length) {
        if (whatsappCount) {
          message("جميع المتدربين محدد لهم WhatsApp. استخدم زر «فتح WhatsApp» بجوار كل متدرب، ثم اضغط إرسال داخل المحادثة. لا يوجد إرسال تلقائي دون WhatsApp Business API.");
        } else {
          message("لا توجد دعوات جاهزة للإرسال.", true);
        }
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
          ". يوجد " + whatsappCount +
          " متدربًا محددًا لهم WhatsApp؛ افتح محادثة كل متدرب من جدول المراجعة واضغط إرسال."
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
