/* Browser check for news layouts and ad spaces. Runs when Playwright and a Chromium are available
   (set PLAYWRIGHT_MODULE to its index.mjs if it is not installed in this repo), and is skipped otherwise. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs']) {
    if (!m) continue;
    try { return await import(m); } catch { /* try the next one */ }
  }
  return null;
}

test('news layouts build, stories open, and an ad request can be approved into a spot', async (t) => {
  const pw = await loadPlaywright();
  if (!pw) { t.skip('Playwright is not available'); return; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch { t.skip('No Chromium to run'); return; }
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try { const body = await readFile(path.join(WEB, path.normalize(p))); res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0);
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
    await page.route('**/js/app.js', async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/\}\)\(\);\s*$/, "Object.defineProperty(window,'state',{get(){return state}});window.hard=hard;window.T_={KITS,buildFromForm,bizForm,adBookOpen};})();");
      await r.fulfill({ response: res, body });
    });
    await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/builder.html?tour=0`);
    await page.getByText('News or magazine', { exact: true }).first().click();
    await page.getByText('Use this layout').first().click();
    await page.waitForFunction(() => window.state && window.state.sections.some((s) => s.type === 'news'));

    /* every news layout renders its sections */
    const layouts = await page.evaluate(() => Object.keys(T_.KITS.news.layouts));
    assert.ok(layouts.length >= 5);
    for (const k of layouts) {
      const n = await page.evaluate((k) => { const r = T_.buildFromForm({ ...T_.bizForm(), industry: 'news' }, null, k, { theme: true }); Object.assign(state, r); hard(); return document.querySelectorAll('#site .nw-sec, #site .nw-tick, #site .nw-nl').length; }, k);
      assert.ok(n > 0, `layout ${k} shows news sections`);
    }

    /* a story opens as an article page */
    await page.click('#site .nw-view');
    await page.waitForSelector('#nwRoot .nw-art h1');
    await page.keyboard.press('Escape');

    /* suggested ad spaces turn on, and a request is approved into the top banner */
    await page.click('#obApp');
    await page.click('[data-adsopen="spots"]');
    await page.click('[data-adsugg]');
    assert.equal(await page.evaluate(() => Object.values(state.ads.slots).filter((s) => s.on).length), 6);
    await page.click('[data-closemodal]');
    assert.ok(await page.locator('#site .ad-top .ad-house').count());
    await page.evaluate(() => T_.adBookOpen('top'));
    await page.fill('[data-adbk="name"]', 'Kim Lee');
    await page.fill('[data-adbk="biz"]', 'Kim Hardware');
    await page.fill('[data-adbk="email"]', 'kim@example.com');
    await page.click('#adBookForm button[type=submit]');
    await page.waitForSelector('#nwRoot .nw-done');
    await page.click('#nwRoot .nw-done [data-nwclose]');
    const req = await page.evaluate(() => state.adRequests[0]);
    assert.equal(req.status, 'new');
    assert.equal(req.place, 'top');
    await page.click('#obApp');
    await page.click('[data-adsopen="spots"]');
    await page.click('[data-adtab="requests"]');
    await page.click('[data-adreq$="|approve"]');
    const top = await page.evaluate(() => state.ads.slots.top);
    assert.equal(top.src, 'direct');
    assert.equal(top.advertiser, 'Kim Hardware');
    assert.ok(top.start && top.end > top.start);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
