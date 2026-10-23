import { ownerAuth, publicShop } from './accounts.js';
import { updateOrder, updateShop } from './shop.js';

/* ---------- shipping labels (Shippo) ----------
   Each shop uses its own Shippo account, so label postage is billed to the shop owner, not to Think Web Pros:
   the owner pastes their Shippo API token in the account panel. SHIPPO_API_KEY on the server is only used when it is
   a test token (shippo_test_...), so anyone can try labels for free before setting up their own.
   Owners who buy labels somewhere else can type the carrier and tracking number instead. */

const API = 'https://api.goshippo.com';
const KEY_RE = /^shippo_(live|test)_[A-Za-z0-9]{10,80}$/;
export const DEFAULT_PARCEL = { length: 10, width: 8, height: 4, weight: 16 };

const TRACK = {
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  DHL: (n) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`,
};
export const trackingUrl = (carrier, n) => {
  const k = Object.keys(TRACK).find((c) => c.toLowerCase() === String(carrier || '').trim().toLowerCase());
  return k && n ? TRACK[k](encodeURIComponent(n)) : '';
};

export function createShipper({ apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) return null;
  const call = async (path, body) => {
    const res = await fetchImpl(API + path, {
      method: 'POST',
      headers: { Authorization: `ShippoToken ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || (typeof data === 'object' && Object.values(data).flat().find((v) => typeof v === 'string')) || `Shippo said no (${res.status})`);
    return data;
  };
  return {
    testMode: apiKey.startsWith('shippo_test_'),
    async rates({ from, to, parcel }) {
      const s = await call('/shipments/', {
        address_from: from,
        address_to: to,
        parcels: [{ length: String(parcel.length), width: String(parcel.width), height: String(parcel.height), distance_unit: 'in', weight: String(parcel.weight), mass_unit: 'oz' }],
        async: false,
      });
      return {
        rates: (s.rates || []).map((r) => ({ id: r.object_id, amount: Number(r.amount), carrier: r.provider, service: r.servicelevel?.name || '', days: r.estimated_days ?? null })).sort((a, b) => a.amount - b.amount),
        messages: (s.messages || []).map((m) => m.text).filter(Boolean).slice(0, 5),
      };
    },
    async buy(rateId) {
      const t = await call('/transactions/', { rate: rateId, label_file_type: 'PDF_4x6', async: false });
      if (t.status !== 'SUCCESS') throw new Error((t.messages || []).map((m) => m.text).join(' ') || 'Shippo didn’t make the label.');
      return { id: t.object_id, label: t.label_url, tracking: t.tracking_number, trackingUrl: t.tracking_url_provider || '' };
    },
  };
}

export function shippingFromEnv(env = process.env) {
  return { testKey: /^shippo_test_/.test(env.SHIPPO_API_KEY || '') ? env.SHIPPO_API_KEY : '' };
}

// "12 Elm St, Apt 2, Portland, ME 04101" (commas or new lines) -> Shippo's address fields. Best effort; the owner checks it.
export function parseAddress(text) {
  const parts = String(text || '').split(/\n|,/).map((p) => p.trim()).filter(Boolean);
  const out = { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' };
  if (!parts.length) return out;
  let last = parts[parts.length - 1];
  if (/^(usa?|united states( of america)?)$/i.test(last) && parts.length > 1) {
    parts.pop();
    last = parts[parts.length - 1];
  }
  const m = last.match(/^(.*?)\s*\b([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/);
  if (m) {
    parts.pop();
    out.state = m[2].toUpperCase();
    out.zip = m[3];
    if (m[1]) out.city = m[1].replace(/,$/, '');
    else if (parts.length > 1) out.city = parts.pop();
  }
  out.street1 = parts.shift() || '';
  out.street2 = parts.join(', ');
  return out;
}

const ADDR_KEYS = ['name', 'company', 'street1', 'street2', 'city', 'state', 'zip', 'phone', 'email'];
const cleanAddr = (a = {}) => ({ ...Object.fromEntries(ADDR_KEYS.map((k) => [k, String(a[k] ?? '').trim().slice(0, 100)])), country: 'US' });
const missing = (a) => ['street1', 'city', 'state', 'zip'].filter((k) => !a[k]);
const cleanParcel = (p = {}) => Object.fromEntries(Object.entries(DEFAULT_PARCEL).map(([k, d]) => [k, Math.max(0.1, Math.min(k === 'weight' ? 2400 : 108, Number(p[k]) || d))]));

export function addShippingRoutes(app, { db, shipping = {}, hooks = {}, fetchImpl }) {
  const owner = ownerAuth(db);
  const shipperFor = (shop) => createShipper({ apiKey: shop.shippoKey || shipping.testKey, fetchImpl });
  const view = (shop) => ({ available: Boolean(shop.shippoKey || shipping.testKey), ownKey: Boolean(shop.shippoKey), testMode: shop.shippoKey ? shop.shippoKey.startsWith('shippo_test_') : Boolean(shipping.testKey), from: shop.shipFrom || null, parcel: shop.parcel || DEFAULT_PARCEL });

  app.get('/api/shop/shipping', owner, (req, res) => res.json(view(req.shop)));
  // { apiKey?: "shippo_live_..." | "", from?: address, parcel?: { length, width, height (in), weight (oz) } }
  app.put('/api/shop/shipping', owner, async (req, res) => {
    const b = req.body || {};
    if (typeof b.apiKey === 'string' && b.apiKey && !KEY_RE.test(b.apiKey.trim())) return res.status(400).json({ error: 'That doesn’t look like a Shippo API token. It starts with shippo_live_ or shippo_test_.' });
    const shop = await updateShop(db, req.shop.id, (s) => {
      if (typeof b.apiKey === 'string') s.shippoKey = b.apiKey.trim() || undefined;
      if (b.from && typeof b.from === 'object') s.shipFrom = cleanAddr(b.from);
      if (b.parcel && typeof b.parcel === 'object') s.parcel = cleanParcel(b.parcel);
      return s;
    });
    res.json({ ...view(shop), shop: publicShop(shop) });
  });

  // prices to ship one order. Uses the address the shopper typed unless the owner corrected it ({ to }).
  app.post('/api/shop/orders/:id/rates', owner, async (req, res) => {
    const o = await db.get(`shop:${req.shop.id}:order:${req.params.id}`);
    if (!o) return res.status(404).json({ error: 'not found' });
    const to = cleanAddr({ ...parseAddress(o.addr), name: o.name, email: o.email, phone: o.phone, ...(req.body?.to || {}) });
    const parcel = cleanParcel(req.body?.parcel || req.shop.parcel);
    const shipper = shipperFor(req.shop);
    if (!shipper) return res.status(503).json({ code: 'not_configured', to, parcel, error: 'Add your Shippo API token (Sign in menu › your shop › Shipping labels) to buy labels here. You can still type a tracking number.' });
    if (!req.shop.shipFrom || missing(req.shop.shipFrom).length) return res.status(400).json({ code: 'from', to, parcel, error: 'Add the address you ship from first (your shop › Shipping labels).' });
    if (missing(to).length) return res.status(400).json({ code: 'address', to, parcel, error: `Check the shopper’s address: add the ${missing(to).join(', ').replace('street1', 'street')}.` });
    try {
      const r = await shipper.rates({ from: req.shop.shipFrom, to, parcel });
      // remember which rates belong to this order, so a label can only be bought for them
      await Promise.all(r.rates.map((x) => db.set(`shop:${req.shop.id}:rate:${x.id}`, { orderId: o.id, ...x }, { ttlSec: 86_400 })));
      res.json({ to, parcel, testMode: shipper.testMode, ...r });
    } catch (err) {
      res.status(502).json({ to, parcel, error: err.message });
    }
  });

  app.post('/api/shop/orders/:id/label', owner, async (req, res) => {
    const rate = req.body?.rate && (await db.get(`shop:${req.shop.id}:rate:${String(req.body.rate).slice(0, 64)}`));
    if (!rate || rate.orderId !== req.params.id) return res.status(400).json({ error: 'Those prices ran out. Get rates again.' });
    const o = await db.get(`shop:${req.shop.id}:order:${req.params.id}`);
    if (!o) return res.status(404).json({ error: 'not found' });
    if (o.shipping?.label) return res.status(409).json({ error: 'This order already has a label.' });
    const shipper = shipperFor(req.shop);
    if (!shipper) return res.status(503).json({ error: 'Shipping labels aren’t set up.' });
    let label;
    try {
      label = await shipper.buy(req.body.rate);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
    await db.del(`shop:${req.shop.id}:rate:${req.body.rate}`);
    let was = null;
    const next = await updateOrder(db, req.shop.id, o.id, (x) => {
      was = x.status;
      x.shipping = { carrier: rate.carrier, service: rate.service, cost: rate.amount, tracking: label.tracking, trackingUrl: label.trackingUrl || trackingUrl(rate.carrier, label.tracking), label: label.label, labelId: label.id, test: shipper.testMode, at: Date.now() };
      if (!['done', 'cancelled'].includes(x.status)) x.status = 'shipped';
      return x;
    });
    if (was !== next.status && hooks.status) hooks.status(req.shop, next).catch((err) => console.error('Status note failed:', err.message));
    res.json(next);
  });
}
