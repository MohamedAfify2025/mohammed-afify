/* PROGRAM DETAIL DIALOG V5 — local test */
(() => {
  "use strict";

  const dialog = document.getElementById("odoo-program-dialog");
  const content = document.getElementById("odoo-program-dialog-content");

  if (!dialog || !content) return;

  const programs = {
    nursery: {
      number: "01",
      code: "EDRAK · NURSERY MANAGEMENT",
      title: "إدارة الحضانات — إدراك",
      intro: "تنظيم بيانات الأطفال والإجراءات اليومية للحضانة ضمن عرض أوضح للملفات والحضور والفصول والخدمات.",
      features: [
        "ملفات الأطفال والبيانات الأساسية",
        "الحضور والانصراف والمتابعة اليومية",
        "الفصول والمجموعات",
        "الرسوم والمصروفات",
        "الأنشطة والخدمات",
        "الصحة والنقل والتواصل مع أولياء الأمور"
      ],
      section: "#nursery",
      demo: "https://wa.me/201092452759?text=" + encodeURIComponent("أرغب في طلب عرض توضيحي لنظام إدراك لإدارة الحضانات.")
    },
    tutoring: {
      number: "02",
      code: "TUTORING CENTER MANAGEMENT",
      title: "إدارة المراكز التعليمية والدروس",
      intro: "تنظيم بيانات المجموعات والطلاب والحصص والحضور ضمن مسار متكامل للمركز التعليمي.",
      features: [
        "المجموعات التعليمية",
        "تسجيل الطلاب والاتصالات",
        "تنظيم الحصص والجلسات",
        "متابعة الحضور",
        "بيانات الطلاب والمعلمين",
        "ربط المنتجات والكتب عند الحاجة"
      ],
      section: "#tutoring",
      demo: "https://wa.me/201092452759?text=" + encodeURIComponent("أرغب في طلب عرض توضيحي لنظام إدارة المراكز التعليمية والدروس.")
    },
    school: {
      number: "03",
      code: "SCHOOL MANAGEMENT",
      title: "إدارة المدارس",
      intro: "تنظيم الهيكل الأكاديمي للمدرسة بما يساعد على وضوح المراحل والصفوف والمواد والدرجات.",
      features: [
        "المراحل الدراسية",
        "السنوات الدراسية",
        "الفصول والصفوف والمستويات",
        "المواد الدراسية",
        "سلالم الدرجات وتوزيعها",
        "تهيئة الهيكل الأكاديمي حسب الاحتياج"
      ],
      section: "#school",
      demo: "https://wa.me/201092452759?text=" + encodeURIComponent("أرغب في طلب عرض توضيحي لحل إدارة المدارس على Odoo.")
    },
    hr: {
      number: "04",
      code: "HUMAN RESOURCES · HR",
      title: "الموارد البشرية وشؤون الموظفين",
      intro: "تنظيم بيانات الموظفين وإجراءات المتابعة اليومية مع مراعاة الوظائف التي تعتمدها تهيئة النظام.",
      features: [
        "ملفات الموظفين",
        "الحضور والغياب",
        "الإجازات",
        "الجزاءات والاستقطاعات",
        "العمل الإضافي وكشوف الرواتب بحسب الإعداد",
        "التقارير الإدارية"
      ],
      section: "#hr",
      demo: "https://wa.me/201092452759?text=" + encodeURIComponent("أرغب في طلب عرض توضيحي لحل الموارد البشرية على Odoo.")
    },
    accounting: {
      number: "05",
      code: "ACCOUNTING MANAGEMENT",
      title: "إدارة الحسابات على Odoo",
      intro: "عرض لمسار المحاسبة من الإعدادات والقيود إلى الفواتير والمدفوعات والتقارير، وفق التوطين والإعدادات المعتمدة.",
      features: [
        "دليل الحسابات والإعدادات",
        "القيود ودفاتر اليومية",
        "فواتير العملاء والموردين",
        "التحصيل والمدفوعات",
        "الضرائب وفق الإعداد",
        "التسويات والتقارير المالية"
      ],
      section: "#accounting-management",
      demo: "https://wa.me/201092452759?text=" + encodeURIComponent("أرغب في طلب عرض توضيحي لبرنامج إدارة الحسابات على Odoo.")
    }
  };

  function el(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function link(className, href, text, closeBeforeNavigate) {
    const anchor = el("a", className, text);
    anchor.href = href;
    if (closeBeforeNavigate) anchor.dataset.closeDialog = "true";
    return anchor;
  }

  function renderProgram(key) {
    const program = programs[key];
    if (!program) return;

    content.replaceChildren();

    content.append(
      el("p", "odoo-program-dialog-eyebrow", program.code),
      el("h2", "odoo-program-dialog-title", program.title),
      el("p", "odoo-program-dialog-intro", program.intro),
      el("h3", "odoo-program-dialog-subheading", "ماذا يغطي هذا البرنامج؟")
    );

    const list = el("ul", "odoo-program-dialog-features");
    program.features.forEach(feature => {
      list.append(el("li", "", feature));
    });
    content.append(list);

    content.append(
      el(
        "div",
        "odoo-program-dialog-note",
        "تتحدد الوظائف النهائية بحسب إصدار النظام والإعدادات والتخصيص المتفق عليه."
      )
    );

    const actions = el("div", "odoo-program-dialog-actions");
    actions.append(
      link("dialog-section", program.section, "عرض تفاصيل البرنامج", true),
      link("dialog-demo", program.demo, "اطلب Demo للبرنامج ↗", false),
      link("dialog-join", "index.html#contact", "طلب الانضمام ←", false)
    );
    content.append(actions);
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest("button.odoo-system-node[data-program]");
    if (!trigger) return;

    event.preventDefault();
    renderProgram(trigger.dataset.program);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  });

  const closeButton = dialog.querySelector(".odoo-program-dialog-close");
  if (closeButton) {
    closeButton.addEventListener("click", () => dialog.close());
  }

  content.addEventListener("click", event => {
    const anchor = event.target.closest("a[data-close-dialog]");
    if (anchor && dialog.open) dialog.close();
  });

  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
})();

/* NURSERY CARD MODALS V6 START */
(() => {
  "use strict";

  const root = document.querySelector(".odoo-solutions-page");
  const dialog = document.getElementById("odoo-program-dialog");
  const content = document.getElementById("odoo-program-dialog-content");

  if (!root || !dialog || !content) return;

  function addElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function addLink(container, className, href, label, closeDialog) {
    if (!href) return;
    const link = addElement("a", className, label);
    link.href = href;
    if (closeDialog) link.dataset.closeDialog = "true";
    container.append(link);
  }

  function openFeature(card) {
    const index = card.querySelector(".nursery-card-index")?.textContent.trim() || "EDRAK";
    const title = card.querySelector(".nursery-card-title-wrap strong")?.textContent.trim() || "تفاصيل الميزة";
    const shortText = card.querySelector(".nursery-card-title-wrap small")?.textContent.trim() || "";
    const bodyText = card.querySelector(".nursery-feature-details p")?.textContent.trim() || shortText;
    const chips = [...card.querySelectorAll(".nursery-detail-chips span")]
      .map(chip => chip.textContent.trim())
      .filter(Boolean);

    content.replaceChildren();

    content.append(
      addElement("p", "odoo-program-dialog-eyebrow", index),
      addElement("h2", "odoo-program-dialog-title", title),
      addElement("p", "odoo-program-dialog-intro", shortText),
      addElement("h3", "odoo-program-dialog-subheading", "تفاصيل هذه الوظيفة")
    );

    const detail = addElement("p", "odoo-program-dialog-intro", bodyText);
    content.append(detail);

    if (chips.length) {
      const list = addElement("ul", "odoo-program-dialog-features");
      chips.forEach(chip => list.append(addElement("li", "", chip)));
      content.append(list);
    }

    content.append(
      addElement(
        "div",
        "odoo-program-dialog-note",
        "تتحدد الوظائف النهائية بحسب إصدار الموديول والإعدادات والتخصيص المتفق عليه."
      )
    );

    const actions = addElement("div", "odoo-program-dialog-actions");
    const nurserySection = document.getElementById("nursery");
    const demoHref = nurserySection?.querySelector(".nursery-showcase-primary")?.getAttribute("href");
    const joinHref = nurserySection?.querySelector(".nursery-showcase-secondary")?.getAttribute("href");

    addLink(actions, "dialog-section", "#edraak-nursery-demo", "مشاهدة فيديو الحضانة", true);
    addLink(actions, "dialog-demo", demoHref, "اطلب Demo للبرنامج ↗", false);
    addLink(actions, "dialog-join", joinHref, "طلب الانضمام ←", false);

    content.append(actions);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  document.addEventListener("click", event => {
    const summary = event.target.closest(
      "#nursery details.nursery-feature-card > summary"
    );

    if (!summary) return;

    event.preventDefault();
    const card = summary.closest("details.nursery-feature-card");
    if (card) openFeature(card);
  });

  content.addEventListener("click", event => {
    const link = event.target.closest("a[data-close-dialog]");
    if (link && dialog.open) dialog.close();
  });
})();
/* NURSERY CARD MODALS V6 END */
