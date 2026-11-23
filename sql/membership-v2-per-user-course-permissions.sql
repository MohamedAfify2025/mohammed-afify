-- Membership V2: role-based course access and per-student capability overrides.
-- Safe deployment notes:
-- 1. This migration is transactional and checks the existing V2 functions before replacing them.
-- 2. It does NOT create users, subscriptions, payments, or change existing plan defaults.
-- 3. A student override applies only while an approved/active student has an active paid/waived
--    subscription for that same course.
-- 4. Static files committed to a public website are still public by URL. Store paid lesson media
--    in private storage or serve it through an authenticated backend before treating it as secret.

BEGIN;

DO $preflight$
DECLARE
  v_access_def text;
  v_courses_def text;
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.course_catalog') IS NULL
     OR to_regclass('public.student_subscriptions') IS NULL
     OR to_regclass('public.subscription_plans') IS NULL
     OR to_regclass('public.subscription_plan_courses') IS NULL
     OR to_regclass('public.membership_audit_log') IS NULL THEN
    RAISE EXCEPTION 'Membership V2 preflight failed: one or more required tables are missing.';
  END IF;

  IF to_regprocedure('membership_v2_private.is_admin()') IS NULL
     OR to_regprocedure('membership_v2_private.my_course_access(text,text)') IS NULL
     OR to_regprocedure('public.get_my_active_courses_v2()') IS NULL THEN
    RAISE EXCEPTION 'Membership V2 preflight failed: required V2 access functions are missing.';
  END IF;

  v_access_def := lower(pg_get_functiondef(
    'membership_v2_private.my_course_access(text,text)'::regprocedure
  ));
  v_courses_def := lower(pg_get_functiondef(
    'public.get_my_active_courses_v2()'::regprocedure
  ));

  IF position('student_subscriptions' in v_access_def) = 0
     OR position('subscription_plan_courses' in v_access_def) = 0
     OR position('payment_state' in v_access_def) = 0
     OR position('starts_at' in v_access_def) = 0
     OR position('expires_at' in v_access_def) = 0
     OR position('account_state' in v_access_def) = 0 THEN
    RAISE EXCEPTION 'Membership V2 preflight failed: my_course_access has an unexpected definition. Export and review it before applying this migration.';
  END IF;

  IF position('student_subscriptions' in v_courses_def) = 0
     OR position('subscription_plan_courses' in v_courses_def) = 0
     OR position('payment_state' in v_courses_def) = 0
     OR position('can_view_course_page' in v_courses_def) = 0 THEN
    RAISE EXCEPTION 'Membership V2 preflight failed: get_my_active_courses_v2 has an unexpected definition. Export and review it before applying this migration.';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.student_course_permissions (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  course_slug text NOT NULL REFERENCES public.course_catalog(course_slug) ON UPDATE CASCADE ON DELETE CASCADE,
  can_view_course_page boolean NOT NULL DEFAULT true,
  can_watch_video boolean NOT NULL DEFAULT false,
  can_download boolean NOT NULL DEFAULT false,
  can_take_assessments boolean NOT NULL DEFAULT false,
  can_receive_certificate boolean NOT NULL DEFAULT false,
  can_track_progress boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_course_permissions_page_gate_check CHECK (
    can_view_course_page
    OR NOT (
      can_watch_video
      OR can_download
      OR can_take_assessments
      OR can_receive_certificate
      OR can_track_progress
    )
  ),
  CONSTRAINT student_course_permissions_pkey PRIMARY KEY (user_id, course_slug)
);

CREATE INDEX IF NOT EXISTS student_course_permissions_course_idx
  ON public.student_course_permissions(course_slug);

DROP TRIGGER IF EXISTS student_course_permissions_touch_updated_at
  ON public.student_course_permissions;
CREATE TRIGGER student_course_permissions_touch_updated_at
  BEFORE UPDATE ON public.student_course_permissions
  FOR EACH ROW EXECUTE FUNCTION membership_v2_private.touch_updated_at();

ALTER TABLE public.student_course_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_course_permissions_self_admin_read_v2
  ON public.student_course_permissions;
CREATE POLICY student_course_permissions_self_admin_read_v2
  ON public.student_course_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT membership_v2_private.is_admin())
  );

REVOKE ALL ON TABLE public.student_course_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.student_course_permissions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_student_course_permissions_v2(
  p_target_user uuid,
  p_course_slug text,
  p_can_view_course_page boolean,
  p_can_watch_video boolean,
  p_can_download boolean,
  p_can_take_assessments boolean,
  p_can_receive_certificate boolean,
  p_can_track_progress boolean,
  p_note text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT membership_v2_private.is_admin() THEN
    RAISE EXCEPTION 'Only an active platform admin may change student course permissions.'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user IS NULL OR nullif(btrim(coalesce(p_course_slug, '')), '') IS NULL
     OR p_can_view_course_page IS NULL
     OR p_can_watch_video IS NULL
     OR p_can_download IS NULL
     OR p_can_take_assessments IS NULL
     OR p_can_receive_certificate IS NULL
     OR p_can_track_progress IS NULL THEN
    RAISE EXCEPTION 'Student, course and all permission values are required.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT p_can_view_course_page AND (
    p_can_watch_video OR p_can_download OR p_can_take_assessments
    OR p_can_receive_certificate OR p_can_track_progress
  ) THEN
    RAISE EXCEPTION 'Course page access must be enabled before any other course capability.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_target_user
      AND p.role = 'student'
      AND p.status = 'approved'
      AND p.account_state = 'active'
  ) THEN
    RAISE EXCEPTION 'An approved, active student profile is required.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.student_subscriptions ss
    JOIN public.subscription_plans sp ON sp.id = ss.plan_id
    JOIN public.subscription_plan_courses pc ON pc.plan_id = sp.id
    JOIN public.course_catalog cc ON cc.course_slug = pc.course_slug
    WHERE ss.user_id = p_target_user
      AND pc.course_slug = p_course_slug
      AND ss.status = 'active'
      AND ss.payment_state IN ('paid', 'waived')
      AND ss.starts_at IS NOT NULL
      AND ss.starts_at <= now()
      AND (ss.expires_at IS NULL OR ss.expires_at > now())
      AND sp.is_active = true
      AND cc.is_active = true
  ) THEN
    RAISE EXCEPTION 'Student must have an active, paid or waived subscription covering this course.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.student_course_permissions (
    user_id, course_slug,
    can_view_course_page, can_watch_video, can_download,
    can_take_assessments, can_receive_certificate, can_track_progress,
    updated_by
  ) VALUES (
    p_target_user, p_course_slug,
    p_can_view_course_page, p_can_watch_video, p_can_download,
    p_can_take_assessments, p_can_receive_certificate, p_can_track_progress,
    auth.uid()
  )
  ON CONFLICT (user_id, course_slug) DO UPDATE SET
    can_view_course_page = EXCLUDED.can_view_course_page,
    can_watch_video = EXCLUDED.can_watch_video,
    can_download = EXCLUDED.can_download,
    can_take_assessments = EXCLUDED.can_take_assessments,
    can_receive_certificate = EXCLUDED.can_receive_certificate,
    can_track_progress = EXCLUDED.can_track_progress,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.membership_audit_log (
    actor_user_id, action_key, target_user_id, entity_type, entity_id, details
  ) VALUES (
    auth.uid(),
    'student.course_permissions.updated',
    p_target_user,
    'student_course_permissions',
    NULL,
    jsonb_build_object(
      'course_slug', p_course_slug,
      'can_view_course_page', p_can_view_course_page,
      'can_watch_video', p_can_watch_video,
      'can_download', p_can_download,
      'can_take_assessments', p_can_take_assessments,
      'can_receive_certificate', p_can_receive_certificate,
      'can_track_progress', p_can_track_progress,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_student_course_permissions_v2(
  p_target_user uuid,
  p_course_slug text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT membership_v2_private.is_admin() THEN
    RAISE EXCEPTION 'Only an active platform admin may reset student course permissions.'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user IS NULL OR nullif(btrim(coalesce(p_course_slug, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Student and course are required.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.student_course_permissions
  WHERE user_id = p_target_user
    AND course_slug = p_course_slug;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    INSERT INTO public.membership_audit_log (
      actor_user_id, action_key, target_user_id, entity_type, entity_id, details
    ) VALUES (
      auth.uid(),
      'student.course_permissions.reset_to_plan',
      p_target_user,
      'student_course_permissions',
      NULL,
      jsonb_build_object('course_slug', p_course_slug)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION membership_v2_private.my_course_access(
  p_course_slug text,
  p_capability text DEFAULT 'page'::text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT membership_v2_private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.student_subscriptions ss
        ON ss.user_id = p.user_id
      JOIN public.subscription_plans sp
        ON sp.id = ss.plan_id
      JOIN public.subscription_plan_courses spc
        ON spc.plan_id = sp.id
      LEFT JOIN public.student_course_permissions scp
        ON scp.user_id = p.user_id
       AND scp.course_slug = spc.course_slug
      WHERE p.user_id = (SELECT auth.uid())
        AND p.role = 'student'
        AND p.status = 'approved'
        AND p.account_state = 'active'
        AND ss.status = 'active'
        AND ss.payment_state IN ('paid', 'waived')
        AND ss.starts_at IS NOT NULL
        AND ss.starts_at <= now()
        AND (ss.expires_at IS NULL OR ss.expires_at > now())
        AND sp.is_active = true
        AND spc.course_slug = p_course_slug
        AND CASE p_capability
          WHEN 'page' THEN COALESCE(scp.can_view_course_page, spc.can_view_course_page)
          WHEN 'video' THEN COALESCE(scp.can_watch_video, spc.can_watch_video)
          WHEN 'download' THEN COALESCE(scp.can_download, spc.can_download)
          WHEN 'assessment' THEN COALESCE(scp.can_take_assessments, spc.can_take_assessments)
          WHEN 'certificate' THEN COALESCE(scp.can_receive_certificate, spc.can_receive_certificate)
          WHEN 'progress' THEN COALESCE(scp.can_track_progress, spc.can_track_progress)
          ELSE false
        END
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_active_courses_v2()
RETURNS TABLE(
  course_slug text,
  course_title text,
  plan_code text,
  plan_name text,
  can_view_course_page boolean,
  can_watch_video boolean,
  can_download boolean,
  can_take_assessments boolean,
  can_receive_certificate boolean,
  can_track_progress boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT DISTINCT
    cc.course_slug,
    cc.title,
    sp.code,
    sp.name,
    COALESCE(scp.can_view_course_page, pc.can_view_course_page),
    COALESCE(scp.can_watch_video, pc.can_watch_video),
    COALESCE(scp.can_download, pc.can_download),
    COALESCE(scp.can_take_assessments, pc.can_take_assessments),
    COALESCE(scp.can_receive_certificate, pc.can_receive_certificate),
    COALESCE(scp.can_track_progress, pc.can_track_progress)
  FROM public.student_subscriptions ss
  JOIN public.profiles p ON p.user_id = ss.user_id
  JOIN public.subscription_plans sp ON sp.id = ss.plan_id
  JOIN public.subscription_plan_courses pc ON pc.plan_id = sp.id
  JOIN public.course_catalog cc ON cc.course_slug = pc.course_slug
  LEFT JOIN public.student_course_permissions scp
    ON scp.user_id = ss.user_id
   AND scp.course_slug = pc.course_slug
  WHERE ss.user_id = (SELECT auth.uid())
    AND p.role = 'student'
    AND p.status = 'approved'
    AND p.account_state = 'active'
    AND ss.status = 'active'
    AND ss.payment_state IN ('paid', 'waived')
    AND ss.starts_at IS NOT NULL
    AND ss.starts_at <= now()
    AND (ss.expires_at IS NULL OR ss.expires_at > now())
    AND sp.is_active = true
    AND cc.is_active = true
    AND COALESCE(scp.can_view_course_page, pc.can_view_course_page) = true
  ORDER BY 1, 3;
$$;

CREATE OR REPLACE FUNCTION public.get_my_course_permissions_v2()
RETURNS TABLE(
  course_slug text,
  course_title text,
  can_view_course_page boolean,
  can_watch_video boolean,
  can_download boolean,
  can_take_assessments boolean,
  can_receive_certificate boolean,
  can_track_progress boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH assigned AS (
    SELECT
      pc.course_slug,
      COALESCE(scp.can_view_course_page, pc.can_view_course_page) AS can_view_course_page,
      COALESCE(scp.can_watch_video, pc.can_watch_video) AS can_watch_video,
      COALESCE(scp.can_download, pc.can_download) AS can_download,
      COALESCE(scp.can_take_assessments, pc.can_take_assessments) AS can_take_assessments,
      COALESCE(scp.can_receive_certificate, pc.can_receive_certificate) AS can_receive_certificate,
      COALESCE(scp.can_track_progress, pc.can_track_progress) AS can_track_progress
    FROM public.student_subscriptions ss
    JOIN public.profiles p ON p.user_id = ss.user_id
    JOIN public.subscription_plans sp ON sp.id = ss.plan_id
    JOIN public.subscription_plan_courses pc ON pc.plan_id = sp.id
    JOIN public.course_catalog cc ON cc.course_slug = pc.course_slug
    LEFT JOIN public.student_course_permissions scp
      ON scp.user_id = ss.user_id
     AND scp.course_slug = pc.course_slug
    WHERE ss.user_id = (SELECT auth.uid())
      AND p.role = 'student'
      AND p.status = 'approved'
      AND p.account_state = 'active'
      AND ss.status = 'active'
      AND ss.payment_state IN ('paid', 'waived')
      AND ss.starts_at IS NOT NULL
      AND ss.starts_at <= now()
      AND (ss.expires_at IS NULL OR ss.expires_at > now())
      AND sp.is_active = true
      AND cc.is_active = true
  )
  SELECT
    assigned.course_slug,
    cc.title,
    bool_or(assigned.can_view_course_page),
    bool_or(assigned.can_watch_video),
    bool_or(assigned.can_download),
    bool_or(assigned.can_take_assessments),
    bool_or(assigned.can_receive_certificate),
    bool_or(assigned.can_track_progress)
  FROM assigned
  JOIN public.course_catalog cc ON cc.course_slug = assigned.course_slug
  GROUP BY assigned.course_slug, cc.title
  ORDER BY cc.title;
$$;

REVOKE ALL ON FUNCTION public.admin_set_student_course_permissions_v2(uuid,text,boolean,boolean,boolean,boolean,boolean,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_student_course_permissions_v2(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_course_permissions_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_student_course_permissions_v2(uuid,text,boolean,boolean,boolean,boolean,boolean,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_student_course_permissions_v2(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_course_permissions_v2() TO authenticated;

DROP POLICY IF EXISTS course_catalog_public_preview_v2 ON public.course_catalog;
CREATE POLICY course_catalog_public_preview_v2
  ON public.course_catalog
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON TABLE public.course_catalog TO anon, authenticated;

COMMIT;
