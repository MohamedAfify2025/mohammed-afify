-- Organize course content into explicit units while preserving the existing lesson records.
-- Additive only: existing course_lessons rows and private Storage objects remain untouched.

create table if not exists public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null
    references public.course_catalog(course_slug)
    on update cascade on delete cascade,
  unit_slug text not null
    check (unit_slug ~ '^[a-z0-9-]{1,100}$'),
  title text not null,
  description text not null default '',
  sort_order integer not null default 1 check (sort_order > 0),
  is_published boolean not null default false,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_units_course_unit_unique unique (course_slug, unit_slug)
);

create index if not exists course_units_course_order_idx
  on public.course_units(course_slug, sort_order);

alter table public.course_lessons
  add column if not exists unit_id uuid
    references public.course_units(id) on delete set null,
  add column if not exists source_path text,
  add column if not exists source_base_url text,
  add column if not exists lesson_type text not null default 'lesson';

alter table public.course_lessons
  drop constraint if exists course_lessons_lesson_type_check;

alter table public.course_lessons
  add constraint course_lessons_lesson_type_check
  check (lesson_type in ('overview', 'lesson', 'assessment', 'resource'));

create index if not exists course_lessons_course_unit_order_idx
  on public.course_lessons(course_slug, unit_id, sort_order);

drop trigger if exists course_units_touch_updated_at on public.course_units;
create trigger course_units_touch_updated_at
  before update on public.course_units
  for each row execute function membership_v2_private.touch_updated_at();

alter table public.course_units enable row level security;

revoke all on table public.course_units from public, anon, authenticated;
grant select, insert, update, delete on table public.course_units to authenticated;

drop policy if exists course_units_admin_manage_v1 on public.course_units;
create policy course_units_admin_manage_v1
  on public.course_units
  for all to authenticated
  using ((select membership_v2_private.is_admin()))
  with check ((select membership_v2_private.is_admin()));

drop policy if exists course_units_student_read_published_v1 on public.course_units;
create policy course_units_student_read_published_v1
  on public.course_units
  for select to authenticated
  using (
    is_published = true
    and (select auth.uid()) is not null
    and has_my_course_access(course_slug, 'page'::text)
  );
