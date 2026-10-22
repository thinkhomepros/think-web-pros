// What customers are actually charged. The studio's Admin pricing lives in the owner's browser, so the server
// keeps its own copy of the prices and works out every total itself; a tampered cart can't lower the bill.
// Keep these in step with defaultAdmin() in web/js/app.js and the landing page prices.
export const CATALOG = {
  tiers: {
    starter: { name: 'Starter', setup: 299, monthly: 19, includes: [] },
    growth: { name: 'Growth', setup: 599, monthly: 39, includes: ['domain'] },
    pro: { name: 'Pro', setup: 1199, monthly: 79, includes: ['domain', 'seo', 'whitelabel', 'chat'] },
  },
  addons: {
    booking: { name: 'Online booking', price: 15, billing: 'monthly' },
    store: { name: 'Online store', price: 29, billing: 'monthly' },
    domain: { name: 'Custom domain & email', price: 8, billing: 'monthly' },
    seo: { name: 'SEO boost', price: 49, billing: 'monthly' },
    chat: { name: 'Live chat', price: 12, billing: 'monthly' },
    whitelabel: { name: 'Remove our badge', price: 5, billing: 'monthly' },
    logomaker: { name: 'AI logo package', price: 49, billing: 'once' },
    logo: { name: 'Logo by a designer', price: 149, billing: 'once' },
    copy: { name: 'Professional copywriting', price: 199, billing: 'once' },
    photos: { name: 'On-site photo shoot', price: 249, billing: 'once' },
  },
  pos: {
    'pos-lite': { name: 'POS Lite', price: 39 },
    'pos-pro': { name: 'POS Pro', price: 89 },
    'pos-multi': { name: 'POS Multi-location', price: 149 },
  },
  hardware: {
    reader: { name: 'Tap & chip card reader', price: 59 },
    terminal: { name: 'Countertop terminal', price: 299 },
    kit: { name: 'Register kit', price: 799 },
    kds: { name: 'Kitchen display', price: 399 },
  },
  storage: { name: 'Design storage', monthly: 20 },
};

const cents = (dollars) => Math.round(Number(dollars) * 100);

// Prices an order from the ids it names. Returns null when the order can't be priced yet (a custom quote).
// Lines are { name, amount (cents), recurring: boolean }; recurring lines bill every `interval`.
export function priceOrder(order, catalog = CATALOG) {
  const kind = order?.kind || 'order';
  if (kind === 'storage') {
    const s = catalog.storage;
    return summarize([{ name: s.name, amount: cents(s.monthly), recurring: true }], 'month');
  }
  if (kind === 'quote') return null;

  const tier = catalog.tiers[order.plan];
  if (!tier) throw Object.assign(new Error('unknown plan'), { code: 'bad_plan' });
  const annual = Boolean(order.annual);
  const per = (monthly) => cents(annual ? monthly * 10 : monthly);
  const lines = [
    { name: `${tier.name} plan`, amount: per(tier.monthly), recurring: true },
    { name: `${tier.name} site design`, amount: cents(tier.setup), recurring: false },
  ];
  const included = new Set(tier.includes);
  for (const id of new Set(Array.isArray(order.addons) ? order.addons : [])) {
    const a = catalog.addons[id];
    if (!a || included.has(id)) continue;
    lines.push(a.billing === 'once'
      ? { name: a.name, amount: cents(a.price), recurring: false }
      : { name: a.name, amount: per(a.price), recurring: true });
  }
  const pos = order.pos && catalog.pos[order.pos];
  if (pos) lines.push({ name: pos.name, amount: per(pos.price), recurring: true });
  for (const [id, qty] of Object.entries(order.hw || {})) {
    const h = catalog.hardware[id];
    const q = Math.min(Math.max(Math.floor(Number(qty) || 0), 0), 50);
    if (h && q) lines.push({ name: q > 1 ? `${h.name} × ${q}` : h.name, amount: cents(h.price) * q, recurring: false, quantity: q, unit: cents(h.price) });
  }
  return summarize(lines, annual ? 'year' : 'month');
}

// A quote Dustin has priced in Admin: a one-time amount and an optional monthly plan.
export function priceQuote({ setup = 0, monthly = 0, label = 'Custom website' } = {}) {
  const lines = [];
  if (setup > 0) lines.push({ name: `${label} design`, amount: cents(setup), recurring: false });
  if (monthly > 0) lines.push({ name: `${label} plan`, amount: cents(monthly), recurring: true });
  return lines.length ? summarize(lines, 'month') : null;
}

function summarize(lines, interval) {
  const recurring = lines.filter((l) => l.recurring).reduce((n, l) => n + l.amount, 0);
  const once = lines.filter((l) => !l.recurring).reduce((n, l) => n + l.amount, 0);
  // the first period is paid today along with the one-time items
  return { lines, interval, recurring, once, dueToday: once + recurring, currency: 'usd' };
}
