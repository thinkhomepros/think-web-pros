/* ---------- Stripe Terminal (card readers) ----------
   Server-driven integration: the register never talks to the reader itself. The server asks Stripe to show the
   amount on the reader, the customer taps, dips or swipes, and the register asks the server how it went. This works
   from any browser (iPad, Android tablet, laptop) with Stripe's smart readers (WisePOS E, S700), and in test mode
   with Stripe's simulated reader, which needs no hardware.
   Calls Stripe's REST API with fetch, so there is no SDK to keep in step with the payments code. When a shop has its
   own Stripe account (Connect), its acct_ id goes in `account` and the charge lands in that account. */

const API = 'https://api.stripe.com/v1';

// Stripe takes form fields: { a: { b: 1 }, c: ['x'] } becomes a[b]=1&c[0]=x
export function formBody(obj, prefix = '', out = new URLSearchParams()) {
  for (const [key, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? formBody(item, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item))));
    else if (typeof v === 'object') formBody(v, name, out);
    else out.append(name, String(v));
  }
  return out;
}

export function createTerminal({ secretKey, fetchImpl = fetch } = {}) {
  if (!secretKey) return null;
  const testMode = /^(sk|rk)_test_/.test(secretKey);

  async function stripe(method, path, body, { account, idempotencyKey } = {}) {
    const headers = { Authorization: `Bearer ${secretKey}` };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (account) headers['Stripe-Account'] = account;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${API}${path}`, { method, headers, body: body ? formBody(body).toString() : undefined, signal: AbortSignal.timeout(20000) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(d.error?.message || `Stripe ${res.status}`);
      err.status = res.status;
      err.code = d.error?.code || 'stripe_error';
      throw err;
    }
    return d;
  }

  const cardOf = (pi) => {
    const ch = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const c = ch?.payment_method_details?.card_present || ch?.payment_method_details?.interac_present || {};
    return { brand: c.brand || '', last4: c.last4 || '', charge: ch?.id || (typeof pi.latest_charge === 'string' ? pi.latest_charge : '') };
  };

  return {
    testMode,
    // A location is Stripe's word for a shop address; every reader belongs to one.
    async ensureLocation({ name, address = {}, locationId, account }) {
      if (locationId) return locationId;
      const loc = await stripe('POST', '/terminal/locations', {
        display_name: String(name || 'Register').slice(0, 100),
        address: { line1: address.line1 || '1 Main St', city: address.city || 'Springfield', state: address.state || 'MO', postal_code: address.postal_code || '65801', country: address.country || 'US' },
      }, { account });
      return loc.id;
    },
    // code is what the reader shows in Settings > Generate pairing code, or simulated-wpe for Stripe's test reader.
    async registerReader({ code, label, locationId, account }) {
      const r = await stripe('POST', '/terminal/readers', { registration_code: code, label: String(label || 'Register').slice(0, 100), location: locationId }, { account });
      return readerSummary(r);
    },
    async listReaders({ locationId, account }) {
      const d = await stripe('GET', `/terminal/readers?limit=50${locationId ? `&location=${encodeURIComponent(locationId)}` : ''}`, null, { account });
      return (d.data || []).map(readerSummary);
    },
    async deleteReader({ readerId, account }) {
      await stripe('DELETE', `/terminal/readers/${encodeURIComponent(readerId)}`, null, { account });
    },
    // Shows the amount on the reader. The tip is already in amount (the customer picks it on the register screen).
    async startPayment({ readerId, amount, saleId, tenderId, fee = 0, description, account, metadata = {} }) {
      const pi = await stripe('POST', '/payment_intents', {
        amount,
        currency: 'usd',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        application_fee_amount: account && fee > 0 ? fee : undefined,
        description: String(description || '').slice(0, 300) || undefined,
        metadata: { saleId, source: 'twp-register', ...metadata },
      }, { account, idempotencyKey: `pi-${tenderId || saleId}-${amount}` });
      await stripe('POST', `/terminal/readers/${encodeURIComponent(readerId)}/process_payment_intent`, { payment_intent: pi.id, process_config: { skip_tipping: true } }, { account });
      return { paymentIntent: pi.id };
    },
    // Test mode only: the simulated reader "taps" a test card. 4000000000000002 is declined.
    async simulateTap({ readerId, card, account }) {
      if (!testMode) throw Object.assign(new Error('Only in test mode'), { status: 400 });
      await stripe('POST', `/test_helpers/terminal/readers/${encodeURIComponent(readerId)}/present_payment_method`, card ? { type: 'card_present', card_present: { number: card } } : {}, { account });
    },
    async paymentStatus({ readerId, paymentIntent, account }) {
      const pi = await stripe('GET', `/payment_intents/${encodeURIComponent(paymentIntent)}?expand[]=latest_charge`, null, { account });
      if (pi.status === 'succeeded') return { status: 'succeeded', amount: pi.amount_received || pi.amount, ...cardOf(pi) };
      if (pi.status === 'requires_capture') {
        const done = await stripe('POST', `/payment_intents/${encodeURIComponent(paymentIntent)}/capture`, {}, { account });
        return { status: 'succeeded', amount: done.amount_received || done.amount, ...cardOf(pi) };
      }
      if (pi.status === 'canceled') return { status: 'canceled' };
      let action = null;
      if (readerId) {
        const r = await stripe('GET', `/terminal/readers/${encodeURIComponent(readerId)}`, null, { account });
        action = r.action;
      }
      if (action?.status === 'failed') return { status: 'failed', message: action.failure_message || 'The card was declined.', code: action.failure_code || '' };
      if (pi.last_payment_error) return { status: 'failed', message: pi.last_payment_error.message || 'The card was declined.', code: pi.last_payment_error.code || '' };
      return { status: 'waiting' };
    },
    async cancelPayment({ readerId, paymentIntent, account }) {
      if (readerId) await stripe('POST', `/terminal/readers/${encodeURIComponent(readerId)}/cancel_action`, {}, { account }).catch(() => {});
      if (paymentIntent) await stripe('POST', `/payment_intents/${encodeURIComponent(paymentIntent)}/cancel`, {}, { account }).catch(() => {});
    },
    async refund({ paymentIntent, amount, refundId, account }) {
      const r = await stripe('POST', '/refunds', { payment_intent: paymentIntent, amount, metadata: { refundId, source: 'twp-register' } }, { account, idempotencyKey: `rf-${refundId}-${paymentIntent}` });
      return { id: r.id, status: r.status, amount: r.amount };
    },
  };
}

const readerSummary = (r) => ({ id: r.id, label: r.label || r.device_type, type: r.device_type, status: r.status || 'online', serial: r.serial_number || '', location: r.location || '', simulated: /simulated/i.test(r.device_type || '') || /^tmr_.*sim/i.test(r.id) });
