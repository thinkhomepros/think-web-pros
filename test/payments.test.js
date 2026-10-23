import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
import { priceOrder } from '../server/catalog.js';
import { createApp } from '../server/app.js';
import { createPayPalPayments, createStripePayments } from '../server/payments.js';
import { createRedisStore, createStore } from '../server/store.js';

const json = (method, body, headers = {}) => ({ method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const admin = { Authorization: 'Bearer secret' };

describe('pricing', () => {
  test('prices plans, add-ons, POS and hardware from the server catalog', () => {
    const p = priceOrder({ plan: 'growth', addons: ['domain', 'store', 'logomaker', 'nope'], pos: 'pos-lite', hw: { reader: 2 } });
    // domain is included with Growth, so it is not charged
    assert.deepEqual(p.lines.map((l) => [l.name, l.amount, l.recurring]), [
      ['Growth plan', 3900, true], ['Growth site design', 59900, false], ['Online store', 2900, true],
      ['AI logo package', 4900, false], ['POS Lite', 3900, true], ['Tap & chip card reader × 2', 11800, false],
    ]);
    assert.equal(p.recurring, 3900 + 2900 + 3900);
    assert.equal(p.dueToday, p.recurring + 59900 + 4900 + 11800);
    assert.equal(p.interval, 'month');
  });
  test('yearly billing is ten months, storage is $20 a month, quotes wait for a price', () => {
    const y = priceOrder({ plan: 'starter', annual: true });
    assert.equal(y.interval, 'year');
    assert.equal(y.recurring, 19000);
    assert.equal(priceOrder({ kind: 'storage' }).dueToday, 2000);
    assert.equal(priceOrder({ kind: 'quote' }), null);
    assert.throws(() => priceOrder({ plan: 'free' }));
  });
});

describe('payments', () => {
  let dataDir, server, base, sessions, paypalCalls;
  const webhookSecret = 'whsec_test';

  const fakeStripe = {
    checkout: {
      sessions: {
        async create(params) {
          const s = { id: `cs_test_${sessions.length + 1}`, url: 'https://checkout.stripe.test/pay', params, status: 'open', payment_status: 'unpaid', client_reference_id: params.client_reference_id, metadata: params.metadata };
          sessions.push(s);
          return s;
        },
        async retrieve(id) { return sessions.find((s) => s.id === id); },
      },
    },
    webhooks: new Stripe('sk_test_x').webhooks,
  };

  // Stands in for PayPal's REST API.
  async function fakePayPalFetch(url, init) {
    const p = new URL(url).pathname;
    paypalCalls.push([init.method, p]);
    const body = init.body && init.body.startsWith('{') ? JSON.parse(init.body) : null;
    const ok = (d) => new Response(JSON.stringify(d), { status: 200 });
    if (p === '/v1/oauth2/token') return ok({ access_token: 't', expires_in: 3600 });
    if (p === '/v1/catalogs/products') return ok({ id: 'PROD-1' });
    if (p === '/v1/billing/plans') return ok({ id: 'P-1', body });
    if (p === '/v2/checkout/orders') { fakePayPalFetch.last = body; return ok({ id: 'PPO-1' }); }
    if (p === '/v2/checkout/orders/PPO-1/capture') {
      const u = fakePayPalFetch.last.purchase_units[0];
      return ok({ status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', custom_id: u.custom_id, amount: u.amount }] } }] });
    }
    if (p.startsWith('/v1/billing/subscriptions/')) return ok({ status: 'ACTIVE', custom_id: fakePayPalFetch.subFor, plan_id: 'P-1' });
    return new Response('{}', { status: 404 });
  }

  before(async () => {
    sessions = [];
    paypalCalls = [];
    dataDir = await mkdtemp(path.join(tmpdir(), 'twp-pay-'));
    const payments = {
      stripe: createStripePayments({ client: fakeStripe, webhookSecret }),
      paypal: createPayPalPayments({ clientId: 'cid', secret: 's', fetchImpl: fakePayPalFetch }),
      zelle: { to: 'pay@thinkwebpros.test', name: 'Think Web Pros' },
    };
    server = createApp({ ai: null, store: createStore(dataDir), adminToken: 'secret', payments, publicUrl: 'https://studio.test' }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const place = async (order) => (await fetch(`${base}/api/orders`, json('POST', { order: { business: 'Acme', email: 'a@acme.test', ...order } }))).json();
  const getOrder = async (id) => (await fetch(`${base}/api/orders/${id}`, { headers: admin })).json();

  test('config lists the methods that are set up', async () => {
    const c = await (await fetch(`${base}/api/config`)).json();
    assert.deepEqual(c.payments, { card: true, test: true, paypal: { clientId: 'cid' }, zelle: { to: 'pay@thinkwebpros.test', name: 'Think Web Pros' } });
  });

  test('the server sets the price, whatever the browser sent', async () => {
    const o = await place({ plan: 'pro', setup: 1, monthly: 0 });
    assert.equal(o.payment.dueToday, 119900 + 7900);
    assert.match(o.number, /^TWP-[0-9A-F]{8}$/);
  });

  test('card checkout opens a Stripe subscription and the webhook marks it paid', async () => {
    const o = await place({ plan: 'starter', addons: ['photos'] });
    const r = await (await fetch(`${base}/api/pay/${o.id}/card`, { method: 'POST' })).json();
    assert.equal(r.url, 'https://checkout.stripe.test/pay');
    const s = sessions.at(-1);
    assert.equal(s.params.mode, 'subscription');
    assert.equal(s.params.payment_method_types, undefined, 'lets Stripe show every method switched on in the Dashboard');
    assert.deepEqual(s.params.line_items.map((l) => [l.price_data.unit_amount, l.price_data.recurring?.interval]), [[1900, 'month'], [29900, undefined], [24900, undefined]]);
    assert.equal(s.params.success_url, `https://studio.test/builder?paid=${o.id}&session_id={CHECKOUT_SESSION_ID}`);

    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { ...s, status: 'complete', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' } } });
    const bad = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=nope', 'content-type': 'application/json' }, body: payload });
    assert.equal(bad.status, 400);
    const sig = fakeStripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    const ok = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': sig, 'content-type': 'application/json' }, body: payload });
    assert.equal(ok.status, 200);
    const saved = await getOrder(o.id);
    assert.equal(saved.payment.status, 'paid');
    assert.equal(saved.payment.stripeSubscription, 'sub_1');
    assert.equal(saved.status, 'Paid');
    assert.equal((await fetch(`${base}/api/pay/${o.id}/card`, { method: 'POST' })).status, 409, 'a paid order cannot be paid twice');
  });

  test('the return page confirms a card payment without waiting for the webhook', async () => {
    const o = await place({ kind: 'storage' });
    await fetch(`${base}/api/pay/${o.id}/card`, { method: 'POST' });
    const s = sessions.at(-1);
    assert.equal(s.params.mode, 'subscription');
    Object.assign(s, { status: 'complete', payment_status: 'paid' });
    const r = await (await fetch(`${base}/api/pay/${o.id}/card/result?session_id=${s.id}`)).json();
    assert.equal(r.status, 'paid');
  });

  test('PayPal one-time orders are captured and checked against the order', async () => {
    const o = await place({ kind: 'quote', plan: 'custom' });
    assert.equal(o.payment, null);
    assert.equal((await fetch(`${base}/api/pay/${o.id}/paypal`, { method: 'POST' })).status, 409, 'a quote has no price yet');
    const priced = await (await fetch(`${base}/api/orders/${o.id}`, json('PATCH', { quote: { setup: 2500 } }, admin))).json();
    assert.equal(priced.payLink, `https://studio.test/builder?pay=${o.id}`);
    const start = await (await fetch(`${base}/api/pay/${o.id}/paypal`, { method: 'POST' })).json();
    assert.equal(start.paypalOrderId, 'PPO-1');
    assert.equal(fakePayPalFetch.last.purchase_units[0].amount.value, '2500.00');
    const done = await fetch(`${base}/api/pay/${o.id}/paypal/confirm`, json('POST', { paypalOrderId: 'PPO-1' }));
    assert.equal((await done.json()).status, 'paid');
  });

  test('PayPal monthly plans become subscriptions with the design fee up front', async () => {
    const o = await place({ plan: 'growth' });
    const start = await (await fetch(`${base}/api/pay/${o.id}/paypal`, { method: 'POST' })).json();
    assert.equal(start.planId, 'P-1');
    fakePayPalFetch.subFor = 'someone-else';
    assert.equal((await fetch(`${base}/api/pay/${o.id}/paypal/confirm`, json('POST', { subscriptionId: 'I-1' }))).status, 402);
    fakePayPalFetch.subFor = o.id;
    // a failed check marks the order failed, so it can be tried again
    const ok = await fetch(`${base}/api/pay/${o.id}/paypal/confirm`, json('POST', { subscriptionId: 'I-1' }));
    assert.equal((await ok.json()).status, 'paid');
  });

  test('Zelle gives instructions and Admin marks it paid', async () => {
    const o = await place({ plan: 'starter' });
    const z = await (await fetch(`${base}/api/pay/${o.id}/zelle`, { method: 'POST' })).json();
    assert.deepEqual(z, { to: 'pay@thinkwebpros.test', name: 'Think Web Pros', amount: 29900 + 1900, memo: o.number, recurring: 1900, interval: 'month' });
    assert.equal((await getOrder(o.id)).payment.status, 'awaiting_zelle');
    assert.equal((await fetch(`${base}/api/orders/${o.id}`, json('PATCH', { paymentStatus: 'paid' }))).status, 401);
    const r = await (await fetch(`${base}/api/orders/${o.id}`, json('PATCH', { paymentStatus: 'paid' }, admin))).json();
    assert.equal(r.payment.status, 'paid');
  });

  test('the public pay page shows the price but not provider ids', async () => {
    const o = await place({ plan: 'starter' });
    await fetch(`${base}/api/pay/${o.id}/card`, { method: 'POST' });
    const p = await (await fetch(`${base}/api/pay/${o.id}`)).json();
    assert.equal(p.payment.dueToday, 31800);
    assert.equal(p.payment.stripeSession, undefined);
    assert.equal(p.payment.history, undefined);
    assert.equal((await fetch(`${base}/api/pay/not-an-id`)).status, 404);
  });
});

describe('redis store', () => {
  test('keeps orders and designs in Redis over its REST API', async () => {
    const db = new Map();
    const zset = [];
    const fakeFetch = async (url, init) => {
      const out = JSON.parse(init.body).map(([cmd, ...a]) => {
        if (cmd === 'SET') { db.set(a[0], a[1]); return { result: 'OK' }; }
        if (cmd === 'GET') return { result: db.get(a[0]) ?? null };
        if (cmd === 'MGET') return { result: a.map((k) => db.get(k) ?? null) };
        if (cmd === 'ZADD') { zset.push([Number(a[1]), a[2]]); return { result: 1 }; }
        if (cmd === 'ZRANGE') return { result: [...zset].sort((x, y) => y[0] - x[0]).map((z) => z[1]) };
        return { error: 'unknown' };
      });
      return new Response(JSON.stringify(out));
    };
    const store = createRedisStore({ url: 'https://redis.test/', token: 't', fetchImpl: fakeFetch });
    await store.saveOrder({ id: 'a', receivedAt: '2026-10-22T00:00:00Z', status: 'New', design: { big: true } });
    await store.saveOrder({ id: 'b', receivedAt: '2026-10-22T01:00:00Z', status: 'New', design: null });
    assert.deepEqual((await store.listOrders()).map((o) => o.id), ['b', 'a']);
    assert.equal((await store.listOrders())[0].design, undefined);
    assert.deepEqual((await store.getOrder('a')).design, { big: true });
    await store.updateOrder('a', (r) => ({ ...r, status: 'Paid' }));
    assert.equal((await store.getOrder('a')).status, 'Paid');
    assert.equal(await store.updateOrder('zzz', (r) => r), null);
  });
});
