// SVM EdTech Admin: the billing rules in one place, with no database in it, so they can be tested on their own.
// server.js calls these for quotations, invoices, payments and renewals.

export const MODULE_LABELS = {
  fees: 'Fees management',
  attendance: 'Attendance',
  exams: 'Exams & results',
  accounting: 'Accounting',
  staff_basic: 'Staff directory & attendance',
  staff_payroll: 'Staff payroll',
  inventory: 'Inventory',
  hostel: 'Hostel',
  transport: 'Transport',
  library: 'Library',
  timetable_homework: 'Timetable & homework',
  communications: 'Notices & messages',
};
export const MODULE_KEYS = Object.keys(MODULE_LABELS);
export const PLAN_LABELS = {
  erp_selected_modules: 'School ERP, selected modules',
  erp_all_modules: 'School ERP, all modules',
  erp_all_modules_website: 'School ERP, all modules + school website',
};
// The five per-student plans on svmedtech.com (2026 price list). Older schools keep the three legacy plan types above.
export const TIER_LABELS = {
  starter: 'Starter (free up to 100 students)',
  basic: 'Basic',
  core: 'Core',
  complete: 'Complete',
  complete_website: 'Complete + Website',
};
export const TIER_KEYS = Object.keys(TIER_LABELS);
export const TIER_DEFAULTS = {
  starter: { rate: 0, min: 0, setupRate: 0, setupMin: 0 },
  basic: { rate: 30, min: 6000, setupRate: 30, setupMin: 4000 },
  core: { rate: 45, min: 9000, setupRate: 30, setupMin: 4000 },
  complete: { rate: 70, min: 18000, setupRate: 40, setupMin: 6000 },
  complete_website: { rate: 85, min: 25000, setupRate: 50, setupMin: 10000 },
};
// Which ERP modules each plan switches on (the school's ERP reads plan_modules).
const CORE_SET = ['fees', 'attendance', 'exams', 'communications'];

export const TIER_MODULES = {
  starter: ['fees', 'attendance', 'communications'],
  basic: CORE_SET,
  core: [...CORE_SET, 'timetable_homework', 'staff_basic'],
  complete: Object.keys(MODULE_LABELS),
  complete_website: Object.keys(MODULE_LABELS),
};
// Logins and apps each plan includes (the standard). A role not in the plan gets no login; connected screens disappear.
export const TIER_FEATURES = {
  starter:          { parentLogin: false, teacherLogin: false, parentApp: false, backups: 'weekly' },
  basic:            { parentLogin: true,  teacherLogin: false, parentApp: false, backups: 'weekly' },
  core:             { parentLogin: true,  teacherLogin: true,  parentApp: false, backups: 'nightly' },
  complete:         { parentLogin: true,  teacherLogin: true,  parentApp: true,  backups: 'nightly' },
  complete_website: { parentLogin: true,  teacherLogin: true,  parentApp: true,  backups: 'nightly' },
};
export const STARTER_FREE_LIMIT = 100;
export const LEGACY_PLAN_TYPES = Object.keys(PLAN_LABELS);
Object.assign(PLAN_LABELS, TIER_LABELS);
export const PLAN_TYPES = Object.keys(PLAN_LABELS);
export const isTier = p => TIER_KEYS.includes(p);

export const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Math.max(0, r2(v)));

// What admin stores in vendor_settings.billing_config. Every price is optional (null = not set yet).
export function defaultBillingConfig() {
  return {
    moduleYearly: Object.fromEntries(MODULE_KEYS.map(k => [k, null])),
    setupFees: { erp_selected_modules: null, erp_all_modules: null, erp_all_modules_website: null },
    tiers: JSON.parse(JSON.stringify(TIER_DEFAULTS)),
    gstEnabled: false,
    gstRate: 18,
    gstin: '',
    pan: '',
    quoteValidityDays: 15,
    dueDays: 15,
    terms: '',
  };
}

// Clean whatever the browser sent, so a bad value can never be stored.
export function cleanBillingConfig(input, current) {
  const base = Object.assign(defaultBillingConfig(), current || {});
  const i = input || {};
  const out = defaultBillingConfig();
  for (const k of MODULE_KEYS) out.moduleYearly[k] = i.moduleYearly && k in i.moduleYearly ? num(i.moduleYearly[k]) : (base.moduleYearly || {})[k] ?? null;
  for (const t of TIER_KEYS) {
    const bt = (base.tiers || {})[t] || TIER_DEFAULTS[t], it = (i.tiers || {})[t] || {};
    const pick = f => (f in it ? num(it[f]) : num(bt[f]));
    out.tiers[t] = { rate: pick('rate') ?? 0, min: pick('min') ?? 0, setupRate: pick('setupRate') ?? 0, setupMin: pick('setupMin') ?? 0 };
  }
  for (const p of LEGACY_PLAN_TYPES) out.setupFees[p] = i.setupFees && p in i.setupFees ? num(i.setupFees[p]) : (base.setupFees || {})[p] ?? null;
  out.gstEnabled = i.gstEnabled != null ? !!i.gstEnabled : !!base.gstEnabled;
  const rate = i.gstRate != null && i.gstRate !== '' ? Number(i.gstRate) : base.gstRate;
  out.gstRate = isNaN(rate) ? 18 : Math.min(28, Math.max(0, r2(rate)));
  out.gstin = String(i.gstin != null ? i.gstin : base.gstin || '').trim().toUpperCase().slice(0, 20);
  out.pan = String(i.pan != null ? i.pan : base.pan || '').trim().toUpperCase().slice(0, 12);
  const qv = i.quoteValidityDays != null && i.quoteValidityDays !== '' ? parseInt(i.quoteValidityDays, 10) : base.quoteValidityDays;
  out.quoteValidityDays = Math.min(180, Math.max(1, isNaN(qv) ? 15 : qv));
  const dd = i.dueDays != null && i.dueDays !== '' ? parseInt(i.dueDays, 10) : base.dueDays;
  out.dueDays = Math.min(180, Math.max(0, isNaN(dd) ? 15 : dd));
  out.terms = String(i.terms != null ? i.terms : base.terms || '').slice(0, 2000);
  return out;
}

// The legacy "transport_library" module means both; price it as both.
export function expandModules(mods) {
  const out = [];
  for (const m of Array.isArray(mods) ? mods : []) {
    if (m === 'transport_library') { out.push('transport', 'library'); continue; }
    if (MODULE_LABELS[m]) out.push(m);
  }
  return out.filter((m, i) => out.indexOf(m) === i);
}

// Lines for a school's plan: a one-time setup line and the yearly subscription.
// bundle = { all, allWebsite } are the two package prices (vendor_settings default_price_* columns).
// Anything with no price set is returned as a line with amount 0 and listed in `missing`, never guessed.
// Per-student plans: yearly = max(minimum, rate x students); setup likewise. Needs the student count.
export function tierAmounts(tier, students, cfg) {
  const t = Object.assign({}, TIER_DEFAULTS[tier], ((cfg || {}).tiers || {})[tier]);
  const n = Math.max(0, Math.floor(Number(students) || 0));
  return { students: n, yearly: r2(Math.max(t.min, t.rate * n)), setup: r2(Math.max(t.setupMin, t.setupRate * n)), t };
}
const inr = n => 'Rs ' + Math.round(n).toLocaleString('en-IN');

export function priceFor({ planType, planModules, cfg, bundle, includeSetup = true, includeSubscription = true, students }) {
  const c = Object.assign(defaultBillingConfig(), cfg || {});
  const lines = [], missing = [];
  const plan = PLAN_TYPES.includes(planType) ? planType : null;
  if (!plan) return { lines, missing: ['plan'], plan: null };
  if (isTier(plan)) {
    const n = Math.floor(Number(students) || 0);
    if (n < 1) return { lines, missing: ['number of students'], plan };
    if (plan === 'starter') {
      if (n > STARTER_FREE_LIMIT) return { lines, missing: ['Starter is free only up to ' + STARTER_FREE_LIMIT + ' students; choose a paid plan'], plan };
      return { lines, missing, plan };
    }
    const a = tierAmounts(plan, n, c), L = TIER_LABELS[plan];
    if (includeSetup) lines.push({ kind: 'setup', description: 'One-time setup and onboarding, ' + L + ' (' + n + ' students x ' + inr(a.t.setupRate) + ', minimum ' + inr(a.t.setupMin) + ')', qty: 1, rate: a.setup, amount: a.setup });
    if (includeSubscription) lines.push({ kind: 'subscription', description: 'Yearly subscription, ' + L + ' (' + n + ' students x ' + inr(a.t.rate) + ', minimum ' + inr(a.t.min) + ')', qty: 1, rate: a.yearly, amount: a.yearly });
    return { lines, missing, plan };
  }
  if (includeSetup) {
    const fee = (c.setupFees || {})[plan];
    if (fee == null) missing.push('setup fee');
    lines.push({ kind: 'setup', description: 'One-time setup and onboarding (' + PLAN_LABELS[plan] + ')', qty: 1, rate: fee == null ? 0 : fee, amount: fee == null ? 0 : fee });
  }
  if (includeSubscription) {
    if (plan === 'erp_selected_modules') {
      const mods = expandModules(planModules);
      if (!mods.length) missing.push('modules');
      for (const m of mods) {
        const p = (c.moduleYearly || {})[m];
        if (p == null) missing.push(MODULE_LABELS[m]);
        lines.push({ kind: 'subscription', module: m, description: MODULE_LABELS[m] + ', yearly subscription', qty: 1, rate: p == null ? 0 : p, amount: p == null ? 0 : p });
      }
    } else {
      const p = plan === 'erp_all_modules' ? (bundle || {}).all : (bundle || {}).allWebsite;
      const pn = p == null ? null : num(p);
      if (pn == null) missing.push('yearly package price');
      lines.push({ kind: 'subscription', description: 'Yearly subscription (' + PLAN_LABELS[plan] + ')', qty: 1, rate: pn == null ? 0 : pn, amount: pn == null ? 0 : pn });
    }
  }
  return { lines, missing, plan };
}

// Clean the lines a user typed or edited: only what is needed, amounts worked out here, never trusted from the browser.
export function cleanLines(lines) {
  const out = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const description = String((l && l.description) || '').trim().slice(0, 300);
    const qty = l && l.qty != null && l.qty !== '' ? Number(l.qty) : 1;
    const rate = l && l.rate != null && l.rate !== '' ? Number(l.rate) : 0;
    if (!description || isNaN(qty) || isNaN(rate) || qty <= 0 || rate < 0) continue;
    const kind = ['setup', 'subscription', 'other'].includes(l.kind) ? l.kind : 'other';
    out.push({ kind, module: l.module && MODULE_LABELS[l.module] ? l.module : undefined, description, qty: r2(qty), rate: r2(rate), amount: r2(qty * rate) });
  }
  return out;
}

// Totals for lines (or a single amount), a discount and GST. GST is worked out on what is left after the discount.
export function computeTotals({ lines, amount, discount, gstApplicable, gstRate }) {
  const hasLines = Array.isArray(lines) && lines.length > 0;
  const subtotal = hasLines ? r2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)) : r2(amount);
  const disc = Math.min(subtotal, Math.max(0, r2(discount)));
  const taxable = r2(subtotal - disc);
  const rate = gstApplicable && gstRate != null && !isNaN(Number(gstRate)) ? Number(gstRate) : 0;
  const gstAmount = gstApplicable ? r2(taxable * rate / 100) : 0;
  return { subtotal, discount: disc, taxable, gstAmount, total: r2(taxable + gstAmount) };
}

// Where an invoice stands, from what was paid. Cancelled invoices stay cancelled.
export function paymentStatus({ total, paid, status }) {
  if (status === 'cancelled') return 'cancelled';
  const t = r2(total), p = r2(paid);
  if (t > 0 && p >= t - 0.005) return 'paid';
  if (p > 0) return 'partial';
  return 'pending';
}
export function effectiveStatus({ status, dueDate, today }) {
  if ((status === 'pending' || status === 'partial') && dueDate && String(dueDate).slice(0, 10) < today) return 'overdue';
  return status;
}

const pad = n => String(n).padStart(2, '0');
export const isoDay = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); }
// One year of service: 1 Apr 2026 to 31 Mar 2027.
export function termEndForYear(startIso) {
  const d = new Date(startIso + 'T00:00:00Z');
  const day = d.getUTCDate(), month = d.getUTCMonth();
  const next = new Date(Date.UTC(d.getUTCFullYear() + 1, month, 1));
  const last = new Date(Date.UTC(next.getUTCFullYear(), month + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  next.setUTCDate(next.getUTCDate() - 1);
  return isoDay(next);
}
// A renewal starts the day after the current term ends, or today if the plan already lapsed (or never started).
export function nextTerm({ planValidUntil, today }) {
  const v = planValidUntil ? String(planValidUntil).slice(0, 10) : null;
  const start = v && v >= today ? addDays(v, 1) : today;
  return { termStart: start, termEnd: termEndForYear(start) };
}

// Indian-style amount in words for receipts, e.g. 12500 -> "Twelve Thousand Five Hundred Rupees Only".
export function amountInWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  const three = x => (x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const v = r2(n); let rupees = Math.floor(v); const paise = Math.round((v - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thou = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thou) parts.push(two(thou) + ' Thousand');
  if (rupees) parts.push(three(rupees));
  let words = parts.join(' ') + (parts.length ? ' Rupees' : '');
  if (paise) words += (parts.length ? ' and ' : '') + two(paise) + ' Paise';
  return words + ' Only';
}
