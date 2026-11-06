/* Mohammed Afify Academy — course images and domain filters V3 */
(() => {
  'use strict';

  const COURSE_CONFIG = {
    'business-administration.html': { domain: 'business', image: 'business-administration.webp' },
    'programming.html':             { domain: 'technology', image: 'programming.webp' },
    'python.html':                  { domain: 'technology', image: 'python.webp' },
    'scratch.html':                 { domain: 'technology', image: 'scratch.webp' },
    'icdl.html':                    { domain: 'digital', image: 'icdl.webp' },
    'windows.html':                 { domain: 'digital', image: 'windows.webp' },
    'word.html':                    { domain: 'digital', image: 'word.webp' },
    'powerpoint.html':              { domain: 'digital', image: 'powerpoint.webp' },
    'excel.html':                   { domain: 'digital', image: 'excel.webp' },
    'data-analysis.html':           { domain: 'data', image: 'data-analysis.webp' },
    'content.html':                 { domain: 'projects', image: 'learning-content.webp' },
    'projects.html':                { domain: 'projects', image: 'projects.webp' },
    'certificates.html':            { domain: 'projects', image: 'certificates.webp' }
  };

  const DOMAIN_LABELS = {
    business: 'مسار واحد',
    technology: '3 مسارات',
    digital: '5 مسارات',
    data: 'مسار واحد',
    projects: '3 موارد'
  };

  const getFileName = (card) => {
    const raw = card.getAttribute('href') || '';
    return raw.split(/[?#]/, 1)[0].split('/').pop().trim();
  };

  const installCardImages = (cards) => {
    cards.forEach((card, index) => {
      const config = COURSE_CONFIG[getFileName(card)];
      if (!config) return;

      // Derive the category from the destination page, not stale HTML attributes.
      card.dataset.domain = config.domain;
      card.dataset.courseCard = '';

      const media = card.querySelector('.pro-course-media');
      if (!media) return;

      // Replace old Google Sites photos and generated text placeholders.
      while (media.firstChild) media.removeChild(media.firstChild);

      const image = document.createElement('img');
      image.className = 'academy-course-card-image';
      image.src = `../assets/academy-course-cards/${config.image}`;
      image.alt = card.querySelector('h2')?.textContent.trim() || 'صورة الدورة التعليمية';
      image.loading = index < 3 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.fetchPriority = index < 3 ? 'high' : 'auto';
      media.appendChild(image);
      media.dataset.imageReady = 'true';
    });
  };

  const init = () => {
    const map = document.querySelector('[data-learning-map]');
    const catalog = document.querySelector('#learning-course-grid');
    if (!map || !catalog || map.dataset.ready === 'true') return;

    const cards = Array.from(catalog.querySelectorAll('a.gs-catalog'));
    if (!cards.length) return;

    map.dataset.ready = 'true';
    installCardImages(cards);

    const filters = Array.from(map.querySelectorAll('[data-map-filter]'));
    const nodeFilters = filters.filter((item) => item.dataset.mapFilter !== 'all');
    const search = map.querySelector('#lm-course-search');
    const selection = map.querySelector('[data-map-selection]');
    const resultCount = document.querySelector('[data-map-result-count]');
    const total = map.querySelector('[data-total-courses]');
    const empty = document.querySelector('[data-map-empty]');
    const catalogTitle = document.querySelector('#lm-catalog-title');
    const catalogSubtitle = document.querySelector('[data-catalog-subtitle]');
    const paths = Array.from(map.querySelectorAll('[data-line]'));

    const domainInfo = new Map(nodeFilters.map((node) => [node.dataset.mapFilter, {
      title: node.dataset.mapTitle || node.querySelector('strong')?.textContent.trim() || '',
      description: node.dataset.mapDescription || ''
    }]));

    let activeDomain = 'all';
    const normalize = (value) => String(value || '')
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .toLocaleLowerCase('ar')
      .trim();

    // Recalculate the domain badges from the canonical card mapping.
    nodeFilters.forEach((node) => {
      const count = cards.filter((card) => card.dataset.domain === node.dataset.mapFilter).length;
      const badge = node.querySelector('.lm-node-count');
      if (badge && DOMAIN_LABELS[node.dataset.mapFilter]) badge.textContent = DOMAIN_LABELS[node.dataset.mapFilter];
      if (count === 0) node.setAttribute('aria-disabled', 'true');
      else node.removeAttribute('aria-disabled');
    });

    const update = (shouldScroll = false) => {
      const term = normalize(search?.value || '');
      let shown = 0;

      cards.forEach((card) => {
        const matchesDomain = activeDomain === 'all' || card.dataset.domain === activeDomain;
        const matchesText = !term || normalize(card.textContent).includes(term);
        const visible = matchesDomain && matchesText;

        // Use both the HTML hidden state and an important inline display rule.
        // This prevents older Academy styles from keeping filtered cards visible.
        if (visible) {
          card.hidden = false;
          card.removeAttribute('hidden');
          card.style.removeProperty('display');
          card.setAttribute('aria-hidden', 'false');
          card.classList.add('lm-card-visible');
        } else {
          card.hidden = true;
          card.setAttribute('hidden', '');
          card.style.setProperty('display', 'none', 'important');
          card.setAttribute('aria-hidden', 'true');
          card.classList.remove('lm-card-visible');
        }

        if (visible) shown += 1;
      });

      filters.forEach((filter) => {
        const current = filter.dataset.mapFilter === activeDomain;
        if (current) filter.setAttribute('aria-current', 'true');
        else filter.removeAttribute('aria-current');
      });

      map.dataset.activeDomain = activeDomain;
      const domain = domainInfo.get(activeDomain);
      paths.forEach((path) => {
        const selected = path.dataset.line === activeDomain;
        path.classList.toggle('is-active', selected);
        path.style.opacity = activeDomain === 'all' ? '.72' : (selected ? '1' : '.18');
        path.style.strokeWidth = selected ? '3.2' : '2.2';
      });

      if (selection) {
        if (domain) selection.textContent = `${domain.title} — ${domain.description}`;
        else if (term) selection.textContent = `نتائج البحث عن «${search.value.trim()}» في المسارات المتاحة.`;
        else selection.textContent = 'كل المجالات مفتوحة للاستكشاف. اختر عقدة لعرض مساراتها.';
      }
      if (catalogTitle) catalogTitle.textContent = domain ? domain.title : (term ? 'نتائج البحث' : 'استكشف كل المسارات');
      if (catalogSubtitle) {
        catalogSubtitle.textContent = domain
          ? domain.description
          : (term ? 'المسارات المطابقة لعبارة البحث.' : 'اختر مجالًا من الخريطة لتظهر المسارات المرتبطة به هنا.');
      }
      if (resultCount) {
        resultCount.textContent = activeDomain === 'all' && !term
          ? `${shown} عنصرًا`
          : `${shown} من ${cards.length} عنصرًا`;
      }
      if (total) total.textContent = String(cards.length);
      if (empty) empty.hidden = shown !== 0;

      if (shouldScroll) {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        document.querySelector('#course-catalog')?.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    };

    filters.forEach((filter) => {
      filter.addEventListener('click', (event) => {
        event.preventDefault();
        activeDomain = filter.dataset.mapFilter || 'all';
        update(true);
      });
    });

    if (search) {
      search.addEventListener('input', () => update(false));
      search.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && search.value) {
          search.value = '';
          update(false);
        }
      });
    }

    map.classList.add('is-enhanced');
    update(false);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
