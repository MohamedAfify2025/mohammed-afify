/* Student self-service course catalogue and enrollment requests. */
(() => {
  'use strict';

  const cfg = window.MEMBERSHIP_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') &&
    typeof cfg.supabaseAnonKey === 'string' &&
    cfg.supabaseAnonKey.length > 20 &&
    !/YOUR_PROJECT_ID|YOUR_SUPABASE|REPLACE_ME/i.test(String(cfg.supabaseUrl) + String(cfg.supabaseAnonKey));

  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const offersHost = document.getElementById('studentCourseOffers');
  const requestsHost = document.getElementById('studentEnrollmentRequests');
  const noticeHost = document.getElementById('studentCourseNotice');

  if (!offersHost || !requestsHost || !noticeHost) return;

  const state = { busy: false, pendingPlanIds: new Set(), offerings: [] };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function showNotice(message, type) {
    noticeHost.textContent = message;
    noticeHost.className = 'm-notice show ' + (type || 'info');
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: currency || 'EGP',
        maximumFractionDigits: 2
      }).format(Number(amount || 0));
    } catch (_) {
      return Number(amount || 0).toFixed(2) + ' ' + (currency || 'EGP');
    }
  }

  function statusText(status) {
    return ({
      pending: 'طلبك قيد المراجعة',
      fulfilled: 'تم إنشاء الاشتراك — بانتظار استكمال التفعيل',
      rejected: 'لم تتم الموافقة على الطلب',
      cancelled: 'تم إلغاء الطلب'
    })[status] || status || 'غير محدد';
  }

  function groupOffers(rows) {
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || !row.plan_id) return;
      let group = groups.get(row.plan_id);
      if (!group) {
        group = {
          plan_id: row.plan_id,
          plan_name: row.plan_name,
          plan_type: row.plan_type,
          price: row.price,
          currency: row.currency,
          duration_days: row.duration_days,
          courses: []
        };
        groups.set(row.plan_id, group);
      }
      if (!group.courses.some(course => course.course_slug === row.course_slug)) {
        group.courses.push({ course_slug: row.course_slug, title: row.course_title });
      }
    });
    return Array.from(groups.values());
  }

  function renderOffers(rows) {
    state.offerings = groupOffers(rows);
    if (!state.offerings.length) {
      offersHost.innerHTML = '<div class="ma-enrollment-empty">لا توجد دورات أو باقات منشورة للاشتراك حاليًا. ستظهر هنا أي دورة يفعّلها مدير المنصة ويتيح الاشتراك العام فيها.</div>';
      return;
    }

    offersHost.innerHTML = state.offerings.map(function (offer) {
      const titles = offer.courses.map(course => escapeHtml(course.title || course.course_slug)).join('، ');
      const duration = offer.duration_days
        ? '<span>' + escapeHtml(offer.duration_days) + ' يوم</span>'
        : '<span>مدة مفتوحة</span>';
      const alreadyRequested = state.pendingPlanIds.has(offer.plan_id);
      const label = alreadyRequested ? 'تم إرسال الطلب' : (Number(offer.price || 0) <= 0 ? 'اطلب الاشتراك المجاني' : 'طلب الاشتراك');
      const disabled = alreadyRequested ? ' disabled' : '';
      return '<article class="ma-enrollment-card">' +
        '<div class="ma-enrollment-card-top"><span class="ma-enrollment-tag">متاحة للاشتراك</span><span class="ma-enrollment-price">' +
        escapeHtml(money(offer.price, offer.currency)) + '</span></div>' +
        '<h3>' + escapeHtml(offer.plan_name || 'باقة تعليمية') + '</h3>' +
        '<p class="ma-enrollment-courses">' + titles + '</p>' +
        '<div class="ma-enrollment-meta">' + duration + '<span>' + offer.courses.length + ' دورة</span></div>' +
        '<button class="ma-enrollment-button" type="button" data-plan-id="' + escapeHtml(offer.plan_id) + '"' + disabled + '>' +
        label + '</button></article>';
    }).join('');
  }

  function renderRequests(rows) {
    state.pendingPlanIds = new Set(
      (Array.isArray(rows) ? rows : [])
        .filter(row => ['pending', 'fulfilled'].includes(row.status))
        .map(row => row.plan_id)
    );

    if (!Array.isArray(rows) || !rows.length) {
      requestsHost.innerHTML = '<div class="ma-enrollment-empty">لم ترسل طلبات اشتراك إضافية بعد.</div>';
      return;
    }

    requestsHost.innerHTML = rows.map(function (row) {
      const offer = state.offerings.find(item => item.plan_id === row.plan_id);
      const title = offer ? offer.plan_name : 'باقة تعليمية';
      const note = row.admin_note
        ? '<p class="ma-enrollment-admin-note">ملاحظة الإدارة: ' + escapeHtml(row.admin_note) + '</p>'
        : '';
      return '<article class="ma-enrollment-request">' +
        '<div><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(statusText(row.status)) + '</small></div>' +
        '<time>' + escapeHtml(new Date(row.created_at).toLocaleDateString('ar-EG')) + '</time>' +
        note + '</article>';
    }).join('');
  }

  async function load() {
    if (!client) {
      showNotice('تعذّر الاتصال بقاعدة البيانات. راجع إعداد Supabase ثم أعد تحميل الصفحة.', 'error');
      offersHost.innerHTML = '';
      return;
    }

    try {
      const sessionResult = await client.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      if (!sessionResult.data.session) {
        offersHost.innerHTML = '<div class="ma-enrollment-empty">سجّل الدخول أولًا لمشاهدة الدورات المتاحة وطلب الاشتراك.</div>';
        return;
      }

      const profileResult = await client.from('profiles')
        .select('role,status,account_state')
        .eq('user_id', sessionResult.data.session.user.id)
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;
      if (profileResult.data?.role === 'admin') {
        document.getElementById('studentEnrollmentPanel')?.setAttribute('hidden', 'hidden');
        return;
      }

      if (profileResult.data?.status !== 'approved' || profileResult.data?.account_state !== 'active') {
        showNotice('يمكنك طلب دورة إضافية بعد اعتماد حسابك وتفعيله من الإدارة.', 'info');
        offersHost.innerHTML = '';
        return;
      }

      const results = await Promise.all([
        client.rpc('get_student_course_offerings_v1'),
        client.from('student_course_enrollment_requests')
          .select('id,plan_id,status,admin_note,created_at,fulfilled_subscription_id')
          .eq('student_user_id', sessionResult.data.session.user.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;

      renderOffers(results[0].data || []);
      renderRequests(results[1].data || []);
    } catch (error) {
      showNotice(error?.message || 'تعذّر تحميل الدورات المتاحة.', 'error');
      offersHost.innerHTML = '';
    }
  }

  offersHost.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-plan-id]');
    if (!button || button.disabled || state.busy) return;

    const planId = button.getAttribute('data-plan-id');
    const offer = state.offerings.find(item => item.plan_id === planId);
    if (!offer) return;

    const details = offer.courses.map(course => course.title || course.course_slug).join('، ');
    const confirmation = 'تأكيد إرسال طلب الاشتراك في "' + (offer.plan_name || 'الباقة') +
      '"؟\\nالدورات: ' + details +
      '\\nالسعر: ' + money(offer.price, offer.currency) +
      '\\nلن يتم فتح المحتوى المدفوع إلا بعد مراجعة الإدارة وتأكيد السداد.';
    if (!window.confirm(confirmation)) return;

    state.busy = true;
    button.disabled = true;
    button.textContent = 'جارٍ إرسال الطلب…';

    try {
      const { error } = await client.rpc('request_course_enrollment_v1', {
        p_plan_id: planId,
        p_student_note: ''
      });
      if (error) throw error;
      showNotice('تم إرسال طلب الاشتراك بنجاح. يمكنك متابعة حالته من قائمة طلباتك أدناه.', 'success');
      await load();
    } catch (error) {
      showNotice(error?.message || 'تعذّر إرسال الطلب. حاول مرة أخرى.', 'error');
      button.disabled = false;
      button.textContent = 'طلب الاشتراك';
    } finally {
      state.busy = false;
    }
  });

  load();
})();
