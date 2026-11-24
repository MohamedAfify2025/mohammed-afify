/* BUSINESS ADMINISTRATION UNIT 02 INTERACTIONS START */
(() => {
  'use strict';

  const root = document.getElementById('unit-2');
  if (!root || root.dataset.unit2Initialized === 'true') return;
  root.dataset.unit2Initialized = 'true';

  const worksheet = root.querySelector('#baUnit2DecisionForm');
  const worksheetFeedback = root.querySelector('#baUnit2DecisionFeedback');
  const quiz = root.querySelector('#baUnit2QuizForm');
  const quizFeedback = root.querySelector('#baUnit2QuizFeedback');

  const showFeedback = (node, text, kind = 'info') => {
    if (!node) return;
    node.className = `ba-u2-feedback show ${kind}`;
    node.textContent = text;
  };

  worksheet?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!worksheet.reportValidity()) return;

    const data = new FormData(worksheet);
    const lines = [
      'منصة Mohammed Afify - تطبيق الوحدة الثانية: أنواع منظمات الأعمال',
      `اسم النشاط / المشروع: ${data.get('projectName') || 'غير محدد'}`,
      `الهيكل الحالي: ${data.get('currentStructure') || 'غير محدد'}`,
      `الهيكل المقترح: ${data.get('targetStructure') || 'غير محدد'}`,
      '',
      'سبب الاختيار:',
      data.get('reason') || '',
      '',
      'المخاطرة التي يجب إدارتها:',
      data.get('risk') || '',
      '',
      'ما الذي قد يتغير في السيطرة أو التمويل؟',
      data.get('tradeoff') || ''
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'business-unit-2-decision-worksheet.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    showFeedback(
      worksheetFeedback,
      'تم تنزيل ورقة عملك على جهازك. لم تُرسل الإجابات إلى الخادم أو إلى حساب الطالب.',
      'success'
    );
  });

  quiz?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!quiz.reportValidity()) return;

    const answers = { q1: 'b', q2: 'c', q3: 'a', q4: 'b', q5: 'c' };
    const formData = new FormData(quiz);
    let score = 0;
    Object.entries(answers).forEach(([name, correct]) => {
      if (formData.get(name) === correct) score += 1;
    });

    let message = `نتيجتك ${score} من ${Object.keys(answers).length}. `;
    if (score === 5) {
      message += 'ممتاز! ميّزت بين الملكية والسيطرة والمسؤولية والوصول إلى رأس المال.';
    } else if (score >= 3) {
      message += 'نتيجة جيدة. راجع جدول المقارنة، ثم أعد المحاولة لتثبيت الفروق.';
    } else {
      message += 'راجع بطاقات الأنواع الثلاثة وجدول المقارنة، ثم حاول مرة أخرى.';
    }
    message += ' هذا تقويم ذاتي محلي، ولا تُحفظ الدرجة في حساب الطالب.';
    showFeedback(quizFeedback, message, score >= 3 ? 'success' : 'info');
  });
})();
/* BUSINESS ADMINISTRATION UNIT 02 INTERACTIONS END */
