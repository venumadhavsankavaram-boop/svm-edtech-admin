// Run: node tests/billing-logic.test.mjs
import assert from 'node:assert/strict';
import * as B from '../billing-logic.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

t('selected modules are priced one line per module, plus setup, and missing prices are reported not guessed', () => {
  const cfg = B.cleanBillingConfig({ moduleYearly: { fees: 4000, attendance: 2500 }, setupFees: { erp_selected_modules: 5000 } });
  const r = B.priceFor({ planType: 'erp_selected_modules', planModules: ['fees', 'attendance', 'hostel'], cfg });
  assert.equal(r.lines.length, 4);
  assert.deepEqual(r.lines.map(l => l.amount), [5000, 4000, 2500, 0]);
  assert.deepEqual(r.missing, ['Hostel']);
});
t('all-modules and website bundles use the package price and own setup fee', () => {
  const cfg = B.cleanBillingConfig({ setupFees: { erp_all_modules: 10000, erp_all_modules_website: 15000 } });
  const a = B.priceFor({ planType: 'erp_all_modules', cfg, bundle: { all: 30000, allWebsite: 38000 } });
  assert.deepEqual(a.lines.map(l => [l.kind, l.amount]), [['setup', 10000], ['subscription', 30000]]);
  const w = B.priceFor({ planType: 'erp_all_modules_website', cfg, bundle: { all: 30000, allWebsite: 38000 } });
  assert.deepEqual(w.lines.map(l => l.amount), [15000, 38000]);
  assert.deepEqual(B.priceFor({ planType: 'erp_all_modules', cfg: {}, bundle: {} }).missing, ['setup fee', 'yearly package price']);
});
t('renewal has no setup fee; the old combined transport_library module is priced as transport + library', () => {
  const cfg = B.cleanBillingConfig({ moduleYearly: { transport: 1500, library: 1000 } });
  const r = B.priceFor({ planType: 'erp_selected_modules', planModules: ['transport_library'], cfg, includeSetup: false });
  assert.deepEqual(r.lines.map(l => l.amount), [1500, 1000]);
});
t('unknown plan gives no lines', () => assert.deepEqual(B.priceFor({ planType: 'x' }).lines, []));
t('totals: discount first, then GST on what is left; GST off means total = amount', () => {
  const lines = B.cleanLines([{ description: 'A', qty: 1, rate: 10000, kind: 'setup' }, { description: 'B', qty: 2, rate: 2500, kind: 'subscription' }]);
  assert.equal(lines[1].amount, 5000);
  assert.deepEqual(B.computeTotals({ lines, discount: 1000, gstApplicable: false }), { subtotal: 15000, discount: 1000, taxable: 14000, gstAmount: 0, total: 14000 });
  assert.deepEqual(B.computeTotals({ lines, discount: 1000, gstApplicable: true, gstRate: 18 }), { subtotal: 15000, discount: 1000, taxable: 14000, gstAmount: 2520, total: 16520 });
  assert.equal(B.computeTotals({ amount: 999.995, gstApplicable: false }).total, 1000);
});
t('a discount can never push the total below zero', () => assert.equal(B.computeTotals({ amount: 500, discount: 900 }).total, 0));
t('bad lines are dropped (empty text, zero/negative numbers)', () => assert.equal(B.cleanLines([{ description: '', rate: 5 }, { description: 'x', qty: 0, rate: 5 }, { description: 'y', qty: 1, rate: -1 }, { description: 'ok', rate: 1 }]).length, 1));
t('payment status: pending, partial, paid; cancelled stays cancelled; overdue only while money is still owed', () => {
  assert.equal(B.paymentStatus({ total: 1000, paid: 0 }), 'pending');
  assert.equal(B.paymentStatus({ total: 1000, paid: 400 }), 'partial');
  assert.equal(B.paymentStatus({ total: 1000, paid: 1000 }), 'paid');
  assert.equal(B.paymentStatus({ total: 1000, paid: 999.996 }), 'paid');
  assert.equal(B.paymentStatus({ total: 1000, paid: 0, status: 'cancelled' }), 'cancelled');
  assert.equal(B.effectiveStatus({ status: 'partial', dueDate: '2026-01-01', today: '2026-02-01' }), 'overdue');
  assert.equal(B.effectiveStatus({ status: 'paid', dueDate: '2026-01-01', today: '2026-02-01' }), 'paid');
  assert.equal(B.effectiveStatus({ status: 'cancelled', dueDate: '2026-01-01', today: '2026-02-01' }), 'cancelled');
});
t('one year of service ends the day before the anniversary, including 29 Feb', () => {
  assert.equal(B.termEndForYear('2026-04-01'), '2027-03-31');
  assert.equal(B.termEndForYear('2026-11-17'), '2027-11-16');
  assert.equal(B.termEndForYear('2028-02-29'), '2029-02-27');
});
t('renewal starts the day after the current term ends, or today if it already lapsed', () => {
  assert.deepEqual(B.nextTerm({ planValidUntil: '2027-03-31', today: '2027-02-10' }), { termStart: '2027-04-01', termEnd: '2028-03-31' });
  assert.deepEqual(B.nextTerm({ planValidUntil: '2026-12-31', today: '2027-02-10' }), { termStart: '2027-02-10', termEnd: '2028-02-09' });
  assert.deepEqual(B.nextTerm({ planValidUntil: null, today: '2026-11-17' }), { termStart: '2026-11-17', termEnd: '2027-11-16' });
});
t('amount in words (Indian style)', () => {
  assert.equal(B.amountInWords(12500), 'Twelve Thousand Five Hundred Rupees Only');
  assert.equal(B.amountInWords(125000), 'One Lakh Twenty Five Thousand Rupees Only');
  assert.equal(B.amountInWords(10000000), 'One Crore Rupees Only');
  assert.equal(B.amountInWords(1234.5), 'One Thousand Two Hundred Thirty Four Rupees and Fifty Paise Only');
  assert.equal(B.amountInWords(0), 'Zero Rupees Only');
});
t('settings are cleaned: bad numbers ignored, GST limited, old values kept when a field is not sent', () => {
  const a = B.cleanBillingConfig({ moduleYearly: { fees: '4000', hostel: 'abc' }, gstRate: 99, gstin: ' 22aaaaa0000a1z5 ', quoteValidityDays: 0 });
  assert.equal(a.moduleYearly.fees, 4000); assert.equal(a.moduleYearly.hostel, null); assert.equal(a.gstRate, 28); assert.equal(a.gstin, '22AAAAA0000A1Z5'); assert.equal(a.quoteValidityDays, 1); assert.equal(a.gstEnabled, false);
  const b = B.cleanBillingConfig({ gstEnabled: true }, a);
  assert.equal(b.moduleYearly.fees, 4000); assert.equal(b.gstEnabled, true); assert.equal(b.gstin, '22AAAAA0000A1Z5');
});
t('per-student plans: yearly and setup = the larger of minimum and rate x students; Starter free to 100', () => {
  const cfg = B.cleanBillingConfig({});
  const a = B.priceFor({ planType: 'core', cfg, students: 120 });
  assert.deepEqual(a.lines.map(l => [l.kind, l.amount]), [['setup', 4000], ['subscription', 9000]]);
  const b = B.priceFor({ planType: 'complete_website', cfg, students: 500 });
  assert.deepEqual(b.lines.map(l => l.amount), [25000, 42500]);
  assert.deepEqual(B.priceFor({ planType: 'basic', cfg, students: 500, includeSetup: false }).lines.map(l => l.amount), [15000]);
  assert.deepEqual(B.priceFor({ planType: 'starter', cfg, students: 80 }).lines, []);
  assert.equal(B.priceFor({ planType: 'starter', cfg, students: 150 }).missing.length, 1);
  assert.deepEqual(B.priceFor({ planType: 'core', cfg }).missing, ['number of students']);
  assert.equal(B.cleanBillingConfig({ tiers: { basic: { rate: 35 } } }).tiers.basic.min, 6000);
  assert.equal(B.cleanBillingConfig({ tiers: { basic: { rate: 35 } } }).tiers.basic.rate, 35);
});
console.log('billing-logic: ' + n + ' passed');
