/* Mohammed Afify Academy — connected map interactions V2 */
(() => {
  'use strict';

  const init = () => {
    const map = document.querySelector('[data-learning-map]');
    const catalog = document.querySelector('#learning-course-grid');
    if (!map || !catalog || map.dataset.ready === 'true') return;
    map.dataset.ready = 'true';

    const cards = Array.from(catalog.querySelectorAll('[data-course-card]'));
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

    const update = (shouldScroll = false) => {
      const term = normalize(search?.value || '');
      let shown = 0;

      cards.forEach((card) => {
        const matchesDomain = activeDomain === 'all' || card.dataset.domain === activeDomain;
        const matchesText = !term || normalize(card.textContent).includes(term);
        const visible = matchesDomain && matchesText;
        card.hidden = !visible;
        card.classList.toggle('lm-card-visible', visible);
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
      if (catalogSubtitle) catalogSubtitle.textContent = domain ? domain.description : (term ? 'المسارات المطابقة لعبارة البحث.' : 'اختر مجالًا من الخريطة لتظهر المسارات المرتبطة به هنا.');
      if (resultCount) resultCount.textContent = activeDomain === 'all' && !term ? `${shown} عنصرًا` : `${shown} من ${cards.length} عنصرًا`;
      if (total) total.textContent = String(cards.length);
      if (empty) empty.hidden = shown !== 0;

      if (shouldScroll) {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        document.querySelector('#course-catalog')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
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
