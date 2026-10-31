/* BUSINESS ADMINISTRATION UNIT 03 INTERACTIONS START */
(() => {
  'use strict';
  const root = document.getElementById('unit-3');
  if (!root || root.dataset.unit3Initialized === 'true') return;
  root.dataset.unit3Initialized = 'true';

  const worksheet = root.querySelector('#baUnit3DecisionForm');
  const worksheetFeedback = root.querySelector('#baUnit3DecisionFeedback');
  const quiz = root.querySelector('#baUnit3QuizForm');
  const quizFeedback = root.querySelector('#baUnit3QuizFeedback');

  const showFeedback = (node, message, kind = 'info') => {
    if (!node) return;
    node.className = `ba-u3-feedback show ${kind}`;
    node.textContent = message;
  };

  worksheet?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!worksheet.reportValidity()) return;
    const data = new FormData(worksheet);
    const lines = [
      'منصة Mohammed Afify - ورقة عمل الوحدة الثالثة: أهداف منظمات الأعمال وأصحاب المصلحة',
      `اسم المنظمة / المشروع: ${data.get('projectName') || 'غير محدد'}`,
      `مرحلة المنظمة: ${data.get('stage') || 'غير محددة'}`,
      `الهدف ذو الأولوية: ${data.get('goal') || 'غير محدد'}`,
      `مؤشر قياس الهدف والمدة الزمنية: ${data.get('measure') || ''}`,
      '',
      'أصحاب المصلحة الأساسيون ومصالحهم:', data.get('primaryStakeholders') || '',
      '',
      'أصحاب المصلحة الثانويون ومصالحهم:', data.get('secondaryStakeholders') || '',
      '',
      'التعارض المحتمل بين المصالح:', data.get('conflict') || '',
      '',
      'القرار المقترح وكيف يوازن بين المصالح:', data.get('decision') || ''
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'business-unit-3-objectives-stakeholders-worksheet.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showFeedback(worksheetFeedback, 'تم تنزيل ورقة العمل على جهازك. لم تُرسل الإجابات إلى الخادم أو إلى حساب الطالب.', 'success');
  });

  quiz?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!quiz.reportValidity()) return;
    const answers = { q1: 'b', q2: 'a', q3: 'c', q4: 'b', q5: 'c' };
    const formData = new FormData(quiz);
    let score = 0;
    Object.entries(answers).forEach(([name, correct]) => { if (formData.get(name) === correct) score += 1; });
    const total = Object.keys(answers).length;
    let message = `نتيجتك ${score} من ${total}. `;
    if (score === total) message += 'ممتاز! فهمت الأهداف وتصنيف أصحاب المصلحة وأهمية الموازنة بينهم.';
    else if (score >= 3) message += 'نتيجة جيدة. راجع جدول أصحاب المصلحة ومحور الأخلاقيات والمسؤولية الاجتماعية ثم أعد المحاولة.';
    else message += 'راجع بطاقات الأهداف ومراحل المنظمة والفرق بين أصحاب المصلحة الأساسيين والثانويين، ثم حاول مرة أخرى.';
    message += ' هذا تقويم تكويني محلي، ولا تُحفظ الدرجة في حساب الطالب.';
    showFeedback(quizFeedback, message, score >= 3 ? 'success' : 'info');
  });
})();
/* BUSINESS ADMINISTRATION UNIT 03 INTERACTIONS END */
