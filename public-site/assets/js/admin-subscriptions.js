(() => {
'use strict';

const $ = id => document.getElementById(id);
const state = {
  client:null, user:null, profiles:[], courses:[],
  plans:[], planCourses:[], subscriptions:[],
  payments:[], assignments:[], permissions:[],
  accessPermissions:[], permissionsReady:false,
  reviewPlans:[], reviewPlansError:""
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function msg(text, error=false) {
  const el = $('liveMessage');
  el.textContent = text;
  el.classList.toggle('error', error);
  el.style.display = 'block';
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function clearMsg() {
  $('liveMessage').style.display = 'none';
}

function money(amount,currency='EGP') {
  try {
    return new Intl.NumberFormat('ar-EG',{
      style:'currency',currency
    }).format(Number(amount || 0));
  } catch (_) {
    return Number(amount || 0).toFixed(2) + ' ' + currency;
  }
}

function date(value) {
  if(!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' :
    d.toLocaleDateString('ar-EG');
}

function dateTime(value) {
  if(!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' :
    d.toLocaleString('ar-EG');
}

function statusLabel(value) {
  const map = {
    active:'نشط',pending:'قيد الانتظار',expired:'منتهي',
    cancelled:'ملغي',suspended:'معلّق',paid:'مدفوع',
    partial:'مدفوع جزئيًا',unpaid:'غير مدفوع',
    waived:'معفى',refunded:'مسترد',failed:'فشل'
  };
  return map[value] || value || '—';
}

function statusHtml(value) {
  return `<span class="status ${esc(value)}">${esc(statusLabel(value))}</span>`;
}

function person(userId) {
  return state.profiles.find(p => p.user_id === userId);
}

function profileIdentifier(profile) {
  const email = String(profile?.email || "").trim();
  const suffix = "@students.invalid";
  if (email.toLowerCase().endsWith(suffix)) {
    return "اسم المستخدم: " + email.slice(0, -suffix.length);
  }
  return email;
}

function plan(planId) {
  return state.plans.find(p => p.id === planId);
}

function courseTitle(slug) {
  const c = state.courses.find(x => x.course_slug === slug);
  return c ? c.title : slug;
}


function ensurePricingControls() {
  const assignmentForm = $('subscriptionForm');
  if (assignmentForm && !$('assignDiscountType')) {
    const actions = assignmentForm.querySelector('.actions');
    const controls = document.createElement('div');
    controls.className = 'form-grid';
    controls.style.gridColumn = '1/-1';
    controls.innerHTML = `
      <div class="field">
        <label for="assignDiscountType">نوع الخصم</label>
        <select name="discount_type" id="assignDiscountType">
          <option value="none">بدون خصم</option>
          <option value="percent">خصم بنسبة مئوية</option>
          <option value="fixed">خصم بمبلغ ثابت</option>
          <option value="waive">إعفاء كامل</option>
        </select>
      </div>
      <div class="field" id="assignDiscountValueWrap">
        <label for="assignDiscountValue">قيمة الخصم</label>
        <input name="discount_value" id="assignDiscountValue" type="number" min="0" step="0.01" value="0">
      </div>
      <div class="field">
        <label for="assignDiscountReason">سبب الخصم (اختياري)</label>
        <input name="discount_reason" id="assignDiscountReason" maxlength="240" placeholder="مثال: خصم طالب متفوق">
      </div>
      <div class="notice" id="assignPricePreview" style="grid-column:1/-1">اختر الطالب والباقة لحساب السعر والخصم.</div>`;
    if (actions) actions.before(controls);
    else assignmentForm.appendChild(controls);
  }

  const paymentAmount = $('paymentForm')?.querySelector('[name="amount"]');
  if (paymentAmount && !$('paymentBalance')) {
    const balance = document.createElement('small');
    balance.id = 'paymentBalance';
    balance.className = 'muted';
    balance.textContent = 'اختر الاشتراك لمعرفة المبلغ المتبقي.';
    paymentAmount.insertAdjacentElement('afterend', balance);
    paymentAmount.id = 'paymentAmount';
  }

  const subscriptionsBody = $('subscriptionsBody');
  const table = subscriptionsBody?.closest('table');
  const headRow = table?.querySelector('thead tr');
  if (headRow && headRow.children.length !== 12) {
    headRow.innerHTML = '<th>الطالب</th><th>الباقة</th><th>السعر الأساسي</th><th>الخصم</th><th>الصافي المستحق</th><th>المدفوع</th><th>المتبقي</th><th>حالة الدفع</th><th>حالة الاشتراك</th><th>البداية</th><th>الانتهاء</th><th>إجراءات</th>';
  }

  const planHelp = $('planForm')?.closest('.panel')?.querySelector('.help');
  if (planHelp) {
    planHelp.textContent = 'أنشئ باقة لدورة واحدة عند تحديد سعرها الأساسي. السعر المسجل هو السعر الثابت قبل خصم الطالب، ويمكن تطبيق خصم مستقل لكل طالب عند الاعتماد.';
  }
}

function calculateDiscount(baseAmount, type, rawValue) {
  const base = Math.max(0, Number(baseAmount || 0));
  const value = Math.max(0, Number(rawValue || 0));
  let discount = 0;
  if (type === 'waive') discount = base;
  else if (type === 'percent') discount = base * Math.min(100, value) / 100;
  else if (type === 'fixed') discount = Math.min(base, value);
  discount = Math.round(discount * 100) / 100;
  return {base, discount, net:Math.max(0, Math.round((base - discount) * 100) / 100)};
}

function updateAssignPricePreview() {
  const student = state.profiles.find(p => p.user_id === $('studentSelect').value);
  const selectedPlan = state.plans.find(p => p.id === $('planSelect').value);
  const host = $('assignPricePreview');
  if (!host) return;
  if (!student || !selectedPlan) {
    host.textContent = 'اختر الطالب والباقة لحساب السعر والخصم.';
    return;
  }
  const type = $('assignDiscountType').value;
  const value = $('assignDiscountValue').value;
  const calc = calculateDiscount(selectedPlan.price, type, value);
  host.textContent = `السعر الأساسي: ${money(calc.base, selectedPlan.currency)} — الخصم: ${money(calc.discount, selectedPlan.currency)} — صافي المستحق: ${money(calc.net, selectedPlan.currency)}`;
}

function paymentRemaining(subscriptionId) {
  const sub = state.subscriptions.find(s => s.id === subscriptionId);
  if (!sub) return null;

  // A waived subscription has no collectible balance, even when its
  // original agreed_amount is greater than zero.
  if (sub.payment_state === 'waived') return 0;

  const paid = state.payments
    .filter(p => p.subscription_id === subscriptionId && p.status === 'paid')
    .reduce((sum,p) => sum + Number(p.amount || 0), 0);
  return Math.max(0, Math.round((Number(sub.agreed_amount || 0) - paid) * 100) / 100);
}

function updatePaymentBalance() {
  const remaining = paymentRemaining($('paymentSubscription').value);
  const host = $('paymentBalance');
  const amount = $('paymentAmount');
  if (remaining === null) {
    host.textContent = 'اختر الاشتراك لمعرفة المبلغ المتبقي.';
    amount.removeAttribute('max');
    return;
  }
  host.textContent = `المبلغ المتبقي: ${money(remaining, state.subscriptions.find(s => s.id === $('paymentSubscription').value)?.currency || 'EGP')}`;
  amount.max = String(remaining);
}

function fillSelect(id, rows, valueKey, labelFn, placeholder) {
  const el = $(id);
  const old = el.value;
  el.innerHTML = `<option value="">${esc(placeholder || 'اختر')}</option>` +
    rows.map(row =>
      `<option value="${esc(row[valueKey])}">${esc(labelFn(row))}</option>`
    ).join('');
  if(rows.some(row => row[valueKey] === old)) el.value = old;
}

function normalizeCourseLabel(value) {
  return String(value || '').trim().toLocaleLowerCase('ar');
}

function refreshPlanOptionsForSelectedStudent() {
  const studentId = $('studentSelect').value;
  const student = state.profiles.find(p => p.user_id === studentId);

  if(!student) {
    fillSelect('planSelect', [], 'id', () => '', 'اختر الطالب أولاً');
    return;
  }

  const requested = normalizeCourseLabel(student.requested_course);
  const matchingSlugs = new Set(
    state.courses
      .filter(course =>
        normalizeCourseLabel(course.title) === requested ||
        normalizeCourseLabel(course.course_slug) === requested
      )
      .map(course => course.course_slug)
  );

  const matchingPlanIds = new Set(
    state.planCourses
      .filter(mapping =>
        matchingSlugs.has(mapping.course_slug) &&
        mapping.can_view_course_page === true
      )
      .map(mapping => mapping.plan_id)
  );

  const eligiblePlans = state.plans.filter(plan =>
    plan.is_active === true && matchingPlanIds.has(plan.id)
  );

  fillSelect(
    'planSelect',
    eligiblePlans,
    'id',
    plan => `${plan.name} — ${money(plan.price, plan.currency)}`,
    eligiblePlans.length ? 'اختر الباقة المناسبة' : 'لا توجد باقة نشطة لهذه الدورة'
  );
}

function localDateTimeValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}

function studentSubscriptionIsEntitled(subscription) {
  if(subscription.status !== 'active' || !['paid','waived'].includes(subscription.payment_state)) return false;
  if(!subscription.starts_at || new Date(subscription.starts_at) > new Date()) return false;
  if(subscription.expires_at && new Date(subscription.expires_at) <= new Date()) return false;
  const selectedPlan = plan(subscription.plan_id);
  return selectedPlan?.is_active === true;
}

function activeCourseMappingsForStudent(studentId) {
  const activePlanIds = new Set(state.subscriptions
    .filter(s => s.user_id === studentId && studentSubscriptionIsEntitled(s))
    .map(s => s.plan_id));
  const map = new Map();
  for(const row of state.planCourses) {
    if(!activePlanIds.has(row.plan_id)) continue;
    const current = map.get(row.course_slug) || {
      can_view_course_page:false,can_watch_video:false,can_download:false,
      can_take_assessments:false,can_receive_certificate:false,can_track_progress:false
    };
    for(const key of Object.keys(current)) current[key] = current[key] || row[key] === true;
    map.set(row.course_slug,current);
  }
  return map;
}

function readStudentPermissionForm() {
  return {
    can_view_course_page:$('permCanPage').checked,
    can_watch_video:$('permCanVideo').checked,
    can_download:$('permCanDownload').checked,
    can_take_assessments:$('permCanAssessment').checked,
    can_receive_certificate:$('permCanCertificate').checked,
    can_track_progress:$('permCanProgress').checked
  };
}

function setStudentPermissionForm(values) {
  $('permCanPage').checked = values.can_view_course_page === true;
  $('permCanVideo').checked = values.can_watch_video === true;
  $('permCanDownload').checked = values.can_download === true;
  $('permCanAssessment').checked = values.can_take_assessments === true;
  $('permCanCertificate').checked = values.can_receive_certificate === true;
  $('permCanProgress').checked = values.can_track_progress === true;
}

function renderStudentCoursePermissions() {
  const ready = state.permissionsReady === true;
  $('individualPermissionsSetup').hidden = ready;
  $('studentPermissionsForm').hidden = !ready;
  if(!ready) return;
  refreshStudentPermissionCourseOptions();
}

function refreshStudentPermissionCourseOptions() {
  const studentId = $('accessStudentSelect').value;
  const mappings = activeCourseMappingsForStudent(studentId);
  const rows = state.courses.filter(c => mappings.has(c.course_slug));
  fillSelect('accessCourseSelect',rows,'course_slug',c => c.title,'اختر دورة لها اشتراك نشط');
  loadStudentCoursePermissionForm();
}

function loadStudentCoursePermissionForm() {
  const studentId = $('accessStudentSelect').value;
  const courseSlug = $('accessCourseSelect').value;
  const host = $('studentPermissionSource');

  if(!studentId || !courseSlug) {
    setStudentPermissionForm({
      can_view_course_page:false,can_watch_video:false,can_download:false,
      can_take_assessments:false,can_receive_certificate:false,can_track_progress:false
    });
    host.textContent = 'اختر طالبًا ودورة لها اشتراك نشط لعرض الصلاحيات.';
    return;
  }

  const override = state.accessPermissions.find(p =>
    p.user_id === studentId && p.course_slug === courseSlug
  );
  const defaults = activeCourseMappingsForStudent(studentId).get(courseSlug);
  const values = override || defaults || {};
  setStudentPermissionForm(values);
  host.textContent = override
    ? 'توجد صلاحيات فردية مخصصة لهذا الطالب. تعديلها لن يؤثر على بقية المشتركين.'
    : 'لا توجد صلاحيات فردية محفوظة؛ يتم استخدام صلاحيات الباقة الحالية. يمكنك تخصيصها لهذا الطالب.';
}

async function boot() {
  try {
    const cfg = window.MEMBERSHIP_CONFIG || {};

    const publicKey = String(cfg.supabasePublishableKey || cfg.supabaseAnonKey || '').trim();

    if(!window.supabase?.createClient ||
       !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') ||
       !publicKey ||
       (typeof window.isMembershipPublicKey === 'function' && window.isMembershipPublicKey(publicKey) !== true)) {
      throw new Error('إعداد Supabase غير مكتمل أو المفتاح العام غير صالح.');
    }

    state.client = window.supabase.createClient(
      cfg.supabaseUrl,
      publicKey,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
    );

    const {data:sessionData,error:sessionError} =
      await state.client.auth.getSession();

    if(sessionError) throw sessionError;

    const session = sessionData?.session;
    if(!session) {
      // The invitation-admin page is the shared sign-in entry for administrators.
      location.href = 'admin-students.html';
      return;
    }

    const {data:isAdmin,error:adminError} =
      await state.client.rpc('is_platform_admin');

    if(adminError) throw adminError;
    if(isAdmin !== true) {
      throw new Error('هذه الصفحة مخصصة لمدير المنصة المعتمد فقط.');
    }

    const {data:adminProfile,error:profileError} = await state.client
      .from('profiles')
      .select('role,status,account_state')
      .eq('user_id',session.user.id)
      .maybeSingle();

    if(profileError || adminProfile?.role !== 'admin' ||
       adminProfile?.status !== 'approved' ||
       adminProfile?.account_state !== 'active') {
      await state.client.auth.signOut();
      throw new Error('حساب الإدارة غير معتمد أو غير نشط.');
    }

    state.user = session.user;
    $('activationStart').value = localDateTimeValue();

    await loadAll();
    msg('تم التحقق من صلاحية المدير وتحميل بيانات العضويات.',false);

  } catch(error) {
    msg(error.message || 'تعذّر فتح لوحة الإدارة.',true);
  }
}

async function loadAll() {
  const db = state.client;

  const queries = await Promise.all([
    db.from('profiles')
      .select('user_id,full_name,email,phone,role,status,account_state,requested_course,requested_role,teacher_specialties,requested_teaching_courses,created_at')
      .order('full_name'),
    db.from('course_catalog')
      .select('course_slug,title,is_active')
      .eq('is_active',true)
      .order('title'),
    db.from('subscription_plans')
      .select('id,code,name,description,plan_type,price,currency,duration_days,is_active,is_public,created_at')
      .order('created_at',{ascending:false}),
    db.from('subscription_plan_courses')
      .select('plan_id,course_slug,can_view_course_page,can_watch_video,can_download,can_take_assessments,can_receive_certificate,can_track_progress'),
    db.from('student_subscriptions')
      .select('id,user_id,plan_id,base_amount,discount_type,discount_value,discount_amount,discount_reason,agreed_amount,currency,status,payment_state,starts_at,expires_at,created_at')
      .order('created_at',{ascending:false})
      .limit(300),
    db.from('subscription_payments')
      .select('id,subscription_id,student_user_id,amount,currency,payment_method,payment_reference,status,paid_at,created_at,note')
      .order('created_at',{ascending:false})
      .limit(300),
    db.from('teacher_course_assignments')
      .select('id,teacher_user_id,course_slug,is_active,assigned_at')
      .order('assigned_at',{ascending:false}),
    db.from('teacher_permissions')
      .select('teacher_user_id,permission_key,enabled,updated_at')
      .order('updated_at',{ascending:false})
  ]);

  const names = [
    'الملفات الشخصية','فهرس الدورات','الباقات','دورات الباقات',
    'الاشتراكات','المدفوعات','إسنادات المدرسين','صلاحيات المدرسين'
  ];

  for(let i=0;i<queries.length;i++) {
    if(queries[i].error) {
      throw new Error(names[i] + ': ' + queries[i].error.message);
    }
  }

  [
    state.profiles,state.courses,state.plans,state.planCourses,
    state.subscriptions,state.payments,state.assignments,state.permissions
  ] = queries.map(r => r.data || []);

  const accessResult = await db.from('student_course_permissions')
    .select('user_id,course_slug,can_view_course_page,can_watch_video,can_download,can_take_assessments,can_receive_certificate,can_track_progress,updated_by,updated_at');
  if(accessResult.error) {
    const missingSchema = ['42P01','PGRST205'].includes(accessResult.error.code) ||
      /student_course_permissions.*(not found|does not exist)|could not find the table/i.test(accessResult.error.message || '');
    if(!missingSchema) throw new Error('صلاحيات الطلاب الفردية: ' + accessResult.error.message);
    state.accessPermissions = [];
    state.permissionsReady = false;
  } else {
    state.accessPermissions = accessResult.data || [];
    state.permissionsReady = true;
  }

  const hasPendingStudents = state.profiles.some(p =>
    p.role === 'student' && p.status === 'pending' && p.requested_role !== 'teacher'
  );
  state.reviewPlans = [];
  state.reviewPlansError = "";
  if(hasPendingStudents) {
    const reviewPlansResult = await db.rpc('get_admin_review_plans_v2');
    if(reviewPlansResult.error) {
      state.reviewPlansError = reviewPlansResult.error.message || 'تعذر تحميل الباقات المتاحة للمراجعة.';
    } else {
      state.reviewPlans = Array.isArray(reviewPlansResult.data) ? reviewPlansResult.data : [];
    }
  }

  renderAll();
}

function renderAll() {
  const students = state.profiles.filter(p =>
    p.role === 'student' && p.status === 'approved' &&
    p.account_state === 'active'
  );
  const teachers = state.profiles.filter(p =>
    p.role === 'teacher' && p.status === 'approved' &&
    p.account_state === 'active'
  );
  const activePlans = state.plans.filter(p => p.is_active);
  const activeSubs = state.subscriptions.filter(s => s.status === 'active');

  $('studentCount').textContent = students.length;
  $('planCount').textContent = activePlans.length;
  $('activeCount').textContent = activeSubs.length;
  $('teacherCount').textContent = teachers.length;

  fillSelect('studentSelect',students,'user_id',
    p => `${p.full_name || 'طالب'} — ${profileIdentifier(p)}`,
    'اختر الطالب المعتمد');

  refreshPlanOptionsForSelectedStudent();

  const usableSubs = state.subscriptions.filter(s =>
    ['pending','active','suspended'].includes(s.status)
  );
  const payableSubs = usableSubs.filter(s => paymentRemaining(s.id) > 0);

  const subLabel = s => {
    const p = person(s.user_id);
    const pl = plan(s.plan_id);
    return `${p?.full_name || profileIdentifier(p) || 'طالب'} — ${pl?.name || 'باقة'} — ${statusLabel(s.status)}`;
  };

  fillSelect('paymentSubscription',payableSubs,'id',subLabel,'اختر اشتراكًا له رصيد مستحق');
  fillSelect('activationSubscription',usableSubs,'id',subLabel,'اختر الاشتراك');

  const teacherCandidates = students.filter(p =>
    !state.subscriptions.some(s =>
      s.user_id === p.user_id && s.status === 'active'
    )
  );

  fillSelect('teacherCandidate',teacherCandidates,'user_id',
    p => `${p.full_name || 'طالب'} — ${profileIdentifier(p)}`,
    'لا يوجد حساب طالب غير مرتبط باشتراك نشط');

  fillSelect('teacherSelect',teachers,'user_id',
    p => `${p.full_name || 'مدرس'} — ${profileIdentifier(p)}`,
    'اختر المدرس');

  fillSelect('permissionTeacher',teachers,'user_id',
    p => `${p.full_name || 'مدرس'} — ${profileIdentifier(p)}`,
    'اختر المدرس');

  fillSelect('teacherCourse',state.courses,'course_slug',
    c => c.title,
    'اختر الدورة');

  fillSelect('accessStudentSelect',students,'user_id',
    p => `${p.full_name || 'طالب'} — ${profileIdentifier(p)}`,
    'اختر الطالب المعتمد');

  renderStudentCoursePermissions();
  renderPendingStudentRequests();
  renderCourseChoices();
  renderPlans();
  renderSubscriptions();
  renderPayments();
  renderAssignments();
  renderPermissions();
  updateAssignPricePreview();
  updatePaymentBalance();
}

function renderPendingStudentRequests() {
  const host = $('pendingStudentsBody');
  const count = $('pendingStudentsLabel');
  if(!host || !count) return;

  const requests = state.profiles.filter(p =>
    p.status === 'pending' && ['student','teacher'].includes(p.role)
  );

  const studentCount = requests.filter(p => p.requested_role !== 'teacher').length;
  const teacherCount = requests.filter(p => p.requested_role === 'teacher').length;
  count.textContent = `${requests.length} طلب — ${studentCount} طالب، ${teacherCount} مدرس`;

  if(!requests.length) {
    host.innerHTML = '<tr><td colspan="7" class="empty">لا توجد طلبات معلقة حاليًا.</td></tr>';
    return;
  }

  host.innerHTML = requests.map(profile => {
    const isTeacher = profile.requested_role === 'teacher';
    const requested = normalizeCourseLabel(profile.requested_course);
    const matchingPlans = isTeacher ? [] : state.reviewPlans.filter(item =>
      normalizeCourseLabel(item.course_slug) === requested ||
      normalizeCourseLabel(item.course_title) === requested
    );
    const selectedOptions = matchingPlans.map(item => {
      const price = Number(item.price || 0);
      return `<option value="${esc(item.plan_id)}" data-base-price="${esc(price)}" data-currency="${esc(item.currency || 'EGP')}">${esc(item.plan_name || 'باقة')} — ${esc(money(price,item.currency || 'EGP'))}</option>`;
    }).join('');

    const noPlan = state.reviewPlansError
      ? 'تعذر تحميل الباقات للمراجعة'
      : 'لا توجد باقة نشطة مطابقة للدورة المطلوبة';
    const courseName = isTeacher
      ? (Array.isArray(profile.requested_teaching_courses)
          ? profile.requested_teaching_courses.join('، ')
          : String(profile.requested_teaching_courses || 'لم يحدد'))
      : courseTitle(profile.requested_course);
    const specialties = isTeacher
      ? (profile.teacher_specialties || 'لم يحدد التخصصات')
      : 'اعتماد طالب';
    const approveDisabled = !isTeacher && (!matchingPlans.length || Boolean(state.reviewPlansError));

    const planCell = isTeacher
      ? '<span class="muted">لا تحتاج باقة</span>'
      : `<select data-request-plan style="min-width:210px;width:100%;padding:8px;border:1px solid #dce3ed;border-radius:8px;background:#fff" ${approveDisabled ? 'disabled' : ''}>
          <option value="">${matchingPlans.length ? 'اختر الباقة' : esc(noPlan)}</option>
          ${selectedOptions}
        </select>
        ${state.reviewPlansError ? `<small class="muted">${esc(state.reviewPlansError)}</small>` : ''}`;

    const discountCell = isTeacher
      ? '<span class="muted">—</span>'
      : `<select data-request-discount-type style="min-width:120px;width:100%;padding:7px;border:1px solid #dce3ed;border-radius:8px">
          <option value="none">بدون خصم</option>
          <option value="percent">نسبة %</option>
          <option value="fixed">مبلغ ثابت</option>
          <option value="waive">إعفاء كامل</option>
        </select>
        <input data-request-discount-value type="number" min="0" step="0.01" value="0" aria-label="قيمة الخصم" style="width:100%;margin-top:6px;padding:7px;border:1px solid #dce3ed;border-radius:8px">
        <input data-request-discount-reason type="text" maxlength="240" placeholder="سبب الخصم (اختياري)" style="width:100%;margin-top:6px;padding:7px;border:1px solid #dce3ed;border-radius:8px">`;

    const priceCell = isTeacher
      ? '<span class="muted">لا ينطبق</span>'
      : '<small data-request-price-preview class="muted">اختر الباقة لحساب المستحق.</small>';

    return `<tr data-pending-student="${esc(profile.user_id)}" data-request-role="${isTeacher ? 'teacher' : 'student'}">
      <td><strong>${esc(profile.full_name || '—')}</strong><br><small class="muted">${esc(profile.email || '')}</small><br><small class="muted">${esc(profile.phone || '')}</small></td>
      <td><strong>${isTeacher ? 'طلب مدرس' : 'طلب متدرب'}</strong><br><small class="muted">${esc(specialties)}</small></td>
      <td>${esc(courseName || (isTeacher ? 'لم يحدد' : 'لم تحدد'))}<br><small class="muted">${esc(profile.requested_course || '—')}</small></td>
      <td>${planCell}</td>
      <td>${discountCell}</td>
      <td>${priceCell}</td>
      <td><div class="action-cell">
        <button type="button" class="btn small teal" data-request-action="approve" ${approveDisabled ? 'disabled title="لا توجد باقة مطابقة"' : ''}>${isTeacher ? 'اعتماد مدرس' : 'اعتماد وإسناد'}</button>
        <button type="button" class="btn small red" data-request-action="reject">رفض</button>
      </div></td>
    </tr>`;
  }).join('');

  host.querySelectorAll('tr[data-pending-student]').forEach(row => updatePendingStudentPrice(row));
}

function updatePendingStudentPrice(row) {
  const select = row?.querySelector('[data-request-plan]');
  const type = row?.querySelector('[data-request-discount-type]');
  const value = row?.querySelector('[data-request-discount-value]');
  const preview = row?.querySelector('[data-request-price-preview]');
  if(!select || !type || !value || !preview) return;

  const option = select.selectedOptions?.[0];
  if(!option?.value) {
    preview.textContent = 'اختر الباقة لحساب المستحق.';
    return;
  }

  const base = Number(option.dataset.basePrice || 0);
  const calc = calculateDiscount(base,type.value,value.value);
  const currency = option.dataset.currency || 'EGP';
  preview.textContent = `الأساسي: ${money(base,currency)} — الخصم: ${money(calc.discount,currency)} — الصافي: ${money(calc.net,currency)}`;
}

function renderCourseChoices() {
  const host = $('courseChoices');

  if(!state.courses.length) {
    host.innerHTML = '<div class="empty">لا توجد دورات نشطة في فهرس الدورات.</div>';
    return;
  }

  host.innerHTML = state.courses.map(c => `
    <label class="course-choice">
      <input type="checkbox" name="course_slug" value="${esc(c.course_slug)}">
      <span>${esc(c.title)} <small class="muted">(${esc(c.course_slug)})</small></span>
    </label>
  `).join('');
}

function renderPlans() {
  $('plansLabel').textContent = state.plans.length + ' باقة';

  $('plansBody').innerHTML = state.plans.length
    ? state.plans.map(p => {
      const mappings = state.planCourses.filter(x => x.plan_id === p.id);
      const names = mappings.map(x => courseTitle(x.course_slug)).join('، ');
      const paidPlanNeedsPrice = /(?:^|[-_])paid(?:[-_]|$)/i.test(String(p.code || '')) && Number(p.price || 0) <= 0;
      const toggleDisabled = !p.is_active && paidPlanNeedsPrice;
      const extraNote = paidPlanNeedsPrice
        ? '<br><small class="muted">أدخل السعر الحقيقي قبل التفعيل</small>'
        : '';
      return `<tr>
        <td><strong>${esc(p.name)}</strong><br><span class="muted">${esc(p.code)}</span></td>
        <td>${esc(p.plan_type)}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;min-width:180px">
            <input data-plan-price="${esc(p.id)}" type="number" min="0" step="0.01" value="${esc(p.price)}" aria-label="السعر الأساسي" style="width:110px;min-height:34px;padding:5px 7px;border:1px solid #dce3ed;border-radius:8px">
            <span class="muted">${esc(p.currency)}</span>
            <button class="btn small light" data-plan-save="${esc(p.id)}">حفظ</button>
          </div>${extraNote}
        </td>
        <td>${p.duration_days ? esc(p.duration_days)+' يوم' : 'مفتوح المدة'}</td>
        <td>${esc(names || 'لم تحدد')}</td>
        <td>${statusHtml(p.is_active ? 'active' : 'cancelled')}</td>
        <td><button class="btn small light" data-plan-toggle="${esc(p.id)}" ${toggleDisabled ? 'disabled title="أدخل السعر الحقيقي قبل تفعيل الباقة المدفوعة."' : ''}>${p.is_active ? 'إيقاف' : 'تفعيل'}</button></td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="7" class="empty">لا توجد باقات.</td></tr>';
}

function renderSubscriptions() {
  $('subscriptionsLabel').textContent = state.subscriptions.length + ' اشتراك';

  $('subscriptionsBody').innerHTML = state.subscriptions.length
    ? state.subscriptions.map(s => {
      const p = person(s.user_id);
      const pl = plan(s.plan_id);
      let actions = '';

      if(s.status === 'active') {
        actions += `<button class="btn small light" data-sub-action="suspended" data-id="${esc(s.id)}">تعليق</button>`;
      }

      if(['pending','active','suspended'].includes(s.status)) {
        actions += `<button class="btn small red" data-sub-action="cancelled" data-id="${esc(s.id)}">إلغاء</button>`;
      }

      return `<tr>
        <td>${esc(p?.full_name || '—')}<br><span class="muted">${esc(profileIdentifier(p))}</span></td>
        <td>${esc(pl?.name || '—')}</td>
        <td>${esc(money(s.base_amount ?? s.agreed_amount,s.currency))}</td>
        <td>${esc(money(s.discount_amount || 0,s.currency))}${s.discount_type && s.discount_type !== 'none' ? `<br><small class="muted">${esc(s.discount_type)} ${esc(s.discount_value ?? '')}</small>` : ''}</td>
        <td><strong>${esc(money(s.agreed_amount,s.currency))}</strong></td>
        <td>${esc(money(state.payments.filter(p => p.subscription_id === s.id && p.status === 'paid').reduce((sum,p) => sum + Number(p.amount || 0),0),s.currency))}</td>
        <td>${esc(money(paymentRemaining(s.id),s.currency))}</td>
        <td>${statusHtml(s.payment_state)}</td>
        <td>${statusHtml(s.status)}</td>
        <td>${esc(date(s.starts_at))}</td>
        <td>${esc(date(s.expires_at))}</td>
        <td><div class="action-cell">${actions || '—'}</div></td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="12" class="empty">لا توجد اشتراكات بعد.</td></tr>';
}

function renderPayments() {
  $('paymentsBody').innerHTML = state.payments.length
    ? state.payments.map(p => {
      const student = person(p.student_user_id);
      const refundButton = p.status === 'paid'
        ? `<button class="btn small red" data-refund="${esc(p.id)}">تسجيل استرداد</button>`
        : '—';

      return `<tr>
        <td>${esc(student?.full_name || studenprofileIdentifier(t) || '—')}</td>
        <td>${esc(money(p.amount,p.currency))}</td>
        <td>${esc(p.payment_method)}</td>
        <td>${esc(p.payment_reference || '—')}</td>
        <td>${statusHtml(p.status)}</td>
        <td>${esc(dateTime(p.paid_at || p.created_at))}</td>
        <td>${refundButton}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="7" class="empty">لا توجد مدفوعات مسجلة.</td></tr>';
}

function renderAssignments() {
  $('assignmentsBody').innerHTML = state.assignments.length
    ? state.assignments.map(a => {
      const t = person(a.teacher_user_id);
      return `<tr>
        <td>${esc(t?.full_name || profileIdentifier(t) || '—')}</td>
        <td>${esc(courseTitle(a.course_slug))}</td>
        <td>${statusHtml(a.is_active ? 'active' : 'cancelled')}</td>
        <td>${esc(dateTime(a.assigned_at))}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="4" class="empty">لا توجد إسنادات.</td></tr>';
}

function renderPermissions() {
  const labels = {
    'students.view':'مشاهدة الطلاب',
    'students.view_progress':'مشاهدة التقدم',
    'students.view_assessments':'مشاهدة نتائج الاختبارات',
    'students.view_contact':'بيانات التواصل',
    'lessons.manage':'إدارة الدروس',
    'assessments.manage':'إدارة الاختبارات',
    'assignments.grade':'تصحيح التكليفات',
    'students.message':'مراسلة الطلاب'
  };

  $('permissionsBody').innerHTML = state.permissions.length
    ? state.permissions.map(p => {
      const t = person(p.teacher_user_id);
      return `<tr>
        <td>${esc(t?.full_name || profileIdentifier(t) || '—')}</td>
        <td>${esc(labels[p.permission_key] || p.permission_key)}</td>
        <td>${statusHtml(p.enabled ? 'active' : 'cancelled')}</td>
        <td>${esc(dateTime(p.updated_at))}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="4" class="empty">لا توجد صلاحيات إضافية مسجلة.</td></tr>';
}

async function rpc(name,args) {
  const {data,error} = await state.client.rpc(name,args);
  if(error) throw error;
  return data;
}

$('pendingStudentsBody').addEventListener('input', event => {
  const row = event.target.closest('tr[data-pending-student]');
  if(row) updatePendingStudentPrice(row);
});
$('pendingStudentsBody').addEventListener('change', event => {
  const row = event.target.closest('tr[data-pending-student]');
  if(row) updatePendingStudentPrice(row);
});
$('pendingStudentsBody').addEventListener('click', async event => {
  const button = event.target.closest('[data-request-action]');
  if(!button) return;

  const row = button.closest('tr[data-pending-student]');
  const targetUser = row?.dataset.pendingStudent;
  const action = button.dataset.requestAction;
  const requestRole = row?.dataset.requestRole || 'student';
  if(!targetUser || !['approve','reject'].includes(action)) return;

  const isTeacher = requestRole === 'teacher';
  const planSelect = row.querySelector('[data-request-plan]');
  const discountType = row.querySelector('[data-request-discount-type]')?.value || 'none';
  const discountValue = discountType === 'waive'
    ? 0
    : Number(row.querySelector('[data-request-discount-value]')?.value || 0);
  const discountReason = row.querySelector('[data-request-discount-reason]')?.value || '';

  if(action === 'approve' && !isTeacher) {
    if(!planSelect?.value) {
      msg('اختر باقة نشطة مطابقة للدورة المطلوبة قبل اعتماد الطالب.',true);
      return;
    }
    const selectedOption = planSelect.selectedOptions[0];
    const base = Number(selectedOption.dataset.basePrice || 0);
    if(!Number.isFinite(discountValue) || discountValue < 0 ||
       (discountType === 'percent' && discountValue > 100) ||
       (discountType === 'fixed' && discountValue > base)) {
      msg('قيمة الخصم غير صحيحة أو أكبر من السعر الأساسي.',true);
      return;
    }
    const calc = calculateDiscount(base,discountType,discountValue);
    const planName = selectedOption.textContent.split(' — ')[0];
    const studentName = row.querySelector('td strong')?.textContent || 'الطالب';
    if(!confirm(calc.net === 0
      ? `سيتم اعتماد ${studentName} وإسناد ${planName} مع إعفاء كامل من الرسوم. هل تتابع؟`
      : `سيتم اعتماد ${studentName} وإسناد ${planName} بصافي مستحق ${money(calc.net,selectedOption.dataset.currency || 'EGP')}. سيظل الاشتراك مغلقًا حتى اكتمال السداد. هل تتابع؟`)) return;
  } else if(action === 'approve' && isTeacher) {
    const teacherName = row.querySelector('td strong')?.textContent || 'المدرس';
    if(!confirm(`هل تريد اعتماد طلب ${teacherName} كمدرس؟ بعد الاعتماد يمكنك إسناد الدورات وتحديد صلاحياته.`)) return;
  } else if(!confirm('هل تريد رفض هذا الطلب؟')) {
    return;
  }

  const siblingButtons = row.querySelectorAll('button[data-request-action]');
  siblingButtons.forEach(item => { item.disabled = true; });
  try {
    if(action === 'approve' && !isTeacher) {
      await rpc('approve_student_application_with_discount_v1',{
        p_target_user:targetUser,
        p_plan_id:planSelect.value,
        p_discount_type:discountType,
        p_discount_value:discountValue,
        p_discount_reason:discountReason,
        p_admin_note:'اعتماد من لوحة إدارة العضويات'
      });
      msg('تم اعتماد الطالب وإنشاء الاشتراك. راجع حالة الدفع قبل إتاحة الدورة.');
    } else {
      await rpc('review_membership_request_v2',{
        p_target_user:targetUser,
        p_decision:action === 'approve' ? 'approved' : 'rejected'
      });
      msg(action === 'approve'
        ? 'تم اعتماد المدرس. انتقل إلى قسم المدرسين لإسناد دوراته وصلاحياته.'
        : 'تم رفض الطلب.');
    }
    await loadAll();
  } catch(error) {
    msg('تعذر معالجة الطلب: ' + error.message,true);
    siblingButtons.forEach(item => { item.disabled = false; });
  }
});

$('planForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const form = event.currentTarget;
  const fd = new FormData(form);
  const selected = [...form.querySelectorAll('input[name="course_slug"]:checked')]
    .map(x => x.value);

  if(!selected.length) {
    msg('اختر دورة واحدة على الأقل في الباقة.',true);
    return;
  }

  const price = Number(fd.get('price'));
  const planCode = String(fd.get('code') || '').trim();
  const durationRaw = String(fd.get('duration_days') || '').trim();

  if(!Number.isFinite(price) || price < 0) {
    msg('قيمة السعر غير صحيحة.',true);
    return;
  }
  if (/(?:^|[-_])paid(?:[-_]|$)/i.test(planCode) && price <= 0) {
    msg('الباقة المدفوعة تحتاج سعرًا أساسيًا أكبر من صفر قبل إنشائها.',true);
    return;
  }

  if(durationRaw && (!Number.isInteger(Number(durationRaw)) || Number(durationRaw) <= 0)) {
    msg('مدة الاشتراك يجب أن تكون عدد أيام صحيحًا أكبر من صفر.',true);
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const payload = {
      code:planCode,
      name:String(fd.get('name')).trim(),
      description:String(fd.get('description') || ''),
      plan_type:fd.get('plan_type'),
      price,
      currency:fd.get('currency'),
      duration_days:durationRaw ? Number(durationRaw) : null,
      is_active:true,
      is_public:fd.get('is_public') === 'on',
      created_by:state.user.id
    };

    const {data:created,error:createError} = await state.client
      .from('subscription_plans')
      .insert(payload)
      .select('id')
      .single();

    if(createError) throw createError;

    const rows = selected.map(slug => ({
      plan_id:created.id,
      course_slug:slug,
      can_view_course_page:true,
      can_watch_video:$('capVideo').checked,
      can_download:$('capDownload').checked,
      can_take_assessments:$('capAssessment').checked,
      can_receive_certificate:$('capCertificate').checked,
      can_track_progress:$('capProgress').checked
    }));

    const {error:mappingError} = await state.client
      .from('subscription_plan_courses').insert(rows);

    if(mappingError) {
      await state.client.from('subscription_plans').delete().eq('id',created.id);
      throw mappingError;
    }

    form.reset();
    $('capVideo').checked = true;
    $('capProgress').checked = true;
    msg('تم إنشاء الباقة وربط الدورات والصلاحيات بنجاح.');
    await loadAll();

  } catch(error) {
    msg('تعذّر إنشاء الباقة: ' + error.message,true);
  } finally {
    button.disabled = false;
  }
});

$('subscriptionForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const form = event.currentTarget;
  const fd = new FormData(form);
  const studentId = String(fd.get('student_id') || '');
  const planId = String(fd.get('plan_id') || '');
  const selectedPlan = state.plans.find(item => item.id === planId);
  const selectedStudent = state.profiles.find(item => item.user_id === studentId);

  if(!selectedStudent || !selectedPlan) {
    msg('اختر طالبًا معتمدًا وباقة نشطة تشمل دورته.',true);
    return;
  }

  const discountType = String(fd.get('discount_type') || 'none');
  const discountValue = discountType === 'waive' ? 0 : Number(fd.get('discount_value') || 0);
  const calc = calculateDiscount(selectedPlan.price, discountType, discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percent' && discountValue > 100) || (discountType === 'fixed' && discountValue > calc.base)) {
    msg('قيمة الخصم غير صحيحة أو أكبر من السعر الأساسي.',true);
    return;
  }
  const confirmText = calc.net === 0
    ? `سيتم إسناد ${selectedPlan.name} إلى ${selectedStudent.full_name || selectedStudent.email} بصافي صفر جنيه وتفعيل الاشتراك كإعفاء. هل تتابع؟`
    : `السعر الأساسي ${money(calc.base,selectedPlan.currency)}، الخصم ${money(calc.discount,selectedPlan.currency)}، الصافي ${money(calc.net,selectedPlan.currency)}. سيظل الاشتراك معلقًا حتى اكتمال السداد. هل تتابع؟`;

  if(!confirm(confirmText)) return;

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const id = await rpc('admin_assign_student_with_discount_v1',{
      p_target_user:studentId,
      p_plan_id:planId,
      p_discount_type:discountType,
      p_discount_value:discountValue,
      p_discount_reason:fd.get('discount_reason') || '',
      p_admin_note:fd.get('admin_note') || ''
    });

    msg(
      calc.net === 0
        ? 'تم إسناد الاشتراك وإعفاء الطالب وتفعيله. رقم الاشتراك: ' + id
        : 'تم إسناد الاشتراك. المستحق ' + money(calc.net,selectedPlan.currency) + '، وسيظل معلقًا حتى اكتمال السداد. رقم الاشتراك: ' + id
    );

    form.reset();
    refreshPlanOptionsForSelectedStudent();
    await loadAll();

  } catch(error) {
    msg('تعذّر إسناد الباقة: ' + error.message,true);
  } finally {
    button.disabled = false;
  }
});

$('paymentForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const fd = new FormData(event.currentTarget);
  const amount = Number(fd.get('amount'));
  const remaining = paymentRemaining(String(fd.get('subscription_id') || ''));
  if(!Number.isFinite(amount) || amount <= 0) {
    msg('أدخل مبلغ دفعة صحيحًا.',true);
    return;
  }
  if (remaining === null || amount > remaining + 0.001) {
    msg('مبلغ الدفعة أكبر من الرصيد المتبقي.',true);
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    await rpc('record_subscription_payment_v3',{
      p_subscription_id:fd.get('subscription_id'),
      p_amount:amount,
      p_payment_method:fd.get('payment_method'),
      p_payment_reference:fd.get('payment_reference') || '',
      p_note:fd.get('note') || ''
    });

    event.currentTarget.reset();
    msg('تم تسجيل الدفعة وتحديث حالة السداد.');
    await loadAll();

  } catch(error) {
    msg('تعذّر تسجيل الدفعة: ' + error.message,true);
  } finally {
    button.disabled = false;
  }
});

$('activationForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const fd = new FormData(event.currentTarget);
  const starts = fd.get('starts_at');
  const expires = fd.get('expires_at');

  if(!starts) {
    msg('حدد تاريخ بداية الاشتراك.',true);
    return;
  }

  const startIso = new Date(starts).toISOString();
  const expiryIso = expires ? new Date(expires).toISOString() : null;

  if(expiryIso && new Date(expiryIso) <= new Date(startIso)) {
    msg('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.',true);
    return;
  }

  const waive = fd.get('waive_fee') === 'on';

  if(waive && !confirm('هل تؤكد إعفاء الطالب من الرسوم؟')) return;

  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    await rpc('activate_student_subscription_v2',{
      p_subscription_id:fd.get('subscription_id'),
      p_starts_at:startIso,
      p_expires_at:expiryIso,
      p_waive_fee:waive
    });

    msg('تم تفعيل الاشتراك بنجاح.');
    event.currentTarget.reset();
    $('activationStart').value = localDateTimeValue();
    await loadAll();

  } catch(error) {
    msg('تعذّر تفعيل الاشتراك: ' + error.message,true);
  } finally {
    button.disabled = false;
  }
});

$('teacherConvertForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const form = event.currentTarget;
  const fd = new FormData(form);

  if(!confirm('سيتم تحويل حساب الطالب إلى مدرس مع اعتماد الحساب. هل تتابع؟')) return;

  try {
    await rpc('set_profile_role_v2',{
      p_target_user:fd.get('student_id'),
      p_new_role:'teacher'
    });
  } catch(error) {
    msg('تعذّر تحويل الحساب: ' + error.message,true);
    return;
  }

  form.reset();

  try {
    await loadAll();
    msg('تم تحويل الحساب إلى مدرس وتحديث بيانات اللوحة.');
  } catch(error) {
    msg('تم التحويل، لكن تعذّر تحديث عرض البيانات: ' + error.message,true);
  }
});

$('teacherAssignForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const fd = new FormData(event.currentTarget);

  try {
    await rpc('assign_teacher_course_v2',{
      p_teacher_user_id:fd.get('teacher_id'),
      p_course_slug:fd.get('course_slug'),
      p_is_active:fd.get('is_active') === 'true'
    });

    msg('تم حفظ إسناد الدورة للمدرس.');
    await loadAll();

  } catch(error) {
    msg('تعذّر حفظ الإسناد: ' + error.message,true);
  }
});

$('teacherPermissionForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();

  const fd = new FormData(event.currentTarget);

  try {
    await rpc('set_teacher_permission_v2',{
      p_teacher_user_id:fd.get('teacher_id'),
      p_permission_key:fd.get('permission_key'),
      p_enabled:fd.get('enabled') === 'true'
    });

    msg('تم تحديث صلاحية المدرس.');
    await loadAll();

  } catch(error) {
    msg('تعذّر تحديث الصلاحية: ' + error.message,true);
  }
});

$('plansBody').addEventListener('click',async event => {
  const saveButton = event.target.closest('[data-plan-save]');
  if (saveButton) {
    const p = plan(saveButton.dataset.planSave);
    const input = $('plansBody').querySelector(`[data-plan-price="${CSS.escape(saveButton.dataset.planSave)}"]`);
    const nextPrice = Number(input?.value);
    if (!p || !Number.isFinite(nextPrice) || nextPrice < 0) {
      msg('أدخل سعرًا أساسيًا صحيحًا.',true);
      return;
    }
    if (/(?:^|[-_])paid(?:[-_]|$)/i.test(String(p.code || '')) && nextPrice <= 0 && p.is_active) {
      msg('لا يمكن إبقاء الباقة المدفوعة نشطة بسعر صفر. أوقفها أولًا أو أدخل السعر الصحيح.',true);
      return;
    }
    if (!confirm(`تأكيد السعر الأساسي الجديد للباقة «${p.name}»: ${money(nextPrice,p.currency)}؟ سيؤثر هذا السعر على الاشتراكات الجديدة فقط.`)) return;
    saveButton.disabled = true;
    try {
      const {error} = await state.client.from('subscription_plans').update({price:nextPrice}).eq('id',p.id);
      if (error) throw error;
      msg('تم حفظ السعر الأساسي. الاشتراكات السابقة لن تتغير.');
      await loadAll();
    } catch(error) {
      msg('تعذّر حفظ السعر: ' + error.message,true);
    } finally {
      saveButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest('[data-plan-toggle]');
  if(!button) return;

  const p = plan(button.dataset.planToggle);
  if(!p) return;

  const next = !p.is_active;

  if(next && /(?:^|[-_])paid(?:[-_]|$)/i.test(String(p.code || '')) && Number(p.price || 0) <= 0) {
    msg('لا يمكن تفعيل باقة مدفوعة قبل إدخال السعر الأساسي الحقيقي.',true);
    return;
  }

  if(!confirm(next ? 'تفعيل هذه الباقة؟' : 'إيقاف هذه الباقة؟')) return;

  try {
    const {error} = await state.client
      .from('subscription_plans')
      .update({is_active:next})
      .eq('id',p.id);

    if(error) throw error;
    msg('تم تحديث حالة الباقة.');
    await loadAll();

  } catch(error) {
    msg('تعذّر تحديث الباقة: ' + error.message,true);
  }
});

$('subscriptionsBody').addEventListener('click',async event => {
  const button = event.target.closest('[data-sub-action]');
  if(!button) return;

  const nextStatus = button.dataset.subAction;
  const subscriptionId = button.dataset.id;

  if(!confirm(nextStatus === 'cancelled'
    ? 'هل تؤكد إلغاء الاشتراك؟'
    : 'هل تؤكد تعليق الاشتراك؟')) return;

  try {
    await rpc('set_student_subscription_status_v2',{
      p_subscription_id:subscriptionId,
      p_new_status:nextStatus
    });

    msg('تم تحديث حالة الاشتراك.');
    await loadAll();

  } catch(error) {
    msg('تعذّر تحديث الاشتراك: ' + error.message,true);
  }
});

$('paymentsBody').addEventListener('click',async event => {
  const button = event.target.closest('[data-refund]');
  if(!button) return;

  const paymentId = button.dataset.refund;

  if(!confirm('سيتم تغيير حالة الدفعة إلى مستردة في سجل النظام فقط. هذا الإجراء لا يحوّل أموالًا فعليًا. هل تتابع؟')) return;

  const note = prompt('اكتب ملاحظة الاسترداد:') || '';

  try {
    await rpc('refund_subscription_payment_v2',{
      p_payment_id:paymentId,
      p_note:note
    });

    msg('تم تحديث سجل الاسترداد.');
    await loadAll();

  } catch(error) {
    msg('تعذّر تسجيل الاسترداد: ' + error.message,true);
  }
});

$('expireBtn').addEventListener('click',async () => {
  if(!confirm('سيتم إنهاء الاشتراكات النشطة التي تجاوزت تاريخ انتهائها. هل تتابع؟')) return;

  try {
    const count = await rpc('expire_due_subscriptions_v2',{});
    msg('تم إنهاء ' + count + ' اشتراك منتهي المدة.');
    await loadAll();

  } catch(error) {
    msg('تعذّر تحديث الاشتراكات المنتهية: ' + error.message,true);
  }
});

$('refreshBtn').addEventListener('click',async () => {
  clearMsg();
  try {
    await loadAll();
    msg('تم تحديث البيانات.');
  } catch(error) {
    msg(error.message,true);
  }
});

$('logoutBtn').addEventListener('click',async event => {
  event.preventDefault();
  if(!confirm('تسجيل الخروج من لوحة الإدارة؟')) return;
  await state.client.auth.signOut();
  location.href = 'admin-students.html';
});

ensurePricingControls();
$('assignDiscountValueWrap').classList.toggle('hidden', $('assignDiscountType').value === 'none' || $('assignDiscountType').value === 'waive');

$('accessStudentSelect').addEventListener('change', refreshStudentPermissionCourseOptions);
$('accessCourseSelect').addEventListener('change', loadStudentCoursePermissionForm);

$('permCanPage').addEventListener('change', () => {
  if(!$('permCanPage').checked) {
    $('permCanVideo').checked = false;
    $('permCanDownload').checked = false;
    $('permCanAssessment').checked = false;
    $('permCanCertificate').checked = false;
    $('permCanProgress').checked = false;
  }
});
['permCanVideo','permCanDownload','permCanAssessment','permCanCertificate','permCanProgress'].forEach(id => {
  $(id).addEventListener('change', () => {
    if($(id).checked) $('permCanPage').checked = true;
  });
});

$('studentPermissionsForm').addEventListener('submit',async event => {
  event.preventDefault();
  clearMsg();
  const studentId = $('accessStudentSelect').value;
  const courseSlug = $('accessCourseSelect').value;
  const permissions = readStudentPermissionForm();

  if(!state.permissionsReady || !studentId || !courseSlug) {
    msg('اختر طالبًا ودورة لها اشتراك نشط أولًا.',true);
    return;
  }
  if(!permissions.can_view_course_page && Object.entries(permissions).some(([key,value]) => key !== 'can_view_course_page' && value)) {
    msg('يجب تفعيل مشاهدة صفحة الدورة قبل تفعيل أي صلاحية أخرى.',true);
    return;
  }

  const button = $('saveStudentPermissionsBtn');
  button.disabled = true;
  try {
    await rpc('admin_set_student_course_permissions_v2',{
      p_target_user:studentId,
      p_course_slug:courseSlug,
      p_can_view_course_page:permissions.can_view_course_page,
      p_can_watch_video:permissions.can_watch_video,
      p_can_download:permissions.can_download,
      p_can_take_assessments:permissions.can_take_assessments,
      p_can_receive_certificate:permissions.can_receive_certificate,
      p_can_track_progress:permissions.can_track_progress,
      p_note:'من لوحة إدارة صلاحيات الطلاب'
    });
    msg('تم حفظ صلاحيات الطالب لهذه الدورة فقط.');
    await loadAll();
  } catch(error) {
    msg('تعذّر حفظ الصلاحيات: ' + error.message,true);
  } finally {
    button.disabled = false;
  }
});

$('resetStudentPermissionsBtn').addEventListener('click',async () => {
  const studentId = $('accessStudentSelect').value;
  const courseSlug = $('accessCourseSelect').value;
  if(!studentId || !courseSlug) {
    msg('اختر طالبًا ودورة أولًا.',true);
    return;
  }
  if(!confirm('إعادة صلاحيات الطالب إلى إعدادات الباقة لهذه الدورة؟')) return;
  try {
    await rpc('admin_reset_student_course_permissions_v2',{
      p_target_user:studentId,
      p_course_slug:courseSlug
    });
    msg('تمت إعادة صلاحيات الدورة إلى إعدادات الباقة.');
    await loadAll();
  } catch(error) {
    msg('تعذّر إعادة الصلاحيات: ' + error.message,true);
  }
});

$('studentSelect').addEventListener('change', () => {
  refreshPlanOptionsForSelectedStudent();
  updateAssignPricePreview();
});
$('planSelect').addEventListener('change', updateAssignPricePreview);
$('assignDiscountType').addEventListener('change', () => {
  $('assignDiscountValueWrap').classList.toggle('hidden', $('assignDiscountType').value === 'none' || $('assignDiscountType').value === 'waive');
  updateAssignPricePreview();
});
$('assignDiscountValue').addEventListener('input', updateAssignPricePreview);
$('paymentSubscription').addEventListener('change', updatePaymentBalance);

boot();
})();
