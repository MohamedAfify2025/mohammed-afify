-- Secure grading for the first Business Administration track assessment.
-- Run in Supabase Dashboard > SQL Editor AFTER membership-schema.sql has succeeded.
-- Students submit option IDs only; the server calculates the score and stores it.

create or replace function public.submit_business_unit1_quiz(p_answers jsonb)
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
  v_correct integer := 0;
  v_score numeric(5,2);
begin
  if v_user_id is null then
    raise exception 'You must sign in before submitting this assessment.'
      using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles
  where user_id = v_user_id;

  if not found then
    raise exception 'Student profile was not found.' using errcode = 'P0002';
  end if;

  if v_profile.role <> 'student' or v_profile.status <> 'approved' then
    raise exception 'Only approved students can submit this assessment.'
      using errcode = '42501';
  end if;

  if lower(btrim(coalesce(v_profile.requested_course, ''))) <> lower('الإدارة والأعمال') then
    raise exception 'This assessment is available only to the Business Administration track.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object'
     or coalesce(p_answers ->> 'q1', '') not in ('a','b','c','d')
     or coalesce(p_answers ->> 'q2', '') not in ('a','b','c','d')
     or coalesce(p_answers ->> 'q3', '') not in ('a','b','c','d')
     or coalesce(p_answers ->> 'q4', '') not in ('a','b','c','d')
     or coalesce(p_answers ->> 'q5', '') not in ('a','b','c','d') then
    raise exception 'Please answer all five questions with valid options.'
      using errcode = '22023';
  end if;

  v_correct :=
    (case when p_answers ->> 'q1' = 'b' then 1 else 0 end) +
    (case when p_answers ->> 'q2' = 'c' then 1 else 0 end) +
    (case when p_answers ->> 'q3' = 'c' then 1 else 0 end) +
    (case when p_answers ->> 'q4' = 'c' then 1 else 0 end) +
    (case when p_answers ->> 'q5' = 'b' then 1 else 0 end);

  v_score := round((v_correct::numeric * 100.0) / 5, 2);

  insert into public.assessment_results (
    user_id,
    course_slug,
    assessment_title,
    score_percent
  ) values (
    v_user_id,
    'business-administration',
    'تقييم الوحدة الأولى: مدخل إلى الأعمال وغايتها',
    v_score
  );

  return query select v_score, v_correct, 5;
end;
$$;

revoke all on function public.submit_business_unit1_quiz(jsonb) from public;
revoke all on function public.submit_business_unit1_quiz(jsonb) from anon;
grant execute on function public.submit_business_unit1_quiz(jsonb) to authenticated;
