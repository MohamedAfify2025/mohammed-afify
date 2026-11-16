# UI patch — exclude waived subscriptions from collection

**File:** `assets/js/admin-subscriptions.js`  
**Target:** `paymentRemaining(subscriptionId)`

The current helper computes `agreed_amount - paid` without checking `payment_state`. Because the payment selector uses this helper to choose payable subscriptions, a waived subscription with a positive original agreed amount can still appear to have a balance.

Replace the existing helper with:

```javascript
function paymentRemaining(subscriptionId) {
  const sub = state.subscriptions.find(s => s.id === subscriptionId);
  if (!sub) return null;

  // Waived subscriptions have no collectible balance, regardless of
  // their original agreed_amount.
  if (sub.payment_state === 'waived') return 0;

  const paid = state.payments
    .filter(p => p.subscription_id === subscriptionId && p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return Math.max(
    0,
    Math.round((Number(sub.agreed_amount || 0) - paid) * 100) / 100
  );
}
```

## TEST acceptance checks

1. A waived subscription with `agreed_amount > 0` shows remaining balance `0`.
2. A waived subscription is omitted from `payableSubs`.
3. A partial subscription still shows its remaining balance.
4. An unpaid subscription still shows the agreed amount.
5. Direct RPC calls are rejected for waived subscriptions even when the browser is bypassed.

This is a proposed front-end patch only; do not deploy the production page before the TEST RPC checks pass.
