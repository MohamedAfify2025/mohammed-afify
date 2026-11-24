/* Mohammed Afify course access control.
 * This is a browser-side experience gate only. GitHub Pages HTML and public
 * media URLs remain public; confidential paid content needs private storage.
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
  const isPublicInfoPage = isAcademyPage && ['index', 'certificates'].includes(currentSlug);
  const gateClass = 'm-access-checking';

  const CATEGORY_SLUGS = {
    programming: ['programming', 'python', 'scratch'],
    data: ['data-analysis', 'excel', 'word', 'powerpoint'],
    business: ['business-administration'],
    accounting: ['accounting', 'odoo-accounting']
  };

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function allowedRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter((row) =>
      row && row.can_view_course_page === true &&
      /^[a-z0-9-]+$/i.test(String(row.course_slug || ''))
    );
  }

  async function getActiveCourses() {
    if (!client) throw new Error('إعداد الاتصال بقاعدة البيانات غير مكتمل. تعذّر التحقق من الاشتراك.');
    const { data, error } = await client.rpc('get_my_active_courses_v2');
    if (error) throw error;
    return allowedRows(data);
  }

  function addNotice(main, title, detail, targetHref, targetLabel) {
    if (!main) return;
    const target = targetHref
      ? `<a class="m-access-action" href="${targetHref}">${targetLabel || 'فتح لوحة الحساب'}</a>`
      : '';
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
      .m-access-denied h1{font-size:clamp(24px,4vw,34px);margin:12px 0}.m-access-denied p{line-height:2;color:#66738a}
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
      .select('user_id,full_name,email,status,role,account_state')
      .eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على ملف حسابك. سجّل الخروج ثم ادخل مرة أخرى.');
    return data;
  }

  function hideCourseLinks(scope, rows) {
    const allowed = new Set(rows.map((row) => String(row.course_slug).toLowerCase()));
    scope.querySelectorAll('a[href]').forEach((link) => {
      try {
        const url = new URL(link.getAttribute('href'), location.href);
        const match = url.pathname.match(/\/academy\/([^/]+)\.html?$/i);
        if (!match) return;
        const slug = match[1].toLowerCase();
        if (slug === 'index') return;
        if (!allowed.has(slug)) {
          const card = link.closest('.gs-home-card,.gs-catalog,.sc-content-card,.projects-btn,.gs-related a');
          if (card && card !== link) card.hidden = true;
          else link.hidden = true;
        }
      } catch (_) {}
    });
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
      if (!note) {
        note = document.createElement('div');
        note.className = 'm-access-message';
        section.appendChild(note);
      }
      note.textContent = message || 'الدورات التعليمية متاحة بعد تسجيل الدخول وتقديم طلب الاشتراك. سجّل الدخول أو أنشئ حسابًا لمتابعة المسار التعليمي.';
      const actions = document.createElement('div');
      actions.className = 'm-access-actions';
      actions.innerHTML = '<a class="m-access-action" href="membership/login.html">تسجيل الدخول</a><a class="m-access-action secondary" href="membership/register.html">طلب اشتراك</a>';
      note.replaceChildren(document.createTextNode(note.textContent), actions);
    }
  }

  function filterHomepage(profile, courses) {
    const section = document.querySelector('#googleSitesLibrary');
    if (!section) return;
    if (profile.role === 'admin') return;

    const grid = section.querySelector('.gs-home-grid');
    const fullLibraryLink = section.querySelector('a[href="academy/index.html"]');
    const coursesSection = document.querySelector('#courses');

    if (profile.status !== 'approved' || profile.account_state !== 'active') {
      document.querySelectorAll('.category-grid .category-card').forEach((card) => { card.hidden = true; });
      if (grid) grid.hidden = true;
      if (fullLibraryLink) fullLibraryLink.hidden = true;
      coursesSection?.querySelector('.course-grid')?.setAttribute('hidden', 'hidden');
      coursesSection?.querySelector('.filter-row')?.setAttribute('hidden', 'hidden');
      let note = section.querySelector('.m-access-message');
      if (!note) { note = document.createElement('div'); note.className = 'm-access-message'; section.appendChild(note); }
      note.textContent = profile.status === 'rejected'
        ? 'تم رفض طلب الاشتراك. تواصل مع الإدارة لمراجعة الحالة.'
        : 'حسابك قيد المراجعة. ستظهر الدورات بعد اعتماد الحساب وإسناد اشتراك نشط.';
      return;
    }

    const rows = allowedRows(courses);
    const slugs = new Set(rows.map((row) => String(row.course_slug).toLowerCase()));
    const activeCategories = new Set(
      Object.entries(CATEGORY_SLUGS)
        .filter(([, categorySlugs]) => categorySlugs.some((slug) => slugs.has(slug)))
        .map(([category]) => category)
    );

    const categoryMap = [
      ['programming', 'category-code'],
      ['data', 'category-data'],
      ['business', 'category-business'],
      ['accounting', 'category-accounting']
    ];
    document.querySelectorAll('.category-grid .category-card').forEach((card) => {
      const item = categoryMap.find((candidate) => card.classList.contains(candidate[1]));
      card.hidden = !item || !activeCategories.has(item[0]);
    });

    if (grid) {
      grid.querySelectorAll('.gs-home-card').forEach((card) => {
        let slug = '';
        try {
          slug = new URL(card.getAttribute('href'), location.href)
            .pathname.split('/').pop().replace(/\.html?$/i, '').toLowerCase();
        } catch (_) {}
        card.hidden = !slugs.has(slug);
      });
      hideCourseLinks(grid, rows);
      grid.hidden = rows.length === 0;
    }

    if (fullLibraryLink) fullLibraryLink.hidden = rows.length === 0;

    if (coursesSection) {
      coursesSection.querySelectorAll('.course-card').forEach((card) => {
        const link = card.querySelector('a[href]');
        let slug = '';
        try {
          if (link) slug = new URL(link.getAttribute('href'), location.href)
            .pathname.split('/').pop().replace(/\.html?$/i, '').toLowerCase();
        } catch (_) {}
        card.hidden = !slugs.has(slug);
      });
      coursesSection.querySelector('.filter-row')?.setAttribute('hidden', 'hidden');
    }

    let note = section.querySelector('.m-access-message');
    if (!rows.length) {
      if (!note) { note = document.createElement('div'); note.className = 'm-access-message'; section.appendChild(note); }
      note.textContent = 'تم اعتماد حسابك، لكن لا يوجد اشتراك تعليمي نشط حاليًا. ستظهر الدورات هنا بعد إسناد باقة مجانية أو تأكيد دفع الباقة المدفوعة.';
    } else if (note) {
      note.remove();
    }
  }

  function filterCatalog(rows) {
    const host = document.querySelector('main') || document.body;
    const allowed = new Set(rows.map((row) => String(row.course_slug).toLowerCase()));
    let visible = 0;

    host.querySelectorAll('.gs-catalog, .sc-content-card').forEach((card) => {
      const link = card.matches('a[href]') ? card : card.querySelector('a[href]');
      if (!link) { card.hidden = true; return; }
      let slug = '';
      try {
        slug = new URL(link.getAttribute('href'), location.href).pathname
          .split('/').pop().replace(/\.html?$/i, '').toLowerCase();
      } catch (_) {}
      const show = allowed.has(slug);
      card.hidden = !show;
      if (show) visible++;
    });

    hideCourseLinks(host, rows);
    if (!visible) {
      addNotice(
        document.querySelector('main'),
        'لا توجد دورات نشطة في اشتراكك',
        'حسابك معتمد، لكن لا يوجد اشتراك نشط يتيح فتح دورات المكتبة حاليًا. تواصل مع الإدارة لمراجعة الباقة أو حالة الدفع.',
        '../membership/student-dashboard.html',
        'فتح لوحة الحساب'
      );
    }
  }

  function applyCapabilities(course) {
    const main = document.querySelector('main') || document.body;
    if (course.can_watch_video !== true) {
      document.querySelectorAll('iframe[src*="youtube.com/embed/"],iframe[src*="youtube-nocookie.com/embed/"]').forEach((iframe) => {
        iframe.dataset.membershipLockedVideo = 'true';
        iframe.removeAttribute('src');
        iframe.hidden = true;
      });
      const note = document.createElement('div');
      note.className = 'm-access-message';
      note.textContent = 'الباقة الحالية تتيح فتح صفحة الدورة، لكنها لا تشمل مشاهدة الفيديو.';
      main.prepend(note);
    }

    if (course.can_take_assessments !== true) {
      document.querySelectorAll('[data-assessment],.assessment-section,.quiz-section,form[id*="quiz" i]').forEach((element) => {
        element.hidden = true;
      });
    }

    if (course.can_download !== true) {
      document.querySelectorAll('a[href]').forEach((link) => {
        try {
          const url = new URL(link.getAttribute('href'), location.href);
          if (/\.(pdf|zip|docx?|xlsx?|pptx?)$/i.test(url.pathname)) link.hidden = true;
        } catch (_) {}
      });
    }
  }

  async function init() {
    addStyles();
    if (isAcademyPage) document.documentElement.classList.add(gateClass);

    try {
      const profile = await getSignedInProfile();
      if (!profile) {
        if (isPublicInfoPage) {
          document.documentElement.classList.remove(gateClass);
          const main = document.querySelector('main');
          if (main) main.style.visibility = 'visible';
          return;
        }
        if (isAcademyPage) redirectToLogin();
        else if (isHomepage) filterGuestHomepage();
        return;
      }

      if (profile.role === 'admin') {
        document.documentElement.classList.remove(gateClass);
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'visible';
        return;
      }

      if (profile.status !== 'approved' || profile.account_state !== 'active') {
        if (isPublicInfoPage) {
          document.documentElement.classList.remove(gateClass);
          const main = document.querySelector('main');
          if (main) main.style.visibility = 'visible';
          return;
        }
        if (isAcademyPage) {
          location.href = '../membership/student-dashboard.html';
          return;
        }
        if (isHomepage) filterHomepage(profile, []);
        return;
      }

      // The learning catalogue and professional profile are public discovery pages; individual lesson pages remain subscription-gated.
      if (isPublicInfoPage) {
        document.documentElement.classList.remove(gateClass);
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'visible';
        return;
      }

      const courses = await getActiveCourses();

      if (isHomepage) {
        filterHomepage(profile, courses);
        return;
      }

      if (!isAcademyPage) return;

      const main = document.querySelector('main');
      if (currentSlug === 'index') {
        filterCatalog(courses);
        document.documentElement.classList.remove(gateClass);
        if (main) main.style.visibility = 'visible';
        return;
      }

      const course = courses.find((row) =>
        String(row.course_slug || '').toLowerCase() === currentSlug &&
        row.can_view_course_page === true
      );

      if (!course) {
        addNotice(
          main,
          'هذه الدورة غير مشمولة في اشتراكك النشط',
          'لا يوجد اشتراك نشط يمنح حسابك صلاحية فتح هذه الدورة. إذا كنت قد دفعت بالفعل، تواصل مع الإدارة لمراجعة حالة الاشتراك.',
          '../membership/student-dashboard.html',
          'لوحة حسابي'
        );
        document.documentElement.classList.remove(gateClass);
        if (main) main.style.visibility = 'visible';
        return;
      }

      applyCapabilities(course);
      hideCourseLinks(document, courses);
      document.documentElement.classList.remove(gateClass);
      if (main) main.style.visibility = 'visible';
    } catch (error) {
      if (isPublicInfoPage) {
        document.documentElement.classList.remove(gateClass);
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'visible';
        console.warn('Public information page opened without membership verification:', error?.message || error);
        return;
      }
      if (isAcademyPage) {
        addNotice(
          document.querySelector('main'),
          'تعذّر التحقق من صلاحية الاشتراك',
          error?.message || 'المحتوى مخفي حتى يتم التحقق من الاشتراك النشط.',
          '../membership/student-dashboard.html',
          'لوحة حسابي'
        );
        document.documentElement.classList.remove(gateClass);
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'visible';
      } else if (isHomepage) {
        filterGuestHomepage('تعذّر التحقق من الاشتراك. تم إخفاء قائمة الدورات مؤقتًا؛ حدّث الصفحة أو سجّل الدخول مرة أخرى.');
        console.warn('Membership access could not be verified:', error?.message || error);
      } else {
        console.warn('Membership access could not be verified:', error?.message || error);
      }
    }
  }

  init();
})();
