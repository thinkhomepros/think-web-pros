import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { checkAdminToken, createCounter, createHumanCheck, loadHeaderRules } from '../server/security.js';
import { createStore } from '../server/store.js';

async function start(options) {
  const server = createApp(options).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const order = (extra = {}) => ({ order: { business: 'Acme', email: 'a@acme.test', plan: 'pro', ...extra } });
const fakeAi = { model: 'test', async complete(prompt) { return { text: prompt }; } };

describe('security', () => {
  let dataDir, store;
  const servers = [];
  const launch = async (opts) => {
    const s = await start({ ai: fakeAi, store, adminToken: 'a-long-admin-token-for-tests', ...opts });
    servers.push(s.server);
    return s.base;
  };

  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'twp-sec-'));
    store = createStore(dataDir);
  });
  after(async () => {
    for (const s of servers) s.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('sends the vercel.json security headers on pages and the API', async () => {
    const base = await launch();
    const page = await fetch(`${base}/builder`);
    const csp = page.headers.get('content-security-policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.ok(page.headers.get('strict-transport-security'));
    assert.equal(page.headers.get('x-powered-by'), null);
    const api = await fetch(`${base}/api/health`);
    assert.equal(api.headers.get('cache-control'), 'no-store');
    assert.match(api.headers.get('content-security-policy'), /default-src/);
  });

  test('pages carry no inline scripts, so the policy needs no unsafe-inline', async () => {
    const base = await launch();
    for (const p of ['/', '/builder']) {
      const html = await (await fetch(`${base}${p}`)).text();
      const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g)];
      assert.equal(inline.length, 0, `${p} has an inline script`);
      assert.doesNotMatch(html, /\son[a-z]+="/, `${p} has an inline event handler`);
    }
  });

  test('header rules match only their paths', () => {
    const rules = loadHeaderRules();
    const api = rules.find((r) => r.list.some((h) => h.key === 'Cache-Control'));
    assert.ok(api.match.test('/api/orders'));
    assert.ok(!api.match.test('/builder'));
  });

  test('refuses posts sent from other websites', async () => {
    const base = await launch();
    assert.equal((await post(`${base}/api/orders`, order(), { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(`${base}/api/ai/sample`, { prompt: 'hi' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(`${base}/api/orders`, order(), { Origin: base })).status, 201);
  });

  test('caps AI use per visitor per day and for everyone together', async () => {
    const perDay = await launch({ aiPerMinute: 100, aiPerDay: 2 });
    assert.equal((await post(`${perDay}/api/ai/sample`, { prompt: 'a' })).status, 200);
    assert.equal((await post(`${perDay}/api/ai/sample`, { prompt: 'b' })).status, 200);
    const third = await post(`${perDay}/api/ai/sample`, { prompt: 'c' });
    assert.equal(third.status, 429);
    assert.ok(third.headers.get('retry-after'));
    const total = await launch({ aiPerMinute: 100, aiDailyTotal: 1 });
    assert.equal((await post(`${total}/api/ai/sample`, { prompt: 'a' })).status, 200);
    assert.equal((await post(`${total}/api/ai/sample`, { prompt: 'b' })).status, 429);
  });

  test('rate limits orders', async () => {
    const base = await launch({ ordersPerHour: 2 });
    assert.equal((await post(`${base}/api/orders`, order())).status, 201);
    assert.equal((await post(`${base}/api/orders`, order())).status, 201);
    assert.equal((await post(`${base}/api/orders`, order())).status, 429);
  });

  test('quietly drops orders from bots that fill in the hidden field', async () => {
    const before = (await store.listOrders()).length;
    const base = await launch();
    const res = await post(`${base}/api/orders`, order({ hp: 'http://spam.example' }));
    assert.equal(res.status, 201);
    assert.equal((await store.listOrders()).length, before);
  });

  test('rejects oversized fields, bad JSON and odd bodies without leaking details', async () => {
    const base = await launch();
    assert.equal((await post(`${base}/api/orders`, order({ business: 'x'.repeat(500) }))).status, 413);
    assert.equal((await post(`${base}/api/orders`, order({ details: 'x'.repeat(6000) }))).status, 413);
    assert.equal((await post(`${base}/api/orders`, { order: [] })).status, 400);
    const bad = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"order":' });
    assert.equal(bad.status, 400);
    const body = await bad.text();
    assert.doesNotMatch(body, /at |node_modules|SyntaxError/);
  });

  test('locks an address out after 10 wrong admin passwords', async () => {
    const base = await launch();
    const tryToken = (t) => fetch(`${base}/api/orders`, { headers: { Authorization: `Bearer ${t}` } });
    for (let i = 0; i < 10; i++) assert.equal((await tryToken(`guess-${i}`)).status, 401);
    assert.equal((await tryToken('a-long-admin-token-for-tests')).status, 429);
  });

  test('warns about a missing or short admin password', () => {
    assert.match(checkAdminToken(''), /not set/);
    assert.match(checkAdminToken('short'), /shorter/);
    assert.equal(checkAdminToken('x'.repeat(32)), null);
  });

  test('Turnstile: challenges first, then lets a verified visitor through with a cookie', async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push(String(opts.body));
      return new Response(JSON.stringify({ success: opts.body.get('response') === 'good-token' }));
    };
    const human = createHumanCheck({ siteKey: 'site', secretKey: 'secret', fetchImpl });
    const base = await launch({ human });
    const first = await post(`${base}/api/orders`, order());
    assert.equal(first.status, 403);
    assert.deepEqual(await first.json(), { code: 'challenge', siteKey: 'site', error: 'Please complete the security check.' });
    assert.equal((await post(`${base}/api/orders`, order(), { 'X-Turnstile-Token': 'bad-token' })).status, 403);
    const ok = await post(`${base}/api/orders`, order(), { 'X-Turnstile-Token': 'good-token' });
    assert.equal(ok.status, 201);
    const cookie = ok.headers.get('set-cookie').split(';')[0];
    assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await post(`${base}/api/ai/sample`, { prompt: 'hi' }, { Cookie: cookie })).status, 200);
    assert.equal((await post(`${base}/api/ai/sample`, { prompt: 'hi' }, { Cookie: cookie.replace(/.$/, 'x') })).status, 403);
    assert.equal(calls.length, 2);
  });

  test('Turnstile passes expire', async () => {
    let t = 1_000_000;
    const human = createHumanCheck({ siteKey: 's', secretKey: 'k', now: () => t, fetchImpl: async () => new Response('{"success":true}') });
    const base = await launch({ human });
    const ok = await post(`${base}/api/ai/sample`, { prompt: 'hi' }, { 'X-Turnstile-Token': 'x' });
    const cookie = ok.headers.get('set-cookie').split(';')[0];
    t += 7 * 3600_000;
    assert.equal((await post(`${base}/api/ai/sample`, { prompt: 'hi' }, { Cookie: cookie })).status, 403);
  });

  test('counts in Redis when it is set up, and falls back if Redis is down', async () => {
    const sent = [];
    const counter = createCounter({
      redis: { url: 'https://redis.test', token: 't' },
      fetchImpl: async (url, opts) => {
        sent.push(JSON.parse(opts.body));
        return new Response(JSON.stringify([{ result: 'OK' }, { result: 3 }]));
      },
    });
    assert.equal(await counter('ai:60:1.2.3.4', 60), 3);
    assert.deepEqual(sent[0], [['SET', 'twp:rl:ai:60:1.2.3.4', 0, 'EX', 60, 'NX'], ['INCRBY', 'twp:rl:ai:60:1.2.3.4', 1]]);
    const down = createCounter({ redis: { url: 'https://redis.test', token: 't' }, fetchImpl: async () => new Response('', { status: 500 }) });
    assert.equal(await down('k', 60), 1);
    assert.equal(await down('k', 60), 2);
  });
});
