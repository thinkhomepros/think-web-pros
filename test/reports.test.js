import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { cleanReport, createReportRedis, createReportFiles } from '../server/reports.js';
import { createStore } from '../server/store.js';

const TOKEN = 'a-long-admin-token-for-tests';
const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const admin = { Authorization: `Bearer ${TOKEN}` };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const report = (extra = {}) => ({
  report: {
    what: 'I clicked Save and nothing happened.',
    email: 'owner@shop.test',
    page: '/builder#builder',
    where: 'builder',
    env: { browser: 'Chrome 140', platform: 'Windows 10 or 11', screen: '1920×1080', window: '1400×900', touch: false, preview: 'Phone, Light' },
    errors: ['12:00:01 TypeError: x is undefined (/js/app.js:10)'],
    ...extra,
  },
});

describe('problem reports', () => {
  let dataDir, base, server;
  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'twp-rp-'));
    server = createApp({ ai: null, store: createStore(dataDir), reports: createReportFiles(dataDir), adminToken: TOKEN, reportsPerHour: 100, headers: false }).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('stores a report with its screenshot and lists it for the admin only', async () => {
    const res = await fetch(`${base}/api/reports`, { method: 'POST', ...json(report({ screenshot: PNG })) });
    assert.equal(res.status, 201);
    const { id } = await res.json();
    assert.match(id, /^[0-9a-f-]{36}$/);

    assert.equal((await fetch(`${base}/api/reports`)).status, 401);
    assert.equal((await fetch(`${base}/api/reports/${id}`)).status, 401);

    const list = await (await fetch(`${base}/api/reports`, { headers: admin })).json();
    const mine = list.find((r) => r.id === id);
    assert.equal(mine.status, 'New');
    assert.equal(mine.hasScreenshot, true);
    assert.equal(mine.screenshot, undefined, 'the list leaves screenshots out');
    assert.equal(mine.env.preview, 'Phone, Light');
    assert.equal(mine.errors.length, 1);

    const full = await (await fetch(`${base}/api/reports/${id}`, { headers: admin })).json();
    assert.equal(full.screenshot, PNG);
  });

  test('admin can move a report through its statuses', async () => {
    const { id } = await (await fetch(`${base}/api/reports`, { method: 'POST', ...json(report({ email: '' })) })).json();
    const patch = (body, headers = admin) => fetch(`${base}/api/reports/${id}`, { method: 'PATCH', headers: { ...json(body).headers, ...headers }, body: JSON.stringify(body) });
    assert.equal((await patch({ status: 'Fixed' }, {})).status, 401);
    assert.equal((await patch({ status: 'Done?' })).status, 400);
    const res = await patch({ status: 'In progress' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'In progress');
    assert.equal((await patch({ status: 'Fixed' })).status, 200);
    const list = await (await fetch(`${base}/api/reports`, { headers: admin })).json();
    assert.equal(list.find((r) => r.id === id).status, 'Fixed');
    assert.equal((await fetch(`${base}/api/reports/00000000-0000-0000-0000-000000000000`, { method: 'PATCH', headers: { ...json({}).headers, ...admin }, body: '{"status":"Fixed"}' })).status, 404);
  });

  test('rejects empty, malformed and oversized reports, and quietly drops bots', async () => {
    const send = (body) => fetch(`${base}/api/reports`, { method: 'POST', ...json(body) });
    const before = (await (await fetch(`${base}/api/reports`, { headers: admin })).json()).length;
    assert.equal((await send({})).status, 400);
    assert.equal((await send(report({ what: '   ' }))).status, 400);
    assert.equal((await send(report({ email: 'not-an-email' }))).status, 400);
    assert.equal((await send(report({ what: 'x'.repeat(5001) }))).status, 400);
    assert.equal((await send(report({ screenshot: 'data:text/html;base64,PGgxPg==' }))).status, 400);
    const bot = await send(report({ hp: 'http://spam.test' }));
    assert.equal(bot.status, 201);
    const after = (await (await fetch(`${base}/api/reports`, { headers: admin })).json()).length;
    assert.equal(after, before, 'nothing was stored');
  });

  test('rate limits reports from one visitor', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'twp-rl-'));
    const strict = createApp({ ai: null, store: createStore(dir), reports: createReportFiles(dir), adminToken: TOKEN, reportsPerHour: 2, headers: false }).listen(0);
    await new Promise((resolve) => strict.once('listening', resolve));
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await fetch(`http://127.0.0.1:${strict.address().port}/api/reports`, { method: 'POST', ...json(report()) })).status);
    strict.close();
    await rm(dir, { recursive: true, force: true });
    assert.deepEqual(statuses, [201, 201, 429]);
  });

  test('cleanReport trims the details the page attaches', () => {
    const { report: r } = cleanReport({ what: ' hi ', env: { browser: 'b'.repeat(900), touch: 'yes' }, errors: Array.from({ length: 40 }, (_, i) => `e${i}`), extra: 'ignored' });
    assert.equal(r.what, 'hi');
    assert.equal(r.env.browser.length, 500);
    assert.equal(r.env.touch, false);
    assert.equal(r.errors.length, 20);
    assert.equal(r.errors[19], 'e39');
    assert.equal(r.extra, undefined);
  });

  test('the studio and landing page load the report form', async () => {
    const studio = await (await fetch(`${base}/builder`)).text();
    assert.match(studio, /\/js\/report\.js/);
    assert.match(studio, /\/css\/report\.css/);
    const home = await (await fetch(`${base}/`)).text();
    assert.match(home, /data-report/);
    assert.match(home, /\/js\/report\.js/);
    for (const file of ['js/report.js', 'css/report.css']) assert.equal((await fetch(`${base}/${file}`)).status, 200, file);
  });
});

describe('report store on Redis', () => {
  test('keeps the screenshot under its own key and updates status', async () => {
    const db = new Map();
    const zset = [];
    const fetchImpl = async (url, { body }) => {
      const out = JSON.parse(body).map(([cmd, ...a]) => {
        if (cmd === 'SET') return db.set(a[0], a[1]) && 'OK';
        if (cmd === 'GET') return db.get(a[0]) ?? null;
        if (cmd === 'MGET') return a.map((k) => db.get(k) ?? null);
        if (cmd === 'ZADD') return zset.push([Number(a[1]), a[2]]);
        if (cmd === 'ZRANGE') return [...zset].sort((x, y) => y[0] - x[0]).map((z) => z[1]);
        throw new Error(cmd);
      });
      return { ok: true, json: async () => out.map((result) => ({ result })) };
    };
    const store = createReportRedis({ url: 'https://redis.test', token: 't', fetchImpl });
    await store.save({ id: 'a', receivedAt: '2026-10-22T00:00:00Z', status: 'New', what: 'one', screenshot: PNG });
    await store.save({ id: 'b', receivedAt: '2026-10-22T01:00:00Z', status: 'New', what: 'two', screenshot: null });
    assert.ok(!db.get('twp:report:a').includes('base64'));
    const list = await store.list();
    assert.deepEqual(list.map((r) => r.id), ['b', 'a']);
    assert.equal(list[1].hasScreenshot, true);
    assert.equal((await store.get('a')).screenshot, PNG);
    assert.equal((await store.setStatus('a', 'Fixed')).status, 'Fixed');
    assert.equal(await store.setStatus('zzz', 'Fixed'), null);
  });
});
