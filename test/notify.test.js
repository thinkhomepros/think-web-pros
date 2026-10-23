import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createDb } from '../server/db.js';
import { createMailer, createTexter, receiptEmail, statusEmail, usPhone } from '../server/notify.js';
import { updateShop } from '../server/shop.js';
import { createStore } from '../server/store.js';

const shop = { name: 'Harbor <Bakery>', slug: 'harbor', email: 'owner@harbor.co' };
const order = { no: 1001, name: 'Sam Lee', email: 'sam@x.co', method: 'pickup', when: 'Fri, Oct 24 at 9:00 AM', lines: [{ name: 'Sourdough', qty: 2, unit: 9 }], subtotal: 18, discount: 1.8, code: 'TEN', fee: 0, tax: 1.3, total: 17.5, payment: { method: 'later', status: 'unpaid' }, status: 'new' };

describe('messages', () => {
  test('receipt lists the order and escapes names', () => {
    const r = receiptEmail(shop, order, 'https://x/s/harbor');
    assert.equal(r.subject, 'Your order #1001 from Harbor <Bakery>');
    assert.match(r.html, /Harbor &lt;Bakery&gt;/);
    assert.match(r.html, /2 × Sourdough/);
    assert.match(r.html, /Sales tax/);
    assert.match(r.text, /Total \$17\.50/);
    assert.match(r.text, /Pay at pickup/);
  });
  test('status notes only for ready, shipped and cancelled', () => {
    assert.equal(statusEmail(shop, { ...order, status: 'preparing' }), null);
    assert.match(statusEmail(shop, { ...order, status: 'ready' }).subject, /ready for pickup/);
    assert.match(statusEmail(shop, { ...order, status: 'ready', method: 'delivery' }).sms, /out for delivery/);
    const s = statusEmail(shop, { ...order, status: 'shipped', method: 'ship', shipping: { carrier: 'USPS', tracking: '9400', trackingUrl: 'https://t/9400' } });
    assert.match(s.html, /Track your package/);
  });
  test('Resend and Twilio requests', async () => {
    const sent = [];
    const fetchImpl = async (url, opts) => { sent.push({ url, opts }); return { ok: true, json: async () => ({ id: 'm1' }) }; };
    assert.equal(createMailer({ apiKey: '' }), null);
    await createMailer({ apiKey: 're_1', from: 'Shop <o@x.co>', fetchImpl }).send({ to: 'a@b.co', subject: 'Hi', html: '<p>x</p>' });
    assert.equal(sent[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(JSON.parse(sent[0].opts.body).to, ['a@b.co']);
    assert.equal(usPhone('(207) 555-0142'), '+12075550142');
    assert.equal(usPhone('555'), null);
    await createTexter({ sid: 'AC1', token: 't', from: '+15550000000', fetchImpl }).send({ to: '207-555-0142', body: 'Ready' });
    assert.match(sent[1].url, /Accounts\/AC1\/Messages\.json$/);
    assert.match(String(sent[1].opts.body), /To=%2B12075550142/);
  });
});

describe('emails from the store', () => {
  let dir, server, base, db;
  const mail = [];
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set && !set.startsWith('twp_session=;')) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const settle = () => new Promise((r) => setTimeout(r, 30));

  before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'twp-notify-'));
    db = createDb();
    const mailer = { send: async (m) => { mail.push(m); return { id: String(mail.length) }; } };
    server = createApp({ ai: null, store: createStore(dir), db, notify: { mailer }, publicUrl: 'https://studio.test' }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  test('receipt and owner alert on a new order, a note when it is ready', async () => {
    const up = await call('POST', '/api/account/signup', { email: 'owner@harbor.co', password: 'longenough', business: 'Harbor' });
    await updateShop(db, up.body.shop.id, (s) => ({ ...s, active: true }));
    await call('PUT', '/api/shop/site', { design: { sections: [{ id: 's', type: 'shop', data: { items: [{ id: 'loaf', name: 'Loaf', price: '$9' }] } }] } });
    assert.equal((await call('PATCH', '/api/shop/settings', { taxRate: 8.25 })).body.shop.taxRate, 8.25);
    const site = await call('GET', '/api/sites/harbor');
    assert.equal(site.body.shop.emails, true);
    const o = await call('POST', '/api/sites/harbor/orders', { order: { name: 'Sam', email: 'sam@x.co', method: 'pickup', pay: 'later', lines: [{ id: 'loaf', qty: 2 }] } });
    assert.equal(o.body.order.tax, 1.49);
    await settle();
    assert.deepEqual(mail.map((m) => m.to), ['sam@x.co', 'owner@harbor.co']);
    assert.equal(mail[0].replyTo, 'owner@harbor.co');
    assert.match(mail[1].html, /https:\/\/studio\.test\/builder#dashboard/);
    await call('PATCH', `/api/shop/orders/${o.body.order.id}`, { status: 'ready' });
    await settle();
    assert.match(mail[2].subject, /ready for pickup/);
    await call('PATCH', `/api/shop/settings`, { settings: { orderEmails: false } });
    await call('POST', '/api/sites/harbor/orders', { order: { name: 'Al', email: 'al@x.co', method: 'pickup', pay: 'later', lines: [{ id: 'loaf', qty: 1 }] } });
    await settle();
    assert.equal(mail.length, 4, 'owner turned order emails off');
  });

  test('forgot password sends a one-hour link that works once', async () => {
    mail.length = 0;
    assert.deepEqual((await call('POST', '/api/account/forgot', { email: 'nobody@x.co' })).body, { ok: true });
    assert.equal(mail.length, 0);
    await call('POST', '/api/account/forgot', { email: 'OWNER@harbor.co' });
    const token = mail[0].text.match(/reset=([\w-]+)/)[1];
    assert.match(mail[0].html, /https:\/\/studio\.test\/builder\?reset=/);
    cookie = '';
    assert.equal((await call('POST', '/api/account/reset', { token, password: 'short' })).status, 400);
    assert.equal((await call('POST', '/api/account/reset', { token, password: 'brandnewpass' })).status, 200);
    assert.equal((await call('POST', '/api/account/reset', { token, password: 'brandnewpass' })).status, 400, 'used once');
    cookie = '';
    assert.equal((await call('POST', '/api/account/login', { email: 'owner@harbor.co', password: 'brandnewpass' })).status, 200);
  });
});
