-- Mohammed Afify Academy — real, server-graded assessments V1
-- Run once in Supabase SQL Editor AFTER sql/membership-schema.sql.
-- Correct answers remain in PostgreSQL. The browser submits choices only.
-- Every submission is validated and stored in assessment_results.

do $preflight$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing public.profiles. Run sql/membership-schema.sql first.';
  end if;
  if to_regclass('public.assessment_results') is null then
    raise exception 'Missing public.assessment_results. Run sql/membership-schema.sql first.';
  end if;
end;
$preflight$;

create or replace function public._record_academy_assessment_v1(
  p_course_slug text,
  p_assessment_title text,
  p_answers jsonb,
  p_answer_key jsonb
)
returns table (
  score_percent numeric(5,2),
  correct_answers integer,
  total_questions integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_key text;
  v_total integer := 0;
  v_correct integer := 0;
  v_score numeric(5,2);
  v_requested_course text;
begin
  if v_user_id is null then
    raise exception 'سجّل الدخول أولًا قبل إرسال الاختبار.' using errcode = '42501';
  end if;

  select *
    into v_profile
    from public.profiles
   where user_id = v_user_id;

  if not found then
    raise exception 'لم يتم العثور على ملف الطالب.' using errcode = 'P0002';
  end if;

  if v_profile.role <> 'student' or v_profile.status <> 'approved' then
    raise exception 'الاختبارات متاحة للطلاب بعد اعتماد الحساب.' using errcode = '42501';
  end if;

  v_requested_course := lower(btrim(coalesce(v_profile.requested_course, '')));

  if p_course_slug = 'business-administration' then
    if v_requested_course not in ('الإدارة والأعمال', 'إدارة الأعمال', 'الأعمال والإدارة') then
      raise exception 'هذا الاختبار مخصص لطلاب مسار الإدارة والأعمال.' using errcode = '42501';
    end if;
  elsif p_course_slug = 'accounting' then
    if v_requested_course not in ('المحاسبة', 'المحاسبة و odoo', 'المحاسبة المالية', 'المحاسبة - البكالوريا المصرية') then
      raise exception 'هذا الاختبار مخصص لطلاب مسار المحاسبة.' using errcode = '42501';
    end if;
  else
    raise exception 'رمز الدورة غير معتمد للاختبارات.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object'
     or jsonb_typeof(p_answer_key) is distinct from 'object'
     or jsonb_object_length(p_answer_key) < 1 then
    raise exception 'بيانات الإجابات غير مكتملة.' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_answer_key)
  loop
    v_total := v_total + 1;
    if coalesce(p_answers ->> v_key, '') not in ('a','b','c','d') then
      raise exception 'أجب عن جميع الأسئلة باختيار صحيح قبل الإرسال.' using errcode = '22023';
    end if;
    if p_answers ->> v_key = p_answer_key ->> v_key then
      v_correct := v_correct + 1;
    end if;
  end loop;

  v_score := round((v_correct::numeric * 100.0) / v_total, 2);

  insert into public.assessment_results (
    user_id, course_slug, assessment_title, score_percent
  ) values (
    v_user_id, p_course_slug, left(p_assessment_title, 180), v_score
  );

  return query select v_score, v_correct, v_total;
end;
$$;

revoke all on function public._record_academy_assessment_v1(text,text,jsonb,jsonb) from public, anon, authenticated;

-- Business Administration — Units 1 to 3.
create or replace function public.submit_business_unit1_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'business-administration',
    'الإدارة والأعمال — الوحدة الأولى: مدخل إلى الأعمال وغايتها',
    p_answers,
    '{"q1":"b","q2":"c","q3":"c","q4":"c","q5":"b"}'::jsonb
  );
$$;

create or replace function public.submit_business_unit2_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'business-administration',
    'الإدارة والأعمال — الوحدة الثانية: أنواع منظمات الأعمال',
    p_answers,
    '{"q1":"b","q2":"c","q3":"a","q4":"b","q5":"c"}'::jsonb
  );
$$;

create or replace function public.submit_business_unit3_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'business-administration',
    'الإدارة والأعمال — الوحدة الثالثة: الأهداف وأصحاب المصلحة',
    p_answers,
    '{"q1":"b","q2":"a","q3":"c","q4":"b","q5":"c"}'::jsonb
  );
$$;

-- Accounting — five unit assessments.
create or replace function public.submit_accounting_unit1_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'accounting',
    'المحاسبة — الوحدة الأولى: لماذا نتعلم المحاسبة؟',
    p_answers,
    '{"q1":"b","q2":"a","q3":"c","q4":"b","q5":"a"}'::jsonb
  );
$$;

create or replace function public.submit_accounting_unit2_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'accounting',
    'المحاسبة — الوحدة الثانية: القيد المزدوج وحسابات الأستاذ',
    p_answers,
    '{"q1":"b","q2":"a","q3":"c","q4":"b","q5":"a"}'::jsonb
  );
$$;

create or replace function public.submit_accounting_unit3_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'accounting',
    'المحاسبة — الوحدة الثالثة: دفاتر اليومية المساعدة',
    p_answers,
    '{"q1":"a","q2":"c","q3":"b","q4":"a","q5":"c"}'::jsonb
  );
$$;

create or replace function public.submit_accounting_unit4_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'accounting',
    'المحاسبة — الوحدة الرابعة: ميزان المراجعة وتصحيح الأخطاء',
    p_answers,
    '{"q1":"b","q2":"c","q3":"a","q4":"b","q5":"c"}'::jsonb
  );
$$;

create or replace function public.submit_accounting_unit5_quiz(p_answers jsonb)
returns table (score_percent numeric(5,2), correct_answers integer, total_questions integer)
language sql security definer set search_path = public
as $$
  select * from public._record_academy_assessment_v1(
    'accounting',
    'المحاسبة — الوحدة الخامسة: القوائم المالية للمنشأة الفردية',
    p_answers,
    '{"q1":"a","q2":"b","q3":"c","q4":"a","q5":"b"}'::jsonb
  );
$$;

revoke all on function public.submit_business_unit1_quiz(jsonb) from public, anon;
revoke all on function public.submit_business_unit2_quiz(jsonb) from public, anon;
revoke all on function public.submit_business_unit3_quiz(jsonb) from public, anon;
revoke all on function public.submit_accounting_unit1_quiz(jsonb) from public, anon;
revoke all on function public.submit_accounting_unit2_quiz(jsonb) from public, anon;
revoke all on function public.submit_accounting_unit3_quiz(jsonb) from public, anon;
revoke all on function public.submit_accounting_unit4_quiz(jsonb) from public, anon;
revoke all on function public.submit_accounting_unit5_quiz(jsonb) from public, anon;

grant execute on function public.submit_business_unit1_quiz(jsonb) to authenticated;
grant execute on function public.submit_business_unit2_quiz(jsonb) to authenticated;
grant execute on function public.submit_business_unit3_quiz(jsonb) to authenticated;
grant execute on function public.submit_accounting_unit1_quiz(jsonb) to authenticated;
grant execute on function public.submit_accounting_unit2_quiz(jsonb) to authenticated;
grant execute on function public.submit_accounting_unit3_quiz(jsonb) to authenticated;
grant execute on function public.submit_accounting_unit4_quiz(jsonb) to authenticated;
grant execute on function public.submit_accounting_unit5_quiz(jsonb) to authenticated;
