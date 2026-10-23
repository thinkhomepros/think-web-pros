import { randomUUID } from 'node:crypto';
import { ownerAuth, publicShop } from './accounts.js';
import { stockKey } from './db.js';
import { rateLimit } from './security.js';
import { trackingUrl } from './shipping.js';

/* ---------- live shops ----------
   An owner publishes their design: the server keeps it (shown at /s/<slug>), reads the products out of its store
   sections into a catalog with server-side prices, and starts stock counts for anything the owner counts.
   After that the server's counts are the real ones: online orders and the register both take from them.
   Shoppers order through POST /api/sites/:slug/orders; the price is always worked out here, never trusted
   from the browser. */

const num$ = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const hasV = (v) => String(v ?? '').trim() !== '';
const r2 = (n) => Math.round(n * 100) / 100;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// same as ORD_ST in web/js/app.js
export const ORDER_STATUSES = ['new', 'preparing', 'ready', 'shipped', 'done', 'cancelled'];

// Same rules as optList()/pOpts() in web/js/app.js: "Small, Large (+$4)".
function optList(str) {
  return String(str || '').split(',').map((v) => v.trim()).filter(Boolean).map((v) => {
    const m = v.match(/\(\s*\+\s*\$?([\d.]+)\s*\)/);
    return { label: v.replace(/\(\s*\+\s*\$?[\d.]+\s*\)/, '').trim(), add: m ? +m[1] : 0 };
  });
}
function pOpts(x) {
  const o = [];
  if (hasV(x.opt1) && hasV(x.opt1v)) o.push({ name: x.opt1, vals: optList(x.opt1v) });
  if (hasV(x.opt2) && hasV(x.opt2v)) o.push({ name: x.opt2, vals: optList(x.opt2v) });
  return o;
}

const STORE_KEYS = ['pickup', 'payLater', 'delivery', 'deliveryFee', 'deliveryArea', 'shipping', 'shipFee', 'freeOver', 'notice', 'codes', 'subOff'];
const STORE_SET = { pickup: 'yes', payLater: 'yes', delivery: 'no', deliveryFee: '$5', shipping: 'yes', shipFee: '$6', freeOver: '$75', notice: 0, codes: '', subOff: 10 };

function allSections(design) {
  const out = [];
  const seen = new Set();
  const add = (s) => {
    if (s && typeof s === 'object' && s.id && !seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  };
  for (const p of Array.isArray(design?.pages) ? design.pages : []) for (const s of p?.sections || []) add(s);
  for (const s of design?.sections || []) add(s);
  return out;
}

// Reads products and store settings out of a design. Each product keeps its own id; missing or repeated ids are
// replaced so every product (and its stock count) is distinct.
export function catalogFromDesign(design) {
  const products = [];
  const stores = {};
  const ids = new Set();
  for (const s of allSections(design)) {
    if (s.type !== 'shop' || s.hidden) continue;
    const d = s.data || {};
    stores[s.id] = Object.fromEntries(STORE_KEYS.map((k) => [k, d[k] === undefined ? STORE_SET[k] : d[k]]));
    (Array.isArray(d.items) ? d.items : []).forEach((x, k) => {
      if (!x || typeof x !== 'object') return;
      let id = typeof x.id === 'string' && /^[\w-]{1,64}$/.test(x.id) ? x.id : `${s.id}-${k}`;
      while (ids.has(id)) id += 'x';
      ids.add(id);
      const vstock = x.vstock && typeof x.vstock === 'object' ? Object.fromEntries(Object.entries(x.vstock).filter(([, n]) => hasV(n))) : {};
      products.push({
        id,
        sid: s.id,
        k,
        name: text(x.name, 120) || 'Product',
        price: num$(x.price),
        kind: ['item', 'box', 'gift'].includes(x.kind) ? x.kind : 'item',
        opts: pOpts(x),
        preorder: x.preorder === 'yes',
        lead: +x.lead || 0,
        sub: x.sub === 'yes',
        image: typeof x.image === 'string' && /^https:\/\//.test(x.image) ? x.image : null,
        // starting counts from the studio; only used for products the server isn't counting yet
        start: Object.keys(vstock).length ? Object.fromEntries(Object.entries(vstock).map(([v, n]) => [stockKey(id, v), Math.max(0, Math.floor(+n) || 0)])) : hasV(x.stock) ? { [id]: Math.max(0, Math.floor(+x.stock) || 0) } : {},
      });
    });
  }
  return { products, stores };
}

// One product's price for the options the shopper picked (named by label, like the cart's "M / Sage").
export function unitPrice(p, variant, plan, store) {
  const labels = String(variant || '').split(' / ');
  let price = p.price;
  if (p.kind === 'gift' && p.opts[0]) {
    const v = p.opts[0].vals.find((o) => o.label === labels[0]) || p.opts[0].vals[0];
    if (v && num$(v.label)) price = num$(v.label);
  } else {
    p.opts.forEach((g, i) => {
      const v = g.vals.find((o) => o.label === labels[i]) || g.vals[0];
      if (v) price += v.add;
    });
  }
  if (plan === 'sub' && p.sub) price *= 1 - (+store.subOff || 0) / 100;
  return r2(price);
}
// The variant label must be one this product really has, or the line is refused.
function variantOk(p, variant) {
  if (!p.opts.length) return !variant;
  const labels = String(variant || '').split(' / ');
  return labels.length === p.opts.length && p.opts.every((g, i) => g.vals.some((v) => v.label === labels[i]));
}

function codes(store) {
  const m = {};
  String(store.codes || '').split(/[\n,]+/).forEach((r) => {
    const [a, b] = r.split('=').map((x) => (x || '').trim());
    if (!a || !b) return;
    const k = a.toUpperCase();
    if (/free\s*ship/i.test(b)) m[k] = { ship: true };
    else if (/%/.test(b)) m[k] = { pct: num$(b) };
    else if (num$(b)) m[k] = { amt: num$(b) };
  });
  return m;
}

// Prices an order the same way the cart drawer shows it (spTotals in app.js), plus sales tax on goods.
export function priceShopOrder(catalog, input, { taxRate = 0 } = {}) {
  const lines = [];
  for (const l of Array.isArray(input?.lines) ? input.lines.slice(0, 100) : []) {
    const p = catalog.products.find((x) => x.id === l?.id);
    const qty = Math.floor(Number(l?.qty));
    if (!p) return { error: 'One of the items in your cart is no longer for sale. Please remove it and try again.' };
    if (!(qty > 0 && qty <= 999)) return { error: 'Please check the quantities in your cart.' };
    const variant = text(l.variant, 200);
    if (!variant && p.opts.length && p.kind !== 'gift') return { error: `Please choose options for ${p.name}.` };
    if (variant && !variantOk(p, variant)) return { error: `${p.name} doesn’t come in that option anymore.` };
    const plan = l.sub && p.sub ? 'sub' : 'once';
    const store = catalog.stores[p.sid] || STORE_SET;
    lines.push({ id: p.id, sid: p.sid, k: p.k, name: p.name, variant, opts: text(l.opts, 400), qty, unit: unitPrice(p, variant, plan, store), sub: plan === 'sub', every: plan === 'sub' ? text(l.every, 40) || 'Every week' : '', pre: p.preorder });
  }
  if (!lines.length) return { error: 'Your cart is empty.' };
  const store = catalog.stores[lines[0].sid] || STORE_SET;
  const methods = ['pickup', 'delivery', 'ship'].filter((m) => (m === 'ship' ? store.shipping : store[m]) === 'yes');
  const method = methods.includes(input.method) ? input.method : methods[0] || 'pickup';
  const subtotal = r2(lines.reduce((a, l) => a + l.unit * l.qty, 0));
  let fee = 0;
  if (method === 'delivery') fee = num$(store.deliveryFee);
  if (method === 'ship') fee = num$(store.freeOver) && subtotal >= num$(store.freeOver) ? 0 : num$(store.shipFee);
  const codeName = text(input.code, 40).toUpperCase();
  const code = codeName ? codes(store)[codeName] : null;
  let discount = 0;
  if (code) {
    if (code.pct) discount = (subtotal * code.pct) / 100;
    if (code.amt) discount = Math.min(subtotal, code.amt);
    if (code.ship && method !== 'pickup') fee = 0;
  }
  discount = r2(discount);
  const rate = Math.max(0, Math.min(20, Number(taxRate) || 0));
  const tax = r2(((subtotal - discount) * rate) / 100);
  return { lines, method, subtotal, discount, fee: r2(fee), tax, taxRate: rate, total: r2(Math.max(0, subtotal - discount + fee + tax)), code: code ? codeName : '', payLater: store.payLater === 'yes', store };
}

const ownerView = (o) => o;

// Money from orders that were paid (or are pay at pickup and not cancelled). Amounts in dollars.
export function salesReport(orders, days) {
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const r = { days, orders: 0, gross: 0, refunds: 0, tax: 0, fees: 0, tips: 0, net: 0, unpaid: 0, bySource: {}, byPay: {}, byDay: {} };
  for (const o of orders) {
    const pay = o.payment || {};
    if (pay.status === 'abandoned' || pay.status === 'failed') continue;
    if (o.status === 'cancelled' && !pay.refunded) continue;
    if (pay.status === 'unpaid') {
      r.unpaid += o.total;
      continue;
    }
    r.orders++;
    r.gross += o.total;
    r.refunds += pay.refunded || 0;
    r.tax += o.tax || 0;
    r.fees += o.fee || 0;
    r.tips += o.tip || 0;
    const src = o.source === 'pos' ? 'In store' : 'Website';
    r.bySource[src] = (r.bySource[src] || 0) + o.total - (pay.refunded || 0);
    const how = pay.paidWith || pay.method || 'card';
    r.byPay[how] = (r.byPay[how] || 0) + o.total - (pay.refunded || 0);
    r.byDay[day(o.at)] = (r.byDay[day(o.at)] || 0) + o.total - (pay.refunded || 0);
  }
  for (const k of ['gross', 'refunds', 'tax', 'fees', 'tips', 'unpaid']) r[k] = Math.round(r[k] * 100) / 100;
  r.net = Math.round((r.gross - r.refunds) * 100) / 100;
  return r;
}
// What a shopper may see about their own order.
export function shopperView(o) {
  if (!o) return null;
  const { id, no, at, name, method, when, lines, subtotal, discount, fee, tax, total, status, payment, shipping } = o;
  return { id, no, at, name, method, when, lines: lines.map(({ name: n, opts, qty, unit }) => ({ name: n, opts, qty, unit })), subtotal, discount, fee, tax, total, status, payment: payment && { status: payment.status, method: payment.method }, shipping: shipping && { carrier: shipping.carrier, tracking: shipping.tracking, trackingUrl: shipping.trackingUrl } };
}

export async function getShopBySlug(db, slug) {
  if (!/^[a-z0-9-]{1,60}$/.test(String(slug))) return null;
  const id = await db.get(`shop-slug:${slug}`);
  return id ? db.get(`shop:${id}`) : null;
}
export async function saveOrder(db, shopId, order) {
  await db.set(`shop:${shopId}:order:${order.id}`, order);
  await db.zadd(`shop:${shopId}:orders`, order.at, order.id);
  return order;
}
export async function updateOrder(db, shopId, id, change) {
  const o = await db.get(`shop:${shopId}:order:${id}`);
  if (!o) return null;
  const next = change(o) || o;
  next.updatedAt = Date.now();
  await db.set(`shop:${shopId}:order:${id}`, next);
  return next;
}
export async function updateShop(db, shopId, change) {
  const s = await db.get(`shop:${shopId}`);
  if (!s) return null;
  const next = change(s) || s;
  await db.set(`shop:${shopId}`, next);
  return next;
}

// A paid plan order turns on the shop whose owner used the same email.
export async function activateShopByEmail(db, email, note) {
  const userId = email ? await db.get(`user-email:${String(email).trim().toLowerCase()}`) : null;
  const user = userId ? await db.get(`user:${userId}`) : null;
  return user ? updateShop(db, user.shopId, (s) => ({ ...s, active: true, activatedBy: note })) : null;
}

/* hooks lets later stages (card payments, emails) join in without this file knowing them:
   hooks.checkout(shop, order, req) -> { url } to send the shopper to pay, or null to finish here
   hooks.placed(shop, order) runs after an order is saved (receipts, owner alerts); for card orders, once paid
   hooks.status(shop, order) runs when the owner changes an order's status
   hooks.emails is true when receipts are sent */
export function addShopRoutes(app, { db, counter, humanOnly = (req, res, next) => next(), hooks = {} }) {
  const owner = ownerAuth(db);
  const orderLimit = rateLimit(counter, 'shop-orders', [{ windowSec: 3600, max: 20 }, { windowSec: 86_400, max: 60 }], 'You’ve placed several orders already. Please wait a little and try again.');

  // publish: { design } -> the live address. Products named in the design become the shop's catalog.
  // A site goes online once its owner has a paid plan (or Admin turns the shop on).
  app.put('/api/shop/site', owner, async (req, res) => {
    if (!req.shop.active) return res.status(402).json({ code: 'plan_needed', error: 'Choose a plan to put your site online. Your design is saved with your order.' });
    const design = req.body?.design;
    if (!design || typeof design !== 'object' || !Array.isArray(design.sections)) return res.status(400).json({ error: 'design is required' });
    const catalog = catalogFromDesign(design);
    const [stock, before] = await Promise.all([db.getStock(req.shop.id), db.get(`shop:${req.shop.id}:catalog`)]);
    const add = {};
    for (const p of catalog.products) for (const [k, n] of Object.entries(p.start)) if (!(k in stock)) add[k] = n;
    // counts for website products (or sizes) that are gone stop being counted; the register's own items stay
    const keep = new Set(catalog.products.flatMap((p) => Object.keys(p.start)));
    const web = new Set((before?.products || []).map((p) => p.id).concat(catalog.products.map((p) => p.id)));
    for (const k of Object.keys(stock)) if (!keep.has(k) && web.has(k.split('|')[0])) add[k] = null;
    try {
      await db.set(`shop:${req.shop.id}:site`, design);
    } catch (err) {
      console.error('Site not stored:', err.message);
      return res.status(413).json({ error: 'Your site is too large to publish. Try smaller photos.' });
    }
    await db.set(`shop:${req.shop.id}:catalog`, catalog);
    if (Object.keys(add).length) await db.setStock(req.shop.id, add);
    const shop = await updateShop(db, req.shop.id, (s) => ({ ...s, published: { at: Date.now(), products: catalog.products.length } }));
    res.json({ shop: publicShop(shop), url: `/s/${shop.slug}`, stock: await db.getStock(req.shop.id) });
  });

  app.patch('/api/shop/settings', owner, async (req, res) => {
    const b = req.body || {};
    const shop = await updateShop(db, req.shop.id, (s) => {
      if (typeof b.name === 'string' && b.name.trim()) s.name = b.name.trim().slice(0, 80);
      if (b.taxRate !== undefined) s.taxRate = Math.max(0, Math.min(20, Number(b.taxRate) || 0));
      if (b.settings && typeof b.settings === 'object') s.settings = { ...(s.settings || {}), ...Object.fromEntries(Object.entries(b.settings).filter(([k, v]) => /^[a-zA-Z]{1,30}$/.test(k) && ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 500) : v])) };
      return s;
    });
    res.json({ shop: publicShop(shop) });
  });

  app.get('/api/shop/stock', owner, async (req, res) => res.json(await db.getStock(req.shop.id)));
  // { counts: { "<id>" | "<id>|<variant>": n | null } } sets what's on the shelf (null stops counting it)
  app.put('/api/shop/stock', owner, async (req, res) => {
    const counts = req.body?.counts;
    if (!counts || typeof counts !== 'object') return res.status(400).json({ error: 'counts is required' });
    const clean = Object.fromEntries(Object.entries(counts).slice(0, 2000).filter(([k]) => k.length <= 300).map(([k, n]) => [k, n == null || n === '' ? null : Math.max(0, Math.floor(Number(n)) || 0)]));
    await db.setStock(req.shop.id, clean);
    res.json(await db.getStock(req.shop.id));
  });

  app.get('/api/shop/orders', owner, async (req, res) => {
    const ids = await db.zrange(`shop:${req.shop.id}:orders`, { limit: Math.min(1000, Number(req.query.limit) || 500) });
    const orders = (await db.getMany(ids.map((id) => `shop:${req.shop.id}:order:${id}`))).filter(Boolean);
    res.json(orders.map(ownerView));
  });
  app.patch('/api/shop/orders/:id', owner, async (req, res) => {
    // { status } and/or { shipping: { carrier, tracking } } for a package the owner sent some other way
    const ship = req.body?.shipping && typeof req.body.shipping === 'object' ? req.body.shipping : null;
    const status = req.body?.status || (ship ? 'shipped' : undefined);
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
    if (ship && !String(ship.tracking || '').trim()) return res.status(400).json({ error: 'Add the tracking number.' });
    let putBack = null;
    let was = null;
    const o = await updateOrder(db, req.shop.id, req.params.id, (x) => {
      was = x.status;
      if (ship) {
        const carrier = String(ship.carrier || '').trim().slice(0, 40);
        const tracking = String(ship.tracking).trim().slice(0, 60);
        x.shipping = { ...(x.shipping || {}), carrier, tracking, trackingUrl: trackingUrl(carrier, tracking), at: Date.now() };
      }
      // cancelling puts the items back on the shelf, once
      if (status === 'cancelled' && x.status !== 'cancelled' && !x.stockReturned) {
        putBack = x.lines;
        x.stockReturned = true;
      }
      x.status = status;
      return x;
    });
    if (!o) return res.status(404).json({ error: 'not found' });
    if (putBack) await db.putStock(req.shop.id, putBack);
    // tell the shopper when it's ready, shipped or cancelled
    if (was !== status && hooks.status) hooks.status(req.shop, o).catch((err) => console.error('Status note failed:', err.message));
    res.json(o);
  });

  // money in and out: refunds (card refunds go back through Stripe), marking pay-at-pickup orders paid, and a report
  app.post('/api/shop/orders/:id/refund', owner, async (req, res) => {
    const o = await db.get(`shop:${req.shop.id}:order:${req.params.id}`);
    if (!o) return res.status(404).json({ error: 'not found' });
    const paid = ['paid', 'partly_refunded'].includes(o.payment?.status);
    if (!paid) return res.status(400).json({ error: 'This order hasn’t been paid, so there’s nothing to refund. Cancel it instead.' });
    const left = Math.round((o.total - (o.payment.refunded || 0)) * 100) / 100;
    const amount = req.body?.amount == null ? left : Math.round(Number(req.body.amount) * 100) / 100;
    if (!(amount > 0) || amount > left + 0.001) return res.status(400).json({ error: `Refund between $0.01 and $${left.toFixed(2)}.` });
    let refund = { amount, by: o.payment.method };
    if (o.payment.intent) {
      if (!hooks.refund) return res.status(503).json({ error: 'Card refunds aren’t switched on. Refund it from your Stripe dashboard.' });
      try {
        refund = { ...refund, ...(await hooks.refund(req.shop, o.payment.intent, Math.round(amount * 100))), amount };
      } catch (err) {
        console.error('Refund failed:', err.message);
        return res.status(502).json({ error: `Stripe didn’t refund it: ${err.message}` });
      }
    }
    const full = amount >= left - 0.001;
    let back = null;
    const next = await updateOrder(db, req.shop.id, o.id, (x) => {
      const refunded = Math.round(((x.payment.refunded || 0) + amount) * 100) / 100;
      x.payment = { ...x.payment, refunded, status: refunded >= x.total - 0.001 ? 'refunded' : 'partly_refunded', refunds: [...(x.payment.refunds || []), { at: Date.now(), amount, id: refund.id || null }] };
      if (full && req.body?.restock !== false && !x.stockReturned) {
        back = x.lines;
        x.stockReturned = true;
      }
      if (full) x.status = 'cancelled';
      return x;
    });
    if (back) await db.putStock(req.shop.id, back);
    if (full && hooks.status) hooks.status(req.shop, next).catch((err) => console.error('Status note failed:', err.message));
    res.json(next);
  });
  app.post('/api/shop/orders/:id/paid', owner, async (req, res) => {
    const method = ['cash', 'card', 'other'].includes(req.body?.method) ? req.body.method : 'cash';
    const o = await updateOrder(db, req.shop.id, req.params.id, (x) => {
      if (x.payment.status !== 'paid') x.payment = { ...x.payment, status: 'paid', paidWith: method, paidAt: Date.now() };
      return x;
    });
    o ? res.json(o) : res.status(404).json({ error: 'not found' });
  });
  // sales for the last N days: what came in, refunds, tax and delivery collected, by day and by where it was sold
  app.get('/api/shop/report', owner, async (req, res) => {
    const days = Math.max(1, Math.min(366, Number(req.query.days) || 30));
    const since = Date.now() - days * 86_400_000;
    const ids = await db.zrange(`shop:${req.shop.id}:orders`, { limit: 5000 });
    const orders = (await db.getMany(ids.map((id) => `shop:${req.shop.id}:order:${id}`))).filter((o) => o && o.at >= since);
    res.json(salesReport(orders, days));
  });

  /* public: the live site, its stock, and placing orders */
  app.get('/api/sites/:slug', async (req, res) => {
    const shop = await getShopBySlug(db, req.params.slug);
    const design = shop?.published ? await db.get(`shop:${shop.id}:site`) : null;
    if (!design) return res.status(404).json({ error: 'This site isn’t published yet.' });
    res.json({ shop: { name: shop.name, slug: shop.slug, taxRate: shop.taxRate || 0, cards: Boolean(shop.chargesEnabled) && Boolean(hooks.checkout), emails: Boolean(hooks.emails) }, design, stock: await db.getStock(shop.id) });
  });
  app.get('/api/sites/:slug/stock', async (req, res) => {
    const shop = await getShopBySlug(db, req.params.slug);
    if (!shop) return res.status(404).json({ error: 'not found' });
    res.json(await db.getStock(shop.id));
  });
  app.get('/api/sites/:slug/orders/:id', async (req, res) => {
    const shop = await getShopBySlug(db, req.params.slug);
    const o = shop && /^[0-9a-f-]{36}$/.test(req.params.id) ? await db.get(`shop:${shop.id}:order:${req.params.id}`) : null;
    o ? res.json(shopperView(o)) : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/sites/:slug/orders', orderLimit, humanOnly, async (req, res) => {
    const shop = await getShopBySlug(db, req.params.slug);
    const catalog = shop ? await db.get(`shop:${shop.id}:catalog`) : null;
    if (!catalog) return res.status(404).json({ error: 'This shop isn’t taking orders right now.' });
    const input = req.body?.order;
    if (!input || typeof input !== 'object') return res.status(400).json({ error: 'order is required' });
    if (typeof input.hp === 'string' && input.hp.trim()) return res.status(201).json({ id: randomUUID(), status: 'new' });
    const name = text(input.name, 100);
    const email = text(input.email, 254);
    if (!name || !EMAIL.test(email)) return res.status(400).json({ error: 'Add your name and a valid email.' });
    const priced = priceShopOrder(catalog, input, { taxRate: shop.taxRate });
    if (priced.error) return res.status(400).json({ error: priced.error });
    const addr = text(input.addr, 300);
    if (priced.method !== 'pickup' && !addr) return res.status(400).json({ error: 'Add the address for delivery.' });
    // pay at pickup only for pickup orders the shop allows it on; otherwise by card once the shop takes cards
    const cards = Boolean(shop.chargesEnabled && hooks.checkout);
    const canLater = priced.payLater && priced.method === 'pickup';
    const pay = input.pay === 'later' && canLater ? 'later' : cards ? 'card' : canLater ? 'later' : null;
    if (!pay) return res.status(400).json({ error: 'This shop isn’t taking online payments yet. Please call to order.' });

    const taken = await db.takeStock(shop.id, priced.lines);
    if (!taken.ok) {
      const s = taken.short[0];
      const p = priced.lines.find((l) => l.id === s.id && l.variant === s.variant);
      return res.status(409).json({ code: 'short', short: taken.short, error: s.have ? `Only ${s.have} ${p?.name || 'left'}${s.variant ? ` (${s.variant})` : ''} left. Please lower the amount.` : `${p?.name || 'An item'}${s.variant ? ` (${s.variant})` : ''} just sold out.` });
    }
    const no = await db.next(`shop:${shop.id}:order-no`, 1000);
    const order = {
      id: randomUUID(),
      no,
      at: Date.now(),
      shopId: shop.id,
      name,
      email,
      phone: text(input.phone, 40),
      addr,
      method: priced.method,
      date: /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : '',
      slot: text(input.slot, 20),
      when: text(input.when, 80),
      note: text(input.note, 1000),
      code: priced.code,
      lines: priced.lines.map(({ pre, ...l }) => l),
      subtotal: priced.subtotal,
      discount: priced.discount,
      fee: priced.fee,
      tax: priced.tax,
      taxRate: priced.taxRate,
      total: priced.total,
      status: 'new',
      source: 'web',
      payment: { method: pay, status: priced.total > 0 ? 'unpaid' : 'paid' },
    };
    await saveOrder(db, shop.id, order);
    let next = null;
    if (pay === 'card' && order.total > 0) {
      try {
        next = await hooks.checkout(shop, order, req);
      } catch (err) {
        console.error('Card checkout failed:', err.message);
        await db.putStock(shop.id, order.lines);
        await updateOrder(db, shop.id, order.id, (o) => ({ ...o, status: 'cancelled', stockReturned: true, payment: { ...o.payment, status: 'failed' } }));
        return res.status(502).json({ error: 'We couldn’t start the card payment. Please try again in a minute.' });
      }
    }
    if (!next && hooks.placed) hooks.placed(shop, order).catch((err) => console.error('Order follow-up failed:', err.message));
    res.status(201).json({ order: shopperView(order), pay: next });
  });
}
