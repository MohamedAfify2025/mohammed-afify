-- Student self-service course enrollment requests for Mohammed Afify Academy.
-- Run this migration once in Supabase Dashboard > SQL Editor before publishing the UI.
-- This migration does NOT add a payment gateway. Admin review, payment confirmation and
-- subscription activation continue through the existing membership management workflow.

create extension if not exists pgcrypto;

-- The platform's subscription-management schema must already be installed.
do $preflight$
declare
  required_table text;
begin
  foreach required_table in array array[
    'public.profiles',
    'public.course_catalog',
    'public.subscription_plans',
    'public.subscription_plan_courses',
    'public.student_subscriptions'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'Missing required table: %. Install the existing membership/subscription schema first.', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'account_state'
  ) then
    raise exception 'Missing profiles.account_state. Apply the current membership account-state migration first.';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_platform_admin'
  ) then
    raise exception 'Missing public.is_platform_admin(). Install the current membership admin functions first.';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_assign_student_with_discount_v1'
  ) then
    raise exception 'Missing public.admin_assign_student_with_discount_v1(). Install the current subscription management functions first.';
  end if;
end;
$preflight$;

create table if not exists public.student_course_enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  student_note text not null default '',
  admin_note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'rejected', 'cancelled')),
  fulfilled_subscription_id uuid references public.student_subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists student_course_enrollment_requests_student_idx
  on public.student_course_enrollment_requests (student_user_id, created_at desc);

create index if not exists student_course_enrollment_requests_status_idx
  on public.student_course_enrollment_requests (status, created_at);

create unique index if not exists student_course_enrollment_requests_one_pending_plan
  on public.student_course_enrollment_requests (student_user_id, plan_id)
  where status = 'pending';

alter table public.student_course_enrollment_requests enable row level security;

drop policy if exists "course_enrollment_requests_read_own_or_admin"
  on public.student_course_enrollment_requests;
create policy "course_enrollment_requests_read_own_or_admin"
  on public.student_course_enrollment_requests
  for select to authenticated
  using (
    student_user_id = auth.uid()
    or public.is_platform_admin()
  );

drop policy if exists "course_enrollment_requests_insert_approved_student"
  on public.student_course_enrollment_requests;
create policy "course_enrollment_requests_insert_approved_student"
  on public.student_course_enrollment_requests
  for insert to authenticated
  with check (
    student_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'student'
        and p.status = 'approved'
        and p.account_state = 'active'
    )
  );

revoke all on public.student_course_enrollment_requests from anon, authenticated;
grant select, insert on public.student_course_enrollment_requests to authenticated;

-- Public catalogue data is limited to active courses attached to active, public plans.
-- The function is SECURITY DEFINER so students do not need direct access to admin tables.
create or replace function public.get_student_course_offerings_v1()
returns table (
  course_slug text,
  course_title text,
  plan_id uuid,
  plan_name text,
  plan_type text,
  price numeric,
  currency text,
  duration_days integer,
  included_courses_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.course_slug,
    c.title,
    p.id,
    p.name,
    p.plan_type,
    p.price,
    p.currency,
    p.duration_days,
    count(*) over (partition by p.id)::integer
  from public.course_catalog c
  join public.subscription_plan_courses pc
    on pc.course_slug = c.course_slug
   and pc.can_view_course_page = true
  join public.subscription_plans p
    on p.id = pc.plan_id
  where c.is_active = true
    and p.is_active = true
    and p.is_public = true
  order by p.name, c.title;
$$;

revoke all on function public.get_student_course_offerings_v1() from public;
grant execute on function public.get_student_course_offerings_v1() to anon, authenticated;

create or replace function public.request_course_enrollment_v1(
  p_plan_id uuid,
  p_student_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'سجّل الدخول أولًا لإرسال طلب الاشتراك.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'student'
      and p.status = 'approved'
      and p.account_state = 'active'
  ) then
    raise exception 'يجب اعتماد حساب الطالب وتفعيله قبل طلب دورة جديدة.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.subscription_plans p
    join public.subscription_plan_courses pc on pc.plan_id = p.id
    join public.course_catalog c on c.course_slug = pc.course_slug
    where p.id = p_plan_id
      and p.is_active = true
      and p.is_public = true
      and c.is_active = true
      and pc.can_view_course_page = true
  ) then
    raise exception 'هذه الباقة غير متاحة للاشتراك حاليًا.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.student_subscriptions s
    where s.user_id = auth.uid()
      and s.plan_id = p_plan_id
      and s.status in ('pending', 'active', 'suspended')
  ) then
    raise exception 'لديك بالفعل اشتراك قائم أو طلب قيد التنفيذ لهذه الباقة.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.student_course_enrollment_requests r
    where r.student_user_id = auth.uid()
      and r.plan_id = p_plan_id
      and r.status = 'pending'
  ) then
    raise exception 'تم إرسال طلب لهذه الباقة من قبل، وهو ما زال قيد المراجعة.' using errcode = '23505';
  end if;

  insert into public.student_course_enrollment_requests (
    student_user_id, plan_id, student_note
  )
  values (
    auth.uid(), p_plan_id, left(coalesce(p_student_note, ''), 500)
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_course_enrollment_v1(uuid, text) from public;
grant execute on function public.request_course_enrollment_v1(uuid, text) to authenticated;

-- Admin fulfilment creates the real subscription using the existing transactional
-- assignment RPC. Paid subscriptions remain pending payment/activation; free plans
-- are assigned as waived using the same established admin workflow.
create or replace function public.admin_process_course_enrollment_request_v1(
  p_request_id uuid,
  p_action text,
  p_admin_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.student_course_enrollment_requests%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_subscription_id uuid;
  v_discount_type text;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'هذه العملية متاحة لمدير المنصة فقط.' using errcode = '42501';
  end if;

  select *
    into v_request
    from public.student_course_enrollment_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'طلب الاشتراك غير موجود.' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'تمت معالجة هذا الطلب من قبل.' using errcode = '22023';
  end if;

  if p_action = 'reject' then
    update public.student_course_enrollment_requests
       set status = 'rejected',
           admin_note = left(coalesce(p_admin_note, ''), 1000),
           reviewed_at = now(),
           reviewed_by = auth.uid()
     where id = p_request_id;
    return null;
  end if;

  if p_action <> 'fulfill' then
    raise exception 'إجراء المعالجة غير صحيح.' using errcode = '22023';
  end if;

  select *
    into v_plan
    from public.subscription_plans
   where id = v_request.plan_id
     and is_active = true
     and is_public = true;

  if not found then
    raise exception 'الباقة لم تعد متاحة. حدّث فهرس الباقات قبل معالجة الطلب.' using errcode = '22023';
  end if;

  v_discount_type := case when coalesce(v_plan.price, 0) <= 0 then 'waive' else 'none' end;

  v_subscription_id := public.admin_assign_student_with_discount_v1(
    p_target_user => v_request.student_user_id,
    p_plan_id => v_request.plan_id,
    p_discount_type => v_discount_type,
    p_discount_value => 0,
    p_discount_reason => case when v_discount_type = 'waive' then 'باقة مجانية منشورة - طلب طالب' else '' end,
    p_admin_note => left(coalesce(p_admin_note, 'طلب اشتراك ذاتي من الطالب'), 1000)
  );

  update public.student_course_enrollment_requests
     set status = 'fulfilled',
         admin_note = left(coalesce(p_admin_note, ''), 1000),
         fulfilled_subscription_id = v_subscription_id,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_request_id;

  return v_subscription_id;
end;
$$;

revoke all on function public.admin_process_course_enrollment_request_v1(uuid, text, text) from public;
grant execute on function public.admin_process_course_enrollment_request_v1(uuid, text, text) to authenticated;

comment on table public.student_course_enrollment_requests is
  'Student self-service requests for published course plans; admin fulfilment creates the actual membership subscription.';
