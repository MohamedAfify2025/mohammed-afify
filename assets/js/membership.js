/* Student membership and learning progress integration.
 * The browser may contain only Supabase's publishable/anon key, never service_role.
 */
(() => {
  'use strict';
  const cfg = window.MEMBERSHIP_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') &&
    typeof cfg.supabaseAnonKey === 'string' && cfg.supabaseAnonKey.length > 20 &&
    !/YOUR_PROJECT_ID|YOUR_SUPABASE|REPLACE_ME/i.test(cfg.supabaseUrl + cfg.supabaseAnonKey);
  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  const $ = (id) => document.getElementById(id);
  const page = document.body?.dataset.page || '';
  const year = $('year');
  if (year) year.textContent = new Date().getFullYear();

  function notice(id, message, type = 'info') {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.className = `m-notice show ${type}`;
  }
  function clearNotice(id) {
    const el = $(id);
    if (el) { el.textContent = ''; el.className = 'm-notice'; }
  }
  function configWarning() {
    const el = $('configWarning');
    if (el && client) el.hidden = true;
  }
  configWarning();

  async function requireClient(id = 'formNotice') {
    if (client) return true;
    notice(id, 'النظام غير مربوط حتى الآن. افتح assets/js/supabase-config.js، وأضف Project URL وPublishable/anon key من مشروع Supabase، ثم نفّذ ملف sql/membership-schema.sql. لا تضع Service Role Key في الموقع.', 'error');
    return false;
  }
  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }
  async function getProfile(userId) {
    const { data, error } = await client.from('profiles')
      .select('user_id, full_name, email, phone, requested_course, status, role, created_at')
      .eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function getMyActiveCourses() {
    const { data, error } = await client.rpc('get_my_active_courses_v2');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
  function formatMinutes(seconds) {
    const minutes = Math.max(0, Math.floor(Number(seconds || 0) / 60));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours} س ${rest} د` : `${minutes} د`;
  }
  function statusLabel(status) {
    return ({ pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'غير مقبول' })[status] || 'غير معروف';
  }
  function setStatusChip(el, status) {
    if (!el) return;
    el.textContent = statusLabel(status);
    el.className = `m-chip ${status || ''}`;
  }
  async function redirectToLogin() {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.href = `login.html?next=${next}`;
  }

  // Registration form: account creation creates a pending profile through the SQL trigger.
  if (page === 'register') {
    const roleSelect = $('requestedRole');
    const studentFields = $('studentFields');
    const teacherFields = $('teacherFields');
    const courseInput = $('course');
    const specialtiesInput = $('teacherSpecialties');

    const syncRoleFields = () => {
      const isTeacher = roleSelect?.value === 'teacher';

      if (studentFields) {
        studentFields.style.display = isTeacher ? 'none' : '';
      }

      if (teacherFields) {
        teacherFields.style.display = isTeacher ? '' : 'none';
      }

      if (courseInput) {
        courseInput.required = !isTeacher;
      }

      if (specialtiesInput) {
        specialtiesInput.required = isTeacher;
      }
    };

    roleSelect?.addEventListener('change', syncRoleFields);
    syncRoleFields();

    $('registerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearNotice('formNotice');

      if (!(await requireClient())) return;

      const form = event.currentTarget;
      const data = new FormData(form);

      const fullName = String(data.get('fullName') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      const phone = String(data.get('phone') || '').trim();
      const requestedRole = String(data.get('requestedRole') || 'student').trim();
      const course = String(data.get('course') || '').trim();
      const teacherSpecialties = String(data.get('teacherSpecialties') || '').trim();
      const rawTeacherCourses = String(data.get('teacherCourses') || '').trim();
      const password = String(data.get('password') || '');
      const confirmPassword = String(data.get('confirmPassword') || '');

      if (!['student', 'teacher'].includes(requestedRole)) {
        return notice('formNotice', 'نوع الحساب المحدد غير صحيح.', 'error');
      }

      if (requestedRole === 'student' && !course) {
        return notice('formNotice', 'يرجى اختيار الدورة المطلوبة.', 'error');
      }

      if (requestedRole === 'teacher' && !teacherSpecialties) {
        return notice('formNotice', 'يرجى كتابة التخصصات والخبرات.', 'error');
      }

      if (password.length < 8) {
        return notice('formNotice', 'كلمة المرور يجب ألا تقل عن 8 أحرف.', 'error');
      }

      if (password !== confirmPassword) {
        return notice('formNotice', 'كلمتا المرور غير متطابقتين.', 'error');
      }

      const teacherCourses = requestedRole === 'teacher'
        ? rawTeacherCourses
            .split(/[,\n،;]+/)
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

      const button = form.querySelector('button[type="submit"]');

      if (button) {
        button.disabled = true;
        button.textContent = 'جارٍ إرسال الطلب…';
      }

      try {
        const { data: result, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              requested_course: requestedRole === 'student' ? course : 'طلب تدريس',
              requested_role: requestedRole,
              teacher_specialties: requestedRole === 'teacher' ? teacherSpecialties : '',
              requested_teaching_courses: teacherCourses
            },
            emailRedirectTo: new URL('login.html', location.href).href
          }
        });

        if (error) throw error;

        const msg = result.session
          ? 'تم إنشاء الحساب وإرسال الطلب للمراجعة. سيظل تفعيل الصلاحيات مرتبطًا باعتماد الإدارة.'
          : 'تم تسجيل الطلب. افحص بريدك الإلكتروني واضغط رابط تأكيد الحساب أولًا، ثم سجّل الدخول لمتابعة حالة الطلب.';

        notice('formNotice', msg, 'success');
        form.reset();
        syncRoleFields();

      } catch (err) {
        notice('formNotice', err?.message || 'تعذّر إرسال الطلب. حاول مرة أخرى.', 'error');

      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'إرسال طلب الاشتراك ←';
        }
      }
    });
  }
// Login and password recovery.
  if (page === 'login') {
    $('loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault(); clearNotice('formNotice');
      if (!(await requireClient())) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      const email = String(data.get('email') || '').trim().toLowerCase();
      const password = String(data.get('password') || '');
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'جارٍ تسجيل الدخول…'; }
      try {
        const { data: result, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const profile = await getProfile(result.user.id);
        if (!profile) throw new Error('تم تسجيل الدخول لكن لم يتم إنشاء ملف الطالب. تحقق من تشغيل trigger الموجود في ملف SQL.');
        const target = profile.role === 'admin' ? 'admin-subscriptions.html' : 'student-dashboard.html';
        notice('formNotice', 'تم تسجيل الدخول بنجاح. جارٍ فتح حسابك…', 'success');
        const requestedNext = new URLSearchParams(location.search).get('next');
        setTimeout(() => { location.href = profile.role === 'admin' ? target : (profile.status === 'approved' && requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : target); }, 350);
      } catch (err) {
        notice('formNotice', err?.message || 'تعذّر تسجيل الدخول.', 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'دخول إلى حسابي ←'; }
      }
    });
    $('resetPassword')?.addEventListener('click', async () => {
      clearNotice('formNotice');
      if (!(await requireClient())) return;
      const email = String($('email')?.value || '').trim().toLowerCase();
      if (!email) return notice('formNotice', 'اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟».', 'error');
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: new URL('login.html', location.href).href });
        if (error) throw error;
        notice('formNotice', 'إذا كان البريد مسجلًا، فستصلك رسالة لإعادة تعيين كلمة المرور. افحص صندوق الوارد والرسائل غير المرغوب فيها.', 'success');
      } catch (err) { notice('formNotice', err?.message || 'تعذّر إرسال رسالة إعادة التعيين.', 'error'); }
    });
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    location.href = 'login.html';
  }
  $('logoutLink')?.addEventListener('click', (event) => { event.preventDefault(); signOut().catch(() => { location.href = 'login.html'; }); });

  // Student dashboard.
  if (page === 'dashboard') {
    (async () => {
      if (!(await requireClient('dashboardNotice'))) return;
      try {
        const session = await getSession();
        if (!session) return redirectToLogin();
        const profile = await getProfile(session.user.id);
        if (!profile) throw new Error('لم يتم العثور على ملف الطالب. أعد تشغيل إعداد قاعدة البيانات من ملف SQL.');
        $('studentEmail').textContent = `${profile.full_name || 'طالب'} · ${profile.email || session.user.email || ''}`;
        setStatusChip($('accountStatus'), profile.status);
        if (profile.role === 'admin' && $('adminLink')) $('adminLink').hidden = false;
        if (profile.status === 'pending') { $('pendingPanel').hidden = false; return; }
        if (profile.status === 'rejected') { $('rejectedPanel').hidden = false; return; }
        if (profile.status !== 'approved') throw new Error('حالة الحساب غير معروفة. تواصل مع إدارة المنصة.');
        $('approvedContent').hidden = false;
        const activeCourses = await getMyActiveCourses();
        renderEnrolledTracks(profile, activeCourses);
        await loadDashboardData(session.user.id, activeCourses);
      } catch (err) { notice('dashboardNotice', err?.message || 'تعذّر تحميل لوحة الطالب.', 'error'); }
    })();
  }

  function renderEnrolledTracks(profile, activeCourses) {
    const host = $('enrolledTracksList');
    if (!host) return;

    if (profile.role === 'admin') {
      host.innerHTML = '<div class="m-empty">هذا حساب إدارة المنصة؛ تظهر مسارات الطالب داخل حساب كل طالب بحسب اشتراكه.</div>';
      return;
    }

    const rows = (Array.isArray(activeCourses) ? activeCourses : [])
      .filter((row) => row && row.can_view_course_page === true);

    if (!rows.length) {
      host.innerHTML = '<div class="m-empty">تم اعتماد حسابك، لكن لا يوجد اشتراك تعليمي نشط حاليًا. ستظهر الدورات هنا بعد إسناد باقة مجانية أو تأكيد دفع الباقة المدفوعة من الإدارة.</div>';
      return;
    }

    const knownRoutes = {
      'business-administration': 'business-administration.html',
      'programming': 'programming.html',
      'python': 'python.html',
      'scratch': 'scratch.html',
      'data-analysis': 'data-analysis.html',
      'icdl': 'icdl.html',
      'windows': 'windows.html',
      'word': 'word.html',
      'excel': 'excel.html',
      'powerpoint': 'powerpoint.html',
      'projects': 'projects.html'
    };

    host.innerHTML = rows.map((row) => {
      const slug = String(row.course_slug || '').trim().toLowerCase();
      const route = knownRoutes[slug] || (/^[a-z0-9-]+$/.test(slug) ? `${slug}.html` : '');
      const href = route ? `../academy/${route}` : '';
      const title = String(row.course_title || slug || 'دورة تعليمية');
      const planName = String(row.plan_name || 'اشتراك نشط');
      const videoText = row.can_watch_video === true
        ? 'مشاهدة الفيديو متاحة'
        : 'مشاهدة الفيديو غير مشمولة';
      const action = href
        ? `<a class="m-track-link" href="${escapeHtml(href)}">فتح المسار <span aria-hidden="true">←</span></a>`
        : '<span class="m-track-link disabled" aria-disabled="true">رابط المسار غير مهيأ</span>';

      return `<article class="m-track-card">
        <div class="m-track-top"><span class="m-track-symbol" aria-hidden="true">◎</span><span class="m-track-status">اشتراك نشط</span></div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(planName)} · ${escapeHtml(videoText)}</p>
        <div class="m-track-footer"><span class="m-track-approved">صلاحية مشاهدة الصفحة مفعّلة</span>${action}</div>
      </article>`;
    }).join('');
  }

  async function loadDashboardData(userId, activeCourses) {
    const slugs = [...new Set((Array.isArray(activeCourses) ? activeCourses : [])
      .filter((row) => row && row.can_view_course_page === true)
      .map((row) => String(row.course_slug || '').trim())
      .filter((slug) => /^[a-z0-9-]+$/i.test(slug)))];

    let progress = [];
    let assessments = [];

    if (slugs.length) {
      const [progressResult, assessmentResult] = await Promise.all([
        client.from('learning_progress')
          .select('course_slug, lesson_slug, lesson_title, seconds_watched, completed, updated_at')
          .eq('user_id', userId)
          .in('course_slug', slugs)
          .order('updated_at', { ascending: false }),
        client.from('assessment_results')
          .select('course_slug, assessment_title, score_percent, created_at')
          .eq('user_id', userId)
          .in('course_slug', slugs)
          .order('created_at', { ascending: false })
      ]);

      if (progressResult.error) throw progressResult.error;
      if (assessmentResult.error) throw assessmentResult.error;
      progress = progressResult.data || [];
      assessments = assessmentResult.data || [];
    }

    const seconds = progress.reduce((sum, row) => sum + Number(row.seconds_watched || 0), 0);
    const completed = progress.filter((row) => row.completed).length;
    const avg = assessments.length
      ? assessments.reduce((sum, row) => sum + Number(row.score_percent || 0), 0) / assessments.length
      : null;

    $('watchTime').textContent = formatMinutes(seconds);
    $('completedLessons').textContent = String(completed);
    $('averageScore').textContent = avg === null ? '—' : `${Math.round(avg)}%`;

    const progressEl = $('progressTable');
    if (progressEl) {
      if (!progress.length) {
        progressEl.innerHTML = '<div class="m-empty">لا توجد بيانات مشاهدة مسجّلة للدورات النشطة بعد.</div>';
      } else {
        progressEl.innerHTML = `<table class="m-table"><thead><tr><th>الدورة</th><th>الدرس</th><th>وقت المشاهدة</th><th>الحالة</th><th>آخر تحديث</th></tr></thead><tbody>${progress.map((r) => `<tr><td>${escapeHtml(r.course_slug || '—')}</td><td>${escapeHtml(r.lesson_title || r.lesson_slug || 'درس')}</td><td>${formatMinutes(r.seconds_watched)}</td><td>${r.completed ? 'مكتمل' : 'قيد التعلم'}</td><td>${formatDate(r.updated_at)}</td></tr>`).join('')}</tbody></table>`;
      }
    }

    const assessmentEl = $('assessmentTable');
    if (assessmentEl) {
      if (!assessments.length) {
        assessmentEl.innerHTML = '<div class="m-empty">لا توجد نتائج اختبارات للدورات النشطة بعد.</div>';
      } else {
        assessmentEl.innerHTML = `<table class="m-table"><thead><tr><th>الدورة</th><th>التقييم</th><th>النتيجة</th><th>التاريخ</th></tr></thead><tbody>${assessments.map((r) => `<tr><td>${escapeHtml(r.course_slug || '—')}</td><td>${escapeHtml(r.assessment_title || 'تقييم')}</td><td>${Math.round(Number(r.score_percent || 0))}%</td><td>${formatDate(r.created_at)}</td></tr>`).join('')}</tbody></table>`;
      }
    }
  }

  // Admin-only approvals. Student approval must select a plan and use the
  // transactional V2 RPC; teacher approval and all rejections keep the legacy RPC.
  if (page === 'admin') {
    const normalizeCourse = (value) => String(value || '').trim().toLocaleLowerCase('ar');

    const loadRequests = async () => {
      if (!(await requireClient('adminNotice'))) return;

      clearNotice('adminNotice');

      try {
        const session = await getSession();
        if (!session) return redirectToLogin();

        const profile = await getProfile(session.user.id);
        if (profile?.role !== 'admin') {
          notice('adminNotice', 'هذا القسم مخصص لحسابات الإدارة فقط.', 'error');
          $('requestsTable').innerHTML = '<div class="m-empty">غير مصرح بعرض الطلبات.</div>';
          return;
        }

        const { data, error } = await client
          .from('profiles')
          .select('user_id,full_name,email,phone,requested_course,status,requested_role,teacher_specialties,requested_teaching_courses,created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Failure to load plans must never silently approve a student without a plan.
        let reviewPlans = [];
        let plansErrorMessage = '';
        const planResult = await client.rpc('get_admin_review_plans_v2');
        if (planResult.error) {
          plansErrorMessage = planResult.error.message || 'تعذّر تحميل الباقات النشطة.';
        } else {
          reviewPlans = Array.isArray(planResult.data) ? planResult.data : [];
        }

        const host = $('requestsTable');
        if (!host) throw new Error('لم يتم العثور على عنصر عرض الطلبات.');

        if (!data?.length) {
          host.innerHTML = '<div class="m-empty">لا توجد طلبات معلقة حاليًا.</div>';
          return;
        }

        const rows = data.map((r) => {
          const requestedRole = r.requested_role === 'teacher' ? 'teacher' : 'student';
          const roleLabel = requestedRole === 'teacher' ? 'مدرس' : 'طالب';

          const teacherCourses = Array.isArray(r.requested_teaching_courses)
            ? r.requested_teaching_courses.map((item) => String(item)).join('، ')
            : String(r.requested_teaching_courses || '');

          const details = requestedRole === 'teacher'
            ? `
              <div><strong>التخصصات والخبرات:</strong> ${escapeHtml(r.teacher_specialties || 'لم يحدد')}</div>
              <div style="margin-top:6px"><strong>الدورات المراد تدريسها:</strong> ${escapeHtml(teacherCourses || 'لم يحدد')}</div>
            `
            : `<div><strong>الدورة المطلوبة:</strong> ${escapeHtml(r.requested_course || 'لم يحدد')}</div>`;

          const requestedCourse = normalizeCourse(r.requested_course);
          const matchingPlans = requestedRole === 'student'
            ? reviewPlans.filter((plan) =>
                normalizeCourse(plan.course_title) === requestedCourse ||
                normalizeCourse(plan.course_slug) === requestedCourse
              )
            : [];

          const planSelector = requestedRole === 'student'
            ? `<div class="m-review-plan">
                 <label for="review-plan-${escapeHtml(r.user_id)}">الباقة المطلوبة للاعتماد</label>
                 <select id="review-plan-${escapeHtml(r.user_id)}" data-review-plan style="display:block;width:100%;max-width:360px;margin-top:6px;padding:8px;border:1px solid #dce3ed;border-radius:8px;background:#fff;font:inherit">
                   <option value="">${matchingPlans.length ? 'اختر الباقة' : 'لا توجد باقة نشطة مطابقة لهذه الدورة'}</option>
                   ${matchingPlans.map((plan) => {
                     const price = Number(plan.price || 0);
                     const amount = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(price);
                     const currency = String(plan.currency || '');
                     const typeLabel = price === 0 ? 'مجانية' : 'مدفوعة';
                     return `<option value="${escapeHtml(plan.plan_id)}">${escapeHtml(plan.plan_name)} — ${escapeHtml(typeLabel)} — ${escapeHtml(amount)} ${escapeHtml(currency)}</option>`;
                   }).join('')}
                 </select>
                 ${plansErrorMessage ? `<small class="m-review-plan-error">${escapeHtml(plansErrorMessage)}</small>` : ''}
               </div>`
            : '';

          const cannotApproveStudent = requestedRole === 'student' && matchingPlans.length === 0;

          return `
            <tr>
              <td>${escapeHtml(r.full_name || '—')}</td>
              <td>${escapeHtml(r.email || '—')}</td>
              <td>${escapeHtml(r.phone || '—')}</td>
              <td><strong>${roleLabel}</strong></td>
              <td>${details}${planSelector}</td>
              <td>${formatDate(r.created_at)}</td>
              <td>
                <div class="m-row-actions">
                  <button type="button" class="m-mini-button" data-review="approved"
                    data-user="${escapeHtml(r.user_id)}" data-role="${requestedRole}"
                    ${cannotApproveStudent ? 'disabled title="لا يمكن اعتماد الطالب دون اختيار باقة نشطة مطابقة للدورة."' : ''}>
                    اعتماد
                  </button>
                  <button type="button" class="m-mini-button reject" data-review="rejected"
                    data-user="${escapeHtml(r.user_id)}" data-role="${requestedRole}">
                    رفض
                  </button>
                </div>
              </td>
            </tr>`;
        }).join('');

        host.innerHTML = `
          <table class="m-table">
            <thead><tr>
              <th>الاسم</th><th>البريد الإلكتروني</th><th>الهاتف</th>
              <th>نوع الحساب</th><th>تفاصيل الطلب والباقة</th>
              <th>تاريخ الطلب</th><th>الإجراء</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;

        host.querySelectorAll('[data-review]').forEach((button) => {
          button.addEventListener('click', async () => {
            const uid = button.dataset.user;
            const decision = button.dataset.review;
            const requestedRole = button.dataset.role;
            const isStudentApproval = decision === 'approved' && requestedRole === 'student';
            const row = button.closest('tr');
            const planSelect = isStudentApproval ? row?.querySelector('[data-review-plan]') : null;

            if (isStudentApproval && !planSelect?.value) {
              notice('adminNotice', 'اختر باقة نشطة تشمل الدورة المطلوبة قبل اعتماد الطالب.', 'error');
              return;
            }

            const roleLabel = requestedRole === 'teacher' ? 'المدرس' : 'الطالب';
            const actionLabel = decision === 'approved' ? `اعتماد حساب ${roleLabel}` : 'رفض طلب التسجيل';
            if (!window.confirm(isStudentApproval
              ? `سيتم اعتماد الطالب وإنشاء اشتراك بالباقة المحددة. إذا كانت الباقة مجانية فسيتم تفعيلها تلقائيًا، أما المدفوعة فستظل معلقة حتى تأكيد الدفع. هل تتابع؟`
              : `هل تريد ${actionLabel}؟`)) return;

            button.disabled = true;
            const siblingButtons = row?.querySelectorAll('[data-review]') || [];
            siblingButtons.forEach((item) => { item.disabled = true; });

            try {
              if (isStudentApproval) {
                const { error: rpcError } = await client.rpc(
                  'approve_student_application_with_plan_v2',
                  {
                    p_target_user: uid,
                    p_plan_id: planSelect.value,
                    p_admin_note: ''
                  }
                );
                if (rpcError) throw rpcError;
              } else {
                const { error: rpcError } = await client.rpc(
                  'review_membership_request_v2',
                  {
                    p_target_user: uid,
                    p_decision: decision
                  }
                );
                if (rpcError) throw rpcError;
              }

              await loadRequests();

              const successMessage = isStudentApproval
                ? 'تم اعتماد الطالب وإنشاء الاشتراك. راجع حالة الدفع في لوحة إدارة الاشتراكات.'
                : decision === 'approved'
                  ? `تم اعتماد طلب ${roleLabel} بنجاح.`
                  : 'تم رفض طلب التسجيل.';

              notice('adminNotice', successMessage, 'success');
            } catch (err) {
              notice('adminNotice', err?.message || 'تعذّر تحديث الطلب. تحقق من صلاحيات الدالة والباقة المختارة.', 'error');
              siblingButtons.forEach((item) => { item.disabled = false; });
            }
          });
        });

      } catch (err) {
        notice('adminNotice', err?.message || 'تعذر تحميل طلبات التسجيل.', 'error');
      }
    };

    $('refreshRequests')?.addEventListener('click', loadRequests);
    loadRequests();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  // YouTube IFrame API watch-time tracking for approved students on academy pages.
  async function startVideoTracking() {
    if (!client || !location.pathname.includes('/academy/')) return;
    try {
      const session = await getSession();
      if (!session) return;
      const profile = await getProfile(session.user.id);
      if (!profile || profile.status !== 'approved') return;

      const courseSlug = decodeURIComponent(location.pathname.split('/').pop().replace(/\.html?$/i, '') || 'course').slice(0, 100);
      const { data: activeCourses, error: accessError } = await client.rpc('get_my_active_courses_v2');
      if (accessError) throw accessError;

      const courseAccess = (Array.isArray(activeCourses) ? activeCourses : [])
        .find((row) => String(row.course_slug || '').toLowerCase() === courseSlug.toLowerCase());

      // Watching and progress tracking are separate subscription capabilities.
      if (!courseAccess || courseAccess.can_watch_video !== true || courseAccess.can_track_progress !== true) return;

      const iframes = Array.from(document.querySelectorAll('iframe[src*="youtube.com/embed/"],iframe[src*="youtube-nocookie.com/embed/"]'));
      if (!iframes.length) return;
      let playerCounter = 0;
      const initPlayers = () => {
        if (!window.YT?.Player) return;
        iframes.forEach((iframe) => {
          if (iframe.dataset.membershipTracked === 'yes') return;
          const videoId = parseYouTubeId(iframe.src);
          if (!videoId) return;
          iframe.dataset.membershipTracked = 'yes';
          if (!iframe.id) iframe.id = `membership-youtube-${++playerCounter}`;
          let src;
          try {
            src = new URL(iframe.src);
            src.searchParams.set('enablejsapi', '1');
            src.searchParams.set('origin', location.origin);
            iframe.src = src.toString();
          } catch (_) { return; }
          const lessonSlug = videoId;
          const lessonTitle = String(iframe.title || iframe.closest('section')?.querySelector('h2,h3')?.textContent || document.querySelector('h1')?.textContent || videoId).trim().slice(0, 200);
          let baseSeconds = 0, credited = 0, lastMediaTime = null, lastSaveAt = 0, duration = 0, isEnded = false;
          let saveInFlight = false;
          client.from('learning_progress').select('seconds_watched,completed').eq('user_id', session.user.id).eq('course_slug', courseSlug).eq('lesson_slug', lessonSlug).maybeSingle()
            .then(({ data, error }) => { if (!error && data) { baseSeconds = Number(data.seconds_watched || 0); isEnded = Boolean(data.completed); } })
            .catch(() => {});
          const save = async (completed = false) => {
            if (saveInFlight || credited < 1) return;
            saveInFlight = true;
            const payload = { user_id: session.user.id, course_slug: courseSlug, lesson_slug: lessonSlug, lesson_title: lessonTitle, seconds_watched: Math.floor(baseSeconds + credited), completed: Boolean(completed || isEnded), updated_at: new Date().toISOString() };
            try {
              const { error } = await client.from('learning_progress').upsert(payload, { onConflict: 'user_id,course_slug,lesson_slug' });
              if (!error) { baseSeconds = payload.seconds_watched; credited = 0; lastSaveAt = Date.now(); }
            } catch (_) { /* Keep tracking in memory and retry on next save. */ }
            finally { saveInFlight = false; }
          };
          const player = new window.YT.Player(iframe.id, { events: {
            onReady: (event) => { try { duration = event.target.getDuration() || 0; } catch (_) {} },
            onStateChange: (event) => {
              const state = event.data;
              if (state === window.YT.PlayerState.PLAYING) {
                const tick = () => {
                  try {
                    if (player.getPlayerState() !== window.YT.PlayerState.PLAYING) return;
                    const current = Number(player.getCurrentTime() || 0);
                    const total = Number(player.getDuration() || duration || 0); if (total) duration = total;
                    if (lastMediaTime !== null) {
                      const delta = current - lastMediaTime;
                      if (delta > 0 && delta <= 8.5) credited += delta;
                    }
                    lastMediaTime = current;
                    const complete = duration > 0 && current / duration >= 0.95;
                    if (complete) isEnded = true;
                    if (credited >= 15 || (Date.now() - lastSaveAt > 60000 && credited >= 5)) save(complete);
                  } catch (_) {}
                };
                // One light polling loop per player. Clears itself when playback stops.
                if (!iframe._membershipWatchTimer) iframe._membershipWatchTimer = window.setInterval(() => {
                  try { if (player.getPlayerState() !== window.YT.PlayerState.PLAYING) { window.clearInterval(iframe._membershipWatchTimer); iframe._membershipWatchTimer = null; save(isEnded); return; } tick(); }
                  catch (_) { window.clearInterval(iframe._membershipWatchTimer); iframe._membershipWatchTimer = null; save(isEnded); }
                }, 5000);
              } else {
                if (iframe._membershipWatchTimer) { window.clearInterval(iframe._membershipWatchTimer); iframe._membershipWatchTimer = null; }
                try { if (state === window.YT.PlayerState.ENDED) isEnded = true; } catch (_) {}
                save(isEnded);
              }
            }
          } });
          window.addEventListener('pagehide', () => { try { if (player.getPlayerState() === window.YT.PlayerState.PLAYING) { const now = Number(player.getCurrentTime() || 0); if (lastMediaTime !== null && now > lastMediaTime && now - lastMediaTime <= 8.5) credited += now - lastMediaTime; } save(isEnded); } catch (_) {} });
        });
      };
      const loadApi = () => {
        if (window.YT?.Player) return initPlayers();
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (typeof previous === 'function') previous(); initPlayers(); };
        if (!document.querySelector('script[data-membership-youtube-api]')) {
          const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.dataset.membershipYoutubeApi = 'true';
          document.head.appendChild(script);
        }
      };
      loadApi();
    } catch (err) {
      console.warn('Membership video tracking could not start:', err?.message || err);
    }
  }
  function parseYouTubeId(src) {
    try { const match = new URL(src, location.href).pathname.match(/\/embed\/([A-Za-z0-9_-]{6,})/); return match ? match[1] : ''; }
    catch (_) { return ''; }
  }
  startVideoTracking();
})();
