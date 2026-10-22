/* Product import: turns another store's product export into Online store products.
   Reads the product CSV from Shopify, Etsy, Square, WooCommerce, Wix, Squarespace and our own export, plus any
   CSV with a name and price column (Big Cartel, eBay, a spreadsheet). The server's /api/import/store sends back
   a public store's products as JSON (Shopify, Big Cartel, WooCommerce or product data on the page), read by fromJSON.
   Everything comes out in the Online store's product shape (PB in app.js): name, price '$10', compare, image,
   images, desc, collection, stock, opt1/opt1v, opt2/opt2v ('Large (+$8)'), and vstock for stock per variant. */
(function (root) {
'use strict';

const PLATFORMS = {
  shopify: { name: 'Shopify', how: ['In Shopify admin, open Products.', 'Click Export, pick All products and CSV for Excel, Numbers, or other spreadsheet programs.', 'Shopify emails you the file. Choose it here.'], url: true },
  etsy: { name: 'Etsy', how: ['In Etsy Shop Manager, open Settings, then Options.', 'Open the Download Data tab and click Download CSV under Currently for sale listings.', 'Choose that file here.'] },
  square: { name: 'Square', how: ['In Square Dashboard, open Items & services, then Items.', 'Click Actions, then Export library, and pick CSV.', 'Choose that file here.'], url: true },
  woocommerce: { name: 'WooCommerce', how: ['In WordPress, open Products, then All Products.', 'Click Export at the top and then Generate CSV.', 'Choose that file here.'], url: true },
  wix: { name: 'Wix', how: ['In your Wix dashboard, open Catalog, then Store Products.', 'Click More Actions, then Export, and download the CSV.', 'Choose that file here.'], url: true },
  squarespace: { name: 'Squarespace', how: ['In Squarespace, open Commerce, then Inventory.', 'Click Export All to download a CSV.', 'Choose that file here.'], url: true },
  bigcartel: { name: 'Big Cartel', how: ['Paste your Big Cartel shop link above, like yourshop.bigcartel.com.', 'Or save your products from a spreadsheet as CSV with Name, Price, Description and Image columns.'], url: true },
  other: { name: 'Other or spreadsheet', how: ['Any CSV works if it has a Name (or Title) and a Price column.', 'Description, Image, Quantity, Category, Size and Color columns are picked up too.', 'From Excel or Google Sheets, use File, then Save as or Download, then CSV.'], url: true },
};
const MAX_PRODUCTS = 500;
const CURRENCY = { USD: '$', CAD: '$', AUD: '$', NZD: '$', MXN: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹' };

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.slice(0, text.search(/\r?\n|$/));
  const count = (ch) => first.split('"').filter((_, i) => i % 2 === 0).join('').split(ch).length;
  const delim = [',', ';', '\t'].reduce((a, b) => (count(b) > count(a) ? b : a));
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// rows as objects keyed by the lowercased header; a repeated header keeps its first filled value
function records(rows) {
  const head = (rows[0] || []).map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { const v = (r[i] ?? '').trim(); if (h && (o[h] === undefined || o[h] === '')) o[h] = v; });
    return o;
  });
}

function detect(headers) {
  const h = new Set(headers.map((x) => String(x).trim().toLowerCase()));
  const has = (...k) => k.every((x) => h.has(x));
  if (has('handle') && (h.has('title') || h.has('variant price'))) return 'shopify';
  if (has('handleid', 'fieldtype')) return 'wix';
  if (has('title', 'quantity') && (h.has('image1') || h.has('currency_code') || h.has('variation 1 type'))) return 'etsy';
  if (h.has('item name') && (h.has('variation name') || h.has('token'))) return 'square';
  if (h.has('regular price') || has('type', 'parent', 'attribute 1 name')) return 'woocommerce';
  if (has('product id', 'variant id') || h.has('hosted image urls')) return 'squarespace';
  if (has('name', 'opt1', 'opt1v')) return 'twp';
  return 'other';
}

/* ---------- small helpers ---------- */
function num(v) {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!s || !/\d/.test(s)) return NaN;
  if (s.includes(',') && !s.includes('.') && /,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else if (s.includes(',') && s.includes('.') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s.replace(/,/g, ''));
}
function fmt(n, sym = '$') {
  if (!isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return sym + (Number.isInteger(r) ? String(r) : r.toFixed(2));
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
function plain(html, max = 1200) {
  let s = String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return s;
}
// option labels can't hold commas: the store splits a product's choices on them
const label = (v) => String(v ?? '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
const httpUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim().replace(/^http:/i, 'https:') : '');
const lastSeg = (c) => String(c || '').split(/[,|]/)[0].split('>').pop().split('/').pop().trim();
function stockOf(v) {
  const s = String(v ?? '').trim();
  if (s === '' || /unlimited|infinite/i.test(s)) return null;
  if (/^(in ?stock|true|yes)$/i.test(s)) return null;
  if (/^(out ?of ?stock|sold ?out|false|no)$/i.test(s)) return 0;
  const n = num(s);
  return isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

/* A group is one product as read from a store: options [{name, values}], variants [{vals, price, compare, stock}].
   Products without variants carry price, compare and stock on the group itself. */
function group(key, o = {}) {
  return { key, name: '', desc: '', collection: '', images: [], options: [], variants: [], price: NaN, compare: NaN, stock: null, sym: '$', url: '', ...o };
}
function addImg(g, ...urls) { urls.forEach((u) => { u = httpUrl(u); if (u && !g.images.includes(u)) g.images.push(u); }); }
function addOpt(g, i, name, value) {
  if (!name && !value) return;
  const o = (g.options[i] ||= { name: label(name) || `Option ${i + 1}`, values: [] });
  if (!o.name && name) o.name = label(name);
  value = label(value);
  if (value && !o.values.includes(value)) o.values.push(value);
}
const DEFAULT_VARIANT = /^(default title|default|regular|title)$/i;

/* ---------- platform readers ---------- */
function readShopify(rs) {
  const by = new Map(), skipped = [];
  rs.forEach((r) => {
    const key = r.handle;
    if (!key) return;
    let g = by.get(key);
    if (!g) by.set(key, (g = group(key, { names: [] })));
    if (r.title && !g.name) {
      g.name = r.title; g.desc = plain(r['body (html)'] ?? r.body);
      g.collection = r.type || lastSeg(r['product category'] || r['standard product type'] || r['custom product type']);
      g.status = (r.status || '').toLowerCase();
      for (let i = 1; i <= 3; i++) g.names[i - 1] = r[`option${i} name`] || '';
    }
    addImg(g, r['image src'], r['variant image']);
    const vals = [1, 2, 3].map((i) => r[`option${i} value`] || '');
    if (r['variant price'] || vals[0]) {
      const real = vals[0] && !(DEFAULT_VARIANT.test(vals[0]) && DEFAULT_VARIANT.test(g.names[0] || 'title'));
      const tracked = 'variant inventory qty' in r && (r['variant inventory tracker'] ?? 'shopify') !== '';
      const v = { vals: real ? vals.filter(Boolean) : [], price: num(r['variant price']), compare: num(r['variant compare at price']), stock: tracked ? stockOf(r['variant inventory qty']) : null };
      if (real) vals.forEach((x, i) => x && addOpt(g, i, g.names[i], x));
      g.variants.push(v);
    }
  });
  const out = [];
  by.forEach((g) => (g.status === 'archived' ? skipped.push(g.name) : g.name && out.push(g)));
  return { groups: out, skipped };
}

function readEtsy(rs) {
  return { groups: rs.filter((r) => r.title).map((r, i) => {
    const g = group('etsy:' + (r.sku || r.title || i), { name: r.title, desc: plain(r.description), price: num(r.price), stock: stockOf(r.quantity), sym: CURRENCY[(r.currency_code || 'USD').toUpperCase()] || '$' });
    for (let k = 1; k <= 10; k++) addImg(g, r['image' + k]);
    for (let k = 1; k <= 2; k++) {
      const vals = String(r[`variation ${k} values`] || '').split(',').map(label).filter(Boolean);
      vals.forEach((v) => addOpt(g, k - 1, r[`variation ${k} name`] || r[`variation ${k} type`], v));
    }
    g.collection = lastSeg(r.section || '');
    return g;
  }), skipped: [] };
}

function readSquare(rs) {
  const by = new Map(), skipped = [];
  rs.forEach((r) => {
    const name = r['item name'];
    if (!name) return;
    if (/^(y|yes|true)$/i.test(r.archived || '')) { skipped.push(name); return; }
    let g = by.get(name);
    if (!g) by.set(name, (g = group('square:' + (r.token || name), { name })));
    if (!g.desc) g.desc = plain(r.description || r['item description'] || '');
    if (!g.collection) g.collection = lastSeg(r.categories || r.category || r['reporting category'] || '');
    Object.keys(r).filter((k) => /image/.test(k)).forEach((k) => String(r[k]).split(/[\s,]+/).forEach((u) => addImg(g, u)));
    const priceKey = Object.keys(r).find((k) => k === 'price') || Object.keys(r).find((k) => /^price\b/.test(k));
    const qtyKeys = Object.keys(r).filter((k) => /^current quantity/.test(k));
    const qty = qtyKeys.map((k) => stockOf(r[k])).filter((n) => n != null);
    const vals = [];
    for (let i = 1; i <= 3; i++) if (r[`option name ${i}`] || r[`option value ${i}`]) { vals.push(label(r[`option value ${i}`])); addOpt(g, i - 1, r[`option name ${i}`], r[`option value ${i}`]); }
    const vn = r['variation name'] || '';
    if (!vals.length && vn && !DEFAULT_VARIANT.test(vn)) { vals.push(label(vn)); addOpt(g, 0, 'Option', vn); }
    g.variants.push({ vals, price: num(priceKey ? r[priceKey] : ''), compare: NaN, stock: qty.length ? qty.reduce((a, b) => a + b, 0) : null });
  });
  return { groups: [...by.values()], skipped };
}

function readWoo(rs) {
  const parents = new Map(), out = [], skipped = [];
  const prices = (r) => { const reg = num(r['regular price']), sale = num(r['sale price']); return isFinite(sale) && sale > 0 ? { price: sale, compare: reg } : { price: reg, compare: NaN }; };
  const wooStock = (r) => (r.stock !== undefined && r.stock !== '' ? stockOf(r.stock) : /^(0|no|false)$/i.test(r['in stock?'] || '') ? 0 : null);
  rs.forEach((r) => {
    const type = (r.type || 'simple').toLowerCase();
    if (type.includes('variation')) return;
    if (!r.name) return;
    if (r.published === '-1') { skipped.push(r.name); return; }
    const g = group('woo:' + (r.id || r.sku || r.name), { name: r.name, desc: plain(r.description || r['short description']), collection: lastSeg(r.categories), stock: wooStock(r), ...prices(r) });
    String(r.images || '').split(/,\s*(?=https?:)/i).forEach((u) => addImg(g, u));
    for (let i = 1; i <= 3; i++) {
      const name = r[`attribute ${i} name`];
      if (name) String(r[`attribute ${i} value(s)`] || '').split(',').forEach((v) => addOpt(g, i - 1, name, v));
    }
    g.attrNames = g.options.map((o) => o.name);
    out.push(g);
    if (r.id) parents.set('id:' + r.id, g);
    if (r.sku) parents.set(r.sku, g);
  });
  rs.filter((r) => (r.type || '').toLowerCase().includes('variation')).forEach((r) => {
    const g = parents.get(r.parent) || parents.get('id:' + String(r.parent || '').replace(/^id:/, ''));
    if (!g) return;
    const vals = [];
    for (let i = 1; i <= 3; i++) {
      const name = r[`attribute ${i} name`], v = label(r[`attribute ${i} value(s)`]);
      if (!name || !v) continue;
      const at = g.options.findIndex((o) => o.name.toLowerCase() === label(name).toLowerCase());
      const idx = at >= 0 ? at : g.options.length;
      addOpt(g, idx, name, v);
      vals[idx] = v;
    }
    addImg(g, ...String(r.images || '').split(/,\s*(?=https?:)/i));
    g.variants.push({ vals, ...prices(r), stock: wooStock(r) });
  });
  return { groups: out, skipped };
}

function readWix(rs) {
  const by = new Map(), out = [];
  const wixImg = (n) => (n = String(n || '').trim()) && (httpUrl(n) || (/^[\w~.-]+\.\w{3,4}$/.test(n) ? 'https://static.wixstatic.com/media/' + n : ''));
  const choice = (c) => label(String(c).split(':').filter((p) => !/^#[\da-f]{3,8}$/i.test(p.trim())).join(' '));
  rs.forEach((r) => {
    const kind = (r.fieldtype || '').toLowerCase();
    if (kind === 'product') {
      let price = num(r.price), compare = NaN;
      const dv = num(r.discountvalue);
      if (isFinite(dv) && dv > 0) { compare = price; price = /percent/i.test(r.discountmode) ? price * (1 - dv / 100) : price - dv; }
      const g = group('wix:' + r.handleid, { name: r.name, desc: plain(r.description), collection: String(r.collection || '').split(';')[0].trim(), price, compare, stock: stockOf(r.inventory), off: compare - price });
      String(r.productimageurl || '').split(';').forEach((n) => { const u = wixImg(n); if (u && !g.images.includes(u)) g.images.push(u); });
      for (let i = 1; i <= 6 && g.options.length < 3; i++) {
        const name = r['productoptionname' + i];
        const at = g.options.length;
        if (name) String(r['productoptiondescription' + i] || '').split(';').forEach((c) => addOpt(g, at, name, choice(c)));
      }
      if (g.name) { by.set(r.handleid, g); out.push(g); }
    } else if (kind === 'variant') {
      const g = by.get(r.handleid);
      if (!g) return;
      const vals = g.options.map((_, i) => choice(r['productoptiondescription' + (i + 1)] || ''));
      const base = isFinite(g.compare) ? g.compare : g.price, sur = num(r.surcharge) || 0;
      g.variants.push({ vals, price: base + sur - (isFinite(g.off) ? g.off : 0), compare: isFinite(g.compare) ? base + sur : NaN, stock: stockOf(r.inventory) });
    }
  });
  return { groups: out, skipped: [] };
}

function readSquarespace(rs) {
  const out = [];
  let g = null;
  rs.forEach((r) => {
    if (r.title || (r['product id'] && !g) || (r['product id'] && g && r['product id'] !== g.pid)) {
      g = group('sqs:' + (r['product id'] || r.title), { name: r.title, pid: r['product id'], desc: plain(r.description), collection: lastSeg(r.categories) });
      String(r['hosted image urls'] || '').split(/\s+/).forEach((u) => addImg(g, u));
      if (/^no|false$/i.test(r.visible || '')) g.hidden = true;
      out.push(g);
    }
    if (!g) return;
    const vals = [];
    for (let i = 1; i <= 6; i++) if (r[`option value ${i}`]) { vals.push(label(r[`option value ${i}`])); addOpt(g, i - 1, r[`option name ${i}`], r[`option value ${i}`]); }
    const onSale = /^(yes|true)$/i.test(r['on sale'] || '');
    const price = num(r.price), sale = num(r['sale price']);
    g.variants.push({ vals, price: onSale && isFinite(sale) ? sale : price, compare: onSale && isFinite(sale) ? price : NaN, stock: stockOf(r.stock) });
  });
  return { groups: out.filter((x) => x.name), skipped: [] };
}

const SYN = {
  name: ['name', 'title', 'product name', 'product title', 'item name', 'item', 'product'],
  price: ['price', 'sale price', 'variant price', 'regular price', 'unit price', 'retail price', 'amount', 'cost'],
  compare: ['compare at price', 'compare-at price', 'compare price', 'original price', 'list price', 'msrp', 'was'],
  desc: ['description', 'body (html)', 'body', 'short description', 'details', 'product description', 'summary'],
  stock: ['quantity', 'stock', 'inventory', 'qty', 'quantity available', 'available', 'in stock', 'stock quantity', 'on hand'],
  collection: ['collection', 'category', 'categories', 'product type', 'type', 'department', 'section'],
  key: ['handle', 'parent', 'product id', 'item group id', 'group', 'sku group'],
};
function readGeneric(rs, rows) {
  const keys = (rows[0] || []).map((h) => h.trim().toLowerCase());
  const pick = (k) => SYN[k].find((s) => keys.includes(s));
  const col = Object.fromEntries(Object.keys(SYN).map((k) => [k, pick(k)]));
  const imgCols = keys.filter((k) => /image|photo|picture|img/.test(k));
  const optCols = [];
  for (let i = 1; i <= 3; i++) if (keys.includes(`option${i} name`) || keys.includes(`option ${i} name`)) optCols.push({ name: keys.includes(`option${i} name`) ? `option${i} name` : `option ${i} name`, value: keys.includes(`option${i} value`) ? `option${i} value` : `option ${i} value` });
  if (!optCols.length) ['size', 'color', 'colour', 'flavor', 'flavour', 'scent', 'style', 'material'].filter((k) => keys.includes(k)).slice(0, 2).forEach((k) => optCols.push({ fixed: k[0].toUpperCase() + k.slice(1), value: k }));
  if (!col.name) return { groups: [], skipped: [], error: 'This file needs a Name or Title column.' };
  const by = new Map(), out = [];
  rs.forEach((r) => {
    const name = r[col.name] || '';
    const key = (col.key && r[col.key]) || name;
    if (!key) return;
    let g = by.get(key);
    if (!g) {
      if (!name) return;
      g = group('csv:' + key, { name, desc: plain(col.desc ? r[col.desc] : ''), collection: lastSeg(col.collection ? r[col.collection] : '') });
      by.set(key, g); out.push(g);
    }
    imgCols.forEach((k) => String(r[k] || '').split(/[\s,;]+/).forEach((u) => addImg(g, u)));
    const vals = [];
    optCols.forEach((c, i) => { const v = r[c.value]; if (v) { vals.push(label(v)); addOpt(g, i, c.fixed || r[c.name], v); } });
    g.variants.push({ vals, price: num(col.price ? r[col.price] : ''), compare: num(col.compare ? r[col.compare] : ''), stock: col.stock ? stockOf(r[col.stock]) : null });
  });
  return { groups: out, skipped: [] };
}

// our own export (the store panel's CSV) is already in product shape
const TWP_COLS = ['name', 'collection', 'price', 'compare', 'stock', 'daily', 'badge', 'kind', 'desc', 'opt1', 'opt1v', 'opt2', 'opt2v', 'preorder', 'lead', 'image'];
function readTwp(rs) {
  return rs.filter((r) => r.name).map((r) => {
    const p = { images: [], src: 'twp:' + r.name.toLowerCase() };
    TWP_COLS.forEach((k) => { if (r[k] !== undefined && r[k] !== '') p[k] = k === 'lead' ? +r[k] || 0 : k === 'image' ? httpUrl(r[k]) || null : r[k]; });
    return p;
  });
}

/* ---------- group -> product ---------- */
function toProduct(g, notes) {
  const sym = g.sym || '$';
  const vs = g.variants.filter((v) => isFinite(v.price));
  const base = vs.length ? Math.min(...vs.map((v) => v.price)) : g.price;
  const p = { name: label(g.name).slice(0, 120) || 'Product', price: fmt(isFinite(base) ? base : 0, sym), desc: g.desc || '', collection: label(g.collection).slice(0, 40), image: g.images[0] || null, images: g.images.slice(1, 9), kind: 'item', src: g.key };
  const cheapest = vs.find((v) => v.price === base);
  const cmp = cheapest && isFinite(cheapest.compare) ? cheapest.compare : g.compare;
  if (isFinite(cmp) && cmp > base) p.compare = fmt(cmp, sym);
  const opts = g.options.filter((o) => o.values.length);
  if (opts.length > 2) notes.push(`${p.name}: only the first two choices (${opts[0].name}, ${opts[1].name}) were kept; ${opts.slice(2).map((o) => o.name).join(', ')} was left out.`);
  const idx = opts.slice(0, 2).map((o) => g.options.indexOf(o));
  // price differences between variants become "(+$8)" on the choice that costs more
  const add = idx.map(() => ({}));
  if (vs.length > 1) {
    idx.forEach((oi, n) => {
      g.options[oi].values.forEach((val) => {
        const m = vs.filter((v) => v.vals[oi] === val).map((v) => v.price - base - (n === 1 ? add[0][v.vals[idx[0]]] || 0 : 0));
        if (m.length) add[n][val] = Math.max(0, Math.round(Math.min(...m) * 100) / 100);
      });
    });
  }
  idx.forEach((oi, n) => {
    const o = g.options[oi];
    p['opt' + (n + 1)] = o.name;
    p['opt' + (n + 1) + 'v'] = o.values.map((v) => (add[n][v] > 0 ? `${v} (+${fmt(add[n][v], sym)})` : v)).join(', ');
  });
  // gift cards sell amounts: the store reads each choice as the card's value
  if (/gift ?card|gift ?certificate/i.test(p.name) && vs.length > 1) {
    p.kind = 'gift'; p.opt1 = 'Amount'; p.opt1v = [...new Set(vs.map((v) => fmt(v.price, sym)))].join(', '); delete p.opt2; delete p.opt2v;
  }
  const counted = (g.variants.length ? g.variants : [g]).filter((v) => v.stock != null);
  if (counted.length) p.stock = counted.reduce((a, v) => a + v.stock, 0);
  if (p.kind === 'item' && idx.length && counted.length > 1) {
    const vstock = {};
    g.variants.forEach((v) => { if (v.stock == null) return; const k = idx.map((oi) => v.vals[oi]).filter(Boolean).join(' / '); if (k) vstock[k] = (vstock[k] || 0) + v.stock; });
    if (Object.keys(vstock).length > 1) p.vstock = vstock;
  }
  return p;
}

function finish(groups, platform, skipped = [], error = '') {
  const notes = [];
  if (error) return { platform, products: [], notes, skipped, error };
  let products = groups.map((g) => toProduct(g, notes));
  if (products.length > MAX_PRODUCTS) { notes.push(`Only the first ${MAX_PRODUCTS} of ${products.length} products were read.`); products = products.slice(0, MAX_PRODUCTS); }
  const noPrice = products.filter((p) => p.price === '$0' || p.price === '').length;
  if (noPrice) notes.push(`${noPrice} product${noPrice > 1 ? 's have' : ' has'} no price yet. Look for $0 after importing.`);
  if (skipped.length) notes.push(`Skipped ${skipped.length} archived or draft product${skipped.length > 1 ? 's' : ''}.`);
  return { platform, products, notes, skipped, error: products.length ? '' : 'No products were found in this file.' };
}

function fromCSV(text, hint) {
  const rows = parseCSV(text);
  if (rows.length < 2) return finish([], hint || 'other', [], 'This file has no products in it. Check that it is the product export saved as CSV.');
  const platform = detect(rows[0]);
  const rs = records(rows);
  if (platform === 'twp') { const products = readTwp(rs); return { platform, products, notes: [], skipped: [], error: products.length ? '' : 'No products were found in this file.' }; }
  const read = { shopify: readShopify, etsy: readEtsy, square: readSquare, woocommerce: readWoo, wix: readWix, squarespace: readSquarespace }[platform];
  const r = read ? read(rs) : readGeneric(rs, rows);
  return finish(r.groups, platform, r.skipped, r.error);
}

/* ---------- JSON from /api/import/store ---------- */
function fromShopifyJSON(list) {
  return list.map((x) => {
    const g = group('shopify:' + (x.handle || x.id), { name: x.title, desc: plain(x.body_html), collection: x.product_type || '', url: x.handle ? '/products/' + x.handle : '' });
    (x.images || []).forEach((im) => addImg(g, im.src));
    const names = (x.options || []).map((o) => o.name);
    (x.variants || []).forEach((v) => {
      const vals = [v.option1, v.option2, v.option3].filter(Boolean);
      const real = vals.length && !(vals.length === 1 && DEFAULT_VARIANT.test(vals[0]));
      if (real) vals.forEach((val, i) => addOpt(g, i, names[i], val));
      g.variants.push({ vals: real ? vals.map(label) : [], price: num(v.price), compare: num(v.compare_at_price), stock: v.available === false ? 0 : null });
    });
    if (g.variants.some((v) => v.stock === 0) && !g.variants.every((v) => v.stock === 0)) g.variants.forEach((v) => (v.stock = null));
    return g;
  });
}
function fromBigCartel(list) {
  return list.map((x) => {
    const g = group('bigcartel:' + (x.permalink || x.id), { name: x.name, desc: plain(x.description), collection: (x.categories || [])[0]?.name || '' });
    (x.images || []).forEach((im) => addImg(g, im.secure_url || im.url));
    const opts = (x.options || []).filter((o) => o.name && !DEFAULT_VARIANT.test(o.name));
    opts.forEach((o) => { addOpt(g, 0, 'Option', o.name); g.variants.push({ vals: [label(o.name)], price: num(o.price ?? x.price), compare: NaN, stock: o.sold_out ? 0 : null }); });
    if (!opts.length) { g.price = num(x.default_price ?? x.price); g.stock = x.status === 'sold-out' ? 0 : null; }
    if (g.variants.some((v) => v.stock === 0) && !g.variants.every((v) => v.stock === 0)) g.variants.forEach((v) => (v.stock = null));
    return g;
  });
}
function fromWooStore(list) {
  return list.map((x) => {
    const pr = x.prices || {}, d = 10 ** (+pr.currency_minor_unit || 0);
    const price = num(pr.price) / d, reg = num(pr.regular_price) / d;
    const g = group('woo:' + (x.id || x.slug), { name: plain(x.name, 200), desc: plain(x.short_description || x.description), collection: (x.categories || [])[0]?.name || '', price, compare: reg > price ? reg : NaN, stock: x.is_in_stock === false ? 0 : null, sym: pr.currency_symbol || '$' });
    (x.images || []).forEach((im) => addImg(g, im.src));
    (x.attributes || []).filter((a) => a.has_variations).forEach((a, i) => (a.terms || []).forEach((t) => addOpt(g, i, a.name, plain(t.name, 60))));
    return g;
  });
}
function fromJsonLd(list) {
  const out = [];
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  const img = (v) => [].concat(v || []).map((i) => (typeof i === 'string' ? i : i?.url || i?.contentUrl)).filter(Boolean);
  const offer = (o) => { o = [].concat(o || []); const f = o.find((x) => x) || {}; return { price: num(f.price ?? f.lowPrice ?? f.priceSpecification?.price), cur: f.priceCurrency, out: /OutOfStock|SoldOut/i.test(f.availability || '') }; };
  list.forEach((x, i) => {
    if (!x || !x.name) return;
    const g = group('page:' + (x.sku || x.productID || x.url || x.name || i), { name: plain(x.name, 200), desc: plain(x.description), collection: lastSeg(typeof x.category === 'string' ? x.category : x.category?.name) });
    img(x.image).forEach((u) => addImg(g, u));
    if (Array.isArray(x.hasVariant) && x.hasVariant.length) {
      const dims = [].concat(x.variesBy || []).map((d) => String(d).split('/').pop());
      x.hasVariant.forEach((v) => {
        const o = offer(v.offers); g.sym = CURRENCY[o.cur] || g.sym;
        const vals = dims.map((d) => label(v[d] ?? v[d.toLowerCase()] ?? ''));
        vals.forEach((val, k) => val && addOpt(g, k, dims[k].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase()), val));
        img(v.image).forEach((u) => addImg(g, u));
        g.variants.push({ vals, price: o.price, compare: NaN, stock: o.out ? 0 : null });
      });
      if (g.variants.some((v) => v.stock === 0) && !g.variants.every((v) => v.stock === 0)) g.variants.forEach((v) => (v.stock = null));
    } else {
      const o = offer(x.offers); g.price = o.price; g.stock = o.out ? 0 : null; g.sym = CURRENCY[o.cur] || g.sym;
    }
    out.push(g);
  });
  return out;
}
function fromJSON(source, data) {
  const list = Array.isArray(data) ? data : [];
  const read = { shopify: fromShopifyJSON, bigcartel: fromBigCartel, woocommerce: fromWooStore, page: fromJsonLd }[source];
  if (!read) return finish([], source, [], 'That store could not be read.');
  return finish(read(list).filter((g) => g.name), source === 'page' ? 'other' : source);
}

/* ---------- into the store ----------
   'add' updates products that were imported before (or share a name) and adds the rest; 'replace' swaps the list. */
function merge(existing, incoming, mode = 'add') {
  if (mode === 'replace') return { items: incoming.slice(), added: incoming.length, updated: 0 };
  const items = existing.slice();
  let added = 0, updated = 0;
  const nm = (x) => String(x.name || '').trim().toLowerCase();
  incoming.forEach((p) => {
    const at = items.findIndex((x) => (p.src && x.src === p.src) || nm(x) === nm(p));
    if (at < 0) { items.push(p); added++; return; }
    const old = items[at], next = { ...old, ...p };
    if (!p.image && old.image) { next.image = old.image; next.images = old.images; }
    if (!p.desc && old.desc) next.desc = old.desc;
    items[at] = next; updated++;
  });
  return { items, added, updated };
}

const api = { PLATFORMS, parseCSV, detect, fromCSV, fromJSON, merge, plain, num };
root.TWPImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
