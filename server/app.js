import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { addAccountRoutes } from './accounts.js';
import { addConnectRoutes, addConnectWebhook } from './connect.js';
import { orderHooks } from './notify.js';
import { createDb } from './db.js';
import { addImportRoutes } from './importer.js';
import { addPosRoutes, kitchenForOrder } from './pos.js';
import { addReportRoutes, createReportFiles } from './reports.js';
import { priceOrder, priceQuote } from './catalog.js';
import { describeSession } from './payments.js';
import { activateShopByEmail, addShopRoutes, updateShop } from './shop.js';
import { publicShop } from './accounts.js';
import { checkOrder, createCounter, isBot, rateLimit, sameOrigin, securityHeaders } from './security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(here, '..', 'web');
const MAX_PROMPT = 8000;

function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// What the customer may see about an order's payment (no provider ids).
function publicPayment(p) {
  if (!p) return null;
  const { lines, interval, recurring, once, dueToday, currency, method, status } = p;
  return { lines: lines.map(({ name, amount, recurring: r }) => ({ name, amount, recurring: r })), interval, recurring, once, dueToday, currency, method, status };
}

// Limits: aiPerMinute/aiPerDay are per visitor; aiDailyTotal caps everyone together so the AI bill can't run away.
// human is the optional Turnstile check from security.js; counter is where rate limit counts are kept.
// reports is where "Report a problem" messages are kept (see reports.js).
export function createApp({ ai, store, readStore, reports = createReportFiles(path.join(tmpdir(), 'think-web-pros')), reportsPerHour = 5, adminToken, aiPerMinute = 10, aiPerDay = 100, aiDailyTotal = 1000, ordersPerHour = 10, human = null, counter = createCounter(), headers = true, payments = {}, publicUrl, db = createDb(), shopHooks = {}, connect = null, notify = {}, pos = {} }) {
  const { stripe = null, paypal = null, zelle = null } = payments;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  if (headers) app.use(securityHeaders());
  app.use('/api', sameOrigin(), rateLimit(counter, 'api', [{ windowSec: 60, max: 300 }]));
  // Stripe signs the exact bytes it sends, so this route reads the raw body before the JSON parser below.
  // It passes the same-origin check because Stripe's servers send no Origin header.
  app.post('/api/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!stripe) return res.status(404).json({ error: 'not found' });
    let event;
    try {
      event = stripe.parseWebhook(req.body, req.get('stripe-signature'));
    } catch (err) {
      console.error('Stripe webhook rejected:', err.message);
      return res.status(400).json({ error: 'bad signature' });
    }
    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      console.error('Stripe webhook failed:', err.message);
      res.status(500).json({ error: 'webhook failed' });
    }
  });

  // card payments for shops go to each shop's own Stripe account (connect.js); emails and the like join via shopHooks
  const origin = (req) => (publicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  // messages sent outside a request (webhooks) link to the address the site was last reached at
  let seenOrigin = publicUrl ? publicUrl.replace(/\/$/, '') : '';
  app.use((req, res, next) => {
    if (!publicUrl && req.get('host')) seenOrigin = origin(req);
    next();
  });
  const notes = orderHooks({ ...notify, origin: () => seenOrigin });
  const hooks = {
    ...notes,
    ...shopHooks,
    // an order is confirmed (pay at pickup, or once the card payment lands): receipts, plus anything else that
    // wants it, like the register's kitchen screen (shopHooks.placed)
    placed: (shop, order) => Promise.all([notes.placed(shop, order), kitchenForOrder(db, shop, order).catch((err) => console.error(err.message)), shopHooks.placed?.(shop, order)]),
    ...(connect ? { checkout: (shop, order, req) => connect.checkout(shop, order, origin(req)) } : {}),
  };
  addConnectWebhook(app, { connect, db, hooks });

  const humanOnly = human ? human.middleware : (req, res, next) => next();
  // Designs carry uploaded logos and photos as data URLs, so orders can be large. Vercel stops bodies over 4.5 MB.
  app.use(express.json({ limit: '5mb' }));

  const paymentMethods = () => ({
    card: Boolean(stripe),
    test: Boolean(stripe?.testMode || (paypal && paypal.env !== 'live')),
    paypal: paypal ? { clientId: paypal.clientId } : null,
    zelle,
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ ai: Boolean(ai), payments: paymentMethods() }));

  const aiLimit = rateLimit(counter, 'ai', [
    { windowSec: 60, max: aiPerMinute },
    { windowSec: 86_400, max: aiPerDay },
    { windowSec: 86_400, max: aiDailyTotal, key: 'all' },
  ], 'Too many AI requests, try again shortly.');
  app.post('/api/ai/sample', aiLimit, humanOnly, async (req, res) => {
    if (!ai) return res.status(503).json({ code: 'not_granted', error: 'AI is not configured on this server.' });
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ code: 'bad_request', error: 'prompt is required' });
    if (prompt.length > MAX_PROMPT) return res.status(413).json({ code: 'too_long', error: 'prompt is too long' });
    try {
      res.json(await ai.complete(prompt, { json: Boolean(req.body.json) }));
    } catch (err) {
      if (err.code === 'refused') return res.status(422).json({ code: 'refused', error: err.message });
      console.error('AI request failed:', err.message);
      res.status(502).json({ code: 'server_error', error: 'The AI request failed.' });
    }
  });

  const orderLimit = rateLimit(counter, 'orders', [{ windowSec: 3600, max: ordersPerHour }, { windowSec: 86_400, max: ordersPerHour * 4 }]);
  app.post('/api/orders', orderLimit, humanOnly, async (req, res) => {
    const order = req.body?.order;
    if (!order || typeof order !== 'object' || Array.isArray(order)) return res.status(400).json({ error: 'order is required' });
    // a bot filled in the hidden field: look like it worked, keep nothing
    if (isBot(order)) return res.status(201).json({ id: randomUUID(), status: 'New' });
    const problem = checkOrder(order, req.body.design);
    if (problem) return res.status(413).json({ error: problem });
    const email = String(order.email || '').trim();
    if (!String(order.business || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'business and a valid email are required' });
    }
    delete order.hp;
    let price;
    try {
      price = priceOrder(order);
    } catch {
      return res.status(400).json({ error: 'unknown plan' });
    }
    const id = randomUUID();
    const record = {
      id,
      number: `TWP-${id.slice(0, 8).toUpperCase()}`,
      clientOrderId: String(order.id || ''),
      kind: order.kind || 'order',
      receivedAt: new Date().toISOString(),
      status: 'New',
      order,
      payment: price && { ...price, method: null, status: 'unpaid', history: [] },
      design: req.body.design ?? null,
    };
    await store.saveOrder(record);
    res.status(201).json({ id: record.id, number: record.number, status: record.status, payment: publicPayment(record.payment) });
  });

  /* ---------- paying for an order ---------- */
  app.use('/api/pay', rateLimit(counter, 'pay', [{ windowSec: 600, max: 60 }]));

  async function setPayment(id, patch, note) {
    const r = await recordPayment(id, patch, note);
    // a paid website plan opens the owner's shop for publishing
    if (r?.payment?.status === 'paid' && (r.order?.kind || 'order') === 'order') {
      await activateShopByEmail(db, r.order.email, `order ${r.number || r.id}`).catch((err) => console.error('Shop not turned on:', err.message));
    }
    return r;
  }
  async function recordPayment(id, patch, note) {
    return store.updateOrder(id, (r) => {
      if (!r.payment) return r;
      // a late or repeated event never takes an order back from paid to waiting
      if (r.payment.status === 'paid' && ['pending', 'processing', 'awaiting_zelle'].includes(patch.status)) patch = { ...patch, status: 'paid' };
      r.payment = { ...r.payment, ...patch, history: [...(r.payment.history || []), { at: new Date().toISOString(), status: patch.status, note }].slice(-50) };
      if (patch.status === 'paid' && r.status === 'New') r.status = 'Paid';
      return r;
    });
  }

  async function handleStripeEvent(event) {
    const o = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        const s = describeSession(o);
        if (!s.orderId) return;
        const status = event.type.endsWith('failed') ? 'failed' : s.status;
        await setPayment(s.orderId, { status, method: 'card', stripeCustomer: s.customer, stripeSubscription: s.subscription }, `Stripe ${event.type}`);
        return;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const orderId = o.parent?.subscription_details?.metadata?.orderId || o.subscription_details?.metadata?.orderId;
        if (!orderId || (event.type === 'invoice.paid' && o.billing_reason === 'subscription_create')) return;
        await setPayment(orderId, { status: event.type === 'invoice.paid' ? 'paid' : 'past_due' }, `Stripe ${event.type} ${o.amount_paid ?? o.amount_due}`);
        return;
      }
      case 'customer.subscription.deleted':
        if (o.metadata?.orderId) await setPayment(o.metadata.orderId, { status: 'cancelled' }, 'Stripe subscription cancelled');
    }
  }

  const validId = (id) => /^[0-9a-f-]{36}$/.test(id);
  // Loads the order for the pay routes; the order id is a random UUID, so knowing it is what lets someone pay.
  async function payable(req, res) {
    const record = validId(req.params.id) && (await store.getOrder(req.params.id));
    if (!record) return void res.status(404).json({ error: 'not found' });
    if (!record.payment) return void res.status(409).json({ code: 'not_priced', error: 'This order has no price yet. We will email you when your quote is ready.' });
    if (record.payment.status === 'paid') return void res.status(409).json({ code: 'paid', error: 'This order is already paid.' });
    return record;
  }

  app.get('/api/pay/:id', async (req, res) => {
    const record = validId(req.params.id) && (await store.getOrder(req.params.id));
    if (!record) return res.status(404).json({ error: 'not found' });
    res.json({ id: record.id, number: record.number, kind: record.kind, business: record.order.business, email: record.order.email, payment: publicPayment(record.payment), methods: paymentMethods() });
  });

  app.post('/api/pay/:id/card', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Card payments are not set up yet.' });
    const record = await payable(req, res);
    if (!record) return;
    try {
      const { url, sessionId } = await stripe.startCheckout({ record, price: record.payment, origin: origin(req) });
      await setPayment(record.id, { method: 'card', status: 'pending', stripeSession: sessionId }, 'Stripe Checkout opened');
      res.json({ url });
    } catch (err) {
      console.error('Stripe checkout failed:', err.message);
      res.status(502).json({ error: 'Card checkout could not start. Try again in a moment.' });
    }
  });

  // The success page asks here too, so the order shows paid even before (or without) the webhook.
  app.get('/api/pay/:id/card/result', async (req, res) => {
    if (!stripe) return res.status(404).json({ error: 'not found' });
    const sessionId = String(req.query.session_id || '');
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !validId(req.params.id)) return res.status(400).json({ error: 'bad request' });
    try {
      const s = await stripe.sessionResult(sessionId);
      if (s.orderId !== req.params.id) return res.status(404).json({ error: 'not found' });
      const r = await setPayment(s.orderId, { status: s.status, method: 'card', stripeCustomer: s.customer, stripeSubscription: s.subscription }, 'Stripe Checkout returned');
      res.json({ status: r?.payment?.status || s.status, number: r?.number });
    } catch (err) {
      console.error('Stripe result failed:', err.message);
      res.status(502).json({ error: 'Could not check the payment.' });
    }
  });

  app.post('/api/pay/:id/paypal', async (req, res) => {
    if (!paypal) return res.status(503).json({ error: 'PayPal is not set up yet.' });
    const record = await payable(req, res);
    if (!record) return;
    try {
      const started = await paypal.startCheckout({ record, price: record.payment });
      await setPayment(record.id, { method: 'paypal', status: 'pending', paypalPlanId: started.planId, paypalOrderId: started.paypalOrderId }, 'PayPal opened');
      res.json(started);
    } catch (err) {
      console.error('PayPal start failed:', err.message);
      res.status(502).json({ error: 'PayPal could not start. Try again in a moment.' });
    }
  });

  app.post('/api/pay/:id/paypal/confirm', async (req, res) => {
    if (!paypal) return res.status(503).json({ error: 'PayPal is not set up yet.' });
    const record = await payable(req, res);
    if (!record) return;
    const { paypalOrderId, subscriptionId } = req.body || {};
    try {
      let result;
      if (subscriptionId && record.payment.paypalPlanId) result = await paypal.checkSubscription(String(subscriptionId), record);
      else if (paypalOrderId && paypalOrderId === record.payment.paypalOrderId) result = await paypal.capture(String(paypalOrderId), record);
      else return res.status(400).json({ error: 'bad request' });
      if (!result.ok) {
        await setPayment(record.id, { status: 'failed' }, `PayPal ${result.status || 'not confirmed'}`);
        return res.status(402).json({ error: 'PayPal did not confirm the payment.' });
      }
      const r = await setPayment(record.id, { status: 'paid', method: 'paypal', paypalSubscription: subscriptionId || undefined, paypalCapture: result.captureId }, 'PayPal paid');
      res.json({ status: 'paid', number: r.number });
    } catch (err) {
      console.error('PayPal confirm failed:', err.message);
      res.status(502).json({ error: 'Could not confirm the PayPal payment.' });
    }
  });

  app.post('/api/pay/:id/zelle', async (req, res) => {
    if (!zelle) return res.status(503).json({ error: 'Zelle is not set up yet.' });
    const record = await payable(req, res);
    if (!record) return;
    await setPayment(record.id, { method: 'zelle', status: 'awaiting_zelle' }, 'Customer chose Zelle');
    res.json({ ...zelle, amount: record.payment.dueToday, memo: record.number, recurring: record.payment.recurring, interval: record.payment.interval });
  });

  // Admin reads require ADMIN_TOKEN; without one set they stay locked.
  // 10 wrong passwords from one address locks that address out for 15 minutes, so the token can't be guessed.
  const requireAdmin = async (req, res, next) => {
    const failKey = `admin-fail:${req.ip}`;
    if ((await counter(failKey, 900, 0)) >= 10) {
      res.set('Retry-After', '900');
      return res.status(429).json({ code: 'rate_limited', error: 'Too many wrong passwords. Try again in 15 minutes.' });
    }
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!adminToken || !token || !sameSecret(token, adminToken)) {
      await counter(failKey, 900);
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
  app.get('/api/orders', requireAdmin, async (req, res) => {
    const orders = await store.listOrders();
    res.json(orders.map(({ design, ...summary }) => summary));
  });
  app.get('/api/orders/:id', requireAdmin, async (req, res) => {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const order = await store.getOrder(req.params.id);
    order ? res.json(order) : res.status(404).json({ error: 'not found' });
  });
  // Admin changes: mark a Zelle (or any) payment received, price a custom quote, or move the order along.
  app.patch('/api/orders/:id', requireAdmin, async (req, res) => {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const { status, paymentStatus, quote } = req.body || {};
    let price;
    if (quote) {
      price = priceQuote({ setup: Number(quote.setup) || 0, monthly: Number(quote.monthly) || 0 });
      if (!price) return res.status(400).json({ error: 'enter a price' });
    }
    if (paymentStatus && !['paid', 'unpaid', 'failed', 'cancelled'].includes(paymentStatus)) return res.status(400).json({ error: 'bad payment status' });
    let record = await store.updateOrder(req.params.id, (r) => {
      if (typeof status === 'string' && status.trim()) r.status = status.trim().slice(0, 40);
      if (price) {
        if (r.payment?.status === 'paid') return r;
        r.payment = { ...price, method: null, status: 'unpaid', history: [...(r.payment?.history || []), { at: new Date().toISOString(), status: 'unpaid', note: 'Quote priced in Admin' }] };
      }
      return r;
    });
    if (!record) return res.status(404).json({ error: 'not found' });
    if (paymentStatus && record.payment) record = await setPayment(record.id, { status: paymentStatus }, 'Marked in Admin');
    const { design, ...summary } = record;
    res.json({ ...summary, payLink: record.payment ? `${origin(req)}/builder?pay=${record.id}` : null });
  });

  // shops owners have opened; Admin can turn one on without a paid order (a deal, a test, or a Zelle payment)
  app.get('/api/admin/shops', requireAdmin, async (req, res) => {
    const ids = await db.zrange('shops', { limit: 500 });
    res.json((await db.getMany(ids.map((id) => `shop:${id}`))).filter(Boolean).map(publicShop));
  });
  app.patch('/api/admin/shops/:id', requireAdmin, async (req, res) => {
    if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'active must be true or false' });
    const shop = /^[0-9a-f-]{36}$/.test(req.params.id) ? await updateShop(db, req.params.id, (s) => ({ ...s, active: req.body.active, activatedBy: 'Admin' })) : null;
    shop ? res.json(publicShop(shop)) : res.status(404).json({ error: 'not found' });
  });

  const reportLimit = rateLimit(counter, 'reports', [{ windowSec: 3600, max: reportsPerHour }, { windowSec: 86_400, max: reportsPerHour * 4 }], 'You’ve sent several reports already. Please wait a while and try again.');
  addReportRoutes(app, { reports, limit: reportLimit, humanOnly, requireAdmin });

  // reading another store's public product list: a few per visitor, since each one fetches pages from that store
  const importLimit = rateLimit(counter, 'import', [{ windowSec: 600, max: 10 }, { windowSec: 86_400, max: 40 }], 'You’ve imported several stores already. Please wait a few minutes and try again.');
  addImportRoutes(app, { readStore, limit: importLimit });

  // owner logins and live shops (accounts.js, shop.js); the register's routes build on the same db
  addAccountRoutes(app, { db, counter, humanOnly, mailer: notify.mailer || null, origin });
  addShopRoutes(app, { db, counter, humanOnly, hooks });
  addConnectRoutes(app, { connect, db, origin });
  // in-person register and kitchen screen (pos.js). pos: { terminal, appFee } from pos-env.js; receipts use notify's email and texts
  addPosRoutes(app, {
    db,
    mailer: notify.mailer || null,
    texter: notify.texter || null,
    ...pos,
    receiptBase: (publicUrl || '').replace(/\/$/, ''),
    pairLimit: rateLimit(counter, 'pos-pair', [{ windowSec: 600, max: 10 }]),
    loginLimit: rateLimit(counter, 'pos-login', [{ windowSec: 600, max: 60 }]),
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
  // a published shop's site: the studio page opens it in site mode (see TWP.site in platform.js)
  app.get('/s/:slug', (req, res) => res.sendFile(path.join(WEB_DIR, 'builder.html')));
  // the old studio guide page now lives inside the studio as the tour and Help panel
  app.get(['/guide', '/guide.html'], (req, res) => res.redirect(301, '/builder'));
  app.use(express.static(WEB_DIR, { extensions: ['html'] }));
  // Bad JSON or a body that's too big gets a plain answer; nothing about the server's insides is sent back.
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('Request failed:', err.message);
    res.status(status).json({ error: status === 413 ? 'request is too large' : status < 500 ? 'bad request' : 'server error' });
  });
  return app;
}
