/* Mohammed Afify — platform content retrieval assistant */
(() => {
  "use strict";

  if (document.getElementById("ma-site-assistant") || !document.body) return;

  const PAGE_PATHS = [
    "academy/accounting.html",
    "academy/accounting-unit-1.html",
    "academy/accounting-unit-2.html",
    "academy/accounting-unit-3.html",
    "academy/accounting-unit-4.html",
    "academy/accounting-unit-5.html",
    "academy/accounting-lesson-u1-01.html",
    "academy/accounting-quiz-u1.html",
    "academy/business-administration.html",
    "academy/certificates.html",
    "academy/content.html",
    "academy/data-analysis.html",
    "academy/excel.html",
    "academy/icdl.html",
    "academy/index.html",
    "academy/powerpoint.html",
    "academy/programming.html",
    "academy/projects.html",
    "academy/python.html",
    "academy/scratch.html",
    "academy/windows.html",
    "academy/word.html",
    "brand/preview.html",
    "index.html",
    "odoo-solutions.html",
  ];

  const path = window.location.pathname;
  const repoMarker = "/mohammed-afify/";
  const markerIndex = path.indexOf(repoMarker);

  const base = markerIndex >= 0
    ? path.slice(0, markerIndex) + repoMarker
    : "/";

  const siteUrl = (relativePath) =>
    new URL(base + relativePath, window.location.origin).href;

  const whatsappLink = Array.from(
    document.querySelectorAll("a[href]")
  ).find((a) => /wa\.me|api\.whatsapp\.com/i.test(a.href));

  const destinations = {
    learning: {
      href: siteUrl("academy/index.html"),
      label: "افتح مكتبة الدورات"
    },
    odoo: {
      href: siteUrl("odoo-solutions.html"),
      label: "افتح حلول Odoo"
    },
    projects: {
      href: siteUrl("academy/projects.html"),
      label: "شاهد المشروعات"
    },
    certificates: {
      href: siteUrl("academy/certificates.html"),
      label: "الملف المهني والشهادات"
    },
    contact: whatsappLink
      ? { href: whatsappLink.href, label: "تواصل عبر واتساب", external: true }
      : { href: siteUrl("index.html#contact"), label: "افتح صفحة التواصل" }
  };

  const root = document.createElement("aside");
  root.id = "ma-site-assistant";
  root.setAttribute("aria-label", "مساعد Mohammed Afify");

  root.innerHTML = `
    <button class="ma-assistant-greeting" type="button" aria-expanded="false">
      أهلًا! أنا هنا لمساعدتك 👋
    </button>

    <button class="ma-assistant-launcher" type="button"
      aria-label="افتح مساعد الموقع" aria-expanded="false">
      <img class="ma-robot-avatar-image ma-robot-launcher-image ma-robot-launcher-full-image" src="${siteUrl("assets/images/assistant/mohammed-afify-robot-mascot.png")}" alt="" aria-hidden="true">
    </button>

    <section class="ma-assistant-panel" role="dialog" aria-modal="false"
      aria-labelledby="ma-assistant-title" aria-hidden="true">
      <header class="ma-assistant-panel-header">
        <button class="ma-assistant-close" type="button" aria-label="إغلاق المساعد">×</button>
        <div class="ma-assistant-avatar" aria-hidden="true">
          <img class="ma-robot-avatar-image ma-robot-header-image" src="${siteUrl("assets/images/assistant/mohammed-afify-robot-avatar.png")}" alt="" aria-hidden="true">
        </div>
        <div class="ma-assistant-header-copy">
          <strong id="ma-assistant-title">مساعد Mohammed Afify</strong>
          <small><span class="ma-assistant-online"></span> يبحث داخل محتوى المنصة</small>
        </div>
      </header>

      <div class="ma-assistant-messages" role="log"
        aria-live="polite" aria-relevant="additions text">
        <div class="ma-chat-row is-assistant">
          <div class="ma-chat-bubble">أهلًا بيك! أنا هنا لمساعدتك. اسألني عن أي موضوع موجود في المنصة، مثل Excel أو البرمجة أو حلول Odoo، وهبحث في المحتوى وأعرض لك رابط المصدر.</div>
        </div>
      </div>

      <div class="ma-assistant-chips" aria-label="أسئلة سريعة">
        <button class="ma-assistant-chip" type="button" data-question="ماذا يوجد في دورات Excel؟">Excel</button>
        <button class="ma-assistant-chip" type="button" data-question="ما محتوى تحليل البيانات وPower BI؟">تحليل البيانات</button>
        <button class="ma-assistant-chip" type="button" data-question="ما حلول Odoo الموجودة في المنصة؟">حلول Odoo</button>
        <button class="ma-assistant-chip" type="button" data-question="أين أجد المشروعات التطبيقية؟">المشروعات</button>
        <button class="ma-assistant-chip" type="button" data-question="ما حلول إدارة العيادات الطبية؟">العيادات</button>
        <button class="ma-assistant-chip" type="button" data-question="ما نظام إدارة الحضانات؟">الحضانات</button>
        <button class="ma-assistant-chip" type="button" data-question="ما محتوى مسار الإدارة والأعمال؟">الإدارة والأعمال</button>
      </div>

      <form class="ma-assistant-composer">
        <textarea class="ma-assistant-input" rows="1" maxlength="700"
          aria-label="اكتب سؤالك" placeholder="اكتب سؤالك هنا..." required></textarea>
        <button class="ma-assistant-send" type="submit">إرسال</button>
      </form>
      <div class="ma-assistant-disclaimer">
        الإجابات مبنية على محتوى صفحات المنصة؛ رابط المصدر يظهر في نهاية الإجابة.
      </div>
    </section>
  `;

  document.body.appendChild(root);

  const launcher = root.querySelector(".ma-assistant-launcher");
  const greeting = root.querySelector(".ma-assistant-greeting");
  const panel = root.querySelector(".ma-assistant-panel");
  const close = root.querySelector(".ma-assistant-close");
  const log = root.querySelector(".ma-assistant-messages");
  const form = root.querySelector(".ma-assistant-composer");
  const input = root.querySelector(".ma-assistant-input");
  // MOHAMMED AFIFY ROBOT COMPANION V1
  // Adds the approved full-body mascot beside the initial welcome message only.
  const assistantMascotUrl = siteUrl("assets/images/assistant/mohammed-afify-robot-mascot.png");
  const initialWelcomeRow = log.querySelector(".ma-chat-row.is-assistant");

  if (initialWelcomeRow && !initialWelcomeRow.querySelector(".ma-assistant-welcome-mascot")) {
    initialWelcomeRow.classList.add("ma-chat-welcome-row");

    const mascotFrame = document.createElement("div");
    mascotFrame.className = "ma-assistant-welcome-mascot-frame";

    const mascotImage = document.createElement("img");
    mascotImage.className = "ma-assistant-welcome-mascot";
    mascotImage.src = assistantMascotUrl;
    mascotImage.alt = "روبوت مساعد Mohammed Afify";
    mascotImage.decoding = "async";
    mascotImage.loading = "eager";

    mascotFrame.appendChild(mascotImage);
    initialWelcomeRow.insertBefore(mascotFrame, initialWelcomeRow.firstChild);
  }

  function setOpen(open) {
    root.classList.toggle("ma-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    greeting.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));

    if (open) {
      setTimeout(() => input.focus(), 50);
    }
  }

  launcher.addEventListener("click", () =>
    setOpen(!root.classList.contains("ma-open"))
  );
  greeting.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => {
    setOpen(false);
    launcher.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.classList.contains("ma-open")) {
      setOpen(false);
      launcher.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (root.classList.contains("ma-open") && !root.contains(event.target)) {
      setOpen(false);
    }
  });

  function addMessage(text, who, actions) {
    const row = document.createElement("div");
    row.className = "ma-chat-row " +
      (who === "user" ? "is-user" : "is-assistant");

    const bubble = document.createElement("div");
    bubble.className = "ma-chat-bubble";
    bubble.textContent = text;

    if (actions && actions.length) {
      const wrap = document.createElement("div");
      wrap.className = "ma-chat-actions";

      actions.forEach((action) => {
        const anchor = document.createElement("a");
        anchor.className = "ma-chat-action";
        anchor.href = action.href;
        anchor.textContent = action.label;

        if (action.external) {
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
        }

        wrap.appendChild(anchor);
      });

      bubble.appendChild(wrap);
    }

    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/[ؤ]/g, "و")
      .replace(/[ئ]/g, "ي")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ـ/g, "")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      .replace(/[^\w\u0600-\u06FF+#.\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeToken(token) {
    let value = normalizeText(token);

    if (/^[\u0600-\u06FF]+$/.test(value)) {
      value = value.replace(/^(وال|بال|لل|ال|و|ب|ل)/, "");

      if (value.length > 6) {
        value = value.replace(/(ات|ون|ين|يه|ية)$/, "");
      }
    }

    return value;
  }

  const STOP_WORDS = new Set([
    "انا", "انت", "انتي", "عايز", "عاوزه", "عاوز", "محتاج", "محتاجه",
    "من", "في", "عن", "على", "الي", "الى", "هو", "هي", "ده", "دي",
    "ايه", "ما", "ماذا", "كيف", "هل", "لو", "لي", "بلي", "مع",
    "اريد", "ممكن", "فضلا", "من فضلك", "فين", "ازاي", "يوجد"
  ]);

  function tokens(value) {
    return normalizeText(value)
      .split(/\s+/)
      .map(normalizeToken)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  }

  const SYNONYM_GROUPS = [
    {
      keys: ["excel", "اكسل", "اكسيل", "جداول البيانات"],
      terms: ["excel", "اكسل", "اكسيل", "الدوال", "المعادلات", "الجداول", "تنسيق الخلايا"]
    },
    {
      keys: ["تحليل البيانات", "data analysis", "power bi", "باور بي اي"],
      terms: ["تحليل البيانات", "data analysis", "power bi", "باور بي اي", "excel", "power query", "التقارير", "البيانات"]
    },
    {
      keys: ["odoo", "اودو", "erp"],
      terms: ["odoo", "اودو", "erp", "المحاسبة", "المخزون", "المبيعات", "المشتريات", "الفواتير", "التنفيذ"]
    },
    {
      keys: ["برمجة", "البرمجه", "python", "بايثون", "scratch", "سكراتش"],
      terms: ["برمجة", "programming", "python", "بايثون", "scratch", "سكراتش", "المشروعات", "الكود"]
    },
    {
      keys: ["word", "وورد", "مستندات"],
      terms: ["word", "وورد", "المستندات", "التنسيق", "Microsoft Word"]
    },
    {
      keys: ["powerpoint", "باوربوينت", "العروض التقديمية"],
      terms: ["powerpoint", "باوربوينت", "العروض", "الشرائح", "presentation"]
    },
    {
      keys: ["icdl", "مهارات الكمبيوتر", "مهارات الحاسب"],
      terms: ["icdl", "مهارات الكمبيوتر", "windows", "excel", "word", "powerpoint"]
    },
    {
      keys: ["شهادات", "شهاده", "الملف المهني", "السيرة الذاتية"],
      terms: ["الشهادات", "certificate", "الملف المهني", "السيرة الذاتية", "الإنجازات"]
    },
    {
      keys: ["مشروعات", "مشروع", "اعمال تطبيقية"],
      terms: ["مشروعات", "مشروع", "تطبيقية", "portfolio", "المشروعات الجاهزة"]
    },
    {
      keys: ["تعلم", "اتعلم", "دورات", "كورسات", "تعليمي"],
      terms: ["تعليم", "الدورات", "المحتوى التعليمي", "المكتبة", "الفيديوهات", "المسارات"]
    },
    {
      keys: ["حضانة", "حضانات", "nursery", "ادارة الحضانات", "ادراك"],
      terms: ["حضانة", "حضانات", "nursery", "الطفل", "الأطفال", "الأسرة", "الحضور", "الانصراف", "الفصول", "الرسوم", "النقل", "الصحة", "الأنشطة"]
    },
    {
      keys: ["عيادة", "عيادات", "clinic", "clinics", "طبي", "طبية", "مركز طبي"],
      terms: ["عيادة", "عيادات", "clinic", "clinics", "المرضى", "المواعيد", "الأطباء", "الاستقبال", "الفواتير", "التحصيل", "الخدمات الطبية"]
    },
    {
      keys: ["مدرسة", "مدارس", "school", "schools"],
      terms: ["مدرسة", "مدارس", "الطلاب", "المراحل", "الصفوف", "البيانات الأكاديمية", "الحضور", "الرسوم"]
    },
    {
      keys: ["مركز تعليمي", "المراكز التعليمية", "دروس", "تدريس", "tutoring"],
      terms: ["مركز تعليمي", "المراكز التعليمية", "المجموعات", "الطلاب", "المعلمين", "الحصص", "الحضور", "التحصيل"]
    },
    {
      keys: ["موارد بشرية", "الموارد البشرية", "hr", "الموظفين", "شؤون العاملين"],
      terms: ["الموارد البشرية", "الموظفين", "ملفات الموظفين", "الحضور", "الانصراف", "الإجازات", "الرواتب", "إجراءات العمل"]
    },
    {
      keys: ["تأهيل", "التأهيل", "مركز التأهيل", "rehabilitation", "تخاطب", "علاج وظيفي"],
      terms: ["مركز التأهيل", "التأهيل", "تخاطب", "تعديل السلوك", "صعوبات التعلم", "العلاج الوظيفي", "العلاج الطبيعي", "التقييم النفسي", "الجلسات", "الباقات"]
    },
    {
      keys: ["ادارة واعمال", "الإدارة والأعمال", "business", "ريادة الأعمال", "مشروعات"],
      terms: ["الإدارة", "الأعمال", "إدارة الأعمال", "المشروعات", "التخطيط", "القرارات", "التسويق", "المبيعات", "التطبيق العملي"]
    },
    {
      keys: [
        "محاسبة", "حسابات", "accounting", "مالية", "فواتير",
        "مدين", "دائن", "الخصوم", "الأصول", "القيد المزدوج",
        "ميزان المراجعة", "دفاتر الأستاذ", "دفاتر اليومية",
        "المعادلة المحاسبية", "الاستحقاق"
      ],
      terms: [
        "المحاسبة", "الحسابات", "الفواتير", "القيود", "المدفوعات",
        "التقارير المالية", "الدورة المحاسبية", "القيد المزدوج",
        "المدين", "الدائن", "الأصول", "الخصوم", "حقوق الملكية",
        "دفاتر الأستاذ", "دفاتر اليومية", "ميزان المراجعة",
        "القوائم المالية", "الأساس النقدي", "أساس الاستحقاق"
      ]
    },
    {
      keys: ["اشتراك", "التسجيل", "انضمام", "طلب الانضمام", "عضوية"],
      terms: ["الاشتراك", "التسجيل", "طلب الاشتراك", "الانضمام", "نموذج التسجيل", "حساب الطالب"]
    }
  ];

  function expandedTerms(query) {
    const normalizedQuery = normalizeText(query);
    const baseTerms = tokens(query);
    const expanded = new Set(baseTerms);

    SYNONYM_GROUPS.forEach((group) => {
      const matched = group.keys.some((key) => {
        const keyTokens = tokens(key);

        return normalizedQuery.includes(normalizeText(key)) ||
          normalizeText(key).includes(normalizedQuery) ||
          keyTokens.some((keyToken) =>
            baseTerms.some((queryToken) =>
              queryToken.length >= 3 &&
              keyToken.length >= 3 &&
              (keyToken.includes(queryToken) || queryToken.includes(keyToken))
            )
          );
      });

      if (matched) {
        group.terms.forEach((term) => {
          tokens(term).forEach((word) => expanded.add(word));
        });
      }
    });

    return { baseTerms, expandedTerms: Array.from(expanded), normalizedQuery };
  }
  const BLOCK_SELECTOR = [
    ".category-card", ".course-card", ".gs-tool-card", ".gs-source-block",
    ".gs-resource", ".platform-video-card", ".odoo-detail-card",
    ".odoo-accounting-steps > div", ".service-item", ".odoo-solution-tile",
    ".course-track-card", ".program-card", "[data-assistant-index]",
    ".ac-unit-grid > *", ".ac-lesson-row", ".al-content-section",
    ".al-case-story", ".al-case-analysis", ".al-function-card",
    ".av-quiz-question"
  ].join(",");

  let knowledgePromise = null;

  function getEntryUrl(node, relativePath) {
    const pageHref = siteUrl(relativePath);
    const linkedNode = node.matches("a[href]") ? node : node.closest("a[href]");

    if (linkedNode) {
      const rawHref = linkedNode.getAttribute("href") || "";
      if (rawHref && !/^(javascript:|mailto:|tel:)/i.test(rawHref)) {
        try {
          const candidate = new URL(rawHref, pageHref);
          const basePath = new URL(base, window.location.origin).pathname;
          if (candidate.origin === window.location.origin &&
              candidate.pathname.startsWith(basePath)) {
            return candidate.href;
          }
        } catch (_) {
          // Fall back to the page/section URL when the link is malformed.
        }
      }
    }

    const section = node.closest("section[id], article[id]");
    if (section && /^[A-Za-z][\w:.-]*$/.test(section.id)) {
      const target = new URL(pageHref);
      target.hash = section.id;
      return target.href;
    }

    return pageHref;
  }

  async function buildPageEntries(relativePath) {
    const response = await fetch(siteUrl(relativePath), { cache: "no-cache", credentials: "same-origin" });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + relativePath);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pageTitle = (doc.querySelector("title")?.textContent || relativePath)
      .replace(/\s*\|\s*Mohammed Afify\s*/i, "")
      .trim();

    const main = doc.querySelector("main") || doc.body;
    if (!main) return [];

    main.querySelectorAll(
      "script, style, noscript, iframe, form, nav, footer, button, .ma-site-assistant"
    ).forEach((element) => element.remove());

    const selector = [
      "h1", "h2", "h3", "p", "li", "a[href]", "td", "th", "dt", "dd", "blockquote", "figcaption",
      BLOCK_SELECTOR
    ].join(",");

    const candidates = Array.from(main.querySelectorAll(selector));
    const seen = new Set();
    const entries = [];

    candidates.forEach((node) => {
      const isBlock = node.matches(BLOCK_SELECTOR);
      const parentBlock = node.closest(BLOCK_SELECTOR);

      if (!isBlock && parentBlock) return;

      const text = (node.innerText || node.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      if (!text || text.length < 18) return;

      const dedupeKey = normalizeText(text).slice(0, 500);
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const section = node.closest("section, article") || main;
      const ownHeading = node.matches("h1,h2,h3")
        ? text
        : "";

      const nestedHeading = node.querySelector("h1,h2,h3,h4,strong");
      const sectionHeading = section.querySelector("h1,h2,h3");

      const heading = (
        ownHeading ||
        (nestedHeading?.textContent || "").trim() ||
        (sectionHeading?.textContent || "").trim() ||
        pageTitle
      ).replace(/\s+/g, " ").trim();

      entries.push({
        page: relativePath,
        pageTitle,
        heading,
        text: text.slice(0, 800),
        url: getEntryUrl(node, relativePath)
      });
    });

    return entries;
  }

  async function getKnowledge() {
    if (!knowledgePromise) {
      knowledgePromise = Promise.allSettled(
        PAGE_PATHS.map(buildPageEntries)
      ).then((settled) => {
        const entries = [];
        const failures = [];

        settled.forEach((result, index) => {
          if (result.status === "fulfilled") {
            entries.push(...result.value);
          } else {
            failures.push(PAGE_PATHS[index]);
          }
        });

        if (!entries.length) {
          throw new Error("تعذر تحميل محتوى صفحات المنصة.");
        }

        return { entries, failures };
      });
    }

    return knowledgePromise;
  }

  // MOHAMMED AFIFY SMART SEARCH ENGINE V2
  // Exact phrase, partial word, infix fragment and one-character typo matching.

  function editDistanceAtMostOne(left, right) {
    if (left === right) return 0;
    if (Math.abs(left.length - right.length) > 1) return 2;

    let i = 0;
    let j = 0;
    let edits = 0;

    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        i++;
        j++;
        continue;
      }

      edits++;
      if (edits > 1) return 2;

      if (left.length > right.length) i++;
      else if (right.length > left.length) j++;
      else {
        i++;
        j++;
      }
    }

    if (i < left.length || j < right.length) edits++;
    return edits;
  }

  function tokenMatchStrength(textTokens, term) {
    if (!term) return 0;

    let best = 0;

    for (const word of textTokens) {
      if (word === term) return 1;

      const shortest = Math.min(word.length, term.length);
      const longest = Math.max(word.length, term.length);

      // Match a fragment anywhere inside a word, not only at its beginning.
      if ((word.includes(term) || term.includes(word)) && shortest >= 2) {
        let strength;

        if (shortest >= 5) strength = 0.94;
        else if (shortest >= 4) strength = 0.86;
        else if (shortest === 3) strength = 0.72;
        else strength = 0.42;

        // Keep very short fragments from overpowering precise matches.
        strength *= Math.min(1, shortest / Math.max(3, longest * 0.55));
        best = Math.max(best, strength);
        continue;
      }

      // Tolerate one missing, extra or mistyped character in longer words.
      if (shortest >= 4 && editDistanceAtMostOne(word, term) === 1) {
        best = Math.max(best, 0.48);
      }
    }

    return best;
  }

  function scoreEntry(entry, queryInfo) {
    const titleTokens = new Set(tokens(entry.heading + " " + entry.pageTitle));
    const textTokens = new Set(tokens(entry.text));
    const combined = normalizeText(
      entry.heading + " " + entry.pageTitle + " " + entry.text
    );

    let score = 0;
    let matchedOriginal = 0;
    let matchedTitle = 0;
    let synonymBonus = 0;

    queryInfo.baseTerms.forEach((term) => {
      const titleStrength = tokenMatchStrength(titleTokens, term);
      const textStrength = tokenMatchStrength(textTokens, term);
      const bestStrength = Math.max(titleStrength, textStrength);

      if (bestStrength > 0) matchedOriginal++;

      if (titleStrength > 0) {
        matchedTitle++;
        score += 10 * titleStrength;
      }

      if (textStrength > 0) {
        score += 3.4 * textStrength;
      }
    });

    // Full phrase match is stronger than a broad synonym match.
    if (
      queryInfo.normalizedQuery.length >= 3 &&
      combined.includes(queryInfo.normalizedQuery)
    ) {
      score += 18;
    }

    // Reward entries containing all meaningful query words.
    if (
      queryInfo.baseTerms.length > 1 &&
      matchedOriginal === queryInfo.baseTerms.length
    ) {
      score += 3.5;
    }

    // Synonyms provide discovery help but cannot create results alone.
    if (matchedOriginal > 0) {
      queryInfo.expandedTerms.forEach((term) => {
        if (queryInfo.baseTerms.includes(term)) return;

        const titleStrength = tokenMatchStrength(titleTokens, term);
        const textStrength = tokenMatchStrength(textTokens, term);

        synonymBonus += (titleStrength * 0.7) + (textStrength * 0.18);
      });
    }

    score += Math.min(2.2, synonymBonus);

    // Penalize a result that matches only a tiny fraction of a long query.
    if (queryInfo.baseTerms.length > 1) {
      const coverage = matchedOriginal / queryInfo.baseTerms.length;
      score *= 0.45 + (0.55 * coverage);
    }

    return { score, matchedOriginal, matchedTitle };
  }

  function searchKnowledge(entries, query) {
    const queryInfo = expandedTerms(query);
    if (!queryInfo.baseTerms.length) return [];

    const ranked = entries.map((entry) => {
      const result = scoreEntry(entry, queryInfo);

      return {
        ...entry,
        score: result.score,
        matchedOriginal: result.matchedOriginal,
        matchedTitle: result.matchedTitle
      };
    }).filter((entry) => {
      const threshold = queryInfo.baseTerms.length === 1 ? 1.8 : 2.0;
      return entry.matchedOriginal > 0 && entry.score >= threshold;
    });

    ranked.sort((a, b) =>
      (b.score - a.score) ||
      (b.matchedOriginal - a.matchedOriginal) ||
      (b.matchedTitle - a.matchedTitle)
    );

    // Return the strongest excerpt from each source page.
    const selected = [];
    const usedPages = new Set();

    for (const entry of ranked) {
      if (usedPages.has(entry.page)) continue;

      usedPages.add(entry.page);
      selected.push(entry);

      if (selected.length >= 5) break;
    }

    return selected;
  }
  function cleanSnippet(value, maxLength = 330) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
  }

  function pageLabel(page) {
    const labels = {
      "index.html": "الواجهة الرئيسية",
      "odoo-solutions.html": "حلول Odoo",
      "academy/accounting.html": "كورس المحاسبة",
      "academy/accounting-unit-1.html": "المحاسبة - الوحدة الأولى",
      "academy/accounting-unit-2.html": "المحاسبة - الوحدة الثانية",
      "academy/accounting-unit-3.html": "المحاسبة - الوحدة الثالثة",
      "academy/accounting-unit-4.html": "المحاسبة - الوحدة الرابعة",
      "academy/accounting-unit-5.html": "المحاسبة - الوحدة الخامسة",
      "academy/accounting-lesson-u1-01.html": "المحاسبة - الدرس الأول",
      "academy/accounting-quiz-u1.html": "اختبار الوحدة الأولى - المحاسبة",      "academy/certificates.html": "الشهادات والملف المهني",
      "academy/content.html": "المحتوى التعليمي",
      "academy/data-analysis.html": "تحليل البيانات",
      "academy/excel.html": "Microsoft Excel",
      "academy/icdl.html": "ICDL ومهارات الكمبيوتر",
      "academy/index.html": "مكتبة الدورات التعليمية",
      "academy/business-administration.html": "الإدارة والأعمال",
      "membership/register.html": "طلب الاشتراك والتسجيل",
      "academy/powerpoint.html": "Microsoft PowerPoint",
      "academy/programming.html": "البرمجة",
      "academy/projects.html": "المشروعات التطبيقية",
      "academy/python.html": "Python",
      "academy/scratch.html": "Scratch وبرمجة الأطفال",
      "academy/windows.html": "Windows والإنترنت",
      "academy/word.html": "Microsoft Word"
    };

    return labels[page] || page;
  }

  function makeAnswer(results, failures, query) {
    if (!results.length) {
      const text = failures.length
        ? "حاولت البحث في صفحات المنصة، لكن لم أجد تطابقًا كافيًا أو تعذر تحميل بعض الصفحات. جرّب سؤالًا أكثر تحديدًا، مثل: محتوى Excel أو حلول Odoo."
        : "لم أجد معلومات كافية تطابق سؤالك في صفحات المنصة التي بحثت فيها. جرّب اسم دورة أو برنامج أو خدمة محددة.";

      return {
        text,
        actions: [
          destinations.learning,
          destinations.odoo,
          destinations.projects,
          destinations.contact
        ]
      };
    }

    const parts = [
      "بحثت في محتوى المنصة، ودي أقرب المعلومات لسؤالك:"
    ];

    results.forEach((entry, index) => {
      parts.push(
        `${index + 1}. ${entry.heading}\n${cleanSnippet(entry.text)}`
      );
    });

    if (failures.length) {
      parts.push("ملاحظة: تعذر قراءة بعض الصفحات أثناء البحث؛ قد تكون هناك معلومات إضافية لم تظهر في هذه النتيجة.");
    }

    const actions = results.map((entry) => ({
      href: entry.url,
      label: "المصدر: " + cleanSnippet(entry.heading || pageLabel(entry.page), 48)
    }));

    // Keep source links at the end of every answer.
    return {
      text: parts.join("\n\n"),
      actions
    };
  }

  async function handleQuestion(question) {
    const value = String(question || "").trim();
    if (!value) return;

    addMessage(value, "user");

    const loadingRow = addMessage(
      "بدور في صفحات المنصة وبراجع المحتوى الأقرب لسؤالك…",
      "assistant"
    );

    try {
      const knowledge = await getKnowledge();
      const results = searchKnowledge(knowledge.entries, value);
      const response = makeAnswer(results, knowledge.failures, value);

      loadingRow.remove();
      addMessage(response.text, "assistant", response.actions);
    } catch (error) {
      loadingRow.remove();
      addMessage(
        "واجهت مشكلة في قراءة صفحات المنصة. تأكد أن الموقع يعمل من خلال localhost أو الرابط المنشور، ثم جرّب مرة أخرى.",
        "assistant",
        [
          destinations.learning,
          destinations.odoo,
          destinations.contact
        ]
      );
      console.error("Platform assistant retrieval error:", error);
    }
  }

  // Live, page-wide search suggestions while the visitor types.
  const liveSearchPanel = document.createElement("div");
  liveSearchPanel.className = "ma-assistant-search-suggestions";
  liveSearchPanel.hidden = true;
  liveSearchPanel.setAttribute("role", "region");
  liveSearchPanel.setAttribute("aria-label", "نتائج البحث في محتوى المنصة");

  const liveSearchStyle = document.createElement("style");
  liveSearchStyle.textContent = `
    .ma-assistant-search-suggestions {
      margin: 8px 10px 10px;
      padding: 10px;
      border: 1px solid #dce6ed;
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(18, 38, 63, .09);
      max-height: 270px;
      overflow-y: auto;
      direction: rtl;
      color: #142743;
    }
    .ma-assistant-search-suggestions[hidden] { display: none !important; }
    .ma-assistant-search-suggestions .ma-search-heading {
      margin: 0 0 7px;
      color: #087f73;
      font-size: 12px;
      font-weight: 800;
    }
    .ma-assistant-search-suggestions a {
      display: block;
      padding: 9px 10px;
      margin-top: 6px;
      border: 1px solid #edf1f5;
      border-radius: 10px;
      background: #f9fbfd;
      color: #243b55;
      text-decoration: none;
      line-height: 1.65;
    }
    .ma-assistant-search-suggestions a:hover,
    .ma-assistant-search-suggestions a:focus-visible {
      border-color: #5bdac3;
      background: #effbf8;
      outline: none;
    }
    .ma-assistant-search-suggestions strong {
      display: block;
      color: #142743;
      font-size: 13px;
    }
    .ma-assistant-search-suggestions small {
      display: block;
      margin-top: 3px;
      color: #52677e;
      font-size: 11px;
    }
    .ma-assistant-search-suggestions .ma-search-source {
      display: block;
      margin-top: 4px;
      color: #087f73;
      font-size: 10px;
      font-weight: 800;
    }
    .ma-assistant-search-suggestions .ma-search-empty {
      padding: 10px;
      color: #52677e;
      font-size: 12px;
      line-height: 1.7;
    }
  `;
  root.appendChild(liveSearchStyle);
  form.insertAdjacentElement("beforebegin", liveSearchPanel);

  let liveSearchTimer = null;
  let liveSearchSequence = 0;

  function renderLiveSearchResults(results, query) {
    liveSearchPanel.replaceChildren();

    const heading = document.createElement("p");
    heading.className = "ma-search-heading";
    heading.textContent = results.length
      ? `نتائج مطابقة لـ «${query}» (${results.length})`
      : `لم تظهر نتائج مطابقة لـ «${query}»`;
    liveSearchPanel.appendChild(heading);

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "ma-search-empty";
      empty.textContent = "جرّب كلمة أخرى أو اكتب عبارة أطول. يتم البحث في الصفحات العامة ومحتواها.";
      liveSearchPanel.appendChild(empty);
      liveSearchPanel.hidden = false;
      return;
    }

    results.forEach((entry) => {
      const link = document.createElement("a");
      link.href = entry.url;

      const title = document.createElement("strong");
      title.textContent = entry.heading || entry.pageTitle || pageLabel(entry.page);

      const snippet = document.createElement("small");
      snippet.textContent = cleanSnippet(entry.text, 180);

      const source = document.createElement("span");
      source.className = "ma-search-source";
      source.textContent = "فتح المصدر: " + pageLabel(entry.page) + " ↗";

      link.append(title, snippet, source);
      liveSearchPanel.appendChild(link);
    });

    liveSearchPanel.hidden = false;
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    const normalized = normalizeText(query);
    const sequence = ++liveSearchSequence;

    if (liveSearchTimer) clearTimeout(liveSearchTimer);

    if (normalized.length < 2 || !tokens(query).length) {
      liveSearchPanel.hidden = true;
      liveSearchPanel.replaceChildren();
      return;
    }

    liveSearchPanel.hidden = false;
    liveSearchPanel.textContent = "جارٍ البحث في محتوى المنصة…";

    liveSearchTimer = setTimeout(async () => {
      try {
        const knowledge = await getKnowledge();
        if (sequence !== liveSearchSequence || input.value.trim() !== query) return;
        const results = searchKnowledge(knowledge.entries, query);
        renderLiveSearchResults(results, query);
      } catch (error) {
        if (sequence !== liveSearchSequence) return;
        liveSearchPanel.textContent = "تعذر تحميل نتائج البحث. تأكد من اتصال الموقع ثم أعد المحاولة.";
        liveSearchPanel.hidden = false;
        console.error("Live platform search error:", error);
      }
    }, 220);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      liveSearchPanel.hidden = true;
    }
  });

  form.addEventListener("submit", () => {
    liveSearchPanel.hidden = true;
  });
  root.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      handleQuestion(button.getAttribute("data-question"));
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;

    input.value = "";
    input.style.height = "auto";
    handleQuestion(value);
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 105) + "px";
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
})();