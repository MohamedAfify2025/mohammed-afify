/* Mohammed Afify learning & professional platform
   Before publishing: replace CONTACT_EMAIL with the email you want visitors to use. */
const CONTACT_EMAIL = "mohammedafify34@gmail.com";

const translations = {
  ar: {
    announcement:"التعلّم الحقيقي يبدأ بالتطبيق — اكتشف الدروس والموارد المجانية",explore:"استكشف الآن ←",brandSub:"التعليم والتقنية والأعمال",
    navHome:"الرئيسية",navLearning:"التعلّم",navServices:"الخدمات",navResources:"الموارد",navAbout:"من أنا",navContact:"تواصل",navCta:"ابدأ مشروعك",
    heroEyebrow:"من المعرفة إلى التطبيق",heroTitle:'تعلّم مهارة.<br><span>وابنِ مستقبلك.</span>',heroLead:"مساحة واحدة تجمع البرمجة وتحليل البيانات والإدارة والمحاسبة — شروحات عملية، موارد قابلة للتنزيل، وخدمات تساعدك على تحويل الأفكار إلى نتائج.",heroPrimary:"اكتشف مسارات التعلّم",heroSecondary:"تعرّف على الخدمات",heroProof:"تعلّم عملي <b>•</b> خطوات واضحة <b>•</b> تطبيقات واقعية",visualStatus:"التعلّم قيد التشغيل",floatCode:"البرمجة",floatData:"تحليل البيانات",heroBottom:"مسارات مصممة للمبتدئين والمهنيين",
    learningKicker:"تعلّم بطريقتك",learningTitle:"اختر مسارك التالي.",learningIntro:"ابدأ من الأساسيات، ثم انتقل إلى التطبيق العملي خطوة بخطوة.",
    catCodeTitle:"البرمجة والتقنية",catCodeDesc:"أساسيات البرمجة وتطوير الويب وقواعد البيانات وبناء حلول عملية.",catDataTitle:"تحليل البيانات",catDataDesc:"حوّل الأرقام إلى قرارات باستخدام Excel وأدوات التحليل والتقارير.",catBusinessTitle:"الإدارة والأعمال",catBusinessDesc:"إدارة المشروعات والعمليات والمبيعات وفهم الأنظمة المؤسسية.",catAccountingTitle:"المحاسبة وOdoo",catAccountingDesc:"من القيود والدورة المحاسبية إلى تطبيقات المحاسبة داخل Odoo ERP.",viewCourses:"عرض الدورات <span>↙</span>",
    coursesKicker:"ابدأ بالتطبيق",coursesTitle:"محتوى يساعدك على التقدّم.",coursesIntro:"هذه بطاقات بداية قابلة للتطوير وإضافة روابط الدروس والفيديوهات الفعلية إليها.",filterAll:"الكل",filterProgramming:"برمجة",filterData:"تحليل بيانات",filterBusiness:"إدارة",filterAccounting:"محاسبة وOdoo",beginner:"مبتدئ",intermediate:"متوسط",videoText:"فيديو + تطبيق",practicalFile:"ملف تطبيقي",practicalText:"تطبيق عملي",coursePython:"مدخل إلى البرمجة باستخدام Python",coursePythonDesc:"تعرّف على المتغيرات والشروط والحلقات من خلال أمثلة بسيطة.",courseExcel:"Excel لتحليل البيانات والتقارير",courseExcelDesc:"ابدأ بالدوال الأساسية وتنظيم البيانات وبناء تقارير مفيدة.",courseAccounting:"أساسيات المحاسبة والدورة المحاسبية",courseAccountingDesc:"افهم المدين والدائن والقيود اليومية وترحيل الحسابات.",courseOdoo:"التعرّف على Odoo ERP",courseOdooDesc:"اكتشف كيف تتكامل المبيعات والمخزون والمحاسبة في نظام واحد.",courseSoon:"اطلب محتوى الدورة <span>↙</span>",downloadSample:"حمّل ملف التدريب <span>↓</span>",odooServices:"خدمات وتدريب Odoo <span>↙</span>",
    servicesKicker:"من التعلّم إلى التنفيذ",servicesTitle:'هل لديك تحدٍ في عملك؟<br><span>لنعمل على حلّه.</span>',servicesIntro:"إلى جانب المحتوى التعليمي، أقدّم خدمات تقنية وعملية تساعد الأفراد والشركات على تحسين العمل وبناء حلول تناسب احتياجاتهم.",discussProject:"ناقش مشروعك",service1:"البرمجة وتطوير الحلول",service1Desc:"مواقع ويب وأدوات صغيرة وأتمتة المهام وتحسين سير العمل.",service2:"تحليل البيانات والتقارير",service2Desc:"تنظيم البيانات، إعداد التقارير ولوحات متابعة تساعد على اتخاذ القرار.",service3:"الإدارة والمحاسبة",service3Desc:"تحسين الإجراءات وتوثيق العمليات ودعم تطبيق الممارسات المحاسبية.",service4:"تدريب وتنفيذ Odoo ERP",service4Desc:"تدريب المستخدمين، دعم التطبيقات، وتحليل متطلبات النظام وتطويره.",
    resourcesKicker:"أدوات جاهزة للتطبيق",resourcesTitle:"لا تكتفِ بالمشاهدة.<br>جرّب بنفسك.",resourcesIntro:"حمّل ملفات تدريبية وابدأ التجربة على جهازك. ستُضاف مكتبة الموارد تدريجيًا مع الدروس الجديدة.",getFreeFile:"حمّل ملف Excel التجريبي",fileName:"بيانات مبيعات تجريبية",fileGuide:"دليل استخدام الموارد",
    aboutKicker:"نبذة عن المنصة",aboutTitle:"المعرفة تصبح أقوى<br>عندما تتحول إلى ممارسة.",aboutDesc:"أنا محمد عفيفي. أعمل على الجمع بين التقنية والأعمال، وأؤمن أن أفضل طريقة للتعلّم هي تبسيط المفاهيم ثم تطبيقها على مشكلات واقعية. هذه المنصة مساحة للتعلّم ومشاركة الموارد وتقديم الخدمات المهنية.",principle1:"شرح واضح وبسيط",principle2:"تطبيقات عملية",principle3:"تطوير مستمر",contactMe:"تواصل معي <span>↙</span>",
    contactKicker:"لنبدأ الحديث",contactTitle:"لديك سؤال أو فكرة؟<br><span>يسعدني التواصل معك.</span>",contactIntro:"أرسل تفاصيل طلبك، سواء كان استفسارًا عن دورة أو طلب خدمة أو تعاونًا مهنيًا.",contactNote:"النموذج يفتح تطبيق البريد لديك لإرسال الرسالة.",formName:"الاسم",formEmail:"البريد الإلكتروني",formInterest:"ما الذي تحتاج إليه؟",optionCourse:"دورة أو تدريب",optionProgramming:"برمجة وتطوير",optionData:"تحليل بيانات",optionBusiness:"إدارة ومحاسبة",optionOdoo:"Odoo ERP",optionOther:"طلب آخر",formMessage:"تفاصيل الرسالة",sendMessage:"تجهيز الرسالة",formHint:"قبل النشر، أضف بريد التواصل الفعلي داخل ملف script.js.",footerTagline:"Learn • Analyze • Build • Transform",rights:"جميع الحقوق محفوظة.",backTop:"العودة للأعلى ↑",formMissingEmail:"يرجى تعديل عنوان البريد الإلكتروني في ملف script.js قبل نشر الموقع.",emailSubject:"رسالة من موقع Mohammed Afify"
  },
  en: {
    announcement:"Real learning starts with practice — explore lessons and free resources",explore:"Explore now →",brandSub:"Learning, technology & business",
    navHome:"Home",navLearning:"Learning",navServices:"Services",navResources:"Resources",navAbout:"About",navContact:"Contact",navCta:"Start a project",
    heroEyebrow:"From knowledge to application",heroTitle:'Learn a skill.<br><span>Build your future.</span>',heroLead:"One place for programming, data analysis, management and accounting — practical lessons, downloadable resources, and professional services that turn ideas into results.",heroPrimary:"Explore learning paths",heroSecondary:"Explore services",heroProof:"Practical learning <b>•</b> Clear steps <b>•</b> Real-world practice",visualStatus:"Learning in progress",floatCode:"Programming",floatData:"Data analysis",heroBottom:"Learning paths for beginners and professionals",
    learningKicker:"Learn your way",learningTitle:"Choose your next path.",learningIntro:"Start with the fundamentals, then move into hands-on practice step by step.",
    catCodeTitle:"Programming & Technology",catCodeDesc:"Programming fundamentals, web development, databases and practical solutions.",catDataTitle:"Data Analysis",catDataDesc:"Turn numbers into decisions with Excel, analytics tools and clear reports.",catBusinessTitle:"Management & Business",catBusinessDesc:"Project management, operations, sales and enterprise systems.",catAccountingTitle:"Accounting & Odoo",catAccountingDesc:"From journal entries and accounting cycles to accounting in Odoo ERP.",viewCourses:"View courses <span>↙</span>",
    coursesKicker:"Learn by doing",coursesTitle:"Content that moves you forward.",coursesIntro:"These starter cards are ready for you to add links to real lessons and videos.",filterAll:"All",filterProgramming:"Programming",filterData:"Data analysis",filterBusiness:"Management",filterAccounting:"Accounting & Odoo",beginner:"Beginner",intermediate:"Intermediate",videoText:"Video + practice",practicalFile:"Practice file",practicalText:"Hands-on",coursePython:"Introduction to Python Programming",coursePythonDesc:"Learn variables, conditions and loops through simple examples.",courseExcel:"Excel for Data Analysis & Reporting",courseExcelDesc:"Start with core formulas, data organization and useful reports.",courseAccounting:"Accounting Fundamentals & Cycle",courseAccountingDesc:"Understand debits, credits, journal entries and posting.",courseOdoo:"Getting Started with Odoo ERP",courseOdooDesc:"See how sales, inventory and accounting connect in one system.",courseSoon:"Request course content <span>↙</span>",downloadSample:"Download practice file <span>↓</span>",odooServices:"Odoo services & training <span>↙</span>",
    servicesKicker:"From learning to delivery",servicesTitle:'Facing a business challenge?<br><span>Let’s work on it.</span>',servicesIntro:"Alongside educational content, I offer practical technology and business services to help individuals and companies improve their work and build solutions that fit their needs.",discussProject:"Discuss your project",service1:"Programming & Solution Development",service1Desc:"Websites, lightweight tools, task automation and workflow improvements.",service2:"Data Analysis & Reporting",service2Desc:"Organized data, useful reports and dashboards to support decisions.",service3:"Management & Accounting",service3Desc:"Process improvement, documentation and support for accounting practices.",service4:"Odoo ERP Training & Implementation",service4Desc:"User training, application support, requirements analysis and customization.",
    resourcesKicker:"Ready-to-use tools",resourcesTitle:"Don’t just watch.<br>Try it yourself.",resourcesIntro:"Download practice files and start experimenting. The resource library will grow alongside new lessons.",getFreeFile:"Download sample Excel data",fileName:"Sample sales dataset",fileGuide:"Resource usage guide",
    aboutKicker:"About the platform",aboutTitle:"Knowledge gets stronger<br>when it becomes practice.",aboutDesc:"I’m Mohammed Afify. I work at the intersection of technology and business, and believe the best way to learn is to simplify concepts and apply them to real-world problems. This platform is a space for learning, sharing resources and providing professional services.",principle1:"Clear explanations",principle2:"Hands-on practice",principle3:"Continuous improvement",contactMe:"Get in touch <span>↙</span>",
    contactKicker:"Let’s talk",contactTitle:'Have a question or an idea?<br><span>I’d love to hear from you.</span>',contactIntro:"Share your request, whether it’s about a course, a service, or a professional collaboration.",contactNote:"This form opens your email app to send the message.",formName:"Name",formEmail:"Email address",formInterest:"What do you need?",optionCourse:"Course or training",optionProgramming:"Programming & development",optionData:"Data analysis",optionBusiness:"Management & accounting",optionOdoo:"Odoo ERP",optionOther:"Other request",formMessage:"Message details",sendMessage:"Prepare message",formHint:"Before publishing, add your real contact email in script.js.",footerTagline:"Learn • Analyze • Build • Transform",rights:"All rights reserved.",backTop:"Back to top ↑",formMissingEmail:"Please update the email address in script.js before publishing.",emailSubject:"Message from Mohammed Afify website"
  }
};

let currentLang = "ar";
const langButton = document.getElementById("languageToggle");

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.body.dir = lang === "ar" ? "rtl" : "ltr";
  langButton.textContent = lang === "ar" ? "EN" : "عربي";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (translations[lang][key] !== undefined) el.innerHTML = translations[lang][key];
  });
  document.querySelectorAll("[data-placeholder-ar]").forEach(el => {
    el.placeholder = lang === "ar" ? el.dataset.placeholderAr : el.dataset.placeholderEn;
  });
  document.querySelectorAll("option[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (translations[lang][key] !== undefined) el.textContent = translations[lang][key];
  });
  document.title = lang === "ar" ? "Mohammed Afify | تعلّم، حلّل، ابنِ، طوّر" : "Mohammed Afify | Learn, Analyze, Build, Transform";
}
langButton.addEventListener("click", () => setLanguage(currentLang === "ar" ? "en" : "ar"));

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});
mainNav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    const filter = button.dataset.filter;
    document.querySelectorAll(".course-card").forEach(card => {
      card.hidden = filter !== "all" && card.dataset.category !== filter;
    });
  });
});


emailjs.init({
  publicKey: "JpcpLeL3EEKfRhswb"
});

document.getElementById("contactForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const interest = document.getElementById("contactInterest");
  const interestText = interest.options[interest.selectedIndex].text;
  const message = document.getElementById("contactMessage").value.trim();

  const button = event.submitter;
  if (button) {
    button.disabled = true;
    button.textContent = "جارٍ الإرسال...";
  }

  try {
    await emailjs.send(
      "service_dm7zsh9",
      "template_jq3y5vo",
      {
        from_name: name,
        from_email: email,
        interest: interestText,
        message: message
      }
    );

    alert("تم إرسال رسالتك بنجاح، شكرًا لتواصلك معنا.");
    event.target.reset();
  } catch (error) {
    console.error("EmailJS error:", error);
    alert("تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى لاحقًا.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "إرسال الرسالة";
    }
  }
});
