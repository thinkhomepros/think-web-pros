import Stripe from 'stripe';

const usd = (amountCents) => (amountCents / 100).toFixed(2);

// Stripe Checkout: one hosted page for cards, Apple Pay, Google Pay, Link, Cash App Pay, bank (ACH), Klarna, Afterpay
// and anything else switched on under Settings > Payment methods in the Stripe Dashboard. No method list is sent,
// so Stripe shows whichever methods fit the order (pay-over-time options hide themselves on monthly plans).
// Returns null without a secret key so the studio can hide card checkout.
export function createStripePayments({ secretKey, webhookSecret, client } = {}) {
  if (!secretKey && !client) return null;
  const stripe = client || new Stripe(secretKey);

  return {
    testMode: !secretKey || /^(sk|rk)_test_/.test(secretKey),
    async startCheckout({ record, price, origin }) {
      const subscription = price.recurring > 0;
      const meta = { orderId: record.id, orderNumber: record.number };
      const session = await stripe.checkout.sessions.create({
        mode: subscription ? 'subscription' : 'payment',
        line_items: price.lines.map((l) => ({
          quantity: l.quantity || 1,
          price_data: {
            currency: price.currency,
            unit_amount: l.unit || l.amount,
            product_data: { name: l.name },
            ...(l.recurring ? { recurring: { interval: price.interval } } : {}),
          },
        })),
        customer_email: record.order.email,
        client_reference_id: record.id,
        metadata: meta,
        ...(subscription ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta }, customer_creation: 'always' }),
        allow_promotion_codes: true,
        success_url: `${origin}/builder?paid=${record.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/builder?pay=${record.id}`,
      });
      return { url: session.url, sessionId: session.id };
    },
    // What a finished Checkout session says about payment. Bank payments (ACH) finish the page before the money arrives.
    async sessionResult(sessionId) {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      return describeSession(s);
    },
    parseWebhook(rawBody, signature) {
      if (!webhookSecret) throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not set'), { code: 'no_secret' });
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },
  };
}

export function describeSession(s) {
  const paid = s.payment_status === 'paid' || s.payment_status === 'no_payment_required';
  return {
    orderId: s.client_reference_id || s.metadata?.orderId,
    status: paid ? 'paid' : s.status === 'complete' ? 'processing' : 'pending',
    amount: s.amount_total,
    customer: typeof s.customer === 'string' ? s.customer : s.customer?.id,
    subscription: typeof s.subscription === 'string' ? s.subscription : s.subscription?.id,
    sessionId: s.id,
  };
}

// PayPal: the PayPal button pays from a PayPal balance, bank, card or Pay Later, and the Venmo button shows
// on devices where Venmo is available (US). One-time orders use the Orders API, monthly plans use Subscriptions.
export function createPayPalPayments({ clientId, secret, env = 'sandbox', fetchImpl = fetch } = {}) {
  if (!clientId || !secret) return null;
  const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  let token = null;

  async function auth() {
    if (token && token.expires > Date.now()) return token.value;
    const res = await fetchImpl(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const d = await res.json();
    if (!res.ok) throw new Error(`PayPal sign-in failed: ${d.error_description || res.status}`);
    token = { value: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return token.value;
  }
  async function api(method, path, body) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await auth()}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`PayPal ${path} failed: ${d.message || d.name || res.status}`);
    return d;
  }

  let productId = null;
  async function product() {
    if (productId) return productId;
    const p = await api('POST', '/v1/catalogs/products', { name: 'Think Web Pros website plan', type: 'SERVICE', category: 'SOFTWARE' });
    return (productId = p.id);
  }

  return {
    clientId,
    env,
    async startCheckout({ record, price }) {
      const value = (n) => ({ currency_code: 'USD', value: usd(n) });
      if (price.recurring > 0) {
        const plan = await api('POST', '/v1/billing/plans', {
          product_id: await product(),
          name: `${record.order.business} · ${record.number}`.slice(0, 127),
          billing_cycles: [{
            frequency: { interval_unit: price.interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: value(price.recurring) },
          }],
          payment_preferences: {
            auto_bill_outstanding: true,
            payment_failure_threshold: 3,
            ...(price.once > 0 ? { setup_fee: value(price.once), setup_fee_failure_action: 'CANCEL' } : {}),
          },
        });
        return { planId: plan.id };
      }
      const order = await api('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [{ reference_id: record.id, custom_id: record.id, invoice_id: record.number, description: `Think Web Pros order ${record.number}`, amount: value(price.dueToday) }],
      });
      return { paypalOrderId: order.id };
    },
    // Captures an approved one-time order and confirms it was for this order and the full amount.
    async capture(paypalOrderId, record) {
      const d = await api('POST', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {});
      const cap = d.purchase_units?.[0]?.payments?.captures?.[0];
      const ok = d.status === 'COMPLETED' && cap?.custom_id === record.id && cap?.amount?.value === usd(record.payment.dueToday);
      return { ok, captureId: cap?.id, status: cap?.status };
    },
    // Confirms an approved subscription belongs to this order and its plan.
    async checkSubscription(subscriptionId, record) {
      const s = await api('GET', `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
      const ok = s.custom_id === record.id && s.plan_id === record.payment.paypalPlanId && ['ACTIVE', 'APPROVED'].includes(s.status);
      return { ok, status: s.status };
    },
  };
}

// Zelle has no way for a website to take or confirm a payment: customers send it from their bank app,
// and the owner marks the order paid in Admin once it shows up.
export function zelleFromEnv(env) {
  const to = (env.ZELLE_RECIPIENT || '').trim();
  return to ? { to, name: (env.ZELLE_NAME || 'Think Web Pros').trim() } : null;
}
