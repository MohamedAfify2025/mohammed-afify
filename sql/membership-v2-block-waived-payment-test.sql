-- ============================================================================
-- TEST-ONLY PATCH: block collections against waived subscriptions.
-- Source reviewed: MohammedAfify_V2_SCHEMA_ONLY.sql (PostgreSQL 17.11).
-- This migration changes one function body only; it does not alter table rows,
-- schema objects, RLS policies, grants, or existing payments.
--
-- Apply only to the isolated TEST project after schema restoration and review.
-- Do NOT apply to the source/production project in this phase.
-- CREATE OR REPLACE preserves the current signature, owner and ACL.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.record_subscription_payment_v3(p_subscription_id uuid, p_amount numeric, p_payment_method text DEFAULT 'manual'::text, p_payment_reference text DEFAULT ''::text, p_note text DEFAULT ''::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
    v_payment_state text;
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
        ss.status,
        ss.payment_state
    INTO
        v_student,
        v_currency,
        v_due_amount,
        v_subscription_status,
        v_payment_state
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

    IF v_payment_state = 'waived' THEN
        RAISE EXCEPTION 'Payments cannot be added to a waived subscription.'
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
$$;

COMMIT;

-- TEST acceptance:
-- A) payment_state='waived' with agreed_amount > 0 is rejected (SQLSTATE 22023).
-- B) unpaid/partial subscriptions with a valid balance still accept payment.
-- C) amount 0.004 remains rejected by the existing round(p_amount,2) check.
-- D) amounts above the remaining balance remain rejected.
-- E) authenticated retains EXECUTE; PUBLIC must not gain EXECUTE.
