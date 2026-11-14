/* ODOO CONTACT PREFILL V1 */
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const programKey = params.get("odoo_program");
  const requestType = params.get("odoo_request");

  const programs = {
    nursery: { ar: "إدارة الحضانات — إدراك", en: "Edraak nursery management" },
    tutoring: { ar: "المراكز التعليمية والدروس", en: "Tutoring centers" },
    school: { ar: "إدارة المدارس", en: "School management" },
    hr: { ar: "الموارد البشرية وشؤون الموظفين", en: "Human resources" },
    accounting: { ar: "إدارة الحسابات على Odoo", en: "Odoo accounting" },
    clinic: { ar: "إدارة العيادات الطبية", en: "Medical clinic management" }
  };

  const program = programs[programKey];
  if (!program || !["join", "demo"].includes(requestType)) return;

  const form = document.getElementById("contactForm");
  const interest = document.getElementById("contactInterest");
  const message = document.getElementById("contactMessage");

  if (!form || !interest || !message) return;

  const isEnglish = document.documentElement.lang === "en";
  const programName = isEnglish ? program.en : program.ar;

  interest.value = "odoo";
  interest.dispatchEvent(new Event("change", { bubbles: true }));

  if (!message.value.trim()) {
    if (isEnglish) {
      message.value = requestType === "join"
        ? `I would like to request a subscription and implementation discussion for ${programName}. Please contact me to discuss scope, pricing, and next steps.`
        : `I would like to schedule a product demonstration for ${programName}.`;
    } else {
      message.value = requestType === "join"
        ? `أرغب في طلب الاشتراك وبدء التنفيذ لبرنامج ${programName}. يرجى التواصل معي لمناقشة نطاق العمل والتكلفة وخطوات التنفيذ.`
        : `أرغب في تحديد موعد لعرض توضيحي لبرنامج ${programName}.`;
    }
  }

  const notice = document.createElement("div");
  notice.className = "odoo-contact-prefill-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");

  notice.textContent = isEnglish
    ? `Your request is prepared for: ${programName}. You can edit the message before submitting.`
    : `تم تجهيز طلبك لبرنامج: ${programName}. يمكنك تعديل الرسالة قبل الإرسال.`;

  form.insertBefore(notice, form.firstChild);
})();
/* END ODOO CONTACT PREFILL V1 */