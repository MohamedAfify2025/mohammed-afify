/* CINEMATIC MOTION - independent of script.js */
(() => {
  "use strict";

  const reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) return;

  const selectors = [
    "#home .hero-grid > *", "main > section",
    ".gs-main > .gs-hero", ".gs-main > .gs-section",
    ".section-heading", ".category-card", ".course-card", ".service-item",
    ".resource-panel", ".about-grid > *",
    ".gs-card", ".gs-resource", ".gs-catalog", ".gs-source-block",
    ".gs-tools-block", ".gs-tool-card", ".platform-video-card",
    ".odoo-video-block", ".odoo-detail-card", ".odoo-accounting-steps > div",
    ".odoo-home-cta-cards > a",
    ".office-topic-card", ".office-resource-card",
    ".prog-track-card", ".prog-topic", ".prog-resource-card",
    ".py-topic-card", ".py-resource-card",
    ".win-topic-card", ".win-resource-card",
    ".scratch-level-card", ".scratch-resource-card",
    ".icdl-topic-card", ".icdl-resource-card"
  ];

  const unique = new Set();
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => unique.add(element));
  });

  const targets = Array.from(unique).filter(
    (element) => !element.hasAttribute("data-no-cinematic-motion")
  );
  if (!targets.length) return;

  targets.forEach((element, index) => {
    element.setAttribute("data-cinematic-reveal", "");
    element.style.setProperty("--cinematic-delay", `${(index % 4) * 55}ms`);
  });

  document.documentElement.classList.add("cinematic-motion-ready");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-cinematic-visible");
      observer.unobserve(entry.target);
    });
  }, { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.08 });

  targets.forEach((element) => observer.observe(element));
})();