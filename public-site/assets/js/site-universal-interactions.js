(() => {
  "use strict";

  const interactiveSelector = "a,button,input,select,textarea,summary,[role='button'],[role='link']";

  function markSurface(element, action, label, extra = {}) {
    if (!element || element.dataset.siteClickAction) return;
    element.dataset.siteClickAction = action;
    Object.entries(extra).forEach(([key, value]) => {
      element.dataset[key] = String(value);
    });
    element.tabIndex = 0;
    element.setAttribute("role", element.querySelector(interactiveSelector) ? "group" : "link");
    if (label && !element.hasAttribute("aria-label")) element.setAttribute("aria-label", label);
    element.classList.add("site-clickable-surface");
  }

  function initHomepageCards() {
    document.querySelectorAll("#courseGrid .course-card").forEach((card) => {
      const anchor = card.querySelector(".course-body a[href]");
      if (anchor) markSurface(card, "href", anchor.textContent.trim() || "فتح الدورة", {
        siteClickHref: anchor.getAttribute("href")
      });
    });

    const interests = ["programming", "data", "business", "odoo"];
    document.querySelectorAll(".service-item").forEach((card, index) => {
      markSurface(card, "contact", "تواصل بخصوص " + (card.querySelector("h3")?.textContent.trim() || "الخدمة"), {
        siteClickInterest: interests[index] || "other"
      });
    });

    document.querySelectorAll(".file-card").forEach((card) => {
      markSurface(card, "href", "استعراض الموارد التعليمية", {
        siteClickHref: "academy-access.html"
      });
    });

    const floatCode = document.querySelector(".float-card-top");
    if (floatCode) markSurface(floatCode, "filter", "استكشف دورات البرمجة", { siteClickFilter: "programming" });

    const floatData = document.querySelector(".float-card-bottom");
    if (floatData) markSurface(floatData, "filter", "استكشف دورات تحليل البيانات", { siteClickFilter: "data" });
  }

  function initOdooCards() {
    const map = {
      nursery: "nursery",
      tutoring: "tutoring",
      school: "school",
      hr: "hr",
      "accounting-management": "accounting",
      clinics: "clinic"
    };

    document.querySelectorAll(".odoo-detail-card[id]").forEach((card) => {
      const key = map[card.id];
      if (!key) return;
      markSurface(card, "program", "فتح تفاصيل " + (card.querySelector("h3")?.textContent.trim() || "البرنامج"), {
        siteClickProgram: key
      });
    });

    document.querySelectorAll(".platform-video-card").forEach((card) => {
      const anchor = card.querySelector("a[href]");
      if (anchor) markSurface(card, "href", "مشاهدة " + (card.querySelector("h3")?.textContent.trim() || "الفيديو"), {
        siteClickHref: anchor.getAttribute("href"),
        siteClickTarget: anchor.getAttribute("target") || ""
      });
    });
  }

  function initGuideCards() {
    const routes = [
      "admin-students.html",
      "student-set-password.html",
      "admin-subscriptions.html",
      "admin-subscriptions.html"
    ];

    document.querySelectorAll(".flow-item").forEach((item, index) => {
      markSurface(item, "href", "فتح خطوة " + (item.querySelector("strong")?.textContent.trim() || "من الدليل"), {
        siteClickHref: routes[index] || "student-guide.html"
      });
    });

    document.querySelectorAll(".faq").forEach((item) => {
      const answer = item.querySelector("p");
      if (!answer) return;
      item.dataset.siteClickAction = "accordion";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-expanded", "false");
      item.classList.add("site-clickable-surface", "site-faq-item");
      answer.classList.add("faq-answer");
      answer.hidden = true;
    });
  }

  function activateSurface(surface) {
    const action = surface.dataset.siteClickAction;

    if (action === "href") {
      const href = surface.dataset.siteClickHref;
      if (href && surface.dataset.siteClickTarget === "_blank") {
        const opened = window.open(href, "_blank", "noopener,noreferrer");
        if (opened) opened.opener = null;
      } else if (href) {
        window.location.assign(href);
      }
      return;
    }

    if (action === "contact") {
      const select = document.getElementById("contactInterest");
      if (select) {
        select.value = surface.dataset.siteClickInterest || "other";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const contact = document.getElementById("contact");
      if (contact) {
        contact.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", "#contact");
        window.setTimeout(() => document.getElementById("contactMessage")?.focus(), 350);
      }
      return;
    }

    if (action === "filter") {
      const filter = surface.dataset.siteClickFilter;
      const button = document.querySelector('.filter-btn[data-filter="' + CSS.escape(filter || "") + '"]');
      if (button) {
        button.click();
        document.getElementById("courses")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (action === "program") {
      const button = document.querySelector('.odoo-system-node[data-program="' + CSS.escape(surface.dataset.siteClickProgram || "") + '"]');
      if (button) button.click();
      return;
    }

    if (action === "accordion") {
      const answer = surface.querySelector(".faq-answer");
      const open = surface.getAttribute("aria-expanded") !== "true";
      surface.setAttribute("aria-expanded", String(open));
      surface.classList.toggle("is-open", open);
      if (answer) answer.hidden = !open;
    }
  }

  document.addEventListener("click", (event) => {
    const surface = event.target.closest("[data-site-click-action]");
    if (!surface) return;
    const nestedControl = event.target.closest("a,button,input,select,textarea,summary,[role='button'],[role='link']");
    if (nestedControl && nestedControl !== surface) return;
    event.preventDefault();
    activateSurface(surface);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const surface = event.target.closest("[data-site-click-action]");
    if (!surface || event.target !== surface) return;
    if (event.target.closest("a,button,input,select,textarea,summary")) return;
    event.preventDefault();
    activateSurface(surface);
  });

  initHomepageCards();
  initOdooCards();
  initGuideCards();
})();