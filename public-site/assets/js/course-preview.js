(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  const slug = String(new URLSearchParams(window.location.search).get("course") || "").trim();
  const coverManagementRequested = new URLSearchParams(window.location.search).get("manage_cover") === "1";

  const PUBLIC_COURSE_OUTLINES = {
    accounting: [
      ["الوحدة الأولى: لماذا نتعلم المحاسبة؟","فهم دور المحاسبة في تسجيل العمليات وتوفير معلومات تساعد على اتخاذ القرار."],
      ["الوحدة الثانية: قاعدة القيد المزدوج وحسابات دفاتر الأستاذ","فهم طبيعة الحسابات وقاعدة المدين والدائن وترحيل القيود."],
      ["الوحدة الثالثة: دفاتر اليومية المساعدة","التعرف على الدفاتر المساعدة واستخدامها في تنظيم العمليات المتكررة."],
      ["الوحدة الرابعة: ميزان المراجعة وتصحيح الأخطاء","إعداد ميزان المراجعة والتعرف على الأخطاء المحاسبية وطرق معالجتها."],
      ["الوحدة الخامسة: القوائم المالية للمنشأة الفردية","التعرف على القوائم المالية الأساسية والعلاقة بين نتائج النشاط والمركز المالي."]
    ],
    "business-administration": [
      ["الوحدة الأولى: مدخل إلى الأعمال وغايتها","الاحتياجات والرغبات والسلع والخدمات والقطاعات وخلق القيمة وأصحاب المصلحة."],
      ["الوحدة الثانية: أنواع منظمات الأعمال","المنظمة الفردية وشركات الأشخاص وشركات الأموال، والمقارنة بين الملكية والمسؤولية والسيطرة والتمويل."],
      ["الوحدة الثالثة: أهداف منظمات الأعمال وأصحاب المصلحة","البقاء والربح والنمو والحصة السوقية والأهداف الاجتماعية والأخلاقية وتعارض المصالح."],
      ["الوحدة الرابعة: البيئة الداخلية والخارجية","تحليل العوامل الداخلية والخارجية التي تؤثر في المنظمة وقراراتها."],
      ["الوحدة الخامسة: الإدارة والقيادة","مبادئ الإدارة والقيادة وتوجيه الأفراد والموارد نحو الأهداف."],
      ["مشروع تطبيقي: خطة قرار لمشروع مريم","تطبيق مفاهيم المنهج على موقف عملي وموازنة البدائل والمصالح."]
    ],
    programming: [
      ["البرمجة للأطفال: ScratchJr وScratch","التعرف على اللبنات والأوامر وبناء قصص وألعاب تفاعلية بسيطة."],
      ["أساسيات البرمجة","التفكير المنطقي والخوارزميات والمتغيرات وأنواع البيانات والشروط."],
      ["تعلم Python","مدخل إلى كتابة الأوامر وبناء البرامج خطوة بخطوة."],
      ["ورش العمل والتطبيقات","أنشطة عملية ومشروعات صغيرة لتثبيت المفاهيم."]
    ],
    python: [
      ["مدخل إلى Python","التعرف على اللغة ومجالات استخدامها وبيئة التطوير."],
      ["أساسيات كتابة الكود","كتابة الأوامر وتنظيمها وتشغيل البرامج."],
      ["المتغيرات وأنواع البيانات","تخزين القيم والتعامل مع النصوص والأرقام والبيانات."],
      ["الشروط والمنطق","استخدام الشروط لبناء قرارات داخل البرنامج."],
      ["التطبيق وحل المشكلات","توظيف ما تعلمته في تمارين وبرامج صغيرة."]
    ],
    scratch: [
      ["المستوى الأول: ScratchJr","التعرف على الواجهة والشخصيات والخلفيات وتركيب الأوامر الأساسية."],
      ["المستوى الثاني: Scratch","استخدام اللبنات والأحداث والحركة والتكرار والتفاعل."],
      ["ماذا سيكتسب المتعلم؟","تنمية التفكير المنطقي والتسلسل وحل المشكلات والإبداع."],
      ["التعلم من خلال المشروعات","بناء قصص وألعاب وأنشطة تفاعلية بسيطة."]
    ],
    "data-analysis": [
      ["Excel","تنظيم البيانات وإعداد الجداول والتقارير."],
      ["Power Query","تجهيز البيانات وتنظيفها وتحويلها قبل التحليل."],
      ["Power BI","تصميم التقارير ولوحات المعلومات التفاعلية."],
      ["Python","التعرف على استخدام البرمجة ضمن أدوات تحليل البيانات."],
      ["مشروع تطبيقي: تحليل بيانات سوبر ماركت","قراءة بيانات المبيعات وتحليل أداء الفروع وسلوك العملاء واستخلاص مؤشرات."]
    ],
    icdl: [
      ["أساسيات الكمبيوتر","مكونات الجهاز ونظام التشغيل وإدارة الملفات والمجلدات."],
      ["Microsoft Word","إنشاء المستندات وتنسيق النصوص والجداول وتجهيز الملفات للطباعة."],
      ["Microsoft Excel","تنظيم البيانات واستخدام الصيغ وإنشاء الجداول والتقارير."],
      ["Microsoft PowerPoint","إعداد العروض التقديمية باستخدام الشرائح والعناصر المرئية."],
      ["الإنترنت والبريد الإلكتروني","البحث والتصفح وإرسال الرسائل وإدارة المرفقات."],
      ["الأمان الرقمي","حماية البيانات والحسابات والتعامل الآمن مع الروابط والمواقع."]
    ],
    windows: [
      ["أساسيات Windows","التعرف على سطح المكتب والنوافذ والإعدادات الأساسية."],
      ["إدارة الملفات والمجلدات","إنشاء الملفات والمجلدات وتنظيمها ونسخها ونقلها."],
      ["استخدام الإنترنت","التصفح والبحث والوصول إلى المعلومات."],
      ["البريد الإلكتروني والتواصل","إرسال الرسائل وإدارة المرفقات ووسائل التواصل."],
      ["الأمان الرقمي","مبادئ حماية الحسابات والبيانات وتجنب الروابط المشبوهة."],
      ["مهارات الاستخدام اليومي","تطبيق المهارات في المهام المكتبية والدراسية."]
    ],
    word: [
      ["إنشاء المستندات","فتح المستندات وإنشاؤها وحفظها وتنظيمها."],
      ["تنسيق النصوص","اختيار الخطوط والأحجام والألوان وإبراز النص."],
      ["الفقرات والقوائم","ضبط المحاذاة والتباعد وإنشاء القوائم."],
      ["الجداول والصور","إدراج الجداول والصور وتنسيقها داخل المستند."],
      ["تخطيط الصفحة","الهوامش والاتجاه والحجم وتقسيم الصفحات."],
      ["المراجعة والطباعة","مراجعة المستند وتجهيزه للطباعة والمشاركة."]
    ],
    excel: [
      ["أساسيات الجداول","أوراق العمل والخلايا وإدخال البيانات."],
      ["تنسيق البيانات","تنسيق الأرقام والتواريخ والخلايا لتحسين القراءة."],
      ["الصيغ والدوال","العمليات الحسابية والدوال الأساسية."],
      ["الفرز والتصفية","ترتيب البيانات والعثور على المعلومات المطلوبة."],
      ["الرسوم البيانية","تحويل البيانات إلى رسوم تساعد على فهم النتائج."],
      ["التقارير والطباعة","تنظيم الجداول وتجهيز أوراق العمل للطباعة."]
    ],
    powerpoint: [
      ["إنشاء عرض تقديمي","إنشاء ملف العرض واختيار التصميم المناسب."],
      ["تنظيم الشرائح","إضافة الشرائح وترتيبها واختيار التخطيطات."],
      ["النصوص والعناوين","كتابة النصوص وتنسيق العناوين والمحتوى."],
      ["الصور والعناصر المرئية","استخدام الصور والأشكال والجداول والرسوم."],
      ["الانتقالات والحركة","إضافة الانتقالات والحركة بصورة تخدم الرسالة."],
      ["مراجعة العرض","مراجعة التصميم وتجهيز العرض للتقديم."]
    ]
  };


  function showMessage(message, isError = false) {
    const host = $("courseMessage");
    host.textContent = message;
    host.classList.toggle("error", isError);
    host.hidden = !message;
  }

  async function redirectMemberToLearning(client) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const user = userData?.user;
    if (!user) return false;

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,status,account_state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const activeProfile = profile?.status === "approved" && profile?.account_state === "active";
    if (!activeProfile) return false;

    if (profile.role === "admin") {
      const { data: allowed, error: adminError } = await client.rpc("is_platform_admin");
      if (adminError) throw adminError;
      if (allowed !== true) return false;
      // Keep the preview open only for the explicit cover-management route.
      if (coverManagementRequested) return false;
      // Authorized Odoo members continue to the protected standalone course page.
      if (slug === "odoo-training") { window.location.replace("academy/odoo-training.html"); return true; }
      if (slug === "business-administration") {
        window.location.replace("academy/business-administration.html");
        return true;
      }
      window.location.replace("student-space.html?course=" + encodeURIComponent(slug));
      return true;
    }

    if (profile.role !== "student") return false;

    let permissionsResult = await client.rpc("get_my_course_permissions_v2");
    if (permissionsResult.error) {
      const migrationNotApplied = permissionsResult.error.code === "PGRST202" ||
        /get_my_course_permissions_v2.*(not found|does not exist)|could not find the function/i.test(permissionsResult.error.message || "");
      if (!migrationNotApplied) throw permissionsResult.error;
      permissionsResult = await client.rpc("get_my_active_courses_v2");
    }
    if (permissionsResult.error) throw permissionsResult.error;

    const permission = (Array.isArray(permissionsResult.data) ? permissionsResult.data : [])
      .find(item => item.course_slug === slug && item.can_view_course_page === true);
    if (!permission) return false;

    if (slug === "odoo-training") { window.location.replace("academy/odoo-training.html"); return true; }
    if (slug === "business-administration") {
      window.location.replace("academy/business-administration.html");
      return true;
    }

    window.location.replace("student-space.html?course=" + encodeURIComponent(slug));
    return true;
  }

  function renderPublicOutline(courseSlug) {
    const section = $("courseOutline");
    const list = $("courseOutlineList");
    const count = $("courseOutlineCount");
    if (!section || !list || !count) return;

    const units = PUBLIC_COURSE_OUTLINES[courseSlug] || [];
    list.replaceChildren();
    if (!units.length) {
      section.hidden = true;
      return;
    }

    units.forEach(([headingText, detailText], index) => {
      const item = document.createElement("li");
      item.className = "preview-outline-item";

      const number = document.createElement("span");
      number.className = "preview-outline-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const copy = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = headingText;
      const detail = document.createElement("p");
      detail.textContent = detailText;
      copy.append(heading, detail);
      item.append(number, copy);
      list.appendChild(item);
    });

    count.textContent = units.length + " وحدات ومحاور";
    section.hidden = false;
  }

  async function loadCourse() {
    if (!slug || slug.length > 120) {
      showMessage("رابط الدورة غير مكتمل. ارجع إلى مكتبة الدورات لاختيار دورة.", true);
      $("courseNotFound").hidden = false;
      return;
    }
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      showMessage("تعذر تحميل معلومات الدورة؛ إعداد الاتصال العام غير مكتمل.", true);
      return;
    }

    const client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    // A verified active administrator goes straight to the full course workspace,
    // not the visitor-facing description page.
    const redirected = await redirectMemberToLearning(client);
    if (redirected) return;

    const { data, error } = await client
      .from("course_catalog")
      .select("course_slug,title,description")
      .eq("course_slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      showMessage("لم نعثر على دورة منشورة بهذا الرابط.", true);
      $("courseNotFound").hidden = false;
      return;
    }

    const title = data.title || data.course_slug || "دورة تعليمية";
    const categoryLabels = {
      programming: "البرمجة", python: "البرمجة", scratch: "برمجة الأطفال",
      "data-analysis": "تحليل البيانات", "business-administration": "الإدارة والأعمال",
      projects: "المشروعات التطبيقية", accounting: "المحاسبة",
      excel: "المهارات الرقمية", word: "المهارات الرقمية", powerpoint: "المهارات الرقمية",
      icdl: "المهارات الرقمية", windows: "المهارات الرقمية", "odoo-training": "أنظمة ERP"
    };
    const category = $("courseCategory");
    if (category) {
      category.textContent = categoryLabels[data.course_slug] || "مسار تعليمي";
      category.hidden = false;
    }
    $("courseTitle").textContent = title;
    $("courseDescription").textContent = data.description || "لم تُضف الإدارة وصفًا تفصيليًا لهذه الدورة بعد.";
    renderPublicOutline(data.course_slug);
    $("subscribeLink").href = "student-subscribe.html?course=" + encodeURIComponent(data.course_slug);
    document.title = title + " | Mohammed Afify Learning";
    $("courseDetails").hidden = false;

    if (data.course_slug === "odoo-training") {
      const introSection = $("odooIntroPresentation");
      const introFrame = $("odooIntroFrame");
      if (introSection && introFrame) {
        introFrame.src = introFrame.dataset.src || "odoo-training-intro.html";
        introSection.hidden = false;
      }
    }

    showMessage("تم تحميل معلومات الدورة بنجاح.");
  }

  loadCourse().catch((error) => {
    showMessage(error?.message || "تعذر تحميل معلومات الدورة الآن. أعد المحاولة أو ارجع إلى مكتبة الدورات.", true);
  });
})();
