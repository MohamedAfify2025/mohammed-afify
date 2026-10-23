/* Mohammed Afify course access control.
 * UX gate for the public static site. See notes: GitHub Pages cannot make HTML/private media confidential.
 */
(() => {
  'use strict';
  const cfg = window.MEMBERSHIP_CONFIG || {};
  const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') &&
    typeof cfg.supabaseAnonKey === 'string' && cfg.supabaseAnonKey.length > 20 &&
    !/YOUR_PROJECT_ID|YOUR_SUPABASE|REPLACE_ME/i.test(String(cfg.supabaseUrl) + String(cfg.supabaseAnonKey));
  const client = isConfigured && window.supabase?.createClient
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const path = decodeURI(location.pathname);
  const isAcademyPage = /\/academy\/[^/]+\.html?$/i.test(path);
  const isHomepage = !/\/academy\//i.test(path) && (/\/index\.html?$/i.test(path) || path.endsWith('/'));
  const currentSlug = (path.split('/').pop() || '').replace(/\.html?$/i, '').toLowerCase();
  const gateClass = 'm-access-checking';

  const GRANTS = [
    { names: ['البرمجة'], slugs: ['programming', 'python', 'scratch'], categories: ['programming'] },
    { names: ['تحليل البيانات'], slugs: ['data-analysis'], categories: ['data'] },
    { names: ['ICDL ومهارات الكمبيوتر'], slugs: ['icdl', 'windows'], categories: [] },
    { names: ['Microsoft Office'], slugs: ['word', 'excel', 'powerpoint'], categories: ['data'] },
    { names: ['الإدارة والأعمال'], slugs: ['business-administration'], categories: ['business'] },
    { names: ['المحاسبة و Odoo', 'المحاسبة و أودو'], slugs: [], categories: ['accounting', 'business'] },
    { names: ['مسار آخر / لم أحدد بعد', 'عام'], slugs: [], categories: [] }
  ];

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function getGrant(courseName) {
    const needle = normalize(courseName);
    return GRANTS.find((g) => g.names.some((name) => normalize(name) === needle)) || { names: [], slugs: [], categories: [] };
  }
  function addNotice(main, title, detail, targetHref, targetLabel) {
    if (!main) return;
    const target = targetHref ? `<a class="m-access-action" href="${targetHref}">${targetLabel || 'فتح لوحة الحساب'}</a>` : '';
    main.innerHTML = `<section class="m-access-denied" dir="rtl"><div class="m-access-icon">🔒</div><h1>${title}</h1><p>${detail}</p><div class="m-access-actions">${target}<a class="m-access-action secondary" href="../membership/student-dashboard.html">لوحة حسابي</a></div></section>`;
  }
  function addStyles() {
    if (document.getElementById('membership-access-styles')) return;
    const style = document.createElement('style');
    style.id = 'membership-access-styles';
    style.textContent = `
      [hidden]{display:none!important}
      html.${gateClass} body main{visibility:hidden!important}
      .m-access-denied{max-width:760px;margin:70px auto;padding:42px 26px;text-align:center;background:#fff;border:1px solid #e5eaf3;border-radius:24px;box-shadow:0 18px 55px rgba(14,28,58,.08);font-family:inherit;color:#11203d}
      .m-access-icon{font-size:32px;margin-bottom:12px}.m-access-denied h1{font-size:clamp(24px,4vw,34px);margin:12px 0}.m-access-denied p{line-height:2;color:#66738a}
      .m-access-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px}.m-access-action{display:inline-block;padding:12px 18px;border-radius:12px;background:#101b35;color:#fff;text-decoration:none;font-weight:700}.m-access-action.secondary{background:#edf0f9;color:#172647}
      .m-access-message{margin:20px 0;padding:18px;border-radius:14px;background:#fff4df;color:#7b4a00;line-height:1.9}
    `;
    document.head.appendChild(style);
  }
  function redirectToLogin() {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.href = `${isAcademyPage ? '../membership/' : 'membership/'}login.html?next=${next}`;
  }
  async function getSignedInProfile() {
    if (!client) throw new Error('إعداد الاتصال بقاعدة البيانات غير مكتمل. تعذّر التحقق من صلاحية الدخول، لذلك تم إخفاء محتوى الدورات.');
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData?.session;
    if (!session) return null;
    const { data, error } = await client.from('profiles')
      .select('user_id,full_name,email,requested_course,status,role')
      .eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على ملف حسابك. سجّل الخروج ثم ادخل مرة أخرى.');
    return data;
  }
  function hideCourseLinks(scope, grant) {
    const allowed = new Set(grant.slugs);
    scope.querySelectorAll('a[href]').forEach((link) => {
      try {
        const url = new URL(link.getAttribute('href'), location.href);
        const m = url.pathname.match(/\/academy\/([^/]+)\.html?$/i);
        if (!m) return;
        const slug = m[1].toLowerCase();
        if (slug === 'index') return;
        if (!allowed.has(slug)) {
          const card = link.closest('.gs-home-card,.gs-catalog,.sc-content-card,.projects-btn,.gs-related a');
          if (card && card !== link) card.hidden = true;
          else link.hidden = true;
        }
      } catch (_) {}
    });
  }
  function filterCatalog(grant) {
    const host = document.querySelector('main') || document.body;
    const allowed = new Set(grant.slugs);
    let visible = 0;
    host.querySelectorAll('.gs-catalog, .sc-content-card').forEach((card) => {
      const link = card.matches('a[href]') ? card : card.querySelector('a[href]');
      if (!link) { card.hidden = true; return; }
      let slug = '';
      try { slug = new URL(link.getAttribute('href'), location.href).pathname.split('/').pop().replace(/\.html?$/i, '').toLowerCase(); } catch (_) {}
      const show = allowed.has(slug);
      card.hidden = !show;
      if (show) visible++;
    });
    hideCourseLinks(host, grant);
    if (!visible) {
      const main = document.querySelector('main');
      addNotice(main, 'محتوى هذا المسار غير متاح بعد', 'تم اعتماد حسابك، لكن لم تُنشر صفحات تعليمية لهذا المسار في المكتبة حتى الآن. تواصل مع الإدارة لتأكيد محتوى الدورة.', null, '');
    }
  }
  function filterGuestHomepage(message) {
    const section = document.querySelector('#googleSitesLibrary');
    const grid = section?.querySelector('.gs-home-grid');
    if (grid) grid.hidden = true;
    const fullLibraryLink = section?.querySelector('a[href="academy/index.html"]');
    if (fullLibraryLink) fullLibraryLink.hidden = true;
    const coursesSection = document.querySelector('#courses');
    coursesSection?.querySelector('.course-grid')?.setAttribute('hidden', 'hidden');
    coursesSection?.querySelector('.filter-row')?.setAttribute('hidden', 'hidden');
    if (section) {
      let note = section.querySelector('.m-access-message');
      if (!note) { note = document.createElement('div'); note.className = 'm-access-message'; section.appendChild(note); }
      note.textContent = message || 'الدورات التعليمية متاحة بعد تسجيل الدخول وتقديم طلب الاشتراك. سجّل الدخول أو أنشئ حسابًا لمتابعة المسار التعليمي.';
      const actions = document.createElement('div');
      actions.className = 'm-access-actions';
      actions.innerHTML = '<a class="m-access-action" href="membership/login.html">تسجيل الدخول</a><a class="m-access-action secondary" href="membership/register.html">طلب اشتراك</a>';
      note.replaceChildren(document.createTextNode(note.textContent), actions);
    }
  }
  function filterHomepage(profile) {
    const section = document.querySelector('#googleSitesLibrary');
    if (!section) return;
    const grid = section.querySelector('.gs-home-grid');
    const fullLibraryLink = section.querySelector('a[href="academy/index.html"]');
    const coursesSection = document.querySelector('#courses');
    const grant = getGrant(profile.requested_course);
    if (profile.role === 'admin') return;
    const categoryMap = [
      ['programming', 'category-code'],
      ['data', 'category-data'],
      ['business', 'category-business'],
      ['accounting', 'category-accounting']
    ];
    document.querySelectorAll('.category-grid .category-card').forEach((card) => {
      const item = categoryMap.find((candidate) => card.classList.contains(candidate[1]));
      card.hidden = !item || !grant.categories.includes(item[0]);
    });
    if (profile.status !== 'approved') {
      document.querySelectorAll('.category-grid .category-card').forEach((card) => { card.hidden = true; });
      if (grid) grid.hidden = true;
      if (fullLibraryLink) fullLibraryLink.hidden = true;
      coursesSection?.querySelector('.course-grid')?.setAttribute('hidden', 'hidden');
      coursesSection?.querySelector('.filter-row')?.setAttribute('hidden', 'hidden');
      let note = section.querySelector('.m-access-message');
      if (!note) { note = document.createElement('div'); note.className = 'm-access-message'; section.appendChild(note); }
      note.textContent = profile.status === 'rejected'
        ? 'تم رفض طلب الاشتراك. تواصل مع الإدارة لمراجعة الحالة.'
        : 'حسابك قيد المراجعة. ستظهر الدورة المخصصة لك بعد اعتماد الإدارة.';
      return;
    }
    if (grid) {
      let visible = 0;
      grid.querySelectorAll('.gs-home-card').forEach((card) => {
        let slug = '';
        try { slug = new URL(card.getAttribute('href'), location.href).pathname.split('/').pop().replace(/\.html?$/i, '').toLowerCase(); } catch (_) {}
        const show = grant.slugs.includes(slug);
        card.hidden = !show;
        if (show) visible++;
      });
      hideCourseLinks(grid, grant);
      if (!visible) {
        grid.hidden = true;
        const note = document.createElement('div'); note.className = 'm-access-message';
        note.textContent = 'تم اعتماد حسابك، لكن محتوى هذا المسار لم يُنشر في مكتبة الدورات بعد. تواصل مع الإدارة لمراجعة المسار المخصص لك.';
        section.appendChild(note);
      }
    }
    if (fullLibraryLink) fullLibraryLink.hidden = grant.slugs.length === 0;
    if (coursesSection) {
      const isBusinessRelease = grant.slugs.includes('business-administration');
      coursesSection.querySelectorAll('.course-card').forEach((card) => {
        if (isBusinessRelease) {
          card.hidden = !card.classList.contains('business-track-card');
        } else {
          const cat = card.getAttribute('data-category') || '';
          card.hidden = !grant.categories.includes(cat);
        }
      });
      coursesSection.querySelector('.filter-row')?.setAttribute('hidden', 'hidden');
    }
  }
  async function init() {
    addStyles();
    if (isAcademyPage) document.documentElement.classList.add(gateClass);
    try {
      const profile = await getSignedInProfile();
      if (!profile) {
        if (isAcademyPage) redirectToLogin();
        else if (isHomepage) filterGuestHomepage();
        return;
      }
      if (isHomepage) { filterHomepage(profile); return; }
      if (!isAcademyPage) return;
      if (profile.role === 'admin') {
        document.documentElement.classList.remove(gateClass);
        const adminMain = document.querySelector('main');
        if (adminMain) adminMain.style.visibility = 'visible';
        return;
      }

      if (profile.status !== 'approved') {
        location.href = '../membership/student-dashboard.html';
        return;
      }
      const grant = getGrant(profile.requested_course);
      const main = document.querySelector('main');
      if (currentSlug === 'index') {
        filterCatalog(grant);
        document.documentElement.classList.remove(gateClass);
        if (main) main.style.visibility = 'visible';
        return;
      }
      if (!grant.slugs.includes(currentSlug)) {
        addNotice(main, 'هذه الدورة غير مشمولة في اشتراكك', 'تستطيع الوصول إلى المحتوى المخصص للمسار الذي طلبته فقط. إذا كنت تحتاج إلى دورة أخرى، تواصل مع الإدارة لتعديل اشتراكك.', null, '');
        hideCourseLinks(document, grant);
        document.documentElement.classList.remove(gateClass);
        if (main) main.style.visibility = 'visible';
        return;
      }
      hideCourseLinks(document, grant);
      document.documentElement.classList.remove(gateClass);
      if (main) main.style.visibility = 'visible';
    } catch (error) {
      if (isAcademyPage) {
        addNotice(document.querySelector('main'), 'تعذّر التحقق من صلاحية الدخول', error?.message || 'المحتوى مخفي حتى يتم التحقق من حسابك.', null, '');
        document.documentElement.classList.remove(gateClass);
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'visible';
      } else if (isHomepage) {
        filterGuestHomepage('تعذر التحقق من حالة حسابك. تم إخفاء قائمة الدورات مؤقتًا؛ حدّث الصفحة أو سجّل الدخول مرة أخرى.');
        console.warn('Membership access could not be verified:', error?.message || error);
      } else {
        console.warn('Membership access could not be verified:', error?.message || error);
      }
    }
  }
  init();
})();