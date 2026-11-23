import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, '../assets/js/admin-subscriptions.js');
const source = readFileSync(sourcePath, 'utf8');

const match = source.match(
  /function paymentRemaining\\(subscriptionId\\)\\s*\\{[\\s\\S]*?\\n\\}/
);
assert.ok(match, 'paymentRemaining() must exist in admin-subscriptions.js');

const cases = [
  {
    name: 'waived subscription with a positive historical amount',
    state: {
      subscriptions: [{ id: 'waived', payment_state: 'waived', agreed_amount: 2500 }],
      payments: []
    },
    id: 'waived',
    expected: 0
  },
  {
    name: 'unpaid subscription',
    state: {
      subscriptions: [{ id: 'unpaid', payment_state: 'unpaid', agreed_amount: 2500 }],
      payments: []
    },
    id: 'unpaid',
    expected: 2500
  },
  {
    name: 'partially paid subscription',
    state: {
      subscriptions: [{ id: 'partial', payment_state: 'partial', agreed_amount: 2500 }],
      payments: [{ subscription_id: 'partial', status: 'paid', amount: 700 }]
    },
    id: 'partial',
    expected: 1800
  },
  {
    name: 'fully paid subscription',
    state: {
      subscriptions: [{ id: 'paid', payment_state: 'paid', agreed_amount: 2500 }],
      payments: [{ subscription_id: 'paid', status: 'paid', amount: 2500 }]
    },
    id: 'paid',
    expected: 0
  },
  {
    name: 'unknown subscription',
    state: { subscriptions: [], payments: [] },
    id: 'missing',
    expected: null
  }
];

for (const testCase of cases) {
  const actual = runInNewContext(
    `${match[0]}; paymentRemaining(${JSON.stringify(testCase.id)});`,
    { state: testCase.state }
  );
  assert.equal(actual, testCase.expected, testCase.name);
}

assert.match(
  source,
  /const payableSubs = usableSubs\\.filter\\(s => paymentRemaining\\(s\\.id\\) > 0\\);/,
  'The payment selector must exclude zero-balance (including waived) subscriptions.'
);

console.log(`PASS: ${cases.length} payment-balance cases and payable-selector integration.`);
