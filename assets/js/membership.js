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
    $('registerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault(); clearNotice('formNotice');
      if (!(await requireClient())) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      const fullName = String(data.get('fullName') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      const phone = String(data.get('phone') || '').trim();
      const course = String(data.get('course') || '').trim();
      const password = String(data.get('password') || '');
      const confirmPassword = String(data.get('confirmPassword') || '');
      if (password.length < 8) return notice('formNotice', 'كلمة المرور يجب ألا تقل عن 8 أحرف.', 'error');
      if (password !== confirmPassword) return notice('formNotice', 'كلمتا المرور غير متطابقتين.', 'error');
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'جارٍ إرسال الطلب…'; }
      try {
        const { data: result, error } = await client.auth.signUp({
          email, password,
          options: {
            data: { full_name: fullName, phone, requested_course: course },
            emailRedirectTo: new URL('login.html', location.href).href
          }
        });
        if (error) throw error;
        const msg = result.session
          ? 'تم إنشاء الحساب وإرسال الطلب للمراجعة. يمكنك تسجيل الدخول، وسيظل الوصول للمحتوى مرتبطًا باعتماد الإدارة.'
          : 'تم تسجيل الطلب. افحص بريدك الإلكتروني واضغط رابط تأكيد الحساب أولًا، ثم سجّل الدخول لمتابعة حالة الطلب.';
        notice('formNotice', msg, 'success');
        form.reset();
      } catch (err) {
        notice('formNotice', err?.message || 'تعذّر إرسال الطلب. حاول مرة أخرى.', 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'إرسال طلب الاشتراك ←'; }
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
        const target = profile.role === 'admin' ? 'admin-requests.html' : 'student-dashboard.html';
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
        renderEnrolledTracks(profile);
        await loadDashboardData(session.user.id);
      } catch (err) { notice('dashboardNotice', err?.message || 'تعذّر تحميل لوحة الطالب.', 'error'); }
    })();
  }

  function renderEnrolledTracks(profile) {
    const host = $('enrolledTracksList');
    if (!host) return;

    if (profile.role === 'admin') {
      host.innerHTML = '<div class="m-empty">هذا حساب إدارة المنصة؛ تظهر مسارات الطالب داخل حساب كل طالب بحسب اشتراكه.</div>';
      return;
    }

    const requested = String(profile.requested_course || '').trim();
    const normalizeTrack = (value) => String(value || '')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('ar');

    const catalog = [
      { names: ['الإدارة والأعمال'], title: 'الإدارة والأعمال', description: 'مسار البكالوريا المصرية للصف الثاني: خريطة الوحدات والدروس والأنشطة والتقييمات.', href: '../academy/business-administration.html', label: 'متاح الآن' },
      { names: ['البرمجة'], title: 'البرمجة', description: 'المحتوى البرمجي المرتبط بطلب اشتراكك.', href: '../academy/programming.html', label: 'مسارك المعتمد' },
      { names: ['تحليل البيانات'], title: 'تحليل البيانات', description: 'المحتوى والمهارات الخاصة بتحليل البيانات.', href: '../academy/data-analysis.html', label: 'مسارك المعتمد' },
      { names: ['ICDL ومهارات الكمبيوتر'], title: 'ICDL ومهارات الكمبيوتر', description: 'دورات مهارات الكمبيوتر وICDL المسموح بها في اشتراكك.', href: '../academy/icdl.html', label: 'مسارك المعتمد' },
      { names: ['Microsoft Office'], title: 'Microsoft Office', description: 'افتح مكتبة الدورات لمتابعة محتوى Word وExcel وPowerPoint المسموح لاشتراكك.', href: '../academy/index.html', label: 'مسارك المعتمد' }
    ];

    if (!requested) {
      host.innerHTML = '<div class="m-empty">لا يوجد مسار مسجل في حسابك بعد. تواصل مع الإدارة لمراجعة الاشتراك.</div>';
      return;
    }

    const normalized = normalizeTrack(requested);
    const track = catalog.find((item) => item.names.some((name) => normalizeTrack(name) === normalized));
    const title = track ? track.title : requested;
    const description = track ? track.description : 'هذا هو المسار المسجل في طلب اشتراكك. تواصل مع إدارة المنصة إذا كنت تتوقع ظهور محتوى مختلف.';
    const label = track ? track.label : 'يحتاج إلى إعداد';
    const action = track
      ? `<a class="m-track-link" href="${track.href}">فتح المسار <span aria-hidden="true">←</span></a>`
      : '<span class="m-track-link disabled" aria-disabled="true">المحتوى غير متاح بعد</span>';

    host.innerHTML = `<article class="m-track-card">
      <div class="m-track-top"><span class="m-track-symbol" aria-hidden="true">◎</span><span class="m-track-status">${escapeHtml(label)}</span></div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      <div class="m-track-footer"><span class="m-track-approved">اشتراك معتمد</span>${action}</div>
    </article>`;
  }
  async function loadDashboardData(userId) {
    const [progressResult, assessmentResult] = await Promise.all([
      client.from('learning_progress').select('course_slug, lesson_slug, lesson_title, seconds_watched, completed, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }),
      client.from('assessment_results').select('course_slug, assessment_title, score_percent, created_at').eq('user_id', userId).order('created_at', { ascending: false })
    ]);
    if (progressResult.error) throw progressResult.error;
    if (assessmentResult.error) throw assessmentResult.error;
    const progress = progressResult.data || [];
    const assessments = assessmentResult.data || [];
    const seconds = progress.reduce((sum, row) => sum + Number(row.seconds_watched || 0), 0);
    const completed = progress.filter((row) => row.completed).length;
    const avg = assessments.length ? assessments.reduce((sum, row) => sum + Number(row.score_percent || 0), 0) / assessments.length : null;
    $('watchTime').textContent = formatMinutes(seconds);
    $('completedLessons').textContent = String(completed);
    $('averageScore').textContent = avg === null ? '—' : `${Math.round(avg)}%`;
    const progressEl = $('progressTable');
    if (progressEl) {
      if (!progress.length) progressEl.innerHTML = '<div class="m-empty">لا توجد بيانات مشاهدة مسجّلة بعد. افتح درسًا وشغّل الفيديو بعد تفعيل حسابك.</div>';
      else progressEl.innerHTML = `<table class="m-table"><thead><tr><th>الدورة</th><th>الدرس</th><th>وقت المشاهدة</th><th>الحالة</th><th>آخر تحديث</th></tr></thead><tbody>${progress.map((r) => `<tr><td>${escapeHtml(r.course_slug || '—')}</td><td>${escapeHtml(r.lesson_title || r.lesson_slug || 'درس')}</td><td>${formatMinutes(r.seconds_watched)}</td><td>${r.completed ? 'مكتمل' : 'قيد التعلم'}</td><td>${formatDate(r.updated_at)}</td></tr>`).join('')}</tbody></table>`;
    }
    const assessmentEl = $('assessmentTable');
    if (assessmentEl) {
      if (!assessments.length) assessmentEl.innerHTML = '<div class="m-empty">لا توجد نتائج بعد. ستظهر هنا نتائج التقييمات بعد ربطها بقاعدة البيانات.</div>';
      else assessmentEl.innerHTML = `<table class="m-table"><thead><tr><th>الدورة</th><th>التقييم</th><th>النتيجة</th><th>التاريخ</th></tr></thead><tbody>${assessments.map((r) => `<tr><td>${escapeHtml(r.course_slug || '—')}</td><td>${escapeHtml(r.assessment_title || 'تقييم')}</td><td>${Math.round(Number(r.score_percent || 0))}%</td><td>${formatDate(r.created_at)}</td></tr>`).join('')}</tbody></table>`;
    }
  }

  // Admin-only approvals, guarded by database authorization (not by the hidden button).
  if (page === 'admin') {
    const loadRequests = async () => {
      if (!(await requireClient('adminNotice'))) return;
      clearNotice('adminNotice');
      try {
        const session = await getSession();
        if (!session) return redirectToLogin();
        const profile = await getProfile(session.user.id);
        if (profile?.role !== 'admin') {
          notice('adminNotice', 'هذا القسم مخصص لحسابات الإدارة فقط. سجّل الدخول بحساب تم تعيين role = admin له داخل Supabase.', 'error');
          $('requestsTable').innerHTML = '<div class="m-empty">غير مصرح بعرض الطلبات.</div>';
          return;
        }
        const { data, error } = await client.from('profiles').select('user_id,full_name,email,phone,requested_course,status,created_at').eq('status', 'pending').order('created_at', { ascending: true });
        if (error) throw error;
        const host = $('requestsTable');
        if (!data?.length) { host.innerHTML = '<div class="m-empty">لا توجد طلبات معلقة حاليًا.</div>'; return; }
        host.innerHTML = `<table class="m-table"><thead><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الدورة</th><th>تاريخ الطلب</th><th>الإجراء</th></tr></thead><tbody>${data.map((r) => `<tr><td>${escapeHtml(r.full_name || '—')}</td><td>${escapeHtml(r.email || '—')}</td><td>${escapeHtml(r.phone || '—')}</td><td>${escapeHtml(r.requested_course || '—')}</td><td>${formatDate(r.created_at)}</td><td><div class="m-row-actions"><button type="button" class="m-mini-button" data-review="approved" data-user="${escapeHtml(r.user_id)}">اعتماد</button><button type="button" class="m-mini-button reject" data-review="rejected" data-user="${escapeHtml(r.user_id)}">رفض</button></div></td></tr>`).join('')}</tbody></table>`;
        host.querySelectorAll('[data-review]').forEach((button) => button.addEventListener('click', async () => {
          const uid = button.dataset.user; const status = button.dataset.review;
          const action = status === 'approved' ? 'اعتماد هذا الطالب' : 'رفض هذا الطلب';
          if (!window.confirm(`هل تريد ${action}؟`)) return;
          button.disabled = true;
          try {
            const { error: rpcError } = await client.rpc('set_student_status', { target_user: uid, new_status: status });
            if (rpcError) throw rpcError;
            notice('adminNotice', status === 'approved' ? 'تم اعتماد الطالب بنجاح.' : 'تم تحديث حالة الطلب إلى مرفوض.', 'success');
            await loadRequests();
          } catch (err) { notice('adminNotice', err?.message || 'تعذّر تحديث حالة الطلب. تحقق من سياسة قاعدة البيانات.', 'error'); button.disabled = false; }
        }));
      } catch (err) { notice('adminNotice', err?.message || 'تعذّر تحميل الطلبات.', 'error'); }
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
      const iframes = Array.from(document.querySelectorAll('iframe[src*="youtube.com/embed/"],iframe[src*="youtube-nocookie.com/embed/"]'));
      if (!iframes.length) return;
      const courseSlug = decodeURIComponent(location.pathname.split('/').pop().replace(/\.html?$/i, '') || 'course').slice(0, 100);
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
