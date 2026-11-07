/* Mohammed Afify Academy Library — image hotspot navigation */
(() => {
  'use strict';

  const root = document.querySelector('[data-ma-library-banner]');
  if (!root || root.dataset.maLibraryReady === 'true') return;
  root.dataset.maLibraryReady = 'true';

  const getMap = () => document.querySelector('[data-learning-map], .learning-map');
  const getCatalog = () =>
    document.getElementById('course-catalog') ||
    document.getElementById('learning-course-grid') ||
    document.querySelector('.gs-catalog');

  const scrollTo = (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  };

  const findNode = (kind) => {
    const map = getMap();
    if (!map) return null;

    const selectors = {
      projects: ['.lm-node-projects', '[data-map-filter="projects"]'],
      skills: ['.lm-node-digital', '[data-map-filter="digital"]'],
      analytics: ['.lm-node-data', '[data-map-filter="data"]']
    };

    for (const selector of (selectors[kind] || [])) {
      const node = map.querySelector(selector);
      if (node) return node;
    }

    // Text-based fallback for the existing Data Analysis node. The wording is
    // already part of the current map; this does not add or change visible text.
    if (kind === 'analytics') {
      return Array.from(map.querySelectorAll('a,button,[role="button"]'))
        .find((node) => /DATA\s+ANALYSIS/i.test(node.textContent || '')) || null;
    }

    return null;
  };

  const chooseNode = (kind) => {
    const node = findNode(kind);
    if (!node) return false;
    node.click();
    return true;
  };

  const showAllCourses = () => {
    const map = getMap();
    const reset = map && map.querySelector('.lm-reset');
    if (reset) {
      reset.click();
    } else {
      const search = map && map.querySelector('#lm-course-search');
      if (search) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    scrollTo(getCatalog() || map);
  };

  const actions = {
    courses: showAllCourses,
    paths: () => scrollTo(getMap()),
    resources: () => {
      const map = getMap();
      const done = chooseNode('projects');
      scrollTo(getCatalog() || map);
      if (!done) scrollTo(map);
    },
    skills: () => {
      const map = getMap();
      const done = chooseNode('skills');
      scrollTo(getCatalog() || map);
      if (!done) scrollTo(map);
    },
    analytics: () => {
      const map = getMap();
      const done = chooseNode('analytics');
      scrollTo(getCatalog() || map);
      if (!done) scrollTo(map);
    }
  };

  root.querySelectorAll('[data-ma-library-action]').forEach((hotspot) => {
    hotspot.addEventListener('click', (event) => {
      const action = hotspot.dataset.maLibraryAction;
      const handler = actions[action];
      if (!handler) return;
      event.preventDefault();
      handler();
    });
  });
})();
