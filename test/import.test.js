import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// web/js/import.js is a browser script; run it in its own context and take what it puts on the global
const ctx = {};
vm.runInNewContext(readFileSync(new URL('../web/js/import.js', import.meta.url), 'utf8'), ctx);
const { fromCSV, fromJSON, parseCSV, detect, merge } = ctx.TWPImport;
const csv = (rows) => rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
const plainObj = (x) => JSON.parse(JSON.stringify(x));

describe('CSV reading', () => {
  test('quotes, commas, new lines and a byte order mark', () => {
    const rows = parseCSV('﻿Name,Description\n"Mug, large","Line one\nline ""two"""\r\n');
    assert.deepEqual(plainObj(rows), [['Name', 'Description'], ['Mug, large', 'Line one\nline "two"']]);
  });
  test('semicolon files from European spreadsheets', () => {
    assert.deepEqual(plainObj(parseCSV('Name;Price\nCandle;12,50')), [['Name', 'Price'], ['Candle', '12,50']]);
    assert.equal(fromCSV('Name;Price\nCandle;12,50').products[0].price, '$12.50');
  });
  test('detects each platform from its headers', () => {
    assert.equal(detect(['Handle', 'Title', 'Body (HTML)', 'Variant Price']), 'shopify');
    assert.equal(detect(['TITLE', 'DESCRIPTION', 'PRICE', 'CURRENCY_CODE', 'QUANTITY', 'IMAGE1']), 'etsy');
    assert.equal(detect(['Token', 'Item Name', 'Variation Name', 'Price']), 'square');
    assert.equal(detect(['ID', 'Type', 'Name', 'Regular price', 'Parent']), 'woocommerce');
    assert.equal(detect(['handleId', 'fieldType', 'name', 'price']), 'wix');
    assert.equal(detect(['Product ID', 'Variant ID', 'Title', 'Hosted Image URLs']), 'squarespace');
    assert.equal(detect(['Product name', 'Price']), 'other');
  });
});

describe('platform exports', () => {
  test('Shopify: variants, extra image rows, price differences, stock per variant', () => {
    const r = fromCSV(csv([
      ['Handle', 'Title', 'Body (HTML)', 'Type', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Price', 'Variant Compare At Price', 'Image Src', 'Status'],
      ['linen-dress', 'Linen dress', '<p>Soft <b>linen</b> &amp; pockets.</p>', 'Dresses', 'Size', 'S', 'Color', 'Sand', 'shopify', '3', '88.00', '110.00', 'https://cdn.shopify.com/a.jpg', 'active'],
      ['linen-dress', '', '', '', '', 'M', '', 'Sand', 'shopify', '5', '88.00', '110.00', 'https://cdn.shopify.com/b.jpg', ''],
      ['linen-dress', '', '', '', '', 'XL', '', 'Black', 'shopify', '0', '96.00', '', '', ''],
      ['mug', 'Mug', 'A mug', 'Kitchen', 'Title', 'Default Title', '', '', '', '', '28', '', 'https://cdn.shopify.com/m.jpg', 'active'],
      ['old', 'Old thing', '', '', 'Title', 'Default Title', '', '', '', '', '5', '', '', 'archived'],
    ]));
    assert.equal(r.platform, 'shopify');
    assert.equal(r.products.length, 2);
    const [d, m] = r.products;
    assert.equal(d.name, 'Linen dress');
    assert.equal(d.desc, 'Soft linen & pockets.');
    assert.equal(d.price, '$88');
    assert.equal(d.compare, '$110');
    assert.equal(d.collection, 'Dresses');
    assert.equal(d.opt1, 'Size');
    assert.equal(d.opt1v, 'S, M, XL (+$8)');
    assert.equal(d.opt2, 'Color');
    assert.equal(d.opt2v, 'Sand, Black');
    assert.equal(d.stock, 8);
    assert.deepEqual(plainObj(d.vstock), { 'S / Sand': 3, 'M / Sand': 5, 'XL / Black': 0 });
    assert.equal(d.image, 'https://cdn.shopify.com/a.jpg');
    assert.deepEqual(plainObj(d.images), ['https://cdn.shopify.com/b.jpg']);
    assert.equal(m.opt1, undefined);
    assert.equal(m.stock, undefined, 'untracked stock stays empty');
    assert.match(r.notes.join(' '), /Skipped 1 archived/);
  });

  test('Etsy: listing per row, images 1 to 10, variations, currency', () => {
    const r = fromCSV(csv([
      ['TITLE', 'DESCRIPTION', 'PRICE', 'CURRENCY_CODE', 'QUANTITY', 'TAGS', 'IMAGE1', 'IMAGE2', 'VARIATION 1 TYPE', 'VARIATION 1 NAME', 'VARIATION 1 VALUES', 'SKU'],
      ['Soy candle', 'Hand poured.', '24.00', 'USD', '18', 'candle', 'https://i.etsystatic.com/1.jpg', 'https://i.etsystatic.com/2.jpg', 'Scent', 'Scent', 'Cedar,Fig,Lavender', 'C1'],
      ['Print', 'Art print', '30', 'GBP', '4', '', '', '', '', '', '', ''],
    ]));
    assert.equal(r.platform, 'etsy');
    assert.equal(r.products[0].opt1v, 'Cedar, Fig, Lavender');
    assert.equal(r.products[0].stock, 18);
    assert.equal(r.products[0].images.length, 1);
    assert.equal(r.products[1].price, '£30');
  });

  test('Square: variations grouped by item, stock summed across locations, archived skipped', () => {
    const r = fromCSV(csv([
      ['Token', 'Item Name', 'Variation Name', 'SKU', 'Description', 'Categories', 'Price', 'Option Name 1', 'Option Value 1', 'Current Quantity Main St', 'Current Quantity Market', 'Archived'],
      ['T1', 'Cold brew', '16 oz', '', 'Steeped 18 hours', 'Drinks', '5.00', 'Size', '16 oz', '10', '2', 'N'],
      ['T1', 'Cold brew', '32 oz', '', '', 'Drinks', '9.00', 'Size', '32 oz', '4', '', 'N'],
      ['T2', 'Croissant', 'Regular', '', 'Butter', 'Pastry', '4.50', '', '', '', '', 'N'],
      ['T3', 'Gone', 'Regular', '', '', '', '1', '', '', '', '', 'Y'],
    ]));
    assert.equal(r.platform, 'square');
    assert.equal(r.products.length, 2);
    assert.equal(r.products[0].price, '$5');
    assert.equal(r.products[0].opt1v, '16 oz, 32 oz (+$4)');
    assert.equal(r.products[0].stock, 16);
    assert.equal(r.products[1].opt1, undefined);
    assert.equal(r.products[1].price, '$4.50');
  });

  test('WooCommerce: variable product with variation rows and a sale price', () => {
    const r = fromCSV(csv([
      ['ID', 'Type', 'SKU', 'Name', 'Published', 'Short description', 'Description', 'In stock?', 'Stock', 'Sale price', 'Regular price', 'Categories', 'Images', 'Parent', 'Attribute 1 name', 'Attribute 1 value(s)'],
      ['10', 'variable', 'TEE', 'Cotton tee', '1', 'Soft tee', '', '1', '', '', '', 'Clothing > Tops', 'https://shop.test/t1.jpg, https://shop.test/t2.jpg', '', 'Size', 'S, M, L'],
      ['11', 'variation', '', 'Cotton tee - S', '1', '', '', '1', '6', '25', '32', '', '', 'id:10', 'Size', 'S'],
      ['12', 'variation', '', 'Cotton tee - L', '1', '', '', '1', '2', '', '35', '', '', 'TEE', 'Size', 'L'],
      ['13', 'simple', '', 'Tote bag', '1', '', '<p>Canvas</p>', '0', '', '', '18', 'Bags', '', '', '', ''],
      ['14', 'simple', '', 'Draft thing', '-1', '', '', '1', '', '', '9', '', '', '', '', ''],
    ]));
    assert.equal(r.platform, 'woocommerce');
    assert.equal(r.products.length, 2);
    const [t, b] = r.products;
    assert.equal(t.collection, 'Tops');
    assert.equal(t.price, '$25');
    assert.equal(t.compare, '$32');
    assert.equal(t.opt1v, 'S, M, L (+$10)');
    assert.equal(t.stock, 8);
    assert.equal(t.images.length, 1);
    assert.equal(b.stock, 0, 'out of stock with no count is sold out');
    assert.equal(b.desc, 'Canvas');
  });

  test('Wix: product and variant rows, wixstatic images, percent discount', () => {
    const r = fromCSV(csv([
      ['handleId', 'fieldType', 'name', 'description', 'productImageUrl', 'collection', 'price', 'surcharge', 'discountMode', 'discountValue', 'inventory', 'productOptionName1', 'productOptionType1', 'productOptionDescription1'],
      ['p1', 'Product', 'Scarf', '<p>Silk</p>', 'abc123~mv2.jpg;https://x.test/b.jpg', 'Accessories;Sale', '50', '', 'PERCENT', '10', '', 'Color', 'COLOR', '#000000:Black;#FFFFFF:White'],
      ['p1', 'Variant', '', '', '', '', '', '0', '', '', '4', '', '', 'Black'],
      ['p1', 'Variant', '', '', '', '', '', '5', '', '', 'OutOfStock', '', '', 'White'],
    ]));
    assert.equal(r.platform, 'wix');
    const s = r.products[0];
    assert.equal(s.image, 'https://static.wixstatic.com/media/abc123~mv2.jpg');
    assert.equal(s.collection, 'Accessories');
    assert.equal(s.price, '$45');
    assert.equal(s.compare, '$50');
    assert.equal(s.opt1v, 'Black, White (+$5)');
    assert.equal(s.stock, 4);
  });

  test('Squarespace: variant rows under the product row, sale prices', () => {
    const r = fromCSV(csv([
      ['Product ID', 'Variant ID', 'Product Type', 'Title', 'Description', 'Option Name 1', 'Option Value 1', 'Price', 'Sale Price', 'On Sale', 'Stock', 'Categories', 'Hosted Image URLs', 'Visible'],
      ['abc', 'v1', 'PHYSICAL', 'Ceramic bowl', 'Glazed', 'Size', 'Small', '30', '24', 'Yes', '3', 'Kitchen', 'https://images.squarespace-cdn.com/1.jpg https://images.squarespace-cdn.com/2.jpg', 'Yes'],
      ['', 'v2', '', '', '', '', 'Large', '40', '', 'No', 'Unlimited', '', '', ''],
    ]));
    assert.equal(r.platform, 'squarespace');
    const p = r.products[0];
    assert.equal(p.price, '$24');
    assert.equal(p.compare, '$30');
    assert.equal(p.opt1v, 'Small, Large (+$16)');
    assert.equal(p.images.length, 1);
  });

  test('any CSV with a name and price, plus Size and Color columns', () => {
    const r = fromCSV(csv([
      ['Product Name', 'Price', 'Qty', 'Size', 'Image URL', 'Category'],
      ['Hoodie', '$45', '2', 'S', 'https://x.test/h.jpg', 'Tops'],
      ['Hoodie', '$45', '1', 'M', '', 'Tops'],
      ['Sticker, round', '3', '', '', 'not a url', ''],
    ]));
    assert.equal(r.platform, 'other');
    assert.equal(r.products.length, 2);
    assert.equal(r.products[0].opt1, 'Size');
    assert.equal(r.products[0].opt1v, 'S, M');
    assert.equal(r.products[0].stock, 3);
    assert.equal(r.products[1].name, 'Sticker round', 'commas are taken out of names used as choices');
    assert.equal(r.products[1].image, null);
  });

  test('gift cards become amount choices', () => {
    const r = fromCSV(csv([
      ['Handle', 'Title', 'Option1 Name', 'Option1 Value', 'Variant Price'],
      ['gift', 'Gift card', 'Denominations', '$25', '25'],
      ['gift', '', '', '$50', '50'],
    ]));
    assert.equal(r.products[0].kind, 'gift');
    assert.equal(r.products[0].opt1v, '$25, $50');
  });

  test('our own export reads back as it was', () => {
    const r = fromCSV(csv([
      ['name', 'collection', 'price', 'compare', 'stock', 'daily', 'badge', 'kind', 'desc', 'opt1', 'opt1v', 'opt2', 'opt2v', 'preorder', 'lead'],
      ['Sourdough', 'Bread', '$9', '', '', '24', 'best', 'item', 'Our loaf', 'Size', 'Half, Whole (+$4)', '', '', 'no', '0'],
    ]));
    assert.equal(r.platform, 'twp');
    assert.equal(r.products[0].daily, '24');
    assert.equal(r.products[0].opt1v, 'Half, Whole (+$4)');
  });

  test('files with no products say why', () => {
    assert.match(fromCSV('').error, /no products/i);
    assert.match(fromCSV('Color,Size\nred,S').error, /Name or Title/);
  });
});

describe('store JSON', () => {
  test('Shopify products.json', () => {
    const r = fromJSON('shopify', [{ title: 'Tee', handle: 'tee', body_html: '<p>Hi</p>', product_type: 'Tops', options: [{ name: 'Size' }], images: [{ src: 'https://cdn.shopify.com/t.jpg' }], variants: [{ option1: 'S', price: '20.00', compare_at_price: null, available: true }, { option1: 'L', price: '22.00', available: false }] }]);
    assert.equal(r.products[0].opt1v, 'S, L (+$2)');
    assert.equal(r.products[0].stock, undefined);
  });
  test('Big Cartel products.json', () => {
    const r = fromJSON('bigcartel', [{ name: 'Zine', permalink: 'zine', description: 'Issue 1', price: 8, status: 'active', images: [{ url: 'https://images.bigcartel.com/z.jpg' }], options: [{ name: 'Default', price: 8 }], categories: [{ name: 'Print' }] }]);
    assert.equal(r.products[0].price, '$8');
    assert.equal(r.products[0].collection, 'Print');
  });
  test('WooCommerce Store API prices in cents', () => {
    const r = fromJSON('woocommerce', [{ id: 1, name: 'Mug', short_description: '<p>Big</p>', prices: { price: '1800', regular_price: '2400', currency_minor_unit: 2, currency_symbol: '$' }, images: [{ src: 'https://shop.test/m.jpg' }], categories: [{ name: 'Kitchen' }], attributes: [], is_in_stock: true }]);
    assert.equal(r.products[0].price, '$18');
    assert.equal(r.products[0].compare, '$24');
  });
  test('schema.org Product data from a store page', () => {
    const r = fromJSON('page', [{ '@type': 'Product', name: 'Cake', image: ['https://x.test/c.jpg'], offers: { '@type': 'Offer', price: '45.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' } }]);
    assert.equal(r.products[0].price, '$45');
    assert.equal(r.products[0].image, 'https://x.test/c.jpg');
  });
});

describe('merge', () => {
  test('updates by import id or name, keeps photos the import lacks, adds the rest', () => {
    const had = [{ name: 'Mug', price: '$20', image: 'data:own', images: [], src: 'shopify:mug' }, { name: 'Candle', price: '$10' }];
    const r = merge(had, [{ name: 'Mug (new)', price: '$22', image: null, src: 'shopify:mug' }, { name: 'candle', price: '$12' }, { name: 'Print', price: '$30' }]);
    assert.equal(r.added, 1);
    assert.equal(r.updated, 2);
    assert.equal(r.items[0].image, 'data:own');
    assert.equal(r.items[0].price, '$22');
    assert.equal(r.items[1].price, '$12');
    assert.equal(merge(had, [{ name: 'X' }], 'replace').items.length, 1);
  });
});

describe('store links', async () => {
  const { createStoreReader, isPublicAddress, productsFromHtml, storeUrl } = await import('../server/importer.js');
  const { createApp } = await import('../server/app.js');
  const pub = async () => [{ address: '93.184.216.34' }];
  const reply = (status, body, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

  test('only public https store addresses', () => {
    assert.equal(storeUrl('myshop.com/collections/all').href, 'https://myshop.com/collections/all');
    assert.equal(storeUrl('http://myshop.com').protocol, 'https:');
    for (const bad of ['http://127.0.0.1', 'https://[::1]/', 'localhost', 'https://user:pw@shop.com', 'https://shop.com:8080', 'printer.local', 'ftp://x']) assert.equal(storeUrl(bad), null, bad);
    for (const ip of ['10.0.0.1', '172.16.4.4', '192.168.1.1', '169.254.169.254', '127.0.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1', '100.64.0.1']) assert.equal(isPublicAddress(ip), false, ip);
    assert.equal(isPublicAddress('8.8.8.8'), true);
  });

  test('a name that points at a private address is refused', async () => {
    const read = createStoreReader({ resolve: async () => [{ address: '10.1.2.3' }], fetchImpl: async () => assert.fail('must not fetch') });
    await assert.rejects(read('evil.example'), /not a store address/);
  });

  test('a redirect to a private address is refused', async () => {
    const read = createStoreReader({ resolve: async (h) => (h === 'inside.example' ? [{ address: '192.168.0.5' }] : pub()), fetchImpl: async () => reply(302, '', { location: 'https://inside.example/' }) });
    await assert.rejects(read('shop.example'), /not a store address/);
  });

  test('Shopify stores page through products.json', async () => {
    const seen = [];
    const read = createStoreReader({ resolve: pub, fetchImpl: async (url) => { seen.push(url); return reply(200, { products: [{ title: 'Tee', handle: 'tee', variants: [] }] }); } });
    const r = await read('https://tees.myshopify.com/collections/all');
    assert.equal(r.source, 'shopify');
    assert.equal(r.products.length, 1);
    assert.equal(seen[0], 'https://tees.myshopify.com/products.json?limit=250&page=1');
  });

  test('WooCommerce and plain store pages', async () => {
    const woo = createStoreReader({ resolve: pub, fetchImpl: async (url) => (url.includes('/wp-json/') ? reply(200, [{ id: 1, name: 'Mug', prices: { price: '900' } }]) : reply(404, 'no')) });
    assert.equal((await woo('cafe.example')).source, 'woocommerce');
    const html = '<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Cake","offers":{"price":"40"}}]}</script></html>';
    const page = createStoreReader({ resolve: pub, fetchImpl: async (url) => (url.includes('.json') || url.includes('wp-json') ? reply(404, 'no') : reply(200, html)) });
    const r = await page('bakery.example/shop');
    assert.equal(r.source, 'page');
    assert.equal(r.products[0].name, 'Cake');
  });

  test('Etsy links point to the CSV download', async () => {
    const read = createStoreReader({ resolve: pub, fetchImpl: async () => assert.fail('must not fetch') });
    await assert.rejects(read('https://www.etsy.com/shop/MyShop'), /Download Data/);
  });

  test('JSON-LD lists and broken blocks', () => {
    const html = '<script type="application/ld+json">{bad</script><script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"item":{"@type":"Product","name":"A"}},{"@type":"Product","name":"B"}]}</script>';
    assert.deepEqual(productsFromHtml(html).map((p) => p.name), ['A', 'B']);
  });

  test('POST /api/import/store answers with the products or a plain reason', async () => {
    const server = createApp({ ai: null, store: {}, headers: false, readStore: async (url) => { if (url === 'none.example') throw Object.assign(new Error('No products were found at that link.'), { status: 404 }); return { source: 'shopify', products: [{ title: 'Tee' }] }; } }).listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (url) => fetch(`${base}/api/import/store`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ url }) });
    const ok = await post('tees.example');
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).source, 'shopify');
    const no = await post('none.example');
    assert.equal(no.status, 404);
    assert.match((await no.json()).error, /No products/);
    server.close();
  });
});
