import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkPassword, hashPassword, slugify } from '../server/accounts.js';
import { createApp } from '../server/app.js';
import { createDb } from '../server/db.js';
import { catalogFromDesign, priceShopOrder } from '../server/shop.js';
import { createStore } from '../server/store.js';

const design = {
  sections: [
    { id: 'hero1', type: 'hero', data: {} },
    {
      id: 'shop1',
      type: 'shop',
      data: {
        pickup: 'yes', delivery: 'yes', deliveryFee: '$5', shipping: 'yes', shipFee: '$6', freeOver: '$75', payLater: 'yes', subOff: 10,
        codes: 'WELCOME10 = 10%, FIVE = $5, SHIPFREE = free shipping',
        items: [
          { id: 'loaf', name: 'Sourdough', price: '$9', stock: '3', sub: 'yes' },
          { id: 'tee', name: 'Tee', price: '$20', opt1: 'Size', opt1v: 'S, M, L (+$2)', opt2: 'Color', opt2v: 'Sage, Black', vstock: { 'M / Sage': '2', 'L / Black': '' } },
          { name: 'Cookie', price: '$2.50' },
          { id: 'card', name: 'Gift card', price: '$25', kind: 'gift', opt1: 'Amount', opt1v: '$25, $50' },
        ],
      },
    },
  ],
};

describe('shop pricing', () => {
  const cat = catalogFromDesign(design);
  test('reads products, ids and starting counts out of the design', () => {
    assert.deepEqual(cat.products.map((p) => p.id), ['loaf', 'tee', 'shop1-2', 'card']);
    assert.deepEqual(cat.products[0].start, { loaf: 3 });
    assert.deepEqual(cat.products[1].start, { 'tee|M / Sage': 2 });
    assert.deepEqual(cat.products[2].start, {});
  });
  test('prices options, codes, delivery, free shipping and tax on the server', () => {
    const p = priceShopOrder(cat, { lines: [{ id: 'tee', variant: 'L / Black', qty: 2, unit: 0.01 }, { id: 'loaf', qty: 1 }], method: 'delivery', code: 'welcome10' }, { taxRate: 8 });
    assert.equal(p.lines[0].unit, 22);
    assert.equal(p.subtotal, 53);
    assert.equal(p.discount, 5.3);
    assert.equal(p.fee, 5);
    assert.equal(p.tax, 3.82);
    assert.equal(p.total, 56.52);
    const ship = priceShopOrder(cat, { lines: [{ id: 'tee', variant: 'S / Sage', qty: 4 }], method: 'ship' });
    assert.equal(ship.fee, 0, 'free over $75');
    const sub = priceShopOrder(cat, { lines: [{ id: 'loaf', qty: 1, sub: true }] });
    assert.equal(sub.lines[0].unit, 8.1);
    assert.equal(priceShopOrder(cat, { lines: [{ id: 'card', variant: '$50', qty: 1 }] }).total, 50);
  });
  test('refuses made-up products and options', () => {
    assert.match(priceShopOrder(cat, { lines: [{ id: 'nope', qty: 1 }] }).error, /no longer for sale/);
    assert.match(priceShopOrder(cat, { lines: [{ id: 'tee', variant: 'XL / Sage', qty: 1 }] }).error, /doesn’t come/);
    assert.match(priceShopOrder(cat, { lines: [{ id: 'tee', qty: 1 }] }).error, /choose options/);
    assert.match(priceShopOrder(cat, { lines: [] }).error, /empty/);
  });
});

describe('stock counts', () => {
  test('take is all or nothing, put back only touches counted items', async () => {
    const db = createDb();
    await db.setStock('s', { a: 2, 'b|M': 1 });
    assert.deepEqual(await db.takeStock('s', [{ id: 'a', qty: 1 }, { id: 'b', variant: 'M', qty: 2 }]), { ok: false, short: [{ id: 'b', variant: 'M', have: 1, want: 2 }] });
    assert.deepEqual(await db.getStock('s'), { a: 2, 'b|M': 1 });
    assert.deepEqual(await db.takeStock('s', [{ id: 'a', qty: 1 }, { id: 'a', qty: 1 }, { id: 'free', qty: 9 }]), { ok: true });
    assert.equal((await db.getStock('s')).a, 0);
    await db.putStock('s', [{ id: 'a', qty: 1 }, { id: 'free', qty: 1 }]);
    assert.deepEqual(await db.getStock('s'), { a: 1, 'b|M': 1 });
    // two shoppers at once for the last one: only one gets it
    const r = await Promise.all([db.takeStock('s', [{ id: 'a', qty: 1 }]), db.takeStock('s', [{ id: 'a', qty: 1 }])]);
    assert.deepEqual(r.map((x) => x.ok).sort(), [false, true]);
  });
  test('the Redis version checks and takes in one script', async () => {
    const sent = [];
    const fetchImpl = async (url, opts) => {
      sent.push(JSON.parse(opts.body));
      return { ok: true, json: async () => [{ result: [] }] };
    };
    const db = createDb({ redis: { url: 'https://r', token: 't' }, fetchImpl });
    assert.deepEqual(await db.takeStock('s', [{ id: 'a', qty: 1 }, { id: 'a', variant: 'M', qty: 2 }, { id: 'a', qty: 2 }]), { ok: true });
    const [cmd] = sent[0];
    assert.equal(cmd[0], 'EVAL');
    assert.deepEqual(cmd.slice(2), ['1', 'twp:shop:s:stock', 'a', '3', 'a|M', '2']);
  });
});

describe('accounts and live shops', () => {
  let dataDir, server, base, db;
  const jar = {};
  const call = async (method, url, body, who = 'owner') => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(jar[who] ? { Cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) jar[who] = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'twp-shop-'));
    db = createDb();
    server = createApp({ ai: null, store: createStore(dataDir), db, adminToken: 'secret' }).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('passwords are hashed and names become web addresses', async () => {
    const h = await hashPassword('correct horse');
    assert.match(h, /^scrypt\$/);
    assert.equal(await checkPassword('correct horse', h), true);
    assert.equal(await checkPassword('wrong', h), false);
    assert.equal(slugify('Harbor & Pine Bakery!'), 'harbor-and-pine-bakery');
  });

  test('sign up, publish, shoppers order, stock goes down, owner sees it', async () => {
    assert.equal((await call('GET', '/api/account/me')).status, 401);
    assert.equal((await call('POST', '/api/account/signup', { email: 'a@b.co', password: 'short', business: 'X' })).status, 400);
    const up = await call('POST', '/api/account/signup', { email: 'Owner@Shop.co', password: 'longenough', business: 'Harbor & Pine' });
    assert.equal(up.status, 201);
    assert.equal(up.body.shop.slug, 'harbor-and-pine');
    assert.match(jar.owner, /^twp_session=/);
    assert.equal((await call('POST', '/api/account/signup', { email: 'owner@shop.co', password: 'longenough', business: 'Again' }, 'other')).status, 409);
    assert.equal((await call('GET', '/api/account/me')).body.user.email, 'owner@shop.co');

    assert.equal((await call('GET', '/api/sites/harbor-and-pine')).status, 404, 'not published yet');
    const noPlan = await call('PUT', '/api/shop/site', { design });
    assert.equal(noPlan.status, 402, 'a site goes online with a plan');
    const on = await fetch(`${base}/api/admin/shops/${up.body.shop.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' }, body: JSON.stringify({ active: true }) });
    assert.equal((await on.json()).active, true);
    const pub = await call('PUT', '/api/shop/site', { design });
    assert.equal(pub.status, 200);
    assert.equal(pub.body.url, '/s/harbor-and-pine');
    assert.deepEqual(pub.body.stock, { loaf: 3, 'tee|M / Sage': 2 });
    assert.equal((await call('PUT', '/api/shop/site', { design }, 'shopper')).status, 401, 'only the owner publishes');

    const site = await call('GET', '/api/sites/harbor-and-pine', null, 'shopper');
    assert.equal(site.body.design.sections.length, 2);
    assert.equal(site.body.shop.cards, false);

    const bad = await call('POST', '/api/sites/harbor-and-pine/orders', { order: { name: 'Sam', email: 'sam@x.co', lines: [{ id: 'loaf', qty: 4 }] } }, 'shopper');
    assert.equal(bad.status, 409);
    assert.match(bad.body.error, /Only 3/);

    const ok = await call('POST', '/api/sites/harbor-and-pine/orders', { order: { name: 'Sam', email: 'sam@x.co', method: 'pickup', pay: 'later', lines: [{ id: 'loaf', qty: 2, unit: 0 }, { id: 'tee', variant: 'M / Sage', qty: 1 }] } }, 'shopper');
    assert.equal(ok.status, 201);
    assert.equal(ok.body.order.total, 38);
    assert.equal(ok.body.order.no, 1001);
    assert.equal(ok.body.pay, null);
    assert.deepEqual(await db.getStock((await call('GET', '/api/account/me')).body.shop.id), { loaf: 1, 'tee|M / Sage': 1 });

    const orders = await call('GET', '/api/shop/orders');
    assert.equal(orders.body.length, 1);
    assert.equal(orders.body[0].email, 'sam@x.co');
    assert.equal((await call('GET', '/api/shop/orders', null, 'shopper')).status, 401);

    const cancel = await call('PATCH', `/api/shop/orders/${ok.body.order.id}`, { status: 'cancelled' });
    assert.equal(cancel.body.status, 'cancelled');
    await call('PATCH', `/api/shop/orders/${ok.body.order.id}`, { status: 'cancelled' });
    assert.deepEqual((await call('GET', '/api/shop/stock')).body, { loaf: 3, 'tee|M / Sage': 2 }, 'put back once');

    // pay at pickup: refunds only once it's paid, then the money report counts it
    const two = await call('POST', '/api/sites/harbor-and-pine/orders', { order: { name: 'Al', email: 'al@x.co', method: 'pickup', pay: 'later', lines: [{ id: 'loaf', qty: 1 }] } }, 'shopper');
    assert.equal((await call('POST', `/api/shop/orders/${two.body.order.id}/refund`, {})).status, 400);
    let rep = (await call('GET', '/api/shop/report')).body;
    assert.deepEqual([rep.orders, rep.unpaid], [0, 9]);
    const cash = await call('POST', `/api/shop/orders/${two.body.order.id}/paid`, { method: 'cash' });
    assert.deepEqual([cash.body.payment.status, cash.body.payment.paidWith], ['paid', 'cash']);
    const back = await call('POST', `/api/shop/orders/${two.body.order.id}/refund`, { amount: 4, restock: false });
    assert.equal(back.body.payment.refunded, 4);
    rep = (await call('GET', '/api/shop/report?days=1')).body;
    assert.deepEqual([rep.orders, rep.gross, rep.refunds, rep.net, rep.unpaid, rep.byPay.cash, rep.bySource.Website], [1, 9, 4, 5, 0, 5, 5]);
    assert.equal((await call('GET', '/api/shop/report', null, 'shopper')).status, 401);

    const shopperSees = await call('GET', `/api/sites/harbor-and-pine/orders/${ok.body.order.id}`, null, 'shopper');
    assert.equal(shopperSees.body.email, undefined);
    assert.equal(shopperSees.body.status, 'cancelled');
  });

  test('sign in and out', async () => {
    assert.equal((await call('POST', '/api/account/login', { email: 'owner@shop.co', password: 'nope' }, 'b')).status, 401);
    assert.equal((await call('POST', '/api/account/login', { email: 'OWNER@shop.co', password: 'longenough' }, 'b')).status, 200);
    assert.equal((await call('GET', '/api/account/me', null, 'b')).status, 200);
    await call('POST', '/api/account/logout', null, 'b');
    assert.equal((await call('GET', '/api/account/me', null, 'b')).status, 401);
  });

  test('serves the site page at /s/<slug>', async () => {
    const res = await fetch(`${base}/s/harbor-and-pine`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="app">/);
  });
});
