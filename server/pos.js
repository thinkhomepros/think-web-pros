import { createHash, pbkdf2Sync, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ownerAuth } from './accounts.js';
import { stockKey } from './db.js';
import { saveOrder, updateShop } from './shop.js';

/* ---------- POS register ----------
   The in-person register (/pos), the kitchen screen (/kitchen) and the server they share.
   - The owner signs in once on the device with their Think Web Pros account (accounts.js) and picks a PIN. The
     device gets its own device key (kept on the device, sent as a Bearer token), so the owner's password and login
     are never stored on a shared tablet. More registers and kitchen screens join with a 6-digit pairing code made on
     a register by a manager, the way Square and Toast pair devices.
   - Products and stock are the shop's own (shop.js, db.js): the products published from the website design, plus
     items that are only sold at the counter (a food menu, services, a custom list). Both online orders and register
     sales take from the same stock counts. Each register sale is also saved as a shop order (source 'pos') so it
     shows in the owner's Store panel next to online orders.
   - Staff sign in on the register with a PIN. PINs are kept as PBKDF2 hashes, and registers keep a copy so staff can
     still sign in while the internet is down. A server staff key (X-Staff-Key) is needed for manager and owner calls.
   - Sales are made on the register first and sent here when there is a connection (POST /api/pos/sync). Sending the
     same sale twice does nothing, so the register can retry freely. Each new sale takes its items out of stock and,
     when the shop uses the kitchen screen, becomes a kitchen ticket.
   - Card payments go through Stripe Terminal (terminal.js). Without STRIPE_SECRET_KEY the register offers a practice
     reader that approves every card, marked "practice" on the receipt and in reports.
   Money is whole cents everywhere. */

export const ROLES = ['cashier', 'manager', 'owner'];
const rank = (role) => ROLES.indexOf(role);
const PIN = /^\d{4,8}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{6,64}$/;
export const PIN_ROUNDS = 60000;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const newKey = () => randomBytes(32).toString('base64url');
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cents = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const ok = (v, re) => typeof v === 'string' && re.test(v);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: pbkdf2Sync(String(pin), salt, PIN_ROUNDS, 32, 'sha256').toString('hex') };
}
export function checkPin(pin, staff) {
  if (!staff?.salt || !staff?.hash || !PIN.test(String(pin))) return false;
  const a = Buffer.from(hashPin(pin, staff.salt).hash, 'hex');
  const b = Buffer.from(staff.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const DEFAULT_SETTINGS = {
  tipsOn: true,
  tipPresets: [15, 20, 25],
  cashierMaxDiscount: 10, // percent a cashier can give without a manager
  kitchenOn: false,
  receiptFooter: 'Thank you!',
  address: '',
  phone: '',
};

function cleanSettings(input = {}, base = DEFAULT_SETTINGS) {
  const s = { ...base };
  if (input.tipsOn !== undefined) s.tipsOn = Boolean(input.tipsOn);
  if (Array.isArray(input.tipPresets)) s.tipPresets = input.tipPresets.map((n) => Math.min(100, Math.max(0, Math.round(+n) || 0))).filter((n) => n > 0).slice(0, 4);
  if (input.cashierMaxDiscount !== undefined) s.cashierMaxDiscount = Math.min(100, Math.max(0, Math.round(+input.cashierMaxDiscount) || 0));
  if (input.kitchenOn !== undefined) s.kitchenOn = Boolean(input.kitchenOn);
  for (const f of ['receiptFooter', 'address', 'phone']) if (input[f] !== undefined) s[f] = str(input[f], 300);
  return s;
}

// Catalog items as the register uses them. Variant stock is counted per "Size / Color" label, like the online store.
export function cleanItem(x) {
  if (!x || typeof x !== 'object') return null;
  const name = str(x.name, 120);
  if (!name) return null;
  const opts = (Array.isArray(x.opts) ? x.opts : []).slice(0, 6).map((g) => ({
    name: str(g?.name, 60) || 'Option',
    multi: Boolean(g?.multi),
    variant: Boolean(g?.variant),
    vals: (Array.isArray(g?.vals) ? g.vals : []).slice(0, 30).map((v) => ({ label: str(v?.label, 60), add: cents(v?.add) })).filter((v) => v.label),
  })).filter((g) => g.vals.length);
  return {
    id: ok(x.id, /^[\w-]{1,64}$/) ? x.id : randomUUID(),
    name,
    price: Math.max(0, cents(x.price)),
    cat: str(x.cat, 60),
    color: str(x.color, 20),
    image: typeof x.image === 'string' && /^(https:\/\/|\/)/.test(x.image) && x.image.length < 2000 ? x.image : '',
    sku: str(x.sku, 64),
    barcode: str(x.barcode, 64),
    taxable: x.taxable !== false,
    kitchen: Boolean(x.kitchen),
    track: Boolean(x.track),
    hidden: Boolean(x.hidden),
    opts,
    src: x.src && typeof x.src === 'object' ? { sid: str(x.src.sid, 64), k: Math.max(0, Math.trunc(+x.src.k) || 0) } : null,
  };
}

// A register sale or refund moves stock with the same counts the online store uses. A sale that has already
// happened at the counter is never refused: if a count is lower than what was sold, it goes to 0 (and the owner
// sees the miscount in inventory).
export async function sellStock(db, shopId, lines) {
  const L = lines.filter((l) => l.itemId && l.qty > 0).map((l) => ({ id: l.itemId, variant: l.variant || '', qty: l.qty }));
  if (!L.length) return;
  const taken = await db.takeStock(shopId, L);
  if (taken.ok) return;
  const short = new Set(taken.short.map((x) => stockKey(x.id, x.variant)));
  await db.setStock(shopId, Object.fromEntries(taken.short.map((x) => [stockKey(x.id, x.variant), 0])));
  const rest = L.filter((l) => !short.has(stockKey(l.id, l.variant)));
  if (rest.length) await sellStock(db, shopId, rest.map((l) => ({ itemId: l.id, variant: l.variant, qty: l.qty })));
}

// The shop's published products as register items (prices in cents, options as variants with their own stock).
export function itemsFromCatalog(catalog) {
  return (catalog?.products || []).filter((p) => p.kind === 'item').map((p) => ({
    id: p.id,
    name: p.name,
    price: Math.round((Number(p.price) || 0) * 100),
    cat: p.collection || 'Store',
    color: '',
    image: p.image || '',
    sku: '',
    barcode: '',
    taxable: true,
    kitchen: false,
    track: Object.keys(p.start || {}).length > 0,
    hidden: false,
    online: true,
    opts: (p.opts || []).map((g) => ({ name: g.name, multi: false, variant: true, vals: g.vals.map((v) => ({ label: v.label, add: Math.round((Number(v.add) || 0) * 100) })) })),
  }));
}
const OVERRIDE = ['cat', 'color', 'barcode', 'kitchen', 'hidden', 'taxable'];

function cleanLine(l) {
  return {
    itemId: str(l?.itemId, 64),
    name: str(l?.name, 160) || 'Item',
    qty: Math.max(-999, Math.min(999, Math.trunc(+l?.qty) || 1)),
    unit: cents(l?.unit),
    mods: (Array.isArray(l?.mods) ? l.mods : []).slice(0, 20).map((m) => ({ label: str(m?.label, 60), add: cents(m?.add) })),
    variant: str(l?.variant, 120),
    note: str(l?.note, 200),
    discount: Math.max(0, cents(l?.discount)),
    taxable: l?.taxable !== false,
    kitchen: Boolean(l?.kitchen),
    total: cents(l?.total),
  };
}

const TENDERS = ['card', 'cash', 'other'];
function cleanTender(t) {
  return {
    id: str(t?.id, 64),
    kind: TENDERS.includes(t?.kind) ? t.kind : 'other',
    label: str(t?.label, 40),
    amount: cents(t?.amount),
    tip: Math.max(0, cents(t?.tip)),
    given: Math.max(0, cents(t?.given)),
    change: Math.max(0, cents(t?.change)),
    ref: str(t?.ref, 80),
    brand: str(t?.brand, 20),
    last4: str(t?.last4, 4),
    practice: Boolean(t?.practice),
  };
}

export function cleanSale(s) {
  if (!s || typeof s !== 'object' || !ok(s.id, SAFE_ID)) return null;
  const lines = (Array.isArray(s.lines) ? s.lines : []).slice(0, 300).map(cleanLine);
  if (!lines.length) return null;
  return {
    id: s.id,
    no: str(s.no, 20),
    at: Number.isFinite(+s.at) ? +s.at : Date.now(),
    day: ok(s.day, DAY) ? s.day : new Date().toISOString().slice(0, 10),
    deviceId: str(s.deviceId, 64),
    staffId: str(s.staffId, 64),
    staffName: str(s.staffName, 80),
    shiftId: str(s.shiftId, 64),
    type: ['here', 'togo', 'pickup', 'delivery'].includes(s.type) ? s.type : 'here',
    ticket: str(s.ticket, 60),
    customer: { name: str(s.customer?.name, 100), email: str(s.customer?.email, 254), phone: str(s.customer?.phone, 30) },
    note: str(s.note, 300),
    lines,
    subtotal: cents(s.subtotal),
    discount: Math.max(0, cents(s.discount)),
    discountLabel: str(s.discountLabel, 60),
    tax: Math.max(0, cents(s.tax)),
    tip: Math.max(0, cents(s.tip)),
    total: cents(s.total),
    tenders: (Array.isArray(s.tenders) ? s.tenders : []).slice(0, 20).map(cleanTender),
    refunds: [],
    offline: Boolean(s.offline),
  };
}

export function cleanRefund(r) {
  if (!r || typeof r !== 'object' || !ok(r.id, SAFE_ID) || !ok(r.saleId, SAFE_ID)) return null;
  return {
    id: r.id,
    saleId: r.saleId,
    at: Number.isFinite(+r.at) ? +r.at : Date.now(),
    day: ok(r.day, DAY) ? r.day : new Date().toISOString().slice(0, 10),
    staffId: str(r.staffId, 64),
    staffName: str(r.staffName, 80),
    approvedBy: str(r.approvedBy, 80),
    reason: str(r.reason, 200),
    lines: (Array.isArray(r.lines) ? r.lines : []).slice(0, 300).map((l) => ({ index: Math.max(0, Math.trunc(+l?.index) || 0), qty: Math.max(0, Math.trunc(+l?.qty) || 0) })),
    amount: Math.max(0, cents(r.amount)),
    tax: Math.max(0, cents(r.tax)),
    tenders: (Array.isArray(r.tenders) ? r.tenders : []).slice(0, 20).map(cleanTender),
    restock: Boolean(r.restock),
    shiftId: str(r.shiftId, 64),
  };
}

function cleanShift(s) {
  if (!s || typeof s !== 'object' || !ok(s.id, SAFE_ID)) return null;
  return {
    id: s.id,
    deviceId: str(s.deviceId, 64),
    deviceName: str(s.deviceName, 60),
    day: ok(s.day, DAY) ? s.day : new Date().toISOString().slice(0, 10),
    openedAt: +s.openedAt || Date.now(),
    openedBy: str(s.openedBy, 80),
    openCash: Math.max(0, cents(s.openCash)),
    events: (Array.isArray(s.events) ? s.events : []).slice(0, 500).map((e) => ({ kind: ['in', 'out', 'drop'].includes(e?.kind) ? e.kind : 'in', amount: Math.max(0, cents(e?.amount)), note: str(e?.note, 120), at: +e?.at || Date.now(), by: str(e?.by, 80) })),
    closedAt: +s.closedAt || 0,
    closedBy: str(s.closedBy, 80),
    counted: s.counted == null ? null : Math.max(0, cents(s.counted)),
    expected: s.expected == null ? null : cents(s.expected),
    note: str(s.note, 300),
  };
}

function cleanClock(c) {
  if (!c || typeof c !== 'object' || !ok(c.id, SAFE_ID)) return null;
  return { id: c.id, staffId: str(c.staffId, 64), staffName: str(c.staffName, 80), in: +c.in || Date.now(), out: +c.out || 0, day: ok(c.day, DAY) ? c.day : new Date().toISOString().slice(0, 10), deviceId: str(c.deviceId, 64) };
}

function kitchenTicket(sale) {
  const lines = sale.lines.filter((l) => l.kitchen && l.qty > 0).map((l) => ({ name: l.name, qty: l.qty, mods: l.mods.map((m) => m.label), variant: l.variant, note: l.note, done: false }));
  if (!lines.length) return null;
  return { id: sale.id, no: sale.no, name: sale.ticket || sale.customer.name || '', type: sale.type, note: sale.note, at: sale.at, staff: sale.staffName, lines, status: 'new', source: 'register' };
}

// What a paired device may see. PIN hashes are included so staff can sign in offline.
const posView = (shop, pos) => ({
  id: shop.id,
  name: shop.name,
  settings: { ...pos.settings, taxRate: Number(shop.taxRate) || 0 },
  staff: pos.staff.map(({ id, name, role, salt, hash, color, active }) => ({ id, name, role, salt, hash, color, active: active !== false })),
  terminal: { locationId: pos.terminal?.locationId || '', readers: pos.terminal?.readers || [] },
  payments: { connected: Boolean(shop.stripeAccount), chargesEnabled: Boolean(shop.chargesEnabled) },
});

export function addPosRoutes(app, { db, terminal = null, mailer = null, texter = null, pairLimit, loginLimit, receiptBase = '', appFee = null }) {
  const posKey = (id) => `shop:${id}:pos`;
  const savePos = (shopId, pos) => db.set(posKey(shopId), pos);
  const fail = (res, status, error, code) => res.status(status).json({ error, ...(code ? { code } : {}) });
  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
    if (err.code && err.status && err.status < 500) return fail(res, 400, err.message, err.code);
    console.error('Register request failed:', err.message);
    fail(res, 502, err.message && /stripe|card|reader/i.test(err.message) ? err.message : 'The register server had a problem. Try again in a moment.');
  });
  const owner = ownerAuth(db);

  async function addDevice(shopId, pos, name, kind) {
    const token = newKey();
    const device = { id: randomUUID(), shopId, name: str(name, 60) || (kind === 'kitchen' ? 'Kitchen screen' : 'Register'), kind, createdAt: Date.now() };
    await db.set(`pos-device:${sha(token)}`, device);
    pos.devices = [...(pos.devices || []), { id: device.id, name: device.name, kind, createdAt: device.createdAt }];
    await savePos(shopId, pos);
    return { token, device };
  }

  const device = wrap(async (req, res, next) => {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token || token.length > 100) return fail(res, 401, 'This register is not set up.', 'no_device');
    const dev = await db.get(`pos-device:${sha(token)}`);
    const [shop, pos] = dev ? await db.getMany([`shop:${dev.shopId}`, posKey(dev.shopId)]) : [];
    if (!shop || !pos || !(pos.devices || []).some((d) => d.id === dev.id)) return fail(res, 401, 'This register was removed. Set it up again.', 'no_device');
    req.device = dev;
    req.shop = shop;
    req.pos = pos;
    next();
  });
  // role: the lowest role allowed. The staff key comes from POST /api/pos/login.
  const staff = (role) => wrap(async (req, res, next) => {
    const key = req.get('x-staff-key') || '';
    const s = key && key.length < 100 ? await db.get(`pos-staff:${sha(key)}`) : null;
    const member = s && s.shopId === req.shop.id && req.pos.staff.find((m) => m.id === s.staffId && m.active !== false);
    if (!member) return fail(res, 401, 'Sign in again.', 'no_staff');
    if (rank(member.role) < rank(role)) return fail(res, 403, `Only a ${role} can do that.`, 'role');
    req.staff = member;
    next();
  });

  /* setup and pairing */
  // The signed-in owner (cookie or Bearer session from /api/account/login) adds this device. The first time, they
  // also pick the PIN they'll use on the register.
  app.post('/api/pos/devices', pairLimit, owner, wrap(async (req, res) => {
    const shopId = req.shop.id;
    let pos = await db.get(posKey(shopId));
    if (!pos) {
      const name = str(req.body?.owner?.name, 80) || req.user.name || req.user.email.split('@')[0];
      const pin = String(req.body?.owner?.pin || '');
      if (!PIN.test(pin)) return fail(res, 400, 'Pick a PIN of 4 to 8 digits.', 'need_pin');
      pos = { settings: cleanSettings(req.body?.settings || {}), staff: [{ id: randomUUID(), name, role: 'owner', color: '#1e6b52', active: true, userId: req.user.id, ...hashPin(pin) }], devices: [], terminal: {}, createdAt: Date.now() };
      if (req.body?.settings?.taxRate !== undefined) await updateShop(db, shopId, (s) => ({ ...s, taxRate: Math.min(20, Math.max(0, Number(req.body.settings.taxRate) || 0)) }));
      if (Array.isArray(req.body?.catalog?.items)) await saveExtra(shopId, { items: req.body.catalog.items, stock: req.body.catalog.stock });
    }
    const { token, device: dev } = await addDevice(shopId, pos, req.body?.name || `Register ${(pos.devices || []).filter((d) => d.kind === 'register').length + 1}`, req.body?.kind === 'kitchen' ? 'kitchen' : 'register');
    const shop = await db.get(`shop:${shopId}`);
    res.status(201).json({ token, device: dev, ...(await stateOf(shop, pos)) });
  }));
  // Lets the register know, before asking for a PIN, whether this shop already has one.
  app.get('/api/pos/owner', owner, wrap(async (req, res) => {
    const pos = await db.get(posKey(req.shop.id));
    res.json({ shop: { name: req.shop.name }, setUp: Boolean(pos), owner: req.user.name || '' });
  }));

  app.post('/api/pos/pair', pairLimit, wrap(async (req, res) => {
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (code.length !== 6) return fail(res, 400, 'Enter the 6-digit code from the register.');
    const p = await db.get(`pos-pair:${code}`);
    if (!p) return fail(res, 400, 'That code is wrong or has expired. Make a new one on the register.');
    await db.del(`pos-pair:${code}`);
    const [shop, pos] = await db.getMany([`shop:${p.shopId}`, posKey(p.shopId)]);
    if (!shop || !pos) return fail(res, 400, 'That shop no longer exists.');
    const { token, device: dev } = await addDevice(shop.id, pos, req.body?.name || p.name, p.kind);
    res.status(201).json({ token, device: dev, ...(await stateOf(shop, pos)) });
  }));

  app.post('/api/pos/pair-code', device, staff('manager'), wrap(async (req, res) => {
    const kind = req.body?.kind === 'kitchen' ? 'kitchen' : 'register';
    let code = '';
    for (let i = 0; i < 8 && !code; i++) {
      const c = String(randomInt(0, 1_000_000)).padStart(6, '0');
      if (await db.claim(`pos-pair:${c}`, true)) code = c;
    }
    await db.set(`pos-pair:${code}`, { shopId: req.shop.id, kind, name: str(req.body?.name, 60) }, { ttlSec: 600 });
    res.json({ code, expiresIn: 600 });
  }));

  app.delete('/api/pos/devices/:id', device, staff('owner'), wrap(async (req, res) => {
    req.pos.devices = (req.pos.devices || []).filter((d) => d.id !== req.params.id);
    await savePos(req.shop.id, req.pos);
    res.json({ devices: req.pos.devices });
  }));

  app.post('/api/pos/login', loginLimit, device, wrap(async (req, res) => {
    const failKey = `pos-pinfail:${req.device.id}`;
    const fails = (await db.get(failKey)) || 0;
    if (fails >= 10) return fail(res, 429, 'Too many wrong PINs. Wait 5 minutes.', 'locked');
    const member = req.pos.staff.find((m) => m.id === req.body?.staffId && m.active !== false);
    if (!member || !checkPin(req.body?.pin, member)) {
      await db.set(failKey, fails + 1, { ttlSec: 300 });
      return fail(res, 401, 'Wrong PIN.', 'bad_pin');
    }
    await db.del(failKey);
    const key = newKey();
    await db.set(`pos-staff:${sha(key)}`, { shopId: req.shop.id, staffId: member.id }, { ttlSec: 16 * 3600 });
    res.json({ key, staff: { id: member.id, name: member.name, role: member.role } });
  }));

  /* what a register needs to run */
  // Items = the shop's published products (with the register's own touches: category, color, kitchen, barcode)
  // plus register-only items.
  async function catalogOf(shopId) {
    const [catalog, extra] = await db.getMany([`shop:${shopId}:catalog`, `shop:${shopId}:pos-catalog`]);
    const over = extra?.overrides || {};
    const online = itemsFromCatalog(catalog).map((i) => ({ ...i, ...Object.fromEntries(OVERRIDE.filter((k) => over[i.id]?.[k] !== undefined).map((k) => [k, over[i.id][k]])) }));
    const ids = new Set(online.map((i) => i.id));
    const items = [...online, ...(extra?.items || []).filter((i) => !ids.has(i.id))];
    return { items, cats: [...new Set(items.map((i) => i.cat).filter(Boolean))], updatedAt: extra?.updatedAt || 0, publishedAt: catalog ? 1 : 0 };
  }
  async function stateOf(shop, pos) {
    const [catalog, stock] = await Promise.all([catalogOf(shop.id), db.getStock(shop.id)]);
    return {
      shop: posView(shop, pos),
      devices: pos.devices || [],
      catalog,
      stock,
      terminal: terminal ? { enabled: true, testMode: terminal.testMode, ready: canCharge(shop) } : { enabled: false },
      receipts: { email: Boolean(mailer), text: Boolean(texter) },
      now: Date.now(),
    };
  }
  app.get('/api/pos/state', device, wrap(async (req, res) => res.json({ device: req.device, ...(await stateOf(req.shop, req.pos)) })));

  // Saves register-only items and the register's touches on published products. Prices and options of published
  // products come from the website design (publish again to change them).
  async function saveExtra(shopId, input) {
    const prev = (await db.get(`shop:${shopId}:pos-catalog`)) || {};
    const catalog = await db.get(`shop:${shopId}:catalog`);
    const online = new Set(itemsFromCatalog(catalog).map((i) => i.id));
    const items = [];
    const overrides = { ...(prev.overrides || {}) };
    for (const raw of (Array.isArray(input.items) ? input.items : []).slice(0, 2000)) {
      const item = cleanItem(raw);
      if (!item) continue;
      if (online.has(item.id)) overrides[item.id] = Object.fromEntries(OVERRIDE.map((k) => [k, item[k]]));
      else items.push(item);
    }
    const doc = { items, overrides, updatedAt: Date.now() };
    await db.set(`shop:${shopId}:pos-catalog`, doc);
    // new tracked items start with the count the owner typed in
    if (input.stock && typeof input.stock === 'object') {
      const current = await db.getStock(shopId);
      const set = {};
      for (const [f, n] of Object.entries(input.stock)) if (current[f] === undefined && f.length < 200 && Number.isFinite(+n)) set[f] = Math.trunc(+n);
      if (Object.keys(set).length) await db.setStock(shopId, set);
    }
    return doc;
  }
  app.put('/api/pos/catalog', device, staff('manager'), wrap(async (req, res) => {
    await saveExtra(req.shop.id, req.body || {});
    res.json({ catalog: await catalogOf(req.shop.id), stock: await db.getStock(req.shop.id) });
  }));

  // { set: { field: n } } replaces counts (a stock count). An empty value stops counting that item.
  app.put('/api/pos/stock', device, staff('manager'), wrap(async (req, res) => {
    const set = req.body?.set && typeof req.body.set === 'object' ? Object.fromEntries(Object.entries(req.body.set).filter(([f, n]) => f.length < 200 && (n === '' || n === null || Number.isFinite(+n))).slice(0, 2000)) : {};
    if (Object.keys(set).length) await db.setStock(req.shop.id, set);
    res.json({ stock: await db.getStock(req.shop.id) });
  }));

  app.put('/api/pos/settings', device, staff('owner'), wrap(async (req, res) => {
    const input = req.body?.settings || {};
    req.pos.settings = cleanSettings(input, req.pos.settings);
    await savePos(req.shop.id, req.pos);
    const name = str(req.body?.name, 80);
    const shop = await updateShop(db, req.shop.id, (s) => ({ ...s, ...(name ? { name } : {}), ...(input.taxRate !== undefined ? { taxRate: Math.min(20, Math.max(0, Math.round(Number(input.taxRate) * 1000) / 1000 || 0)) } : {}) }));
    res.json({ shop: posView(shop, req.pos) });
  }));

  // The whole staff list. A member without a new pin keeps the old one. There must always be an active owner.
  app.put('/api/pos/staff', device, staff('owner'), wrap(async (req, res) => {
    const list = Array.isArray(req.body?.staff) ? req.body.staff.slice(0, 100) : null;
    if (!list) return fail(res, 400, 'staff is required');
    const old = new Map(req.pos.staff.map((m) => [m.id, m]));
    const next = [];
    const newPins = new Map();
    for (const m of list) {
      const name = str(m?.name, 80);
      if (!name) return fail(res, 400, 'Every staff member needs a name.');
      const prev = typeof m?.id === 'string' ? old.get(m.id) : null;
      const pin = m?.pin == null || m.pin === '' ? null : String(m.pin);
      if (pin !== null && !PIN.test(pin)) return fail(res, 400, `${name}: the PIN must be 4 to 8 digits.`);
      if (!prev && pin === null) return fail(res, 400, `${name}: pick a PIN.`);
      const member = { id: prev?.id || randomUUID(), name, role: ROLES.includes(m?.role) ? m.role : 'cashier', color: str(m?.color, 20), active: m?.active !== false, ...(prev?.userId ? { userId: prev.userId } : {}), ...(pin ? hashPin(pin) : { salt: prev.salt, hash: prev.hash }) };
      if (pin) newPins.set(member, pin);
      next.push(member);
    }
    // everyone signs in with their own PIN, so a new PIN can't match someone else's
    for (const [m, pin] of newPins) {
      const clash = next.find((o) => o !== m && o.active && checkPin(pin, o));
      if (clash) return fail(res, 400, `${m.name} and ${clash.name} have the same PIN. Each person needs their own.`);
    }
    if (!next.some((m) => m.role === 'owner' && m.active)) return fail(res, 400, 'Keep at least one owner.');
    req.pos.staff = next;
    await savePos(req.shop.id, req.pos);
    res.json({ shop: posView(req.shop, req.pos) });
  }));

  /* sales, refunds, shifts and the time clock, sent by the register when it is online */
  const k = (shopId, rest) => `shop:${shopId}:pos-${rest}`;
  // the register sale as a shop order, so it shows in the owner's Store panel next to online orders
  const asOrder = (sale) => ({
    id: sale.id,
    no: sale.no,
    at: sale.at,
    shopId: '',
    name: sale.customer.name || sale.ticket || 'In store',
    email: sale.customer.email,
    phone: sale.customer.phone,
    method: 'in-store',
    note: sale.note,
    lines: sale.lines.map((l) => ({ id: l.itemId, variant: l.variant, name: l.name, opts: l.mods.map((m) => m.label).join(', '), qty: l.qty, unit: Math.round(l.unit + l.mods.reduce((a, m) => a + m.add, 0)) / 100 })),
    subtotal: sale.subtotal / 100,
    discount: sale.discount / 100,
    fee: 0,
    tax: sale.tax / 100,
    tip: sale.tip / 100,
    total: (sale.total + sale.tip) / 100,
    status: 'done',
    source: 'pos',
    staff: sale.staffName,
    payment: { method: [...new Set(sale.tenders.map((t) => (t.kind === 'other' ? t.label || 'other' : t.kind)))].join(' + ') || 'cash', status: 'paid' },
  });
  app.post('/api/pos/sync', device, wrap(async (req, res) => {
    const b = req.body || {};
    const shopId = req.shop.id;
    const accepted = { sales: [], refunds: [], shifts: [], clock: [] };
    for (const raw of (Array.isArray(b.sales) ? b.sales : []).slice(0, 100)) {
      const sale = cleanSale(raw);
      if (!sale) continue;
      sale.deviceId = req.device.id;
      if (await db.claim(k(shopId, `sale:${sale.id}`), sale)) {
        await db.zadd(k(shopId, `sales:${sale.day}`), sale.at, sale.id);
        await sellStock(db, shopId, sale.lines);
        await saveOrder(db, shopId, { ...asOrder(sale), shopId });
        const ticket = req.pos.settings.kitchenOn ? kitchenTicket(sale) : null;
        if (ticket) await addKitchenTicket(db, shopId, ticket);
      }
      accepted.sales.push(sale.id);
    }
    for (const raw of (Array.isArray(b.refunds) ? b.refunds : []).slice(0, 100)) {
      const r = cleanRefund(raw);
      if (!r) continue;
      const sale = await db.get(k(shopId, `sale:${r.saleId}`));
      if (!sale) continue; // the sale itself has not arrived yet; the register sends the refund again next time
      if (await db.claim(k(shopId, `refund:${r.id}`), { saleId: sale.id, day: r.day })) {
        sale.refunds = [...(sale.refunds || []), r];
        await db.set(k(shopId, `sale:${sale.id}`), sale);
        await db.zadd(k(shopId, `refunds:${r.day}`), r.at, r.id);
        if (r.restock) await db.putStock(shopId, r.lines.map((l) => ({ id: sale.lines[l.index]?.itemId, variant: sale.lines[l.index]?.variant, qty: l.qty })).filter((l) => l.id));
        const refunded = sale.refunds.reduce((a, x) => a + x.amount, 0);
        const order = await db.get(`shop:${shopId}:order:${sale.id}`);
        if (order) await db.set(`shop:${shopId}:order:${sale.id}`, { ...order, refunded: refunded / 100, status: refunded >= sale.total ? 'cancelled' : order.status, updatedAt: Date.now() });
      }
      accepted.refunds.push(r.id);
    }
    for (const [list, clean, name] of [[b.shifts, cleanShift, 'shift'], [b.clock, cleanClock, 'clock']]) {
      for (const raw of (Array.isArray(list) ? list : []).slice(0, 100)) {
        const rec = clean(raw);
        if (!rec) continue;
        rec.deviceId = req.device.id;
        if (!(await db.claim(k(shopId, `${name}:${rec.id}`), rec))) await db.set(k(shopId, `${name}:${rec.id}`), rec);
        await db.zadd(k(shopId, `${name}s:${rec.day}`), rec.openedAt || rec.in || Date.now(), rec.id);
        accepted[name === 'shift' ? 'shifts' : 'clock'].push(rec.id);
      }
    }
    res.json({ accepted, stock: await db.getStock(shopId), now: Date.now() });
  }));

  async function dayData(shopId, day) {
    const ids = await Promise.all(['sales', 'refunds', 'shifts', 'clocks'].map((l) => db.zrange(k(shopId, `${l}:${day}`), { limit: 5000 })));
    const [sales, refundRefs, shifts, clock] = await Promise.all([
      db.getMany(ids[0].map((id) => k(shopId, `sale:${id}`))),
      db.getMany(ids[1].map((id) => k(shopId, `refund:${id}`))),
      db.getMany(ids[2].map((id) => k(shopId, `shift:${id}`))),
      db.getMany(ids[3].map((id) => k(shopId, `clock:${id}`))),
    ]);
    // refunds made today on sales from earlier days
    const daySales = new Set(ids[0]);
    const older = [...new Set(refundRefs.filter((r) => r && !daySales.has(r.saleId)).map((r) => r.saleId))];
    const earlierSales = (await db.getMany(older.map((id) => k(shopId, `sale:${id}`)))).filter(Boolean);
    return { day, sales: sales.filter(Boolean), earlierSales, shifts: shifts.filter(Boolean), clock: clock.filter(Boolean) };
  }
  app.get('/api/pos/day/:day', device, staff('manager'), wrap(async (req, res) => {
    if (!DAY.test(req.params.day)) return fail(res, 400, 'bad day');
    res.json(await dayData(req.shop.id, req.params.day));
  }));
  app.get('/api/pos/sales/:id', device, staff('cashier'), wrap(async (req, res) => {
    const sale = SAFE_ID.test(req.params.id) ? await db.get(k(req.shop.id, `sale:${req.params.id}`)) : null;
    sale ? res.json(sale) : fail(res, 404, 'not found');
  }));

  /* kitchen screen */
  app.get('/api/pos/kitchen', device, wrap(async (req, res) => {
    const shopId = req.shop.id;
    const [openIds, doneIds] = await Promise.all([db.zrange(`shop:${shopId}:kitchen`, { limit: 200 }), db.zrange(`shop:${shopId}:kitchen-done`, { limit: 12 })]);
    const [open, done] = await Promise.all([db.getMany(openIds.map((id) => `shop:${shopId}:ticket:${id}`)), db.getMany(doneIds.map((id) => `shop:${shopId}:ticket:${id}`))]);
    res.json({ open: open.filter(Boolean).sort((a, b) => a.at - b.at), done: done.filter(Boolean), now: Date.now() });
  }));
  app.post('/api/pos/kitchen/:id', device, wrap(async (req, res) => {
    const shopId = req.shop.id;
    const key = `shop:${shopId}:ticket:${req.params.id}`;
    const t = /^[A-Za-z0-9_-]{1,64}$/.test(req.params.id) ? await db.get(key) : null;
    if (!t) return fail(res, 404, 'not found');
    const status = req.body?.status;
    if (Array.isArray(req.body?.lines)) req.body.lines.forEach((d, i) => { if (t.lines[i]) t.lines[i].done = Boolean(d); });
    if (status === 'done' && t.status !== 'done') {
      t.status = 'done';
      t.doneAt = Date.now();
      await db.zrem(`shop:${shopId}:kitchen`, t.id);
      await db.zadd(`shop:${shopId}:kitchen-done`, t.doneAt, t.id);
    } else if (status === 'recall' && t.status === 'done') {
      t.status = 'new';
      t.doneAt = 0;
      await db.zrem(`shop:${shopId}:kitchen-done`, t.id);
      await db.zadd(`shop:${shopId}:kitchen`, t.at, t.id);
    } else if (status === 'cooking' || status === 'ready' || status === 'new') t.status = status;
    await db.set(key, t, { ttlSec: 3 * 86400 });
    res.json(t);
  }));

  /* card readers
     In live mode the money must land in the shop's own Stripe account (Connect, direct charges), so cards wait until
     the shop has connected Stripe. In test mode the platform's test account is fine for trying it out. */
  const canCharge = (shop) => Boolean(terminal) && (terminal.testMode || Boolean(shop.stripeAccount && shop.chargesEnabled));
  const account = (shop) => (shop.stripeAccount && shop.chargesEnabled ? shop.stripeAccount : undefined);
  const needTerminal = (req, res, next) => {
    if (!terminal) return fail(res, 400, 'Card readers need Stripe. Add STRIPE_SECRET_KEY on the server (see docs/pos-setup.md).', 'no_stripe');
    if (!canCharge(req.shop)) return fail(res, 400, 'Set up card payments first (Studio, Owner dashboard, Set up card payments), so card money goes to your bank.', 'no_connect');
    next();
  };
  app.post('/api/pos/terminal/readers', device, staff('manager'), needTerminal, wrap(async (req, res) => {
    let code = str(req.body?.code, 100);
    if (!code || code === 'simulated') code = 'simulated-wpe';
    if (/^simulated-/.test(code) && !terminal.testMode) return fail(res, 400, 'The simulated reader only works with a Stripe test key (sk_test_…).');
    const pos = req.pos;
    pos.terminal = pos.terminal || {};
    pos.terminal.locationId = await terminal.ensureLocation({ name: req.shop.name, address: req.body?.address, locationId: pos.terminal.locationId, account: account(req.shop) });
    const reader = await terminal.registerReader({ code, label: req.body?.label || (code.startsWith('simulated') ? 'Test reader' : 'Card reader'), locationId: pos.terminal.locationId, account: account(req.shop) });
    pos.terminal.readers = [...(pos.terminal.readers || []).filter((r) => r.id !== reader.id), reader];
    await savePos(req.shop.id, pos);
    res.status(201).json({ reader, readers: pos.terminal.readers });
  }));
  app.get('/api/pos/terminal/readers', device, needTerminal, wrap(async (req, res) => {
    const pos = req.pos;
    if (!pos.terminal?.locationId) return res.json({ readers: [] });
    pos.terminal.readers = await terminal.listReaders({ locationId: pos.terminal.locationId, account: account(req.shop) });
    await savePos(req.shop.id, pos);
    res.json({ readers: pos.terminal.readers });
  }));
  app.delete('/api/pos/terminal/readers/:id', device, staff('manager'), needTerminal, wrap(async (req, res) => {
    await terminal.deleteReader({ readerId: req.params.id, account: account(req.shop) }).catch(() => {});
    req.pos.terminal.readers = (req.pos.terminal?.readers || []).filter((r) => r.id !== req.params.id);
    await savePos(req.shop.id, req.pos);
    res.json({ readers: req.pos.terminal.readers });
  }));
  const ownReader = (pos, id) => (pos.terminal?.readers || []).some((r) => r.id === id);
  app.post('/api/pos/terminal/pay', device, needTerminal, wrap(async (req, res) => {
    const { readerId, saleId, tenderId } = req.body || {};
    const amount = Math.trunc(+req.body?.amount);
    if (!ownReader(req.pos, readerId)) return fail(res, 400, 'Pick a card reader in Settings first.');
    if (!(amount >= 50 && amount <= 5_000_000)) return fail(res, 400, 'Card payments must be between $0.50 and $50,000.');
    if (!ok(saleId, SAFE_ID) || !ok(tenderId, SAFE_ID)) return fail(res, 400, 'bad sale');
    const fee = account(req.shop) && appFee ? appFee(amount) : 0;
    const out = await terminal.startPayment({ readerId, amount, saleId, tenderId, fee, description: `${req.shop.name} register sale`, account: account(req.shop), metadata: { shopId: req.shop.id } });
    res.json(out);
  }));
  const PI = /^pi_[A-Za-z0-9]+$/;
  app.get('/api/pos/terminal/pay/:pi', device, needTerminal, wrap(async (req, res) => {
    if (!PI.test(req.params.pi)) return fail(res, 400, 'bad payment');
    const readerId = ownReader(req.pos, req.query.reader) ? String(req.query.reader) : null;
    res.json(await terminal.paymentStatus({ readerId, paymentIntent: req.params.pi, account: account(req.shop) }));
  }));
  app.post('/api/pos/terminal/pay/:pi/cancel', device, needTerminal, wrap(async (req, res) => {
    if (!PI.test(req.params.pi)) return fail(res, 400, 'bad payment');
    const readerId = ownReader(req.pos, req.body?.readerId) ? req.body.readerId : null;
    await terminal.cancelPayment({ readerId, paymentIntent: req.params.pi, account: account(req.shop) });
    res.json({ status: 'canceled' });
  }));
  app.post('/api/pos/terminal/simulate', device, needTerminal, wrap(async (req, res) => {
    if (!ownReader(req.pos, req.body?.readerId)) return fail(res, 400, 'Unknown reader');
    const card = /^\d{12,19}$/.test(String(req.body?.card || '')) ? String(req.body.card) : undefined;
    await terminal.simulateTap({ readerId: req.body.readerId, card, account: account(req.shop) });
    res.json({ ok: true });
  }));
  app.post('/api/pos/terminal/refund', device, staff('manager'), needTerminal, wrap(async (req, res) => {
    const { paymentIntent, refundId } = req.body || {};
    const amount = Math.trunc(+req.body?.amount);
    if (!PI.test(String(paymentIntent)) || !ok(refundId, SAFE_ID) || !(amount > 0)) return fail(res, 400, 'bad refund');
    res.json(await terminal.refund({ paymentIntent, amount, refundId, account: account(req.shop) }));
  }));

  /* receipts: a link anyone with it can open, sent by email or text when those are set up */
  app.post('/api/pos/receipt', device, wrap(async (req, res) => {
    const saleKey = ok(req.body?.saleId, SAFE_ID) ? k(req.shop.id, `sale:${req.body.saleId}`) : '';
    const sale = saleKey ? await db.get(saleKey) : null;
    if (!sale) return fail(res, 404, 'That sale has not reached the server yet. Try again in a moment.', 'not_synced');
    let token = sale.receiptToken;
    if (!token) {
      token = randomBytes(12).toString('base64url');
      sale.receiptToken = token;
      await db.set(saleKey, sale);
      await db.set(`pos-receipt:${token}`, { shopId: req.shop.id, saleId: sale.id }, { ttlSec: 400 * 86400 });
    }
    const base = receiptBase || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/receipt?r=${token}`;
    const sent = { email: false, text: false };
    const email = str(req.body?.email, 254);
    const phone = str(req.body?.phone, 30).replace(/[^\d+]/g, '');
    const totalText = `$${((sale.total + sale.tip) / 100).toFixed(2)}`;
    if (email && mailer) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'That email address doesn’t look right.');
      await mailer.send({ to: email, replyTo: req.shop.email, subject: `Your receipt from ${req.shop.name}`, html: `<p>Thanks for shopping at ${esc(req.shop.name)}.</p><p>Total: <b>${totalText}</b></p><p><a href="${esc(url)}">See receipt ${esc(sale.no)}</a></p>`, text: `Thanks for shopping at ${req.shop.name}.\n\nTotal: ${totalText}\nReceipt ${sale.no}: ${url}\n` })
        .catch(() => { throw Object.assign(new Error('The email did not send. Check RESEND_API_KEY and EMAIL_FROM in Vercel.'), { status: 400, code: 'email_failed' }); });
      sent.email = true;
    }
    if (phone && texter) {
      if (phone.replace(/\D/g, '').length < 10) return fail(res, 400, 'That phone number doesn’t look right.');
      const done = await texter.send({ to: phone, body: `${req.shop.name}: your receipt for ${totalText}: ${url}` })
        .catch(() => { throw Object.assign(new Error('The text did not send. Check the Twilio settings in Vercel.'), { status: 400, code: 'text_failed' }); });
      if (!done) return fail(res, 400, 'Texts go to US phone numbers only for now.');
      sent.text = true;
    }
    res.json({ url, sent });
  }));
  app.get('/api/pos/receipt/:token', wrap(async (req, res) => {
    const ref = /^[A-Za-z0-9_-]{8,40}$/.test(req.params.token) ? await db.get(`pos-receipt:${req.params.token}`) : null;
    const [sale, shop, pos] = ref ? await db.getMany([k(ref.shopId, `sale:${ref.saleId}`), `shop:${ref.shopId}`, posKey(ref.shopId)]) : [];
    if (!sale || !shop) return fail(res, 404, 'Receipt not found.');
    const { deviceId, staffId, shiftId, receiptToken, customer, ...rest } = sale;
    const st = pos?.settings || {};
    res.json({ shop: { name: shop.name, address: st.address || '', phone: st.phone || '', footer: st.receiptFooter || '' }, sale: { ...rest, staffName: (sale.staffName || '').split(' ')[0] } });
  }));
}

// Online orders can show up on the kitchen screen too: the store calls kitchenForOrder once an order is placed.
export async function addKitchenTicket(db, shopId, ticket) {
  if (await db.claim(`shop:${shopId}:ticket:${ticket.id}`, ticket)) {
    await db.set(`shop:${shopId}:ticket:${ticket.id}`, ticket, { ttlSec: 3 * 86400 });
    await db.zadd(`shop:${shopId}:kitchen`, ticket.at || Date.now(), ticket.id);
  }
}

// An online pickup or delivery order becomes a ticket when the shop uses the kitchen screen. Only the items marked
// "Send to kitchen" in the register's Products go on it, the same as at the counter. Shipped orders never do.
export async function kitchenForOrder(db, shop, order) {
  if (!shop?.id || !order?.id || order.source === 'pos' || order.method === 'ship') return;
  const [pos, cat] = await db.getMany([`shop:${shop.id}:pos`, `shop:${shop.id}:pos-catalog`]);
  if (!pos?.settings?.kitchenOn) return;
  const over = cat?.overrides || {};
  const lines = (order.lines || []).filter((l) => over[l.id]?.kitchen && l.qty > 0)
    .map((l) => ({ name: l.name, qty: l.qty, mods: l.opts ? [l.opts] : [], variant: l.variant || '', note: '', done: false }));
  if (!lines.length) return;
  await addKitchenTicket(db, shop.id, { id: `web-${order.id}`, no: `#${order.no}`, name: order.name || '', type: order.method === 'delivery' ? 'delivery' : 'pickup', note: [order.when, order.note].filter(Boolean).join(' · '), at: Date.now(), staff: '', lines, status: 'new', source: 'web' });
}
