-- Mohammed Afify learning platform: membership, approval, watch progress and assessment records.
-- Run the whole script in Supabase Dashboard > SQL Editor, using the project SQL editor.
-- Do NOT put a service_role key or database password in any browser file.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  requested_course text not null default 'عام',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_slug text not null,
  lesson_title text not null default '',
  seconds_watched integer not null default 0 check (seconds_watched >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, course_slug, lesson_slug)
);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_slug text not null default '',
  assessment_title text not null,
  score_percent numeric(5,2) not null check (score_percent >= 0 and score_percent <= 100),
  created_at timestamptz not null default now()
);

-- Create one student profile at auth signup. Students cannot set their own role/status.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, phone, requested_course)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'requested_course', 'عام')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_approved_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.set_student_status(target_user uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform admins may update student access.' using errcode = '42501';
  end if;
  if new_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid student status.' using errcode = '22023';
  end if;
  update public.profiles
     set status = new_status, updated_at = now()
   where user_id = target_user and role = 'student';
  if not found then
    raise exception 'Student profile not found.' using errcode = 'P0002';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.learning_progress enable row level security;
alter table public.assessment_results enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());
-- No direct INSERT/UPDATE/DELETE policy on profiles: signup trigger makes records and RPC changes access status.

drop policy if exists "progress_select_self_or_admin" on public.learning_progress;
create policy "progress_select_self_or_admin" on public.learning_progress
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists "progress_insert_approved_self" on public.learning_progress;
create policy "progress_insert_approved_self" on public.learning_progress
for insert to authenticated
with check (user_id = auth.uid() and public.is_approved_student());
drop policy if exists "progress_update_approved_self" on public.learning_progress;
create policy "progress_update_approved_self" on public.learning_progress
for update to authenticated
using (user_id = auth.uid() and public.is_approved_student())
with check (user_id = auth.uid() and public.is_approved_student());

drop policy if exists "assessment_select_self_or_admin" on public.assessment_results;
create policy "assessment_select_self_or_admin" on public.assessment_results
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists "assessment_insert_approved_self" on public.assessment_results;
-- Assessment rows are read-only from the browser in this starter. Add a server-side grading flow
-- before allowing inserts, so students cannot submit arbitrary scores.

revoke all on function public.set_student_status(uuid, text) from public;
revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_approved_student() from public;
grant execute on function public.set_student_status(uuid, text) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_approved_student() to authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update on public.learning_progress to authenticated;
grant select on public.assessment_results to authenticated;

-- AFTER the admin has registered and confirmed their own email, run a separate statement
-- in SQL Editor, substituting their exact login email:
-- update public.profiles set role = 'admin', status = 'approved' where email = lower('YOUR_ADMIN_EMAIL');
-- Never add a public signup form field that lets users choose role='admin'.
