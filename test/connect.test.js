import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createConnect } from '../server/connect.js';
import { createDb } from '../server/db.js';
import { updateShop } from '../server/shop.js';
import { createStore } from '../server/store.js';

// A stand-in for the Stripe SDK that records what it was asked to do.
function fakeStripe() {
  const calls = [];
  const rec = (name, out) => async (...args) => {
    calls.push({ name, args });
    return typeof out === 'function' ? out(...args) : out;
  };
  return {
    calls,
    accounts: { create: rec('accounts.create', { id: 'acct_123' }), retrieve: rec('accounts.retrieve', { charges_enabled: true, payouts_enabled: true, details_submitted: true }) },
    accountLinks: { create: rec('accountLinks.create', { url: 'https://connect.stripe.com/setup/x' }) },
    checkout: { sessions: { create: rec('checkout.sessions.create', { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }) } },
    refunds: { create: rec('refunds.create', (p) => ({ id: 're_1', status: 'succeeded', amount: p.amount })) },
    webhooks: { constructEvent: (raw, sig) => { if (sig !== 'ok') throw new Error('bad sig'); return JSON.parse(raw); } },
  };
}

const design = { sections: [{ id: 'shop1', type: 'shop', data: { pickup: 'yes', payLater: 'no', shipping: 'yes', shipFee: '$6', freeOver: '', codes: 'TEN = 10%', items: [{ id: 'mug', name: 'Mug', price: '$15', stock: '5' }] } }] };

describe('card payments for shops', () => {
  let dataDir, server, base, db, fake;
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set && set.startsWith('twp_session=') && !set.startsWith('twp_session=;')) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const hook = (event) => call('POST', '/api/stripe/connect-webhook', JSON.stringify(event), { 'Stripe-Signature': 'ok' });

  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'twp-connect-'));
    db = createDb();
    fake = fakeStripe();
    const connect = createConnect({ client: fake, webhookSecret: 'whsec', feePercent: 2 });
    server = createApp({ ai: null, store: createStore(dataDir), db, connect, publicUrl: 'https://shop.test' }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('owner connects Stripe, shopper pays by card, webhooks settle the order', async () => {
    const up = await call('POST', '/api/account/signup', { email: 'mugs@x.co', password: 'longenough', business: 'Mug Shop' });
    const shopId = up.body.shop.id;
    await updateShop(db, shopId, (s) => ({ ...s, active: true }));
    assert.equal((await call('PUT', '/api/shop/site', { design })).status, 200);

    const before = await call('GET', '/api/shop/payments');
    assert.deepEqual([before.body.available, before.body.connected], [true, false]);
    const link = await call('POST', '/api/shop/payments/connect');
    assert.equal(link.body.url, 'https://connect.stripe.com/setup/x');
    assert.match(fake.calls.find((c) => c.name === 'accountLinks.create').args[0].return_url, /^https:\/\/shop\.test\/builder\?connect=done/);
    const st = await call('GET', '/api/shop/payments');
    assert.equal(st.body.chargesEnabled, true);
    assert.equal((await call('GET', '/api/sites/mug-shop')).body.shop.cards, true);

    // pickup without pay-later goes to card
    const o = await call('POST', '/api/sites/mug-shop/orders', { order: { name: 'Ann', email: 'ann@x.co', method: 'ship', addr: '1 Main St', code: 'ten', pay: 'later', lines: [{ id: 'mug', qty: 2 }] } });
    assert.equal(o.status, 201);
    assert.equal(o.body.pay.url, 'https://checkout.stripe.com/c/cs_1');
    assert.equal(o.body.order.payment.status, 'unpaid');
    const sc = fake.calls.find((c) => c.name === 'checkout.sessions.create');
    const [params, opts] = sc.args;
    assert.deepEqual(opts, { stripeAccount: 'acct_123' }, 'charged on the shop’s own account');
    assert.deepEqual(params.line_items.map((l) => [l.quantity, l.price_data.unit_amount]), [[1, 2700], [1, 600]], 'discounted goods, then shipping');
    assert.equal(params.payment_intent_data.application_fee_amount, Math.floor(3300 * 0.02));
    assert.equal(params.success_url, `https://shop.test/s/mug-shop?paid=${o.body.order.id}`);

    assert.equal((await call('POST', '/api/stripe/connect-webhook', '{}', { 'Stripe-Signature': 'no' })).status, 400);
    const meta = { shopId, orderId: o.body.order.id };
    await hook({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', metadata: meta } } });
    const paid = (await call('GET', '/api/shop/orders')).body.find((x) => x.id === o.body.order.id);
    assert.equal(paid.payment.status, 'paid');
    assert.equal(paid.payment.intent, 'pi_1');

    // refunds go back through Stripe on the shop's account; the last one cancels the order and restocks
    const oid = o.body.order.id;
    assert.equal((await call('POST', `/api/shop/orders/${oid}/refund`, { amount: 40 })).status, 400, 'no more than was paid');
    const part = await call('POST', `/api/shop/orders/${oid}/refund`, { amount: 10 });
    assert.deepEqual([part.body.payment.status, part.body.payment.refunded, part.body.status], ['partly_refunded', 10, 'new']);
    const rc = fake.calls.filter((c) => c.name === 'refunds.create');
    assert.deepEqual(rc[0].args, [{ payment_intent: 'pi_1', amount: 1000, refund_application_fee: true }, { stripeAccount: 'acct_123' }]);
    assert.equal((await call('GET', '/api/shop/stock')).body.mug, 3);
    const rest = await call('POST', `/api/shop/orders/${oid}/refund`, {});
    assert.deepEqual([rest.body.payment.status, rest.body.payment.refunded, rest.body.status], ['refunded', 33, 'cancelled']);
    assert.equal(fake.calls.filter((c) => c.name === 'refunds.create')[1].args[0].amount, 2300);
    assert.equal((await call('GET', '/api/shop/stock')).body.mug, 5, 'stock back after the full refund');
    assert.equal((await call('POST', `/api/shop/orders/${oid}/refund`, {})).status, 400, 'nothing left');
    const rep = (await call('GET', '/api/shop/report?days=7')).body;
    assert.deepEqual([rep.gross, rep.refunds, rep.net, rep.fees], [33, 33, 0, 6]);

    // an abandoned checkout gives the stock back
    const o2 = await call('POST', '/api/sites/mug-shop/orders', { order: { name: 'Bo', email: 'bo@x.co', method: 'pickup', lines: [{ id: 'mug', qty: 3 }] } });
    assert.equal((await call('GET', '/api/shop/stock')).body.mug, 2);
    await hook({ type: 'checkout.session.expired', data: { object: { id: 'cs_2', metadata: { shopId, orderId: o2.body.order.id } } } });
    assert.equal((await call('GET', '/api/shop/stock')).body.mug, 5);
    const gone = (await call('GET', '/api/shop/orders')).body.find((x) => x.id === o2.body.order.id);
    assert.deepEqual([gone.status, gone.payment.status], ['cancelled', 'abandoned']);

    // Stripe turning cards off for the account is noticed
    await hook({ type: 'account.updated', data: { object: { id: 'acct_123', charges_enabled: false } } });
    assert.equal((await call('GET', '/api/account/me')).body.shop.payments.chargesEnabled, false);
  });
});
