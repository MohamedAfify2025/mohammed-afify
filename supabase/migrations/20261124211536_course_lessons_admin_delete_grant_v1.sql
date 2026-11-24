-- Allow the authenticated role to reach DELETE on lesson rows.
-- The existing course_lessons_admin_manage_v1 RLS policy still restricts
-- actual row deletion to active, approved platform admins only.
GRANT DELETE ON TABLE public.course_lessons TO authenticated;
