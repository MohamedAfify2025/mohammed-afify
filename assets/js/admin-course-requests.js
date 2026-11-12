/* Admin queue for student self-service course enrollment requests. */
(() => {
  'use strict';

  const cfg = window.MEMBERSHIP_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') &&
    typeof cfg.supabaseAnonKey === 'string' &&
    cfg.supabaseAnonKey.length > 20 &&
    !/YOUR_PROJECT_ID|YOUR_SUPABASE|REPLACE_ME/i.test(String(cfg.supabaseUrl) + cfg.supabaseAnonKey);

  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const $ = id => document.getElementById(id);
  const notice = (message, error) => {
    $('queueNotice').textContent = message;
    $('queueNotice').className = 'queue-notice show' + (error ? ' error' : '');
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function money(value, currency) {
    try {
      return new Intl.NumberFormat('ar-EG', {
        style: 'currency', currency: currency || 'EGP', maximumFractionDigits: 2
      }).format(Number(value || 0));
    } catch (_) {
      return Number(value || 0).toFixed(2) + ' ' + (currency || 'EGP');
    }
  }

  const statusLabels = {
    pending: 'قيد المراجعة',
    fulfilled: 'تم إنشاء الاشتراك',
    rejected: 'مرفوض',
    cancelled: 'ملغي'
  };

  async function loadQueue() {
    if (!client) throw new Error('إعداد Supabase غير مكتمل.');
    const sessionResult = await client.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    if (!sessionResult.data.session) {
      location.href = 'login.html?next=' + encodeURIComponent('admin-course-requests.html');
      return;
    }

    const adminResult = await client.rpc('is_platform_admin');
    if (adminResult.error) throw adminResult.error;
    if (adminResult.data !== true) throw new Error('هذه الصفحة مخصصة لمدير المنصة فقط.');

    const requestResult = await client.from('student_course_enrollment_requests')
      .select('id,student_user_id,plan_id,student_note,admin_note,status,fulfilled_subscription_id,created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (requestResult.error) throw requestResult.error;

    const requests = requestResult.data || [];
    const userIds = Array.from(new Set(requests.map(row => row.student_user_id)));
    const planIds = Array.from(new Set(requests.map(row => row.plan_id)));

    const [profilesResult, plansResult, mapResult] = await Promise.all([
      userIds.length
        ? client.from('profiles').select('user_id,full_name,email,phone').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      planIds.length
        ? client.from('subscription_plans').select('id,name,price,currency,is_active').in('id', planIds)
        : Promise.resolve({ data: [], error: null }),
      planIds.length
        ? client.from('subscription_plan_courses').select('plan_id,course_slug').in('plan_id', planIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (plansResult.error) throw plansResult.error;
    if (mapResult.error) throw mapResult.error;

    const profiles = new Map((profilesResult.data || []).map(row => [row.user_id, row]));
    const plans = new Map((plansResult.data || []).map(row => [row.id, row]));
    const coursesByPlan = new Map();
    (mapResult.data || []).forEach(row => {
      const list = coursesByPlan.get(row.plan_id) || [];
      list.push(row.course_slug);
      coursesByPlan.set(row.plan_id, list);
    });

    $('queueCount').textContent = String(requests.filter(row => row.status === 'pending').length);
    const host = $('queueRows');

    if (!requests.length) {
      host.innerHTML = '<tr><td colspan="7" class="empty">لا توجد طلبات اشتراك حتى الآن.</td></tr>';
      return;
    }

    host.innerHTML = requests.map(row => {
      const profile = profiles.get(row.student_user_id) || {};
      const plan = plans.get(row.plan_id) || {};
      const courseNames = (coursesByPlan.get(row.plan_id) || []).join('، ') || '—';
      const actions = row.status === 'pending'
        ? '<div class="queue-actions">' +
          '<button type="button" class="queue-btn approve" data-action="fulfill" data-id="' + escapeHtml(row.id) + '">إنشاء الاشتراك</button>' +
          '<button type="button" class="queue-btn reject" data-action="reject" data-id="' + escapeHtml(row.id) + '">رفض الطلب</button>' +
          '</div>'
        : (row.fulfilled_subscription_id
          ? '<a class="queue-link" href="admin-subscriptions.html">فتح إدارة الاشتراكات</a>'
          : '—');

      return '<tr>' +
        '<td><strong>' + escapeHtml(profile.full_name || 'طالب') + '</strong><small>' + escapeHtml(profile.email || '') + '</small><small>' + escapeHtml(profile.phone || '') + '</small></td>' +
        '<td><strong>' + escapeHtml(plan.name || 'باقة غير معروفة') + '</strong><small>' + escapeHtml(courseNames) + '</small></td>' +
        '<td>' + escapeHtml(money(plan.price, plan.currency)) + '</td>' +
        '<td><span class="queue-status ' + escapeHtml(row.status) + '">' + escapeHtml(statusLabels[row.status] || row.status) + '</span></td>' +
        '<td>' + escapeHtml(new Date(row.created_at).toLocaleString('ar-EG')) + '</td>' +
        '<td>' + escapeHtml(row.student_note || '—') + (row.admin_note ? '<small>الإدارة: ' + escapeHtml(row.admin_note) + '</small>' : '') + '</td>' +
        '<td>' + actions + '</td>' +
      '</tr>';
    }).join('');
  }

  async function processRequest(button) {
    const action = button.getAttribute('data-action');
    const requestId = button.getAttribute('data-id');
    if (!requestId || !['fulfill', 'reject'].includes(action)) return;

    const promptText = action === 'fulfill'
      ? 'سيتم إنشاء اشتراك للطالب وفق السعر المسجل في الباقة. إذا كانت الباقة مدفوعة فستبقى بانتظار تسجيل السداد والتفعيل. هل تتابع؟'
      : 'هل تؤكد رفض طلب الاشتراك؟';
    if (!window.confirm(promptText)) return;

    button.disabled = true;
    try {
      const { data, error } = await client.rpc('admin_process_course_enrollment_request_v1', {
        p_request_id: requestId,
        p_action: action,
        p_admin_note: action === 'reject' ? 'تم رفض الطلب من إدارة المنصة.' : 'تم إنشاء الاشتراك من طلب الطالب.'
      });
      if (error) throw error;
      notice(action === 'fulfill'
        ? 'تم إنشاء الاشتراك بنجاح. ' + (data ? 'رقم الاشتراك: ' + data + '. ' : '') + 'راجع إدارة الاشتراكات لتسجيل الدفعة وتفعيل الوصول عند استحقاق ذلك.'
        : 'تم رفض طلب الاشتراك.', false);
      await loadQueue();
    } catch (error) {
      notice(error?.message || 'تعذّرت معالجة الطلب.', true);
      button.disabled = false;
    }
  }

  $('queueRows').addEventListener('click', event => {
    const button = event.target.closest('[data-action][data-id]');
    if (button) processRequest(button);
  });

  $('refreshQueue').addEventListener('click', () => {
    loadQueue().then(() => notice('تم تحديث قائمة الطلبات.', false))
      .catch(error => notice(error?.message || 'تعذّر تحديث الطلبات.', true));
  });

  $('logoutQueue').addEventListener('click', async event => {
    event.preventDefault();
    if (client) await client.auth.signOut();
    location.href = 'login.html';
  });

  loadQueue().catch(error => notice(error?.message || 'تعذّر تحميل طلبات الاشتراك.', true));
})();
