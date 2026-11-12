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

  const COURSE_CONTENT = Object.freeze({
    accounting: {
      summary: 'منهج تمهيدي في مبادئ المحاسبة والتسجيل المحاسبي وإعداد القوائم المالية.',
      sections: [
        'الوحدة الأولى: لماذا نتعلم المحاسبة؟',
        'الوحدة الثانية: قاعدة القيد المزدوج وحسابات دفاتر الأستاذ',
        'الوحدة الثالثة: دفاتر اليومية المساعدة',
        'الوحدة الرابعة: ميزان المراجعة وتصحيح الأخطاء',
        'الوحدة الخامسة: القوائم المالية للمنشأة الفردية'
      ]
    },
    'financial-accounting': null,
    'business-administration': {
      summary: 'مسار الإدارة والأعمال لفهم المنظمات وقراراتها والبيئة وأصحاب المصلحة.',
      sections: [
        'الوحدة الأولى: مدخل إلى الأعمال وغايتها',
        'الوحدة الثانية: أنواع منظمات الأعمال',
        'الوحدة الثالثة: أهداف منظمات الأعمال وأصحاب المصلحة',
        'الوحدة الرابعة: البيئة الداخلية والخارجية',
        'الوحدة الخامسة: الإدارة والقيادة',
        'مشروع تطبيقي: خطة قرار لمشروع مريم'
      ]
    },
    programming: {
      summary: 'مدخل تدريجي إلى التفكير البرمجي، مع مسارات للأطفال والأساسيات وPython والتطبيق.',
      sections: [
        'البرمجة للأطفال: البداية باستخدام ScratchJr ثم Scratch',
        'أساسيات البرمجة: المفاهيم والمتغيرات وأنواع البيانات والشروط',
        'تعلم Python: كتابة الأوامر وبناء البرامج خطوة بخطوة',
        'ورش العمل والتطبيقات: أنشطة ومشروعات عملية'
      ]
    },
    python: {
      summary: 'تعلم Python من المبادئ الأولى حتى بناء برامج صغيرة وحل المشكلات.',
      sections: [
        'مدخل إلى Python وبيئة التطوير',
        'أساسيات كتابة الكود',
        'المتغيرات وأنواع البيانات',
        'الشروط والمنطق',
        'التطبيق وحل المشكلات'
      ]
    },
    scratch: {
      summary: 'تعلم البرمجة من خلال تركيب اللبنات وبناء القصص والألعاب والمشروعات التفاعلية.',
      sections: [
        'المستوى الأول: ScratchJr',
        'المستوى الثاني: Scratch',
        'التعامل مع الكائنات والخلفيات والأوامر',
        'التعلم من خلال المشروعات والأنشطة'
      ]
    },
    'data-analysis': {
      summary: 'التعرف على أدوات تحليل البيانات وتحويل البيانات إلى مؤشرات وتقارير تساعد على اتخاذ القرار.',
      sections: [
        'Excel: تنظيم البيانات وإعداد الجداول والتقارير',
        'Power Query: تجهيز البيانات وتنظيفها قبل التحليل',
        'Power BI: تصميم التقارير ولوحات المعلومات التفاعلية',
        'Python: استخدام البرمجة ضمن أدوات تحليل البيانات',
        'مشروع تطبيقي: تحليل بيانات مبيعات سوبر ماركت وقياس أداء الفروع وسلوك العملاء'
      ]
    },
    icdl: {
      summary: 'مهارات الكمبيوتر الأساسية واستخدام تطبيقات المكتب والإنترنت بأمان.',
      sections: [
        'أساسيات الكمبيوتر ومكونات الجهاز ونظام التشغيل',
        'Microsoft Word: إنشاء المستندات وتنسيق النصوص والجداول',
        'Microsoft Excel: تنظيم البيانات والصيغ والجداول والتقارير',
        'Microsoft PowerPoint: إعداد العروض التقديمية',
        'الإنترنت والبريد الإلكتروني والبحث وإدارة المرفقات',
        'الأمان الرقمي وحماية البيانات والحسابات'
      ]
    },
    windows: {
      summary: 'أساسيات التعامل مع الكمبيوتر ونظام Windows والإنترنت.',
      sections: [
        'أساسيات Windows',
        'إدارة الملفات والمجلدات',
        'استخدام الإنترنت والبحث عن المعلومات',
        'البريد الإلكتروني والتواصل',
        'الأمان الرقمي ومهارات الاستخدام اليومي'
      ]
    },
    word: {
      summary: 'إنشاء المستندات وتنسيقها وتجهيزها للمراجعة والطباعة.',
      sections: [
        'إنشاء المستندات وحفظها',
        'تنسيق النصوص والخطوط',
        'تنسيق الفقرات والقوائم',
        'إدراج الجداول والصور',
        'تخطيط الصفحة والمراجعة والطباعة'
      ]
    },
    excel: {
      summary: 'تنظيم البيانات وإجراء العمليات الحسابية وإنشاء التقارير والرسوم البيانية.',
      sections: [
        'أساسيات الجداول وأوراق العمل والخلايا',
        'تنسيق البيانات والأرقام والتواريخ',
        'الصيغ والدوال الأساسية',
        'الفرز والتصفية',
        'الرسوم البيانية',
        'التقارير وتجهيز أوراق العمل للطباعة'
      ]
    },
    powerpoint: {
      summary: 'إعداد عروض تقديمية واضحة ومنظمة باستخدام الشرائح والعناصر المرئية.',
      sections: [
        'إنشاء عرض تقديمي وتنظيم الشرائح',
        'النصوص والعناوين',
        'الصور والعناصر المرئية',
        'الانتقالات والحركة',
        'مراجعة العرض وتجهيزه للتقديم'
      ]
    },
    'microsoft-office': {
      summary: 'نظرة متكاملة على تطبيقات Microsoft Office الأكثر استخدامًا.',
      sections: [
        'Microsoft Word: إنشاء المستندات وتنسيق النصوص والجداول',
        'Microsoft Excel: تنظيم البيانات والصيغ والدوال والتقارير',
        'Microsoft PowerPoint: تصميم الشرائح والعروض التقديمية',
        'التكامل بين التطبيقات واستخدام الملفات في الدراسة والعمل'
      ]
    }
  });
  COURSE_CONTENT['financial-accounting'] = COURSE_CONTENT.accounting;
  COURSE_CONTENT.office = COURSE_CONTENT['microsoft-office'];

  const previewDialog = document.getElementById('coursePreviewDialog');
  const previewTitle = document.getElementById('coursePreviewTitle');
  const previewSummary = document.getElementById('coursePreviewSummary');
  const previewList = document.getElementById('coursePreviewList');

  function showCoursePreview(slug, title) {
    const content = COURSE_CONTENT[String(slug || '').toLowerCase()];
    if (previewTitle) previewTitle.textContent = title || 'محتوى الدورة';
    if (previewSummary) {
      previewSummary.textContent = content
        ? content.summary
        : 'لم يتم إعداد وصف تفصيلي لهذا المسار بعد. سيظهر المنهج هنا بعد توثيق وحداته.';
    }
    if (previewList) {
      previewList.innerHTML = content && content.sections.length
        ? content.sections.map((section, index) =>
            '<li><span class="ma-course-preview-number">' + String(index + 1).padStart(2, '0') +
            '</span><span>' + escapeHtml(section) + '</span></li>'
          ).join('')
        : '<li class="ma-course-preview-empty">المحتوى التفصيلي قيد الإعداد.</li>';
    }
    if (previewDialog?.showModal) previewDialog.showModal();
    else if (previewDialog) previewDialog.setAttribute('open', '');
  }

  previewDialog?.querySelector('[data-close-course-preview]')?.addEventListener('click', function () {
    if (previewDialog.close) previewDialog.close();
    else previewDialog.removeAttribute('open');
  });
  previewDialog?.addEventListener('click', function (event) {
    if (event.target === previewDialog) {
      if (previewDialog.close) previewDialog.close();
      else previewDialog.removeAttribute('open');
    }
  });


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
      const courseRows = offer.courses.map(course =>
        '<div class="ma-enrollment-course-row">' +
          '<span class="ma-enrollment-course-title">' + escapeHtml(course.title || course.course_slug) + '</span>' +
          '<button class="ma-course-preview-button" type="button" data-course-preview="' +
            escapeHtml(course.course_slug) + '" data-course-title="' +
            escapeHtml(course.title || course.course_slug) + '">استعراض المحتوى</button>' +
        '</div>'
      ).join('');
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
        '<div class="ma-enrollment-course-list">' + courseRows + '</div>' +
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

      const requestRows = results[1].data || [];
      state.pendingPlanIds = new Set(
        requestRows
          .filter(row => ['pending', 'fulfilled'].includes(row.status))
          .map(row => row.plan_id)
      );
      renderOffers(results[0].data || []);
      renderRequests(requestRows);
    } catch (error) {
      showNotice(error?.message || 'تعذّر تحميل الدورات المتاحة.', 'error');
      offersHost.innerHTML = '';
    }
  }

  offersHost.addEventListener('click', async function (event) {
    const previewButton = event.target.closest('[data-course-preview]');
    if (previewButton) {
      showCoursePreview(
        previewButton.getAttribute('data-course-preview'),
        previewButton.getAttribute('data-course-title')
      );
      return;
    }

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
