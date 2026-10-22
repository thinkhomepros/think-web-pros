import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/* ---------- import products from a public store link ----------
   POST /api/import/store { url } fetches what the store already shows anyone, with no keys:
   Shopify and Big Cartel publish /products.json, WooCommerce has its public Store API, and most other stores
   (Square Online, Wix, Squarespace) put schema.org Product data on their pages. The browser turns the answer into
   products (web/js/import.js fromJSON). Etsy blocks this kind of reading, so Etsy shops use the CSV download. */

const MAX_BYTES = 4_000_000;
const TIMEOUT_MS = 8000;
const MAX_PAGES = 4;

// private, loopback, link-local and other addresses a store can never live on
export function isPublicAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224);
  }
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase();
    if (x.startsWith('::ffff:')) return isPublicAddress(x.slice(7));
    return !(x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff') || x.startsWith('64:ff9b') || x.startsWith('2001:db8'));
  }
  return false;
}

export function storeUrl(input) {
  let s = String(input || '').trim();
  if (!s || s.length > 500) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) return null;
  if (isIP(u.hostname.replace(/^\[|\]$/g, '')) || !u.hostname.includes('.') || /\.(local|internal|localhost)$/i.test(u.hostname)) return null;
  u.protocol = 'https:';
  u.port = '';
  u.hash = '';
  return u;
}

export function createStoreReader({ fetchImpl = fetch, resolve = (h) => lookup(h, { all: true }) } = {}) {
  async function safeGet(url, accept, hops = 0) {
    const u = storeUrl(url);
    if (!u) throw Object.assign(new Error('That link is not a store address.'), { status: 400 });
    // every address the name points to must be public (fetch looks the name up again; Vercel's sandbox has no private network anyway)
    const addrs = await resolve(u.hostname).catch(() => []);
    if (!addrs.length) throw Object.assign(new Error('That store address could not be found.'), { status: 404 });
    if (!addrs.every((a) => isPublicAddress(a.address))) throw Object.assign(new Error('That link is not a store address.'), { status: 400 });
    const res = await fetchImpl(u.href, { redirect: 'manual', headers: { Accept: accept, 'User-Agent': 'ThinkWebProsImport/1.0 (+https://thinkwebpros.com)' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location') && hops < 3) return safeGet(new URL(res.headers.get('location'), u).href, accept, hops + 1);
    if (!res.ok) return { status: res.status, url: u, text: '' };
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return { status: 413, url: u, text: '' };
    const reader = res.body?.getReader?.();
    let text = '';
    if (reader) {
      const dec = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { reader.cancel().catch(() => {}); break; }
        text += dec.decode(value, { stream: true });
      }
    } else text = (await res.text()).slice(0, MAX_BYTES);
    return { status: res.status, url: u, text, type: res.headers.get('content-type') || '' };
  }
  const asJSON = (r) => { try { return r.status === 200 ? JSON.parse(r.text) : null; } catch { return null; } };

  async function shopifyOrBigCartel(origin) {
    const all = [];
    let kind = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = asJSON(await safeGet(`${origin}/products.json?limit=250&page=${page}`, 'application/json'));
      if (data && Array.isArray(data.products)) kind = 'shopify';
      else if (Array.isArray(data) && (!data.length || 'permalink' in data[0])) kind = 'bigcartel';
      else break;
      const list = kind === 'shopify' ? data.products : data;
      all.push(...list);
      if (kind === 'bigcartel' || list.length < 250) break;
    }
    return kind ? { source: kind, products: all } : null;
  }
  async function woo(origin) {
    const all = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = asJSON(await safeGet(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, 'application/json'));
      if (!Array.isArray(data) || (data.length && !('prices' in data[0]))) break;
      all.push(...data);
      if (data.length < 100) break;
    }
    return all.length ? { source: 'woocommerce', products: all } : null;
  }
  async function page(url) {
    const r = await safeGet(url, 'text/html');
    if (r.status === 403 || r.status === 429) return { blocked: true };
    return { source: 'page', products: productsFromHtml(r.text) };
  }

  return async function readStore(input) {
    const u = storeUrl(input);
    if (!u) throw Object.assign(new Error('Paste the link to your store, like yourshop.com or yourshop.myshopify.com.'), { status: 400 });
    if (/(^|\.)etsy\.com$/i.test(u.hostname)) throw Object.assign(new Error('Etsy does not let other sites read shops. Download your listings CSV from Etsy instead (Shop Manager, Settings, Options, Download Data).'), { status: 422, code: 'etsy' });
    const origin = u.origin;
    const found = (await shopifyOrBigCartel(origin)) || (await woo(origin)) || (await page(u.href));
    if (found.blocked) throw Object.assign(new Error('That store did not let us read it. Use its product CSV export instead.'), { status: 422 });
    if (!found.products.length) throw Object.assign(new Error('No products were found at that link. Try the link to your shop page, or use a CSV export.'), { status: 404 });
    return found;
  };
}

// schema.org Product objects in a page's JSON-LD, including ItemList and @graph wrappers
export function productsFromHtml(html) {
  const out = [];
  const walk = (x, depth = 0) => {
    if (!x || typeof x !== 'object' || depth > 6 || out.length >= 500) return;
    if (Array.isArray(x)) return x.forEach((y) => walk(y, depth + 1));
    const t = [].concat(x['@type'] || []).join(' ');
    if (/\bProduct(Group)?\b/.test(t)) { out.push(x); return; }
    if (x['@graph']) walk(x['@graph'], depth + 1);
    if (x.itemListElement) walk([].concat(x.itemListElement).map((e) => e.item || e), depth + 1);
    if (x.mainEntity) walk(x.mainEntity, depth + 1);
  };
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) { try { walk(JSON.parse(m[1].trim())); } catch { /* a broken block on the page */ } }
  return out;
}

export function addImportRoutes(app, { readStore = createStoreReader(), limit }) {
  app.post('/api/import/store', limit, async (req, res) => {
    try {
      res.json(await readStore(req.body?.url));
    } catch (err) {
      const status = err.status || 502;
      if (status >= 500) console.error('Store import failed:', err.message);
      res.status(status).json({ code: err.code || 'import_failed', error: status >= 500 && !err.status ? 'That store could not be reached. Try again, or use a CSV export.' : err.message });
    }
  });
}
