import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createDb } from '../server/db.js';
import { checkPin, cleanItem, hashPin, itemsFromCatalog, sellStock } from '../server/pos.js';
import { createTerminal, formBody } from '../server/terminal.js';
import { catalogFromDesign } from '../server/shop.js';
import * as C from '../web/js/pos-core.js';

async function start(options) {
  const server = createApp({ store: {}, ...options }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

// A pretend Stripe that answers the calls the register makes, and remembers them.
function fakeStripe() {
  const calls = [];
  const pis = {};
  let n = 0;
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const body = Object.fromEntries(new URLSearchParams(opts.body || ''));
    calls.push({ method: opts.method, path: u.pathname, body, headers: opts.headers });
    const json = (d, status = 200) => ({ ok: status < 400, status, json: async () => d });
    const p = u.pathname.replace('/v1', '');
    if (p === '/terminal/locations') return json({ id: 'tml_1' });
    if (p === '/terminal/readers' && opts.method === 'POST') return json({ id: 'tmr_sim1', label: body.label, device_type: 'simulated_wisepos_e', status: 'online' });
    if (p === '/payment_intents' && opts.method === 'POST') {
      const id = `pi_${++n}`;
      pis[id] = { id, amount: +body.amount, status: 'requires_payment_method' };
      return json(pis[id]);
    }
    if (/\/process_payment_intent$/.test(p)) return json({ id: 'tmr_sim1', action: { status: 'in_progress' } });
    if (/present_payment_method$/.test(p)) {
      const pi = Object.values(pis).at(-1);
      if (body['card_present[number]'] === '4000000000000002') pi.last_payment_error = { message: 'Your card was declined.' };
      else Object.assign(pi, { status: 'succeeded', amount_received: pi.amount, latest_charge: { id: 'ch_1', payment_method_details: { card_present: { brand: 'visa', last4: '4242' } } } });
      return json({});
    }
    const m = p.match(/^\/payment_intents\/(pi_\d+)$/);
    if (m) return json(pis[m[1]]);
    if (/^\/terminal\/readers\/tmr_sim1$/.test(p)) return json({ id: 'tmr_sim1', action: { status: pis[Object.keys(pis).at(-1)]?.last_payment_error ? 'failed' : 'in_progress', failure_message: 'Your card was declined.' } });
    if (p === '/refunds') return json({ id: 're_1', status: 'succeeded', amount: +body.amount });
    return json({ error: { message: `unexpected ${p}` } }, 404);
  };
  return { fetchImpl, calls };
}

const design = { sections: [{ id: 'shop1', type: 'shop', data: { items: [{ id: 'tee', name: 'T-shirt', price: '$20', opt1: 'Size', opt1v: 'M, L (+$2)', vstock: { M: '5', L: '2' } }, { id: 'mug', name: 'Mug', price: '$12' }] } }] };

describe('register server', () => {
  let live, db, stripe, session, token, ownerKey, ownerId, shopId;
  const api = (path, { method = 'GET', body, staffKey, auth = token } = {}) =>
    fetch(`${live.base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(staffKey ? { 'X-Staff-Key': staffKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });

  before(async () => {
    db = createDb();
    stripe = fakeStripe();
    live = await start({ db, pos: { terminal: createTerminal({ secretKey: 'sk_test_x', fetchImpl: stripe.fetchImpl }), mailer: { send: async () => {} }, appFee: (a) => Math.round(a * 0.005) } });
    const r = await (await api('/account/signup', { method: 'POST', auth: null, body: { email: 'dana@example.com', password: 'longenough', business: 'Rise Bakery', name: 'Dana' } })).json();
    session = r.token;
    shopId = r.shop.id;
    await db.set(`shop:${shopId}`, { ...(await db.get(`shop:${shopId}`)), active: true });
    assert.equal((await api('/shop/site', { method: 'PUT', auth: session, body: { design } })).status, 200);
  });
  after(() => live.server.close());

  test('the signed-in owner adds a register and picks a PIN', async () => {
    assert.equal((await api('/pos/devices', { method: 'POST', auth: null, body: {} })).status, 401, 'needs the owner signed in');
    const noPin = await api('/pos/devices', { method: 'POST', auth: session, body: {} });
    assert.equal((await noPin.json()).code, 'need_pin');
    const res = await api('/pos/devices', {
      method: 'POST',
      auth: session,
      body: { owner: { pin: '2468' }, settings: { taxRate: 8.25, kitchenOn: true }, catalog: { items: [{ id: 'latte-01', name: 'Latte', price: 450, cat: 'Drinks', kitchen: true }, { id: 'bun-0001', name: 'Bun', price: 350, track: true }], stock: { 'bun-0001': 10 } } },
    });
    assert.equal(res.status, 201);
    const d = await res.json();
    token = d.token;
    ownerId = d.shop.staff[0].id;
    assert.equal(d.shop.staff[0].name, 'Dana');
    assert.equal(d.shop.settings.taxRate, 8.25);
    // published products and register-only items in one list, with the shared stock
    assert.deepEqual(d.catalog.items.map((i) => i.id), ['tee', 'mug', 'latte-01', 'bun-0001']);
    const tee = d.catalog.items[0];
    assert.equal(tee.price, 2000);
    assert.deepEqual(tee.opts[0].vals, [{ label: 'M', add: 0 }, { label: 'L', add: 200 }]);
    assert.equal(tee.track, true);
    assert.deepEqual(d.stock, { 'tee|M': 5, 'tee|L': 2, 'bun-0001': 10 });
    assert.ok(!JSON.stringify(d).includes('2468'));
    assert.ok(checkPin('2468', d.shop.staff[0]));
    // a second register of the same shop doesn't ask for a new PIN
    const again = await api('/pos/devices', { method: 'POST', auth: session, body: { name: 'Back counter' } });
    assert.equal(again.status, 201);
  });

  test('rejects wrong device keys and wrong PINs', async () => {
    assert.equal((await api('/pos/state', { auth: 'nope' })).status, 401);
    assert.equal((await api('/pos/login', { method: 'POST', body: { staffId: ownerId, pin: '0000' } })).status, 401);
    const right = await api('/pos/login', { method: 'POST', body: { staffId: ownerId, pin: '2468' } });
    assert.equal(right.status, 200);
    ownerKey = (await right.json()).key;
  });

  test('staff roles: a cashier cannot change products; PINs must be unique; keep an owner', async () => {
    const res = await api('/pos/staff', { method: 'PUT', staffKey: ownerKey, body: { staff: [{ id: ownerId, name: 'Dana', role: 'owner' }, { name: 'Sam', role: 'cashier', pin: '1357' }] } });
    assert.equal(res.status, 200);
    const sam = (await res.json()).shop.staff.find((s) => s.name === 'Sam');
    const login = await (await api('/pos/login', { method: 'POST', body: { staffId: sam.id, pin: '1357' } })).json();
    assert.equal((await api('/pos/catalog', { method: 'PUT', staffKey: login.key, body: { items: [] } })).status, 403);
    const dup = await api('/pos/staff', { method: 'PUT', staffKey: ownerKey, body: { staff: [{ id: ownerId, name: 'Dana', role: 'owner' }, { id: sam.id, name: 'Sam', role: 'cashier' }, { name: 'Lee', role: 'cashier', pin: '1357' }] } });
    assert.equal(dup.status, 400);
    const noOwner = await api('/pos/staff', { method: 'PUT', staffKey: ownerKey, body: { staff: [{ id: ownerId, name: 'Dana', role: 'manager' }] } });
    assert.equal(noOwner.status, 400);
  });

  test('a synced sale takes shared stock once, shows in the Store orders, and makes a kitchen ticket', async () => {
    const sale = {
      id: 'sale-0001', no: 'A-1', day: '2026-10-23', staffId: ownerId, staffName: 'Dana',
      lines: [
        { itemId: 'latte-01', name: 'Latte', qty: 2, unit: 450, kitchen: true, mods: [{ label: 'Oat milk', add: 75 }], total: 1050 },
        { itemId: 'tee', name: 'T-shirt', variant: 'L', qty: 3, unit: 2000, mods: [{ label: 'L', add: 200 }], total: 6600 },
      ],
      subtotal: 7650, tax: 631, tip: 100, total: 8281,
      tenders: [{ id: 'tnd-0001', kind: 'cash', amount: 8281, tip: 100, given: 9000, change: 619 }],
    };
    const first = await (await api('/pos/sync', { method: 'POST', body: { sales: [sale] } })).json();
    assert.deepEqual(first.accepted.sales, ['sale-0001']);
    assert.equal(first.stock['tee|L'], 0, 'sold 3 of 2: the count goes to 0, the sale still counts');
    const again = await (await api('/pos/sync', { method: 'POST', body: { sales: [sale] } })).json();
    assert.equal(again.stock['tee|M'], 5);

    const orders = await (await api('/shop/orders', { auth: session })).json();
    const o = (orders.orders || orders).find((x) => x.id === 'sale-0001');
    assert.equal(o.source, 'pos');
    assert.equal(o.total, 83.81);
    assert.equal(o.lines[1].unit, 22);

    const k = await (await api('/pos/kitchen')).json();
    assert.equal(k.open.length, 1);
    assert.deepEqual(k.open[0].lines[0].mods, ['Oat milk']);
    assert.equal((await (await api('/pos/kitchen/sale-0001', { method: 'POST', body: { status: 'done' } })).json()).status, 'done');
    const k2 = await (await api('/pos/kitchen')).json();
    assert.deepEqual([k2.open.length, k2.done.length], [0, 1]);

    const refund = { id: 'rfd-0001', saleId: 'sale-0001', day: '2026-10-23', lines: [{ index: 1, qty: 1 }], amount: 2380, restock: true, tenders: [{ kind: 'cash', amount: 2380 }] };
    const r = await (await api('/pos/sync', { method: 'POST', body: { refunds: [refund, refund] } })).json();
    assert.equal(r.stock['tee|L'], 1, 'a restocked refund puts the item back once');

    const day = await (await api('/pos/day/2026-10-23', { staffKey: ownerKey })).json();
    assert.equal(day.sales.length, 1);
    assert.equal(day.sales[0].refunds.length, 1);
  });

  test('register touches on a published product are kept; its price still comes from the website', async () => {
    const items = [{ id: 'tee', name: 'Renamed', price: 1, kitchen: false, color: '#b3472f', barcode: '0123456789' }, { id: 'latte-01', name: 'Latte', price: 475, cat: 'Drinks', kitchen: true }];
    const d = await (await api('/pos/catalog', { method: 'PUT', staffKey: ownerKey, body: { items } })).json();
    const tee = d.catalog.items.find((i) => i.id === 'tee');
    assert.deepEqual([tee.name, tee.price, tee.barcode, tee.color], ['T-shirt', 2000, '0123456789', '#b3472f']);
    assert.equal(d.catalog.items.find((i) => i.id === 'latte-01').price, 475);
    assert.ok(!d.catalog.items.some((i) => i.id === 'bun-0001'), 'removed register items are gone');
  });

  test('pairs a kitchen screen with a one-time code', async () => {
    const { code } = await (await api('/pos/pair-code', { method: 'POST', staffKey: ownerKey, body: { kind: 'kitchen' } })).json();
    assert.match(code, /^\d{6}$/);
    const res = await api('/pos/pair', { method: 'POST', auth: null, body: { code, name: 'Line' } });
    assert.equal(res.status, 201);
    const d = await res.json();
    assert.equal(d.device.kind, 'kitchen');
    assert.equal((await api('/pos/pair', { method: 'POST', auth: null, body: { code } })).status, 400, 'a code works once');
    assert.equal((await api('/pos/kitchen', { auth: d.token })).status, 200);
  });

  test('takes a card on Stripe’s simulated reader, declines a bad card, and refunds', async () => {
    const reg = await api('/pos/terminal/readers', { method: 'POST', staffKey: ownerKey, body: { code: 'simulated' } });
    assert.equal(reg.status, 201);
    const { reader } = await reg.json();
    assert.ok(stripe.calls.some((c) => c.path === '/v1/terminal/readers' && c.body.registration_code === 'simulated-wpe'));
    const pay = await (await api('/pos/terminal/pay', { method: 'POST', body: { readerId: reader.id, amount: 1234, saleId: 'sale-0002', tenderId: 'tnd-0002' } })).json();
    assert.match(pay.paymentIntent, /^pi_/);
    const pi = stripe.calls.find((c) => c.path === '/v1/payment_intents');
    assert.equal(pi.body['payment_method_types[0]'], 'card_present');
    assert.equal(pi.body.application_fee_amount, undefined, 'no fee without a connected account');
    assert.equal(pi.headers['Idempotency-Key'], 'pi-tnd-0002-1234');
    assert.equal((await (await api(`/pos/terminal/pay/${pay.paymentIntent}?reader=${reader.id}`)).json()).status, 'waiting');
    await api('/pos/terminal/simulate', { method: 'POST', body: { readerId: reader.id } });
    const okd = await (await api(`/pos/terminal/pay/${pay.paymentIntent}?reader=${reader.id}`)).json();
    assert.deepEqual([okd.status, okd.brand, okd.last4], ['succeeded', 'visa', '4242']);

    const pay2 = await (await api('/pos/terminal/pay', { method: 'POST', body: { readerId: reader.id, amount: 900, saleId: 'sale-0003', tenderId: 'tnd-0003' } })).json();
    await api('/pos/terminal/simulate', { method: 'POST', body: { readerId: reader.id, card: '4000000000000002' } });
    assert.equal((await (await api(`/pos/terminal/pay/${pay2.paymentIntent}?reader=${reader.id}`)).json()).status, 'failed');

    const rf = await (await api('/pos/terminal/refund', { method: 'POST', staffKey: ownerKey, body: { paymentIntent: pay.paymentIntent, amount: 500, refundId: 'rfd-0002' } })).json();
    assert.equal(rf.amount, 500);
  });

  test('on a connected Stripe account the charge goes to the shop with the platform fee', async () => {
    await db.set(`shop:${shopId}`, { ...(await db.get(`shop:${shopId}`)), stripeAccount: 'acct_shop1', chargesEnabled: true });
    const reader = (await (await api('/pos/state')).json()).shop.terminal.readers[0];
    await api('/pos/terminal/pay', { method: 'POST', body: { readerId: reader.id, amount: 2000, saleId: 'sale-0004', tenderId: 'tnd-0004' } });
    const pi = stripe.calls.filter((c) => c.path === '/v1/payment_intents').at(-1);
    assert.equal(pi.headers['Stripe-Account'], 'acct_shop1');
    assert.equal(pi.body.application_fee_amount, '10');
  });

  test('a receipt link shows the sale without staff or customer details', async () => {
    const res = await (await api('/pos/receipt', { method: 'POST', body: { saleId: 'sale-0001', email: 'pat@example.com' } })).json();
    assert.equal(res.sent.email, true);
    const r = await (await fetch(`${live.base}/api/pos/receipt/${new URL(res.url).searchParams.get('r')}`)).json();
    assert.equal(r.shop.name, 'Rise Bakery');
    assert.equal(r.sale.total, 8281);
    assert.equal(r.sale.deviceId, undefined);
    assert.equal(r.sale.customer, undefined);
  });

  test('serves the register, kitchen and receipt pages', async () => {
    for (const p of ['/pos', '/kitchen', '/receipt', '/js/pos.js', '/js/pos-core.js', '/js/kitchen.js', '/css/pos.css', '/pos-sw.js', '/pos.webmanifest']) assert.equal((await fetch(live.base + p)).status, 200, p);
    const html = await (await fetch(`${live.base}/pos`)).text();
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline scripts (the CSP blocks them)');
  });
});

describe('register pieces', () => {
  test('PIN hashes are PBKDF2-SHA256, the same as the browser makes', () => {
    const h = hashPin('1234', '00'.repeat(16));
    assert.equal(h.hash.length, 64);
    assert.ok(checkPin('1234', h));
    assert.ok(!checkPin('1235', h));
  });

  test('cleanItem keeps safe fields only', () => {
    const x = cleanItem({ name: ' Bun ', price: '350', image: 'javascript:alert(1)', opts: [{ name: 'Glaze', vals: [{ label: 'Maple', add: 50 }, { label: '' }] }] });
    assert.deepEqual([x.name, x.price, x.image, x.opts[0].vals.length], ['Bun', 350, '', 1]);
  });

  test('sellStock never refuses a sale that already happened', async () => {
    const db = createDb();
    await db.setStock('s1', { mug: 1, 'tee|M': 4 });
    await sellStock(db, 's1', [{ itemId: 'mug', qty: 3 }, { itemId: 'tee', variant: 'M', qty: 1 }, { itemId: 'tea', qty: 1 }]);
    assert.deepEqual(await db.getStock('s1'), { mug: 0, 'tee|M': 3 });
  });

  test('published products become register items with variant labels the store uses', () => {
    const items = itemsFromCatalog(catalogFromDesign(design));
    assert.equal(C.variantLabel(items[0], { Size: 'L' }), 'L');
    assert.equal(items[1].track, false);
  });

  test('Stripe form bodies nest like Stripe expects', () => {
    assert.equal(decodeURIComponent(formBody({ a: { b: 1 }, c: ['x'], d: undefined }).toString()), 'a[b]=1&c[0]=x');
  });
});

describe('register math', () => {
  const lines = [
    { itemId: 'a', name: 'Latte', unit: 450, qty: 2, mods: [{ label: 'Oat', add: 75 }], discount: 0, taxable: true },
    { itemId: 'b', name: 'Beans', unit: 1600, qty: 1, mods: [], discount: 0, taxable: false },
  ];
  test('totals: order discount shared across lines, tax only on taxable lines', () => {
    const t = C.totals(lines, { discount: { kind: 'pct', value: 10 }, taxRate: 8.25 });
    assert.equal(t.subtotal, 2650);
    assert.equal(t.discount, 265);
    assert.deepEqual(t.shares, [105, 160]);
    assert.equal(t.tax, Math.round((1050 - 105) * 0.0825));
    assert.equal(t.total, 2650 - 265 + t.tax);
  });
  test('shareOut always adds up', () => {
    const s = C.shareOut(100, [1, 1, 1]);
    assert.equal(s.reduce((a, b) => a + b, 0), 100);
  });
  test('refunds give back the line share of discount and tax, card first', () => {
    const t = C.totals(lines, { discount: { kind: 'amt', value: 265 }, taxRate: 8.25 });
    const sale = { lines, discount: t.discount, tax: t.tax, total: t.total, tip: 0, refunds: [], tenders: [{ id: 'c1', kind: 'cash', amount: 1000 }, { id: 'k1', kind: 'card', amount: t.total - 1000, ref: 'pi_1' }] };
    const v = C.refundValue(sale, [{ index: 0, qty: 2 }]);
    assert.equal(v.amount, 945 + t.tax);
    const tn = C.refundTenders(sale, v.amount);
    assert.equal(tn[0].kind, 'card');
    assert.equal(tn.reduce((a, x) => a + x.amount, 0), v.amount);
    sale.refunds.push({ lines: [{ index: 0, qty: 1 }], tenders: [], amount: 0 });
    assert.deepEqual(C.refundableQty(sale), [1, 1]);
  });
  test('drawer: start + cash sales and tips + pay ins − pay outs − cash refunds', () => {
    const exp = C.drawerExpected({ openCash: 10000, events: [{ kind: 'in', amount: 500 }, { kind: 'out', amount: 1200 }, { kind: 'drop', amount: 5000 }] }, [{ tenders: [{ kind: 'cash', amount: 2000, tip: 300 }, { kind: 'card', amount: 999 }] }], [{ tenders: [{ kind: 'cash', amount: 400 }] }]);
    assert.equal(exp, 10000 + 2300 + 500 - 1200 - 5000 - 400);
    assert.equal(C.countDenoms({ $20: 2, Quarters: 4 }), 4100);
  });
  test('end of day report', () => {
    const r = C.dayReport({ sales: [{ at: Date.parse('2026-10-23T09:30:00'), staffName: 'Sam', subtotal: 2650, discount: 265, tax: 78, tip: 200, total: 2463, lines, tenders: [{ kind: 'card', amount: 2463, tip: 200 }] }], refunds: [{ amount: 500, tax: 0, tenders: [{ kind: 'card', amount: 500 }] }] });
    assert.equal(r.count, 1);
    assert.equal(r.net, 2650 - 265 - 500);
    assert.equal(r.collected, 2463 + 200 - 500);
    assert.equal(r.tenders.Card.refunds, 500);
    assert.equal(r.staff.Sam.tips, 200);
  });
  test('cash suggestions and prices', () => {
    assert.deepEqual(C.cashSuggestions(1235), [1235, 1300, 1500, 2000, 5000]);
    assert.equal(C.parsePrice('From $4.50'), 450);
    assert.equal(C.parsePrice('Ask'), null);
  });
  test('stock left counts what is already in the cart', () => {
    const item = { id: 'tee', track: true, opts: [{ name: 'Size', variant: true, vals: [{ label: 'M' }] }] };
    assert.equal(C.stockLeft(item, 'M', { 'tee|M': 3 }, [{ itemId: 'tee', variant: 'M', qty: 2 }]), 1);
    assert.equal(C.stockLeft(item, '', { 'tee|M': 3, 'tee|L': 1 }, []), 4);
  });
});
