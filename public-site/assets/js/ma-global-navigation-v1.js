/* Mohammed Afify — unified public navigation behavior v1 */
(() => {
  'use strict';
  const root = document.querySelector('.ma-global-header');
  if (!root) return;

  const aboutLink = root.querySelector('a[data-i18n="navAbout"]');
  if (aboutLink) {
    const path = window.location.pathname;
    const marker = "/mohammed-afify/";
    const markerIndex = path.indexOf(marker);
    const siteBase = markerIndex >= 0 ? path.slice(0, markerIndex + marker.length) : "/";
    aboutLink.href = siteBase + "about.html";
    if (aboutLink.textContent.trim() === "عن المنصة") {
      aboutLink.textContent = "عن محمد عفيفي";
    }
  }

  const dropdowns = [...root.querySelectorAll('.ma-nav-dropdown')];
  const closeDropdowns = (except = null) => {
    dropdowns.forEach(item => {
      if (item === except) return;
      item.classList.remove('is-open');
      item.querySelector('.ma-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
  };

  dropdowns.forEach(item => {
    const trigger = item.querySelector('.ma-dropdown-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', event => {
      event.preventDefault();
      const willOpen = !item.classList.contains('is-open');
      closeDropdowns(item);
      item.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
    item.querySelectorAll('.ma-dropdown-menu a').forEach(link => {
      link.addEventListener('click', () => {
        closeDropdowns();
        root.querySelector('#mainNav')?.classList.remove('open');
        root.querySelector('#menuToggle')?.setAttribute('aria-expanded', 'false');
      });
    });
  });

  document.addEventListener('click', event => {
    if (!root.contains(event.target)) closeDropdowns();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDropdowns();
      root.querySelector('#mainNav')?.classList.remove('open');
      root.querySelector('#menuToggle')?.setAttribute('aria-expanded', 'false');
    }
  });
})();
