/* Mohammed Afify Academy - interactive learning paths and hero links. */
(() => {
  'use strict';

  const poster = document.querySelector('[data-ma-academy-paths-v2]');
  const hero = document.querySelector('[data-ma-academy-hero-v3]');
  if ((!poster && !hero) || document.documentElement.dataset.maLearningPathsV22 === 'true') return;
  document.documentElement.dataset.maLearningPathsV22 = 'true';
  if (poster) poster.dataset.maPathsReady = 'true';

  const tracks = {
    business: {
      title: 'مسار إدارة الأعمال والمحاسبة',
      links: [
        ['الإدارة والأعمال', 'business-administration.html'],
        ['المحاسبة', 'accounting.html']
      ]
    },
    programming: {
      title: 'مسار البرمجة',
      links: [
        ['البرمجة', 'programming.html'],
        ['Python', 'python.html'],
        ['Scratch — البرمجة للأطفال', 'scratch.html']
      ]
    },
    windows: {
      title: 'مسار Windows و ICDL',
      links: [
        ['ICDL ومهارات الكمبيوتر', 'icdl.html'],
        ['Windows والإنترنت', 'windows.html']
      ]
    },
    data: {
      title: 'مسار تحليل البيانات',
      links: [['تحليل البيانات', 'data-analysis.html']]
    },
    office: {
      title: 'مسار Microsoft Office',
      links: [
        ['Microsoft Word', 'word.html'],
        ['Microsoft Excel', 'excel.html'],
        ['Microsoft PowerPoint', 'powerpoint.html']
      ]
    },
    education: {
      title: 'مسار التعليم والأطفال',
      links: [
        ['Scratch — البرمجة للأطفال', 'scratch.html'],
        ['المحتوى التعليمي', 'content.html']
      ]
    },
    skills: {
      title: 'مسار تطوير المهارات',
      links: [
        ['Windows والإنترنت', 'windows.html'],
        ['ICDL ومهارات الكمبيوتر', 'icdl.html'],
        ['Microsoft Word', 'word.html'],
        ['Microsoft Excel', 'excel.html'],
        ['Microsoft PowerPoint', 'powerpoint.html'],
        ['تحليل البيانات', 'data-analysis.html']
      ]
    },
    resources: {
      title: 'الموارد العملية',
      links: [
        ['المحتوى التعليمي', 'content.html'],
        ['المشروعات الجاهزة', 'projects.html'],
        ['السيرة الذاتية والشهادات', 'certificates.html']
      ]
    }
  };

  const dialog = document.createElement('dialog');
  dialog.className = 'ma-academy-track-dialog';
  dialog.setAttribute('aria-label', 'قائمة المسارات التعليمية');
  document.body.appendChild(dialog);

  const makeLink = (label, href) => {
    const link = document.createElement('a');
    link.className = 'ma-academy-track-dialog-link';
    link.href = href;
    const text = document.createElement('span');
    text.textContent = label;
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '←';
    link.append(text, arrow);
    return link;
  };

  const renderDialog = (key) => {
    dialog.replaceChildren();
    const inner = document.createElement('div');
    inner.className = 'ma-academy-track-dialog-inner';
    const head = document.createElement('div');
    head.className = 'ma-academy-track-dialog-head';
    const copy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'ma-academy-track-dialog-kicker';
    kicker.textContent = 'MOHAMMED AFIFY · LEARNING PATHS';
    const title = document.createElement('h2');
    title.textContent = key === 'all' ? 'اختر المسار المناسب لك' : tracks[key].title;
    copy.append(kicker, title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ma-academy-track-dialog-close';
    close.setAttribute('aria-label', 'إغلاق القائمة');
    close.textContent = '×';
    close.addEventListener('click', () => dialog.close());
    head.append(copy, close);
    inner.appendChild(head);

    if (key === 'all') {
      const groups = document.createElement('div');
      groups.className = 'ma-academy-track-dialog-all';
      Object.entries(tracks).forEach(([trackKey, track]) => {
        const group = document.createElement('section');
        group.className = 'ma-academy-track-group';
        const heading = document.createElement('h3');
        heading.textContent = track.title;
        const links = document.createElement('div');
        links.className = 'ma-academy-track-dialog-links';
        track.links.forEach(([label, href]) => links.appendChild(makeLink(label, href)));
        group.append(heading, links);
        groups.appendChild(group);
      });
      inner.appendChild(groups);
    } else {
      const links = document.createElement('div');
      links.className = 'ma-academy-track-dialog-links';
      tracks[key].links.forEach(([label, href]) => links.appendChild(makeLink(label, href)));
      inner.appendChild(links);
    }
    dialog.appendChild(inner);
  };

  /* One delegated handler serves the top hero and the lower category artwork. */
  document.addEventListener('click', (event) => {
    const hotspot = event.target.closest('[data-ma-track]');
    if (!hotspot) return;
    const insideHero = hero && hero.contains(hotspot);
    const insidePoster = poster && poster.contains(hotspot);
    if (!insideHero && !insidePoster) return;
    const key = hotspot.dataset.maTrack;
    if (key !== 'all' && !Object.prototype.hasOwnProperty.call(tracks, key)) return;
    event.preventDefault();
    renderDialog(key);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
