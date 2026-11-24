insert into public.course_units (course_slug,unit_slug,title,description,sort_order,is_published)
values
('accounting','unit-01','لماذا نتعلم المحاسبة؟','الوحدة الأولى من منهج المحاسبة كما وردت في صفحة المنهج الأصلية.',1,false),
('accounting','unit-02','قاعدة القيد المزدوج وحسابات دفاتر الأستاذ','الوحدة الثانية من منهج المحاسبة كما وردت في صفحة المنهج الأصلية.',2,false),
('accounting','unit-03','دفاتر اليومية المساعدة','الوحدة الثالثة من منهج المحاسبة كما وردت في صفحة المنهج الأصلية.',3,false),
('accounting','unit-04','ميزان المراجعة وتصحيح الأخطاء','الوحدة الرابعة من منهج المحاسبة كما وردت في صفحة المنهج الأصلية.',4,false),
('accounting','unit-05','القوائم المالية – المنشأة الفردية','الوحدة الخامسة من منهج المحاسبة كما وردت في صفحة المنهج الأصلية.',5,false)
on conflict (course_slug,unit_slug) do update
set title=excluded.title,
    description=excluded.description,
    sort_order=excluded.sort_order,
    updated_at=now();