/* Mohammed Afify — platform content retrieval assistant */
(() => {
  "use strict";

  if (document.getElementById("ma-site-assistant") || !document.body) return;

  const PAGE_PATHS = [
    "index.html",
    "odoo-solutions.html",
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
    "academy/word.html"
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
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M24 6v5" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="24" cy="4" r="2.5" fill="#BFFFF3"/>
        <rect x="7" y="12" width="34" height="27" rx="9"
          fill="rgba(255,255,255,.18)" stroke="white" stroke-width="2"/>
        <rect x="12" y="19" width="24" height="11" rx="5.5"
          fill="#123B44" stroke="#C2FFF4" stroke-width="1.4"/>
        <circle cx="19" cy="24.5" r="2" fill="#75F1DB"/>
        <circle cx="29" cy="24.5" r="2" fill="#75F1DB"/>
        <path d="M18 34h12" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <section class="ma-assistant-panel" role="dialog" aria-modal="false"
      aria-labelledby="ma-assistant-title" aria-hidden="true">
      <header class="ma-assistant-panel-header">
        <button class="ma-assistant-close" type="button" aria-label="إغلاق المساعد">×</button>
        <div class="ma-assistant-avatar" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="8" y="12" width="32" height="27" rx="9"
              fill="rgba(255,255,255,.15)" stroke="white" stroke-width="2"/>
            <rect x="13" y="19" width="22" height="11" rx="5.5"
              fill="#123B44" stroke="#A8F4E8"/>
            <circle cx="19" cy="24.5" r="2" fill="#75F1DB"/>
            <circle cx="29" cy="24.5" r="2" fill="#75F1DB"/>
            <path d="M18 34h12" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
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
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ـ/g, "")
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
    }
  ];

  function expandedTerms(query) {
    const normalizedQuery = normalizeText(query);
    const baseTerms = tokens(query);
    const expanded = new Set(baseTerms);

    SYNONYM_GROUPS.forEach((group) => {
      const matched = group.keys.some((key) =>
        normalizedQuery.includes(normalizeText(key))
      );

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
    ".odoo-accounting-steps > div"
  ].join(",");

  let knowledgePromise = null;

  async function buildPageEntries(relativePath) {
    const response = await fetch(siteUrl(relativePath), { cache: "force-cache" });

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
      "h1", "h2", "h3", "p", "li", "a[href]",
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
        url: siteUrl(relativePath)
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

  function tokenMatches(textTokens, term) {
    if (textTokens.has(term)) return true;
    if (term.length < 3) return false;

    for (const word of textTokens) {
      if (word.length >= 3 && (word.startsWith(term) || term.startsWith(word))) {
        return true;
      }
    }
    return false;
  }

  function scoreEntry(entry, queryInfo) {
    const titleTokens = new Set(tokens(entry.heading + " " + entry.pageTitle));
    const textTokens = new Set(tokens(entry.text));

    let score = 0;
    let matchedOriginal = 0;

    queryInfo.baseTerms.forEach((term) => {
      const titleMatch = tokenMatches(titleTokens, term);
      const textMatch = tokenMatches(textTokens, term);

      if (titleMatch) score += 5;
      if (textMatch) score += 2.1;
      if (titleMatch || textMatch) matchedOriginal++;
    });

    queryInfo.expandedTerms.forEach((term) => {
      if (queryInfo.baseTerms.includes(term)) return;

      const titleMatch = tokenMatches(titleTokens, term);
      const textMatch = tokenMatches(textTokens, term);

      if (titleMatch) score += 2.0;
      if (textMatch) score += 0.65;
    });

    const combined = normalizeText(entry.heading + " " + entry.text);
    if (queryInfo.normalizedQuery.length >= 3 &&
        combined.includes(queryInfo.normalizedQuery)) {
      score += 8;
    }

    if (queryInfo.baseTerms.length >= 2 && matchedOriginal === 0) {
      score *= 0.35;
    }

    return { score, matchedOriginal };
  }

  function searchKnowledge(entries, query) {
    const queryInfo = expandedTerms(query);

    const ranked = entries.map((entry) => {
      const result = scoreEntry(entry, queryInfo);
      return { ...entry, score: result.score, matchedOriginal: result.matchedOriginal };
    }).filter((entry) => entry.score > 0);

    ranked.sort((a, b) => b.score - a.score);

    // Limit results to one best matching excerpt per source page.
    const selected = [];
    const usedPages = new Set();

    for (const entry of ranked) {
      if (usedPages.has(entry.page)) continue;
      if (selected.length === 0 && entry.score < 2.5) break;

      usedPages.add(entry.page);
      selected.push(entry);

      if (selected.length >= 3) break;
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
      "academy/certificates.html": "الشهادات والملف المهني",
      "academy/content.html": "المحتوى التعليمي",
      "academy/data-analysis.html": "تحليل البيانات",
      "academy/excel.html": "Microsoft Excel",
      "academy/icdl.html": "ICDL ومهارات الكمبيوتر",
      "academy/index.html": "مكتبة الدورات التعليمية",
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
      label: "المصدر: " + pageLabel(entry.page)
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