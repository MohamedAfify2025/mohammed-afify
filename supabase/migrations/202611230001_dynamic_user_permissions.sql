-- Membership V2 — dynamic per-user permissions
-- Additive only: existing V2 subscription/payment checks remain authoritative.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_permission_definitions (
  permission_code text PRIMARY KEY,
  permission_name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  resource text NOT NULL,
  action text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_permission_code_format CHECK (permission_code ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  CONSTRAINT platform_permission_name_length CHECK (char_length(permission_name) BETWEEN 2 AND 120),
  CONSTRAINT platform_permission_category_length CHECK (char_length(category) BETWEEN 2 AND 60),
  CONSTRAINT platform_permission_resource_length CHECK (char_length(resource) BETWEEN 2 AND 80),
  CONSTRAINT platform_permission_action_length CHECK (char_length(action) BETWEEN 2 AND 80)
);

CREATE TABLE IF NOT EXISTS public.user_permission_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_mode text NOT NULL DEFAULT 'inherit' CHECK (permission_mode IN ('inherit', 'custom')),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.platform_permission_definitions(permission_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  scope_course_slug text,
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_validity_range CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT user_permission_scope_unique UNIQUE NULLS NOT DISTINCT (user_id, permission_code, scope_course_slug)
);

CREATE TABLE IF NOT EXISTS public.platform_permission_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_user_id uuid,
  permission_code text,
  event_type text NOT NULL CHECK (event_type IN (
    'permission_created','permission_updated','mode_changed','grant_created','grant_updated','grant_revoked'
  )),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_permission_grants_user_active
  ON public.user_permission_grants (user_id, is_active, permission_code);
CREATE INDEX IF NOT EXISTS idx_user_permission_grants_course
  ON public.user_permission_grants (user_id, scope_course_slug)
  WHERE scope_course_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permission_audit_target_created
  ON public.platform_permission_audit_log (target_user_id, created_at DESC);

ALTER TABLE public.platform_permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_permission_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_permission_definitions_admin_read ON public.platform_permission_definitions;
CREATE POLICY platform_permission_definitions_admin_read
  ON public.platform_permission_definitions FOR SELECT TO authenticated
  USING (membership_v2_private.is_admin());

DROP POLICY IF EXISTS user_permission_profiles_owner_or_admin_read ON public.user_permission_profiles;
CREATE POLICY user_permission_profiles_owner_or_admin_read
  ON public.user_permission_profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR membership_v2_private.is_admin());

DROP POLICY IF EXISTS user_permission_grants_owner_or_admin_read ON public.user_permission_grants;
CREATE POLICY user_permission_grants_owner_or_admin_read
  ON public.user_permission_grants FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR membership_v2_private.is_admin());

DROP POLICY IF EXISTS platform_permission_audit_admin_read ON public.platform_permission_audit_log;
CREATE POLICY platform_permission_audit_admin_read
  ON public.platform_permission_audit_log FOR SELECT TO authenticated
  USING (membership_v2_private.is_admin());

GRANT SELECT ON public.platform_permission_definitions TO authenticated;
GRANT SELECT ON public.user_permission_profiles TO authenticated;
GRANT SELECT ON public.user_permission_grants TO authenticated;
GRANT SELECT ON public.platform_permission_audit_log TO authenticated;

INSERT INTO public.platform_permission_definitions
  (permission_code, permission_name, category, description, resource, action, is_system)
VALUES
  ('student.dashboard.view', 'مشاهدة لوحة المتدرب', 'الحساب', 'الدخول إلى المساحة الشخصية للمتدرب', 'student_dashboard', 'view', true),
  ('profile.view', 'مشاهدة البيانات الشخصية', 'الحساب', 'مشاهدة بيانات الحساب الشخصي', 'profile', 'view', true),
  ('profile.edit', 'تعديل البيانات الشخصية', 'الحساب', 'تعديل البيانات الشخصية المسموح بها', 'profile', 'edit', true),
  ('course.catalog.view', 'مشاهدة فهرس الدورات', 'الدورات', 'عرض فهرس الدورات ومعلوماتها العامة', 'course_catalog', 'view', true),
  ('course.lesson.view', 'مشاهدة الدروس', 'الدورات', 'فتح الدروس بعد التحقق من الاشتراك النشط', 'course_lesson', 'view', true),
  ('course.lesson.download', 'تحميل مواد الدروس', 'الدورات', 'تحميل الملفات بعد التحقق من اشتراك الدورة', 'course_lesson', 'download', true),
  ('assessment.take', 'دخول الاختبارات', 'التقييم', 'تقديم الاختبارات المسموح بها', 'assessment', 'take', true),
  ('certificate.view', 'مشاهدة الشهادات', 'التقييم', 'الوصول إلى الشهادات الخاصة بالحساب', 'certificate', 'view', true),
  ('progress.view', 'مشاهدة التقدم', 'التقدم', 'مشاهدة سجل التقدم والإنجاز', 'progress', 'view', true),
  ('project.view', 'مشاهدة المشروعات', 'الموارد', 'مشاهدة المشروعات التطبيقية المسموح بها', 'project', 'view', true),
  ('resource.download', 'تحميل الموارد', 'الموارد', 'تحميل الموارد التعليمية المسموح بها', 'resource', 'download', true)
ON CONFLICT (permission_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_platform_permission(
  p_permission_code text,
  p_course_slug text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_status text;
  v_account_state text;
  v_mode text;
BEGIN
  IF v_user_id IS NULL OR p_permission_code IS NULL OR btrim(p_permission_code) = '' THEN
    RETURN false;
  END IF;

  IF membership_v2_private.is_admin() THEN
    RETURN true;
  END IF;

  SELECT p.role, p.status, p.account_state
    INTO v_role, v_status, v_account_state
    FROM public.profiles p
   WHERE p.user_id = v_user_id;

  IF NOT FOUND OR v_role NOT IN ('student', 'teacher')
     OR v_status <> 'approved' OR v_account_state <> 'active' THEN
    RETURN false;
  END IF;

  SELECT upp.permission_mode INTO v_mode
    FROM public.user_permission_profiles upp
   WHERE upp.user_id = v_user_id;

  -- Default inherit preserves today's V2 behavior. Subscription/payment
  -- enforcement remains mandatory in protected course and media functions.
  IF COALESCE(v_mode, 'inherit') = 'inherit' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.platform_permission_definitions d
      JOIN public.user_permission_grants g ON g.permission_code = d.permission_code
     WHERE d.permission_code = p_permission_code
       AND d.is_active = true
       AND g.user_id = v_user_id
       AND g.is_active = true
       AND g.valid_from <= now()
       AND (g.valid_until IS NULL OR g.valid_until > now())
       AND (
         g.scope_course_slug IS NULL
         OR (p_course_slug IS NOT NULL AND g.scope_course_slug = p_course_slug)
       )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_platform_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_mode text;
  v_permissions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT upp.permission_mode INTO v_mode
    FROM public.user_permission_profiles upp
   WHERE upp.user_id = v_user_id;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'permission_code', d.permission_code,
      'permission_name', d.permission_name,
      'category', d.category,
      'description', d.description,
      'scope_course_slug', g.scope_course_slug,
      'valid_from', g.valid_from,
      'valid_until', g.valid_until
    ) ORDER BY d.category, d.permission_name),
    '[]'::jsonb
  )
    INTO v_permissions
    FROM public.user_permission_grants g
    JOIN public.platform_permission_definitions d ON d.permission_code = g.permission_code
   WHERE g.user_id = v_user_id
     AND g.is_active = true
     AND d.is_active = true
     AND g.valid_from <= now()
     AND (g.valid_until IS NULL OR g.valid_until > now());

  RETURN jsonb_build_object(
    'mode', COALESCE(v_mode, 'inherit'),
    'permissions', COALESCE(v_permissions, '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_platform_permission(
  p_permission_code text,
  p_permission_name text,
  p_category text,
  p_description text,
  p_resource text,
  p_action text,
  p_is_active boolean DEFAULT true
)
RETURNS public.platform_permission_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row public.platform_permission_definitions;
  v_before jsonb;
  v_event text;
BEGIN
  IF NOT membership_v2_private.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_permission_code, '') !~ '^[a-z][a-z0-9_.-]{1,79}$'
     OR char_length(COALESCE(p_permission_name,'')) NOT BETWEEN 2 AND 120
     OR char_length(COALESCE(p_category,'')) NOT BETWEEN 2 AND 60
     OR char_length(COALESCE(p_resource,'')) NOT BETWEEN 2 AND 80
     OR char_length(COALESCE(p_action,'')) NOT BETWEEN 2 AND 80
     OR char_length(COALESCE(p_description,'')) > 500 THEN
    RAISE EXCEPTION 'Invalid permission definition';
  END IF;

  SELECT to_jsonb(d) INTO v_before
    FROM public.platform_permission_definitions d
   WHERE d.permission_code = p_permission_code;
  v_event := CASE WHEN v_before IS NULL THEN 'permission_created' ELSE 'permission_updated' END;

  INSERT INTO public.platform_permission_definitions
    (permission_code, permission_name, category, description, resource, action, is_active, is_system, created_by)
  VALUES
    (p_permission_code, btrim(p_permission_name), btrim(p_category),
     COALESCE(btrim(p_description),''), btrim(p_resource), btrim(p_action),
     COALESCE(p_is_active,true), false, auth.uid())
  ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO public.platform_permission_audit_log
    (actor_user_id, permission_code, event_type, before_state, after_state)
  VALUES (auth.uid(), p_permission_code, v_event, v_before, to_jsonb(v_row));
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_permission_mode(p_user_id uuid, p_mode text)
RETURNS public.user_permission_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row public.user_permission_profiles;
  v_before jsonb;
BEGIN
  IF NOT membership_v2_private.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('inherit', 'custom') THEN
    RAISE EXCEPTION 'Permission mode must be inherit or custom';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id AND p.role = 'student') THEN
    RAISE EXCEPTION 'Target student account was not found';
  END IF;

  SELECT to_jsonb(upp) INTO v_before
    FROM public.user_permission_profiles upp
   WHERE upp.user_id = p_user_id;

  INSERT INTO public.user_permission_profiles (user_id, permission_mode, updated_by)
  VALUES (p_user_id, p_mode, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    permission_mode = EXCLUDED.permission_mode,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO public.platform_permission_audit_log
    (actor_user_id, target_user_id, event_type, before_state, after_state)
  VALUES (auth.uid(), p_user_id, 'mode_changed', v_before, to_jsonb(v_row));
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_grant_user_permission(
  p_user_id uuid,
  p_permission_code text,
  p_scope_course_slug text DEFAULT NULL,
  p_valid_from timestamptz DEFAULT now(),
  p_valid_until timestamptz DEFAULT NULL
)
RETURNS public.user_permission_grants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row public.user_permission_grants;
  v_before jsonb;
BEGIN
  IF NOT membership_v2_private.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id AND p.role = 'student') THEN
    RAISE EXCEPTION 'Target student account was not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_permission_definitions d
     WHERE d.permission_code = p_permission_code AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission definition is missing or inactive';
  END IF;
  IF p_scope_course_slug IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_catalog c WHERE c.course_slug = p_scope_course_slug
  ) THEN
    RAISE EXCEPTION 'Course scope does not exist';
  END IF;
  IF p_valid_from IS NULL OR (p_valid_until IS NOT NULL AND p_valid_until <= p_valid_from) THEN
    RAISE EXCEPTION 'Invalid permission validity range';
  END IF;

  SELECT to_jsonb(g) INTO v_before
    FROM public.user_permission_grants g
   WHERE g.user_id = p_user_id
     AND g.permission_code = p_permission_code
     AND g.scope_course_slug IS NOT DISTINCT FROM p_scope_course_slug;

  INSERT INTO public.user_permission_grants
    (user_id, permission_code, scope_course_slug, is_active, valid_from, valid_until, granted_by)
  VALUES (p_user_id, p_permission_code, p_scope_course_slug, true, p_valid_from, p_valid_until, auth.uid())
  ON CONFLICT ON CONSTRAINT user_permission_scope_unique DO UPDATE SET
    is_active = true,
    valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until,
    granted_by = EXCLUDED.granted_by,
    updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO public.platform_permission_audit_log
    (actor_user_id, target_user_id, permission_code, event_type, before_state, after_state)
  VALUES (
    auth.uid(), p_user_id, p_permission_code,
    CASE WHEN v_before IS NULL THEN 'grant_created' ELSE 'grant_updated' END,
    v_before, to_jsonb(v_row)
  );
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_permission(
  p_user_id uuid,
  p_permission_code text,
  p_scope_course_slug text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF NOT membership_v2_private.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(g) INTO v_before
    FROM public.user_permission_grants g
   WHERE g.user_id = p_user_id
     AND g.permission_code = p_permission_code
     AND g.scope_course_slug IS NOT DISTINCT FROM p_scope_course_slug
     AND g.is_active = true;

  IF v_before IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_permission_grants AS g
     SET is_active = false, updated_at = now()
   WHERE g.user_id = p_user_id
     AND g.permission_code = p_permission_code
     AND g.scope_course_slug IS NOT DISTINCT FROM p_scope_course_slug
     AND g.is_active = true
  RETURNING to_jsonb(g) INTO v_after;

  INSERT INTO public.platform_permission_audit_log
    (actor_user_id, target_user_id, permission_code, event_type, before_state, after_state)
  VALUES (auth.uid(), p_user_id, p_permission_code, 'grant_revoked', v_before, v_after);

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.has_platform_permission(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_platform_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_platform_permission(text, text, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_permission_mode(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_user_permission(uuid, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_user_permission(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_platform_permission(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_platform_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_platform_permission(text, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_permission_mode(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_permission(uuid, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_permission(uuid, text, text) TO authenticated;

COMMIT;
