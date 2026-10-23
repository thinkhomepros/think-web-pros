/* Register math, kept apart from the screens so the server tests can check it.
   All money is whole cents. A line's total = (price + options) × qty − line discount. The order discount is shared
   across lines by their size, tax is worked out on what is left of the taxable lines, and tips sit outside the
   total (they are on the tenders). */

export const uid = (p = '') => p + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).replace(/-/g, '').slice(0, 24);

export const fmt = (c, sign = false) => {
  const n = Math.round(Number(c) || 0);
  const s = (Math.abs(n) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−$' : sign && n > 0 ? '+$' : '$') + s;
};

// "$4.50", "From $65", "4", "12.5" -> cents. Text with no number ("Ask") -> null.
export function parsePrice(v) {
  if (typeof v === 'number') return Math.round(v * 100);
  const m = String(v ?? '').replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?|\.\d{1,2})/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}

export const unitWithMods = (l) => l.unit + (l.mods || []).reduce((a, m) => a + (m.add || 0), 0);
export const lineGross = (l) => unitWithMods(l) * l.qty;
export const lineNet = (l) => Math.max(0, lineGross(l) - (l.discount || 0));

// order discount: { kind: 'pct' | 'amt', value } (pct 0-100, amt in cents)
export function totals(lines, { discount = null, taxRate = 0 } = {}) {
  const nets = lines.map(lineNet);
  const sub = nets.reduce((a, b) => a + b, 0);
  let disc = 0;
  if (discount && discount.value > 0) disc = discount.kind === 'pct' ? Math.round((sub * Math.min(100, discount.value)) / 100) : Math.min(sub, Math.round(discount.value));
  // share the order discount across lines (largest remainder so the parts add up exactly)
  const shares = shareOut(disc, nets);
  const taxable = lines.reduce((a, l, i) => a + (l.taxable !== false ? nets[i] - shares[i] : 0), 0);
  const tax = Math.round((taxable * (Number(taxRate) || 0)) / 100);
  const lineDisc = lines.reduce((a, l) => a + Math.min(lineGross(l), l.discount || 0), 0);
  return { gross: sub + lineDisc, lineDiscount: lineDisc, subtotal: sub, discount: disc, shares, taxable, tax, total: sub - disc + tax, count: lines.reduce((a, l) => a + l.qty, 0) };
}

// Splits `amount` in proportion to `weights`, in whole cents that add up to amount.
export function shareOut(amount, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!amount || !total) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const out = raw.map(Math.floor);
  let left = amount - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}

export const tipFor = (base, pct) => Math.round((base * pct) / 100);

// Cash rounding to the nearest 5 cents (for shops that no longer use pennies).
export const roundCash = (c, on) => (on ? Math.round(c / 5) * 5 : c);

// Quick cash buttons: exact, then the next round bills above the amount.
export function cashSuggestions(due) {
  const out = [due];
  for (const step of [100, 500, 1000, 2000, 5000, 10000]) {
    const v = Math.ceil(due / step) * step;
    if (v > due && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 5);
}

export const paid = (tenders) => tenders.reduce((a, t) => a + t.amount, 0);
export const tipsOf = (tenders) => tenders.reduce((a, t) => a + (t.tip || 0), 0);

/* refunds */
// How many of each line can still be refunded.
export function refundableQty(sale) {
  const left = sale.lines.map((l) => Math.max(0, l.qty));
  for (const r of sale.refunds || []) for (const x of r.lines) if (left[x.index] != null) left[x.index] = Math.max(0, left[x.index] - x.qty);
  return left;
}
// What refunding `pick` ([{index, qty}]) gives back, including its share of the order discount and of the tax.
export function refundValue(sale, pick) {
  let amount = 0;
  let tax = 0;
  const t = totals(sale.lines, { discount: sale.discount ? { kind: 'amt', value: sale.discount } : null, taxRate: 0 });
  const taxableNet = sale.lines.reduce((a, l, i) => a + (l.taxable !== false ? lineNet(l) - t.shares[i] : 0), 0);
  for (const { index, qty } of pick) {
    const l = sale.lines[index];
    if (!l || !qty) continue;
    const per = (lineNet(l) - t.shares[index]) / l.qty;
    const part = Math.round(per * qty);
    amount += part;
    if (l.taxable !== false && taxableNet > 0) tax += Math.round((sale.tax * part) / taxableNet);
  }
  return { amount: amount + tax, tax };
}
// Sends money back to the tenders, card first (so the drawer is touched least), never more than each took.
export function refundTenders(sale, amount) {
  const given = {};
  for (const r of sale.refunds || []) for (const t of r.tenders) given[t.id || t.kind] = (given[t.id || t.kind] || 0) + t.amount;
  const order = [...sale.tenders].sort((a, b) => (a.kind === 'card' ? -1 : 0) - (b.kind === 'card' ? -1 : 0));
  const out = [];
  let left = amount;
  for (const t of order) {
    if (left <= 0) break;
    const room = t.amount - (given[t.id || t.kind] || 0);
    const take = Math.min(room, left);
    if (take > 0) {
      out.push({ id: t.id, kind: t.kind, label: t.label, amount: take, ref: t.ref, practice: t.practice, brand: t.brand, last4: t.last4 });
      left -= take;
    }
  }
  if (left > 0) out.push({ kind: 'cash', label: 'Cash', amount: left });
  return out;
}

/* drawer */
export const DENOMS = [
  ['$100', 10000], ['$50', 5000], ['$20', 2000], ['$10', 1000], ['$5', 500], ['$1', 100],
  ['Quarters', 25], ['Dimes', 10], ['Nickels', 5], ['Pennies', 1],
];
export const countDenoms = (counts) => DENOMS.reduce((a, [k, v]) => a + (Math.max(0, Math.trunc(+counts[k]) || 0) * v), 0);

// Cash that should be in the drawer: starting cash + cash taken (including cash tips) − change is already netted
// because a cash tender's amount is what it paid − pay outs and cash refunds + pay ins − drops.
export function drawerExpected(shift, sales, refunds) {
  let cash = shift.openCash;
  for (const s of sales) for (const t of s.tenders) if (t.kind === 'cash') cash += t.amount + (t.tip || 0);
  for (const r of refunds) for (const t of r.tenders) if (t.kind === 'cash') cash -= t.amount;
  for (const e of shift.events || []) cash += e.kind === 'in' ? e.amount : -e.amount;
  return cash;
}

/* end of day */
export function dayReport({ sales = [], refunds = [], shifts = [], clock = [], catalog = { items: [] } }) {
  const r = {
    count: 0, gross: 0, discounts: 0, net: 0, tax: 0, tips: 0, collected: 0, refunds: 0, refundCount: 0, refundTax: 0,
    tenders: {}, items: {}, cats: {}, staff: {}, hours: Array(24).fill(0), types: {}, practice: 0, offline: 0,
  };
  const cat = new Map((catalog.items || []).map((i) => [i.id, i.cat || 'Other']));
  for (const s of sales) {
    r.count++;
    r.gross += s.subtotal + (s.lines || []).reduce((a, l) => a + Math.min(lineGross(l), l.discount || 0), 0);
    r.discounts += s.discount + (s.lines || []).reduce((a, l) => a + Math.min(lineGross(l), l.discount || 0), 0);
    r.tax += s.tax;
    r.tips += s.tip || 0;
    if (s.offline) r.offline++;
    for (const t of s.tenders) {
      const k = tenderName(t);
      const e = (r.tenders[k] = r.tenders[k] || { count: 0, amount: 0, tips: 0, refunds: 0 });
      e.count++;
      e.amount += t.amount;
      e.tips += t.tip || 0;
      if (t.practice) r.practice += t.amount + (t.tip || 0);
    }
    for (const l of s.lines) {
      const it = (r.items[l.name] = r.items[l.name] || { qty: 0, amount: 0 });
      it.qty += l.qty;
      it.amount += lineNet(l);
      const c = cat.get(l.itemId) || 'Other';
      r.cats[c] = (r.cats[c] || 0) + lineNet(l);
    }
    const who = s.staffName || 'Unknown';
    const st = (r.staff[who] = r.staff[who] || { count: 0, amount: 0, tips: 0, hours: 0 });
    st.count++;
    st.amount += s.total;
    st.tips += s.tip || 0;
    r.hours[new Date(s.at).getHours()] += s.total;
    r.types[s.type || 'here'] = (r.types[s.type || 'here'] || 0) + 1;
  }
  for (const f of refunds) {
    r.refundCount++;
    r.refunds += f.amount;
    r.refundTax += f.tax || 0;
    for (const t of f.tenders) {
      const k = tenderName(t);
      const e = (r.tenders[k] = r.tenders[k] || { count: 0, amount: 0, tips: 0, refunds: 0 });
      e.refunds += t.amount;
    }
  }
  r.net = r.gross - r.discounts - (r.refunds - r.refundTax);
  r.collected = Object.values(r.tenders).reduce((a, t) => a + t.amount + t.tips - t.refunds, 0);
  r.avg = r.count ? Math.round(sales.reduce((a, s) => a + s.total, 0) / r.count) : 0;
  r.topItems = Object.entries(r.items).sort((a, b) => b[1].amount - a[1].amount);
  r.shifts = shifts;
  r.clock = clock;
  for (const c of clock) {
    const who = c.staffName || 'Unknown';
    const st = (r.staff[who] = r.staff[who] || { count: 0, amount: 0, tips: 0, hours: 0 });
    st.hours += Math.max(0, ((c.out || Date.now()) - c.in) / 3600000);
  }
  return r;
}

export function tenderName(t) {
  if (t.kind === 'card') return t.practice ? 'Card (practice)' : 'Card';
  if (t.kind === 'cash') return 'Cash';
  return t.label || 'Other';
}

/* products from the website designer
   The studio keeps its design in this browser (localStorage 'twp-studio-v3'). Online store products, food menu
   dishes and priced services become register items. Store options like "Size: S, M, L" become variants (stock is
   kept per variant, the same "M / Sage" labels the online store uses); "(+$1)" in an option adds to the price. */
export function itemsFromStudio(saved) {
  const st = saved?.state;
  if (!st) return { name: '', items: [] };
  const secs = [];
  const seen = new Set();
  const add = (s) => { if (s && !seen.has(s.id)) { seen.add(s.id); secs.push(s); } };
  (st.pages || []).forEach((p) => (p.sections || []).forEach(add));
  (st.sections || []).forEach(add);
  const items = [];
  const stock = {};
  const opt = (name, vals, variant) => ({
    name: String(name).trim(),
    variant,
    multi: false,
    vals: String(vals).split(',').map((v) => v.trim()).filter(Boolean).map((v) => {
      const m = v.match(/\(\s*\+\s*\$?([\d.]+)\s*\)/);
      return { label: v.replace(/\(\s*\+\s*\$?[\d.]+\s*\)/, '').trim(), add: m ? Math.round(parseFloat(m[1]) * 100) : 0 };
    }),
  });
  for (const s of secs) {
    const list = s.data?.items || [];
    list.forEach((x, k) => {
      // same ids the server gives published products (catalogFromDesign in server/shop.js), so stock lines up
      const id = typeof x.id === 'string' && /^[\w-]{1,64}$/.test(x.id) ? x.id : `${s.id}-${k}`;
      const image = typeof x.image === 'string' && /^https:\/\//.test(x.image) ? x.image : '';
      if (s.type === 'shop') {
        const price = parsePrice(x.price);
        if (price == null || x.kind === 'gift') return;
        const opts = [];
        if (x.opt1 && x.opt1v) opts.push(opt(x.opt1, x.opt1v, true));
        if (x.opt2 && x.opt2v) opts.push(opt(x.opt2, x.opt2v, true));
        const hasVs = x.vstock && typeof x.vstock === 'object' && Object.values(x.vstock).some((n) => n !== '' && n != null);
        const track = hasVs || String(x.stock ?? '').trim() !== '';
        if (hasVs) for (const [vk, n] of Object.entries(x.vstock)) { if (n !== '' && n != null) stock[`${id}|${vk}`] = +n || 0; }
        else if (track) stock[id] = +x.stock || 0;
        items.push({ id, name: x.name, price, cat: x.collection || s.data.heading || 'Store', image, opts, track, taxable: true, kitchen: false, shop: true, src: { sid: s.id, k } });
      } else if (s.type === 'menu') {
        const price = parsePrice(x.price);
        if (price == null) return;
        items.push({ id, name: x.name, price, cat: x.cat || 'Menu', image, opts: [], track: false, taxable: true, kitchen: true, src: { sid: s.id, k } });
      } else if (s.type === 'services') {
        const price = parsePrice(x.price);
        if (price == null) return;
        items.push({ id, name: x.title || x.name, price, cat: s.data.heading || 'Services', image, opts: [], track: false, taxable: true, kitchen: false, src: { sid: s.id, k } });
      }
    });
  }
  return { name: st.brand?.name || '', items, stock };
}

// Variant label in the same form as the online store's vstock keys: "M / Sage"
export const variantLabel = (item, picks) => item.opts.filter((g) => g.variant).map((g) => picks[g.name]).filter(Boolean).join(' / ');

export const stockKey = (itemId, variant) => (variant ? `${itemId}|${variant}` : itemId);

// Stock left for an item (or variant) after what is already in the cart; null when not tracked.
export function stockLeft(item, variant, stock, cart = []) {
  if (!item.track) return null;
  const hasVariants = item.opts.some((g) => g.variant);
  if (hasVariants && !variant) {
    const keys = Object.keys(stock).filter((k) => k.startsWith(`${item.id}|`));
    if (!keys.length) return null;
    return keys.reduce((a, k) => a + stock[k], 0) - cart.filter((l) => l.itemId === item.id).reduce((a, l) => a + l.qty, 0);
  }
  const k = stockKey(item.id, hasVariants ? variant : '');
  if (stock[k] == null) return null;
  return stock[k] - cart.filter((l) => l.itemId === item.id && (!hasVariants || l.variant === variant)).reduce((a, l) => a + l.qty, 0);
}

export const localDay = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
