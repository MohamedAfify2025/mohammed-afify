-- ============================================================================
-- MEMBERSHIP V2 — PHASE 1 REVIEW DRAFT
-- Scope:
--   1) Enforce requested-course matching and overlapping-plan prevention
--      inside create_student_subscription_v2 itself.
--   2) Do not convert an already-paid subscription to waived during activation.
--   3) Validate payment amount AFTER rounding to the stored 2-decimal precision.
--
-- IMPORTANT:
--   * REVIEW DRAFT ONLY. Not executed against Supabase.
--   * Apply only to a separate test project after backup and code review.
--   * This script replaces function bodies only; it does not alter tables/data.
--   * It preserves existing function signatures and SECURITY DEFINER settings.
--   * CREATE OR REPLACE retains the existing function owner and ACL.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1) Core guard: create_student_subscription_v2
--    Rules previously present only in the higher-level assignment RPC are
--    enforced here too, so a direct RPC call cannot bypass them.
--    The profile row lock serializes concurrent subscription creation for
--    the same student under the current transaction model.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_student_subscription_v2(
    p_student_user_id uuid,
    p_plan_id uuid,
    p_admin_note text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_subscription_id uuid;
    v_plan_amount numeric(12,2);
    v_currency text;
    v_status text;
    v_role text;
    v_account_state text;
    v_requested_course text;
BEGIN
    IF NOT membership_v2_private.is_admin() THEN
        RAISE EXCEPTION 'Only an active platform admin may create subscriptions.'
            USING ERRCODE = '42501';
    END IF;

    IF p_student_user_id IS NULL OR p_plan_id IS NULL THEN
        RAISE EXCEPTION 'Student and plan are both required.'
            USING ERRCODE = '22023';
    END IF;

    SELECT
        p.status,
        p.role,
        p.account_state,
        p.requested_course
    INTO
        v_status,
        v_role,
        v_account_state,
        v_requested_course
    FROM public.profiles p
    WHERE p.user_id = p_student_user_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_status <> 'approved'
       OR v_role <> 'student'
       OR v_account_state <> 'active' THEN
        RAISE EXCEPTION 'Approved active student profile not found.'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT sp.price, sp.currency
    INTO v_plan_amount, v_currency
    FROM public.subscription_plans sp
    WHERE sp.id = p_plan_id
      AND sp.is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active subscription plan not found.'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_plan_amount IS NULL OR v_plan_amount < 0 THEN
        RAISE EXCEPTION 'Plan price must be zero or greater.'
            USING ERRCODE = '22023';
    END IF;

    -- The selected plan must include the course requested by the student.
    IF NOT EXISTS (
        SELECT 1
        FROM public.subscription_plan_courses pc
        JOIN public.course_catalog cc
          ON cc.course_slug = pc.course_slug
        WHERE pc.plan_id = p_plan_id
          AND cc.is_active = true
          AND (
              lower(trim(cc.title)) =
                  lower(trim(coalesce(v_requested_course, '')))
              OR lower(trim(cc.course_slug)) =
                  lower(trim(coalesce(v_requested_course, '')))
          )
    ) THEN
        RAISE EXCEPTION
            'Selected plan does not include the course requested by this student.'
            USING ERRCODE = '23514';
    END IF;

    -- Reject any pending/active/suspended subscription whose plan overlaps
    -- at least one course in the newly selected plan.
    IF EXISTS (
        SELECT 1
        FROM public.student_subscriptions existing_ss
        JOIN public.subscription_plan_courses existing_pc
          ON existing_pc.plan_id = existing_ss.plan_id
        JOIN public.subscription_plan_courses selected_pc
          ON selected_pc.course_slug = existing_pc.course_slug
        WHERE existing_ss.user_id = p_student_user_id
          AND existing_ss.status IN ('pending', 'active', 'suspended')
          AND selected_pc.plan_id = p_plan_id
    ) THEN
        RAISE EXCEPTION
            'Student already has a pending or active subscription covering an overlapping course.'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.student_subscriptions (
        user_id,
        plan_id,
        agreed_amount,
        currency,
        status,
        payment_state,
        assigned_by
    )
    VALUES (
        p_student_user_id,
        p_plan_id,
        v_plan_amount,
        v_currency,
        'pending',
        'unpaid',
        (SELECT auth.uid())
    )
    RETURNING id INTO v_subscription_id;

    IF nullif(trim(coalesce(p_admin_note, '')), '') IS NOT NULL THEN
        INSERT INTO public.subscription_admin_notes (
            subscription_id,
            note,
            updated_by
        )
        VALUES (
            v_subscription_id,
            p_admin_note,
            (SELECT auth.uid())
        );
    END IF;

    INSERT INTO public.membership_audit_log (
        actor_user_id,
        action_key,
        target_user_id,
        entity_type,
        entity_id,
        details
    )
    VALUES (
        (SELECT auth.uid()),
        'student.subscription.created',
        p_student_user_id,
        'student_subscription',
        v_subscription_id,
        jsonb_build_object(
            'plan_id', p_plan_id,
            'amount', v_plan_amount,
            'currency', v_currency,
            'requested_course', v_requested_course,
            'overlap_guard', true
        )
    );

    RETURN v_subscription_id;
END;
$function$;


-- --------------------------------------------------------------------------
-- 2) Activation guard: do not mark a paid/previously-paid subscription as
--    waived. A separate explicit refund/reconciliation must occur first.
--    This draft intentionally does not implement "waive only the remaining
--    balance after a partial payment"; that requires a ledger design.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_student_subscription_v2(
    p_subscription_id uuid,
    p_starts_at timestamp with time zone,
    p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_waive_fee boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_student uuid;
    v_payment_state text;
    v_plan_price numeric(12,2);
    v_duration_days integer;
    v_final_expiry timestamptz;
    v_current_status text;
    v_paid_total numeric(12,2);
BEGIN
    IF NOT membership_v2_private.is_admin() THEN
        RAISE EXCEPTION 'Only an active platform admin may activate subscriptions.'
            USING ERRCODE = '42501';
    END IF;

    IF p_starts_at IS NULL THEN
        RAISE EXCEPTION 'Subscription start date is required.'
            USING ERRCODE = '22023';
    END IF;

    SELECT
        ss.user_id,
        ss.payment_state,
        ss.status,
        ss.agreed_amount,
        sp.duration_days
    INTO
        v_student,
        v_payment_state,
        v_current_status,
        v_plan_price,
        v_duration_days
    FROM public.student_subscriptions ss
    JOIN public.subscription_plans sp
      ON sp.id = ss.plan_id
    WHERE ss.id = p_subscription_id
      AND sp.is_active = true
    FOR UPDATE OF ss;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending subscription or active plan not found.'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_current_status NOT IN ('pending', 'suspended') THEN
        RAISE EXCEPTION 'Only pending or suspended subscriptions can be activated.'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = v_student
          AND role = 'student'
          AND status = 'approved'
          AND account_state = 'active'
    ) THEN
        RAISE EXCEPTION 'Student must be approved and active before activation.'
            USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(sum(spay.amount), 0)
    INTO v_paid_total
    FROM public.subscription_payments spay
    WHERE spay.subscription_id = p_subscription_id
      AND spay.status = 'paid';

    IF (p_waive_fee OR v_plan_price = 0)
       AND (v_paid_total > 0 OR v_payment_state = 'paid') THEN
        RAISE EXCEPTION
            'Cannot waive a subscription that already has recorded paid transactions. Refund or reconcile payments first.'
            USING ERRCODE = '22023';
    END IF;

    IF p_waive_fee OR v_plan_price = 0 THEN
        v_payment_state := 'waived';
    ELSIF v_payment_state <> 'paid' THEN
        RAISE EXCEPTION 'The subscription must be fully paid before activation.'
            USING ERRCODE = '22023';
    END IF;

    v_final_expiry := coalesce(
        p_expires_at,
        CASE
            WHEN v_duration_days IS NOT NULL
            THEN p_starts_at + make_interval(days => v_duration_days)
            ELSE NULL
        END
    );

    IF v_final_expiry IS NOT NULL
       AND v_final_expiry <= p_starts_at THEN
        RAISE EXCEPTION 'Subscription expiry must be later than start.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.student_subscriptions
       SET status = 'active',
           payment_state = v_payment_state,
           starts_at = p_starts_at,
           expires_at = v_final_expiry,
           activated_at = coalesce(activated_at, now()),
           updated_at = now()
     WHERE id = p_subscription_id;

    INSERT INTO public.membership_audit_log (
        actor_user_id,
        action_key,
        target_user_id,
        entity_type,
        entity_id,
        details
    )
    VALUES (
        (SELECT auth.uid()),
        'student.subscription.activated',
        v_student,
        'student_subscription',
        p_subscription_id,
        jsonb_build_object(
            'starts_at', p_starts_at,
            'expires_at', v_final_expiry,
            'payment_state', v_payment_state,
            'paid_total', v_paid_total,
            'waiver_requested', p_waive_fee
        )
    );
END;
$function$;


-- --------------------------------------------------------------------------
-- 3) Payment precision: round once, validate the rounded value and store
--    that exact value. Do not use a positive tolerance that can admit a
--    stored amount above the remaining balance.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_subscription_payment_v3(
    p_subscription_id uuid,
    p_amount numeric,
    p_payment_method text DEFAULT 'manual'::text,
    p_payment_reference text DEFAULT ''::text,
    p_note text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_payment_id uuid;
    v_student uuid;
    v_currency text;
    v_due_amount numeric(12,2);
    v_total_paid numeric(12,2);
    v_new_total numeric(12,2);
    v_remaining_amount numeric(12,2);
    v_payment_amount numeric(12,2);
    v_subscription_status text;
BEGIN
    IF NOT membership_v2_private.is_admin() THEN
        RAISE EXCEPTION 'Only an active platform admin may record payments.'
            USING ERRCODE = '42501';
    END IF;

    IF p_amount IS NULL
       OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Payment amount must be a finite number.'
            USING ERRCODE = '22023';
    END IF;

    v_payment_amount := round(p_amount, 2);

    IF v_payment_amount <= 0 THEN
        RAISE EXCEPTION
            'Payment amount must be greater than zero after rounding to two decimals.'
            USING ERRCODE = '22023';
    END IF;

    SELECT
        ss.user_id,
        ss.currency,
        ss.agreed_amount,
        ss.status
    INTO
        v_student,
        v_currency,
        v_due_amount,
        v_subscription_status
    FROM public.student_subscriptions ss
    WHERE ss.id = p_subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found.'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_subscription_status NOT IN ('pending', 'active', 'suspended') THEN
        RAISE EXCEPTION 'Payments cannot be added to a cancelled or expired subscription.'
            USING ERRCODE = '22023';
    END IF;

    IF coalesce(v_due_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'This subscription has no amount due. It may be free or waived.'
            USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(sum(spay.amount), 0)
    INTO v_total_paid
    FROM public.subscription_payments spay
    WHERE spay.subscription_id = p_subscription_id
      AND spay.status = 'paid';

    v_remaining_amount := round(
        greatest(0, v_due_amount - v_total_paid),
        2
    );

    IF v_payment_amount > v_remaining_amount THEN
        RAISE EXCEPTION
            'Payment exceeds the remaining balance. Remaining amount: % %.',
            v_remaining_amount,
            v_currency
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.subscription_payments (
        subscription_id,
        student_user_id,
        amount,
        currency,
        payment_method,
        payment_reference,
        status,
        paid_at,
        recorded_by,
        note
    )
    VALUES (
        p_subscription_id,
        v_student,
        v_payment_amount,
        v_currency,
        coalesce(p_payment_method, 'manual'),
        coalesce(p_payment_reference, ''),
        'paid',
        now(),
        (SELECT auth.uid()),
        coalesce(p_note, '')
    )
    RETURNING id INTO v_payment_id;

    v_new_total := v_total_paid + v_payment_amount;

    UPDATE public.student_subscriptions
       SET payment_state = CASE
             WHEN v_new_total >= v_due_amount THEN 'paid'
             WHEN v_new_total > 0 THEN 'partial'
             ELSE 'unpaid'
           END,
           status = CASE
             WHEN status = 'active' AND v_new_total < v_due_amount
             THEN 'suspended'
             ELSE status
           END,
           updated_at = now()
     WHERE id = p_subscription_id;

    INSERT INTO public.membership_audit_log (
        actor_user_id,
        action_key,
        target_user_id,
        entity_type,
        entity_id,
        details
    )
    VALUES (
        (SELECT auth.uid()),
        'student.subscription.payment_recorded',
        v_student,
        'subscription_payment',
        v_payment_id,
        jsonb_build_object(
            'subscription_id', p_subscription_id,
            'amount', v_payment_amount,
            'total_paid', v_new_total,
            'due_amount', v_due_amount,
            'remaining_amount',
                greatest(0, round(v_due_amount - v_new_total, 2))
        )
    );

    RETURN v_payment_id;
END;
$function$;

COMMIT;

-- POST-APPLY CHECKS (run separately after a successful TEST deployment):
-- 1) Re-run the function metadata audit and confirm signatures/ACL/search_path.
-- 2) Test overlapping-plan rejection through direct create_student_subscription_v2.
-- 3) Test waiver rejection when a paid ledger row exists.
-- 4) Test tiny amount 0.004 rejection and regular two-decimal payment acceptance.
-- 5) Test payment amount greater than the remaining balance is rejected.
-- Do not run these tests against LIVE accounts or real subscription data.
