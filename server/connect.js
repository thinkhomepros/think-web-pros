import express from 'express';
import Stripe from 'stripe';
import { ownerAuth, publicShop } from './accounts.js';
import { updateOrder, updateShop } from './shop.js';

/* ---------- card payments for shops (Stripe Connect) ----------
   Each shop connects its own Stripe account (a Standard account: the owner has their own Stripe dashboard and gets
   paid out by Stripe). Shopper payments are DIRECT charges on that account, so the money never passes through
   Think Web Pros; the platform's cut, if any, is taken as an application fee (SHOP_FEE_PERCENT).
   The register uses the same account (shop.stripeAccount) for Stripe Terminal. */

const cents = (n) => Math.round(Number(n || 0) * 100);

export function createConnect({ secretKey, webhookSecret, feePercent = 0, client } = {}) {
  if (!secretKey && !client) return null;
  const stripe = client || new Stripe(secretKey);
  const fee = Math.max(0, Math.min(10, Number(feePercent) || 0));
  return {
    stripe,
    feePercent: fee,
    testMode: !secretKey || /^(sk|rk)_test_/.test(secretKey),
    async createAccount(shop) {
      const a = await stripe.accounts.create({ type: 'standard', email: shop.email, business_profile: { name: shop.name }, metadata: { shopId: shop.id } });
      return a.id;
    },
    async onboardingLink(account, origin) {
      const l = await stripe.accountLinks.create({ account, type: 'account_onboarding', refresh_url: `${origin}/builder?connect=retry#dashboard`, return_url: `${origin}/builder?connect=done#dashboard` });
      return l.url;
    },
    async accountStatus(account) {
      const a = await stripe.accounts.retrieve(account);
      return { chargesEnabled: Boolean(a.charges_enabled), payoutsEnabled: Boolean(a.payouts_enabled), detailsSubmitted: Boolean(a.details_submitted) };
    },
    async dashboardLink() {
      // Standard accounts sign in to their own Stripe dashboard
      return 'https://dashboard.stripe.com/';
    },
    // A hosted Stripe Checkout page on the shop's own account, for exactly what the server priced.
    async checkout(shop, order, origin) {
      const items = order.discount > 0
        ? [{ name: `Order #${order.no} (${order.lines.reduce((n, l) => n + l.qty, 0)} items, ${order.code || 'discount'} applied)`, amount: cents(order.subtotal - order.discount), qty: 1 }]
        : order.lines.map((l) => ({ name: l.variant ? `${l.name} (${l.variant})` : l.name, amount: cents(l.unit), qty: l.qty }));
      if (order.fee > 0) items.push({ name: order.method === 'ship' ? 'Shipping' : 'Delivery', amount: cents(order.fee), qty: 1 });
      if (order.tax > 0) items.push({ name: 'Sales tax', amount: cents(order.tax), qty: 1 });
      const total = cents(order.total);
      const appFee = Math.floor((total * fee) / 100);
      const meta = { shopId: shop.id, orderId: order.id, orderNo: String(order.no) };
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: items.map((i) => ({ quantity: i.qty, price_data: { currency: 'usd', unit_amount: i.amount, product_data: { name: i.name.slice(0, 250) } } })),
        customer_email: order.email,
        client_reference_id: order.id,
        metadata: meta,
        payment_intent_data: { metadata: meta, description: `${shop.name} order #${order.no}`, ...(appFee > 0 ? { application_fee_amount: appFee } : {}) },
        // an unpaid order holds its stock for 30 minutes, then goes back on the shelf
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${origin}/s/${shop.slug}?paid=${order.id}`,
        cancel_url: `${origin}/s/${shop.slug}?pay=cancel`,
      }, { stripeAccount: shop.stripeAccount });
      return { url: session.url, sessionId: session.id };
    },
    async refund(shop, paymentIntent, amountCents) {
      const r = await stripe.refunds.create({ payment_intent: paymentIntent, ...(amountCents ? { amount: amountCents } : {}), refund_application_fee: true }, { stripeAccount: shop.stripeAccount });
      return { id: r.id, status: r.status, amount: r.amount };
    },
    async balance(shop) {
      const [b, payouts] = await Promise.all([
        stripe.balance.retrieve({}, { stripeAccount: shop.stripeAccount }),
        stripe.payouts.list({ limit: 10 }, { stripeAccount: shop.stripeAccount }),
      ]);
      const sum = (arr) => (arr || []).filter((x) => x.currency === 'usd').reduce((n, x) => n + x.amount, 0);
      return {
        available: sum(b.available),
        pending: sum(b.pending),
        payouts: payouts.data.map((p) => ({ id: p.id, amount: p.amount, status: p.status, arrival: p.arrival_date * 1000 })),
      };
    },
    parseWebhook(rawBody, signature) {
      if (!webhookSecret) throw new Error('STRIPE_CONNECT_WEBHOOK_SECRET is not set');
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },
  };
}

export function connectFromEnv(env = process.env) {
  return createConnect({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET, feePercent: env.SHOP_FEE_PERCENT });
}

// What happens when Stripe tells us about a shop's payment. Exported for tests.
export async function handleConnectEvent(event, { db, hooks = {} }) {
  const o = event.data.object;
  const meta = o.metadata || {};
  const shopId = meta.shopId;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (!shopId || !meta.orderId) return;
      const paid = o.payment_status === 'paid';
      let first = false;
      const order = await updateOrder(db, shopId, meta.orderId, (x) => {
        if (x.payment.status !== 'paid' && paid) first = true;
        x.payment = { ...x.payment, status: paid ? 'paid' : x.payment.status === 'paid' ? 'paid' : 'processing', intent: typeof o.payment_intent === 'string' ? o.payment_intent : o.payment_intent?.id, session: o.id };
        return x;
      });
      if (order?.payment.intent) await db.set(`stripe-pi:${order.payment.intent}`, { shopId, orderId: order.id });
      if (order && first && hooks.placed) {
        const shop = await db.get(`shop:${shopId}`);
        await hooks.placed(shop, order).catch((err) => console.error('Order follow-up failed:', err.message));
      }
      return;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      if (!shopId || !meta.orderId) return;
      let back = null;
      await updateOrder(db, shopId, meta.orderId, (x) => {
        if (x.payment.status === 'paid') return x;
        if (!x.stockReturned) {
          back = x.lines;
          x.stockReturned = true;
        }
        x.status = 'cancelled';
        x.payment = { ...x.payment, status: event.type === 'checkout.session.expired' ? 'abandoned' : 'failed' };
        return x;
      });
      if (back) await db.putStock(shopId, back);
      return;
    }
    case 'charge.refunded': {
      const pi = typeof o.payment_intent === 'string' ? o.payment_intent : o.payment_intent?.id;
      const pmeta = (pi && (await db.get(`stripe-pi:${pi}`))) || {};
      if (!pmeta.shopId || !pmeta.orderId) return;
      await updateOrder(db, pmeta.shopId, pmeta.orderId, (x) => {
        x.payment = { ...x.payment, refunded: o.amount_refunded / 100, status: o.refunded ? 'refunded' : 'partly_refunded' };
        return x;
      });
      return;
    }
    case 'account.updated': {
      const id = await db.get(`stripe-account:${o.id}`);
      if (id) await updateShop(db, id, (s) => ({ ...s, chargesEnabled: Boolean(o.charges_enabled) }));
      return;
    }
    default:
  }
}

// The webhook reads the raw body, so add it before express.json().
export function addConnectWebhook(app, { connect, db, hooks }) {
  app.post('/api/stripe/connect-webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!connect) return res.status(404).json({ error: 'not found' });
    let event;
    try {
      event = connect.parseWebhook(req.body, req.get('stripe-signature'));
    } catch (err) {
      console.error('Stripe Connect webhook rejected:', err.message);
      return res.status(400).json({ error: 'bad signature' });
    }
    try {
      await handleConnectEvent(event, { db, hooks });
      res.json({ received: true });
    } catch (err) {
      console.error('Stripe Connect webhook failed:', err.message);
      res.status(500).json({ error: 'webhook failed' });
    }
  });
}

export function addConnectRoutes(app, { connect, db, origin }) {
  const owner = ownerAuth(db);
  // starts (or continues) the owner's Stripe setup and returns the Stripe page to send them to
  app.post('/api/shop/payments/connect', owner, async (req, res) => {
    if (!connect) return res.status(503).json({ code: 'not_configured', error: 'Card payments aren’t switched on for Think Web Pros yet. Shoppers can still order and pay at pickup.' });
    try {
      let account = req.shop.stripeAccount;
      if (!account) {
        account = await connect.createAccount(req.shop);
        await db.set(`stripe-account:${account}`, req.shop.id);
        await updateShop(db, req.shop.id, (s) => ({ ...s, stripeAccount: account, chargesEnabled: false }));
      }
      res.json({ url: await connect.onboardingLink(account, origin(req)) });
    } catch (err) {
      console.error('Stripe setup failed:', err.message);
      res.status(502).json({ error: 'Stripe didn’t answer. Please try again in a minute.' });
    }
  });
  // checks with Stripe whether the shop can take cards yet (after the owner comes back from Stripe)
  app.get('/api/shop/payments', owner, async (req, res) => {
    const base = { available: Boolean(connect), connected: Boolean(req.shop.stripeAccount), chargesEnabled: Boolean(req.shop.chargesEnabled), feePercent: connect ? connect.feePercent : 0, testMode: Boolean(connect?.testMode) };
    if (!connect || !req.shop.stripeAccount) return res.json(base);
    try {
      const st = await connect.accountStatus(req.shop.stripeAccount);
      const shop = st.chargesEnabled !== Boolean(req.shop.chargesEnabled) ? await updateShop(db, req.shop.id, (s) => ({ ...s, chargesEnabled: st.chargesEnabled })) : req.shop;
      res.json({ ...base, ...st, shop: publicShop(shop) });
    } catch (err) {
      res.json({ ...base, error: 'Stripe didn’t answer just now.' });
    }
  });
  app.get('/api/shop/payments/balance', owner, async (req, res) => {
    if (!connect || !req.shop.stripeAccount) return res.status(404).json({ error: 'Card payments aren’t set up.' });
    try {
      res.json(await connect.balance(req.shop));
    } catch (err) {
      res.status(502).json({ error: 'Stripe didn’t answer just now.' });
    }
  });
}
