import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createDb } from '../server/db.js';
import { updateShop } from '../server/shop.js';
import { parseAddress, trackingUrl } from '../server/shipping.js';
import { createStore } from '../server/store.js';

describe('addresses and tracking links', () => {
  test('reads a typed address into fields', () => {
    assert.deepEqual(parseAddress('12 Elm St, Apt 2, Portland, ME 04101'), { street1: '12 Elm St', street2: 'Apt 2', city: 'Portland', state: 'ME', zip: '04101', country: 'US' });
    assert.deepEqual(parseAddress('12 Elm St\nPortland ME 04101-1234\nUSA'), { street1: '12 Elm St', street2: '', city: 'Portland', state: 'ME', zip: '04101-1234', country: 'US' });
    assert.equal(parseAddress('somewhere nice').street1, 'somewhere nice');
    assert.equal(parseAddress('somewhere nice').zip, '');
  });
  test('builds carrier tracking links', () => {
    assert.equal(trackingUrl('usps', '9400 1'), 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201');
    assert.equal(trackingUrl('Local courier', '1'), '');
  });
});

describe('shipping labels', () => {
  let dir, server, base, db;
  const sent = [];
  const mail = [];
  let cookie = '';
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sent.push({ url, body, auth: opts.headers.Authorization });
    if (url.endsWith('/shipments/')) return { ok: true, json: async () => ({ object_id: 'shp_1', rates: [{ object_id: 'rate_ups', amount: '12.40', provider: 'UPS', servicelevel: { name: 'Ground' }, estimated_days: 3 }, { object_id: 'rate_usps', amount: '7.85', provider: 'USPS', servicelevel: { name: 'Ground Advantage' }, estimated_days: 4 }], messages: [] }) };
    if (url.endsWith('/transactions/')) return { ok: true, json: async () => ({ object_id: 'tx_1', status: 'SUCCESS', label_url: 'https://shippo-delivery.s3/label.pdf', tracking_number: '9400111', tracking_url_provider: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set && !set.startsWith('twp_session=;')) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'twp-ship-'));
    db = createDb();
    const mailer = { send: async (m) => { mail.push(m); return {}; } };
    server = createApp({ ai: null, store: createStore(dir), db, notify: { mailer }, shipping: { testKey: 'shippo_test_platformkey123' }, fetchImpl, connect: { feePercent: 0, checkout: async () => ({ url: 'https://checkout.test/cs', sessionId: 'cs' }) } }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  test('owner sets a ship-from address, picks the cheapest rate, buys a label, shopper gets tracking', async () => {
    const up = await call('POST', '/api/account/signup', { email: 'tees@x.co', password: 'longenough', business: 'Tee Shop' });
    await updateShop(db, up.body.shop.id, (s) => ({ ...s, active: true, stripeAccount: 'acct_1', chargesEnabled: true }));
    await call('PUT', '/api/shop/site', { design: { sections: [{ id: 's', type: 'shop', data: { shipping: 'yes', shipFee: '$6', payLater: 'yes', items: [{ id: 'tee', name: 'Tee', price: '$20' }] } }] } });
    const o = (await call('POST', '/api/sites/tee-shop/orders', { order: { name: 'Ann Lee', email: 'ann@x.co', method: 'ship', addr: '12 Elm St, Portland, ME 04101', pay: 'card', lines: [{ id: 'tee', qty: 1 }] } })).body.order;

    const st = await call('GET', '/api/shop/shipping');
    assert.deepEqual([st.body.available, st.body.ownKey, st.body.testMode], [true, false, true], 'test labels work before the owner adds a token');
    const noFrom = await call('POST', `/api/shop/orders/${o.id}/rates`, {});
    assert.equal(noFrom.body.code, 'from');
    assert.equal(noFrom.body.to.city, 'Portland');

    assert.equal((await call('PUT', '/api/shop/shipping', { apiKey: 'sk_live_nope' })).status, 400);
    const saved = await call('PUT', '/api/shop/shipping', { apiKey: 'shippo_test_ownerkey456', from: { name: 'Tee Shop', street1: '1 Main St', city: 'Bangor', state: 'ME', zip: '04401' }, parcel: { weight: 8 } });
    assert.deepEqual([saved.body.ownKey, saved.body.parcel.weight, saved.body.parcel.length], [true, 8, 10]);
    assert.equal(JSON.stringify((await call('GET', '/api/account/me')).body).includes('ownerkey'), false, 'the token never goes back to the browser');

    const bad = await call('POST', `/api/shop/orders/${o.id}/rates`, { to: { zip: '' } });
    assert.equal(bad.body.code, 'address');
    const r = await call('POST', `/api/shop/orders/${o.id}/rates`, { to: { street2: 'Apt 2' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.rates.map((x) => x.id), ['rate_usps', 'rate_ups'], 'cheapest first');
    const ship = sent.find((x) => x.url.endsWith('/shipments/'));
    assert.equal(ship.auth, 'ShippoToken shippo_test_ownerkey456', 'the owner’s own Shippo account pays');
    assert.deepEqual([ship.body.address_to.street2, ship.body.address_to.name, ship.body.address_from.city, ship.body.parcels[0].weight], ['Apt 2', 'Ann Lee', 'Bangor', '8']);

    assert.equal((await call('POST', `/api/shop/orders/${o.id}/label`, { rate: 'rate_made_up' })).status, 400);
    const lab = await call('POST', `/api/shop/orders/${o.id}/label`, { rate: 'rate_usps' });
    assert.equal(lab.status, 200);
    assert.equal(lab.body.status, 'shipped');
    assert.deepEqual([lab.body.shipping.carrier, lab.body.shipping.tracking, lab.body.shipping.cost], ['USPS', '9400111', 7.85]);
    assert.equal(sent.find((x) => x.url.endsWith('/transactions/')).body.label_file_type, 'PDF_4x6');
    assert.equal((await call('POST', `/api/shop/orders/${o.id}/label`, { rate: 'rate_ups' })).status, 409, 'one label per order');
    await new Promise((res) => setTimeout(res, 30));
    assert.match(mail.find((m) => /has shipped/.test(m.subject)).html, /Track your package/);
    const pub = (await call('GET', `/api/sites/tee-shop/orders/${o.id}`)).body;
    assert.equal(pub.shipping.tracking, '9400111');
    assert.equal(pub.shipping.label, undefined, 'shoppers never see the label');
  });

  test('a tracking number typed in by hand', async () => {
    const o = (await call('POST', '/api/sites/tee-shop/orders', { order: { name: 'Bo', email: 'bo@x.co', method: 'ship', addr: '3 Oak Ave, Austin, TX 78701', pay: 'card', lines: [{ id: 'tee', qty: 1 }] } })).body.order;
    assert.equal((await call('PATCH', `/api/shop/orders/${o.id}`, { shipping: { carrier: 'UPS' } })).status, 400);
    const x = await call('PATCH', `/api/shop/orders/${o.id}`, { shipping: { carrier: 'UPS', tracking: '1Z999' } });
    assert.deepEqual([x.body.status, x.body.shipping.trackingUrl], ['shipped', 'https://www.ups.com/track?tracknum=1Z999']);
  });
});
