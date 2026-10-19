// Run: node screen.test.js   (Node 18+, no dependencies)
const assert = require('assert');
const rules = require('../data/eligibility-rules.json');
const { screen, limitFor } = require('../js/screen.js');
const get = (res, id) => res.find(r => r.program_id === id);
let passed = 0; const t = (name, fn) => { fn(); passed++; console.log('✓', name); };

t('limitFor extends tables with each_additional_person', () => {
  const g = rules.programs.find(p => p.id === 'snap_ma').rules.gross_limit_200;
  assert.strictEqual(limitFor(g, 1), 2660);
  assert.strictEqual(limitFor(g, 9), 9287 + 947);
});

t('MA single adult, $1,500/mo: SNAP, MassHealth, Lifeline, HEAP may qualify; no WIC', () => {
  const res = screen({ state: 'MA', household_size: 1, monthly_gross_income: 1500, age: 34 }, rules);
  ['snap_ma', 'masshealth', 'lifeline', 'liheap_ma', 'food_pantries_meals'].forEach(id => assert.strictEqual(get(res, id).result, 'may_qualify', id));
  assert.ok(!get(res, 'wic'));
  assert.ok(!get(res, 'snap_nh'));
});

t('MA single adult $3,000/mo: SNAP & MassHealth might-not-qualify (never "no"), HEAP may qualify', () => {
  const res = screen({ state: 'MA', household_size: 1, monthly_gross_income: 3000, age: 40 }, rules);
  assert.strictEqual(get(res, 'snap_ma').result, 'might_not_qualify_income');
  assert.match(get(res, 'snap_ma').message, /you can still apply/);
  assert.strictEqual(get(res, 'masshealth').result, 'might_not_qualify_income');
  assert.strictEqual(get(res, 'liheap_ma').result, 'may_qualify');
});

t('Lifeline categorical via SNAP even with high income', () => {
  const res = screen({ state: 'NH', household_size: 2, monthly_gross_income: 9000, receives: ['SNAP'] }, rules);
  assert.strictEqual(get(res, 'lifeline').result, 'may_qualify');
});

t('NH family of 3 at $4,000/mo with child under 5: SNAP (ECE 200%) + WIC + kids Medicaid may qualify; adult GA not', () => {
  const res = screen({ state: 'NH', household_size: 3, monthly_gross_income: 4000, age: 30, has_child_under_5: true }, rules);
  assert.strictEqual(get(res, 'snap_nh').result, 'may_qualify');      // 4442 limit
  assert.strictEqual(get(res, 'wic').result, 'may_qualify');          // 4212 limit
  assert.strictEqual(get(res, 'nh_medicaid').result, 'may_qualify');  // children 196% = 4463
});

t('Pregnant person counts the baby for WIC: 2 people + 1 baby at $4,100', () => {
  const res = screen({ state: 'MA', household_size: 2, monthly_gross_income: 4100, is_pregnant: true, age: 28 }, rules);
  assert.strictEqual(get(res, 'wic').result, 'may_qualify'); // size 3 -> $4,212
});

t('Elderly household over SNAP gross limit -> check_with_program (no gross test)', () => {
  const res = screen({ state: 'MA', household_size: 1, monthly_gross_income: 2900, age: 67 }, rules);
  assert.strictEqual(get(res, 'snap_ma').result, 'check_with_program');
});

t('NH Granite Advantage uses 133% + 5% disregard: single adult $1,830 may qualify, $1,900 might not', () => {
  const a = screen({ state: 'NH', household_size: 1, monthly_gross_income: 1830, age: 45 }, rules);
  assert.strictEqual(get(a, 'nh_medicaid').result, 'may_qualify');   // 1769 + 67 = 1836
  const b = screen({ state: 'NH', household_size: 1, monthly_gross_income: 1900, age: 45 }, rules);
  assert.strictEqual(get(b, 'nh_medicaid').result, 'might_not_qualify_income');
});

t('RAFT only shows with a housing crisis and never computes AMI', () => {
  assert.ok(!get(screen({ state: 'MA', household_size: 2, monthly_gross_income: 2000 }, rules), 'raft_ma'));
  const r = get(screen({ state: 'MA', household_size: 2, monthly_gross_income: 2000, housing_crisis: true }, rules), 'raft_ma');
  assert.strictEqual(r.result, 'check_with_program');
});

t('No result ever says a definite no', () => {
  const res = screen({ state: 'MA', household_size: 1, monthly_gross_income: 999999, age: 40, housing_crisis: true, experiencing_homelessness: true }, rules);
  res.forEach(r => { assert.ok(['may_qualify', 'might_not_qualify_income', 'check_with_program'].includes(r.result)); assert.doesNotMatch(r.message, /not eligible|denied|do not qualify/i); });
});

t('Out-of-area state returns a 211 referral', () => {
  const res = screen({ state: 'CT', household_size: 1, monthly_gross_income: 100 }, rules);
  assert.strictEqual(res[0].program_id, 'out_of_area');
});
console.log(`\n${passed} tests passed`);
