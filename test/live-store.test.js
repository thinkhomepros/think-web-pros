/* Browser check for the live store: an owner signs up and publishes, a shopper orders on /s/<slug>, the owner
   sees the order and the stock count drops. Runs when Playwright and a Chromium are available (set
   PLAYWRIGHT_MODULE to its index.mjs if it is not installed in this repo), and is skipped otherwise. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createDb } from '../server/db.js';
import { createStore } from '../server/store.js';
import { updateShop } from '../server/shop.js';

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs']) {
    if (!m) continue;
    try { return await import(m); } catch { /* try the next one */ }
  }
  return null;
}

test('owner publishes, shopper orders on the live site, owner sees it', async (t) => {
  const pw = await loadPlaywright();
  if (!pw) { t.skip('Playwright is not available'); return; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch { t.skip('No Chromium to run'); return; }
  const dir = await mkdtemp(path.join(tmpdir(), 'twp-live-'));
  const db = createDb();
  const server = createApp({ ai: null, store: createStore(dir), db, headers: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const expose = async (page) => {
      await page.route('**/js/app.js', async (r) => {
        const res = await r.fetch();
        const body = (await res.text()).replace(/\}\)\(\);\s*$/, "Object.defineProperty(window,'state',{get(){return state}});window.hard=hard;window.T_={buildFromForm,bizForm,shopSecs,smartSection,acct:()=>ACCT};})();");
        await r.fulfill({ response: res, body });
      });
      await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    };
    const errors = [];
    const owner = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
    owner.on('pageerror', (e) => errors.push(e.message));
    await expose(owner);
    await owner.goto(`${base}/builder?tour=0`);
    await owner.waitForFunction(() => window.T_ && window.state);
    // a bakery design with an online store, open every day so pickup times exist
    await owner.evaluate(() => {
      const r = T_.buildFromForm({ ...T_.bizForm(), name: 'Harbor Bakery', industry: 'bakery' }, null, null, { theme: true });
      Object.assign(state, r, { started: true, onboarded: true, tab: 'builder' });
      if (!state.sections.some((s) => s.type === 'shop')) state.sections.push(T_.smartSection('shop'));
      state.hours = state.hours.map(() => ({ open: '07:00', close: '19:00', closed: false }));
      const items = T_.shopSecs()[0].data.items;
      items.forEach((x) => { x.opt1 = ''; x.opt1v = ''; x.preorder = 'no'; x.kind = 'item'; x.vstock = undefined; });
      items[0].stock = '3';
      hard();
    });

    await owner.click('#obApp');
    await owner.click('.ob-menu [data-acct]');
    await owner.click('[data-acctmode="up"]');
    await owner.fill('#ac-biz', 'Harbor Bakery');
    await owner.fill('#ac-email', 'owner@harbor.co');
    await owner.fill('#ac-pw', 'goodpassword');
    await owner.click('#acctForm [type=submit]');
    await owner.waitForFunction(() => T_.acct());
    // the owner has paid for a plan
    await updateShop(db, await owner.evaluate(() => T_.acct().shop.id), (s) => ({ ...s, active: true }));
    await owner.click('#obApp');
    await owner.click('.ob-menu [data-pubsite]');
    await owner.waitForFunction(() => T_.acct().shop.published);
    const slug = await owner.evaluate(() => T_.acct().shop.slug);
    assert.equal(slug, 'harbor-bakery');

    const shopper = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
    shopper.on('pageerror', (e) => errors.push(e.message));
    await shopper.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await shopper.goto(`${base}/s/${slug}`);
    await shopper.waitForSelector('#site [data-spadd]');
    assert.equal(await shopper.locator('#acctBtn').isVisible(), false, 'no studio controls on the live site');
    assert.equal(await shopper.locator('.prevbar').isVisible(), false);
    await shopper.locator('#site [data-spadd]').first().click();
    await shopper.locator('#site [data-spadd]').first().click();
    await shopper.evaluate(() => document.querySelector('[data-spcart]') ? document.querySelector('[data-spcart]').click() : null);
    if (!(await shopper.locator('#spRoot .sp-drawer').count())) await shopper.locator('.toast button, [data-toastact]').first().click();
    await shopper.waitForSelector('#spRoot .sp-drawer');
    if (await shopper.locator('[data-spm="pickup"]').count()) await shopper.click('[data-spm="pickup"]');
    await shopper.locator('[data-spslot]').first().click();
    await shopper.click('[data-spstep="details"]');
    await shopper.fill('[data-spin="name"]', 'Sam Shopper');
    await shopper.fill('[data-spin="email"]', 'sam@example.com');
    assert.equal(await shopper.locator('[data-sppay]').count(), 1, 'only pay at pickup until cards are set up');
    await shopper.click('#spForm .sp-go');
    await shopper.waitForSelector('#spRoot .sp-done h3');
    assert.match(await shopper.locator('#spRoot .sp-done').innerText(), /Order #1001/);

    const shopId = await owner.evaluate(() => T_.acct().shop.id);
    const stock = await db.getStock(shopId);
    const first = await owner.evaluate(() => T_.shopSecs()[0].data.items[0].id);
    assert.equal(stock[first], 1, 'two taken from three');
    const orders = await owner.evaluate(() => fetch('/api/shop/orders').then((r) => r.json()));
    assert.equal(orders.length, 1);
    assert.equal(orders[0].name, 'Sam Shopper');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
