import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseJsonObject } from '../server/ai.js';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';

async function start(options) {
  const server = createApp(options).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('server', () => {
  let dataDir, store, live, offline;

  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'twp-'));
    store = createStore(dataDir);
    const fakeAi = {
      model: 'test',
      async complete(prompt, { json }) {
        return { text: `echo: ${prompt}`, json: json ? { reply: 'ok', options: [] } : undefined };
      },
    };
    live = await start({ ai: fakeAi, store, adminToken: 'secret', aiPerMinute: 3 });
    offline = await start({ ai: null, store, adminToken: '' });
  });

  after(async () => {
    live.server.close();
    offline.server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('serves the landing page at the root', async () => {
    const res = await fetch(`${live.base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<h1/);
    assert.match(html, /href="\/builder"/);
    assert.match(html, /application\/ld\+json/);
    for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt', 'img/editor.webp']) {
      assert.equal((await fetch(`${live.base}/${file}`)).status, 200, file);
    }
  });

  test('serves the studio page at /builder', async () => {
    const res = await fetch(`${live.base}/builder`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Think Web Pros Studio/);
    assert.match(html, /\/js\/platform\.js/);
    assert.equal((await fetch(`${live.base}/js/app.js`)).status, 200);
  });

  test('serves the studio guide at /guide and the help scripts', async () => {
    const res = await fetch(`${live.base}/guide`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /HowTo/);
    assert.match(html, /\/js\/help-content\.js/);
    for (const file of ['js/help-content.js', 'js/help.js', 'css/help.css', 'img/guide/pc-1.webp', 'img/guide/tab-8.webp', 'img/guide/ph-4.webp']) {
      assert.equal((await fetch(`${live.base}/${file}`)).status, 200, file);
    }
    const studio = await (await fetch(`${live.base}/builder`)).text();
    assert.match(studio, /id="helpBtn"/);
    assert.match(studio, /\/js\/help\.js/);
  });

  test('reports whether AI is configured', async () => {
    assert.deepEqual(await (await fetch(`${live.base}/api/config`)).json(), { ai: true });
    assert.deepEqual(await (await fetch(`${offline.base}/api/config`)).json(), { ai: false });
  });

  test('AI endpoint answers, validates, and rate limits', async () => {
    const text = await (await post(`${live.base}/api/ai/sample`, { prompt: 'hi' })).json();
    assert.equal(text.text, 'echo: hi');
    const json = await (await post(`${live.base}/api/ai/sample`, { prompt: 'hi', json: true })).json();
    assert.equal(json.json.reply, 'ok');
    assert.equal((await post(`${live.base}/api/ai/sample`, { prompt: '' })).status, 400);
    assert.equal((await post(`${live.base}/api/ai/sample`, { prompt: 'again' })).status, 429);
    const off = await post(`${offline.base}/api/ai/sample`, { prompt: 'hi' });
    assert.equal(off.status, 503);
    assert.equal((await off.json()).code, 'not_granted');
  });

  test('stores orders and keeps them behind the admin token', async () => {
    assert.equal((await post(`${live.base}/api/orders`, { order: { business: 'Acme' } })).status, 400);
    const res = await post(`${live.base}/api/orders`, {
      order: { id: 'TWP-1001', business: 'Acme Plumbing', email: 'owner@acme.test', plan: 'pro' },
      design: { brand: { name: 'Acme Plumbing' } },
    });
    assert.equal(res.status, 201);
    const { id } = await res.json();

    assert.equal((await fetch(`${live.base}/api/orders`)).status, 401);
    assert.equal((await fetch(`${offline.base}/api/orders`, { headers: { Authorization: 'Bearer ' } })).status, 401);
    const auth = { headers: { Authorization: 'Bearer secret' } };
    const list = await (await fetch(`${live.base}/api/orders`, auth)).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].clientOrderId, 'TWP-1001');
    assert.equal(list[0].design, undefined);
    const full = await (await fetch(`${live.base}/api/orders/${id}`, auth)).json();
    assert.equal(full.design.brand.name, 'Acme Plumbing');
  });

  test('parseJsonObject tolerates text around the JSON', () => {
    assert.deepEqual(parseJsonObject('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
    assert.equal(parseJsonObject('no json here'), null);
  });
});
