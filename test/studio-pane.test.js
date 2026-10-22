/* Browser check for the Studio edit pane. Runs when Playwright and a Chromium are available
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

test('turning on "Card and panel color" on a phone keeps the edit pane in view', async (t) => {
  const pw = await loadPlaywright();
  if (!pw) { t.skip('Playwright is not available'); return; }
  let browser;
  try { browser = await pw.chromium.launch(); } catch { t.skip('No Chromium to run'); return; }
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(await readFile(path.join(WEB, path.normalize(p)))); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0);
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
    /* let the test reach the studio state */
    await page.route('**/js/app.js', async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/\}\)\(\);\s*$/, "Object.defineProperty(window,'state',{get(){return state}});window.hard=hard;})();");
      await r.fulfill({ response: res, body });
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/builder.html`);
    await page.getByText('Skip tour').click();
    await page.getByText('Home services', { exact: true }).first().click();
    await page.getByText('Use this layout').first().click();
    await page.waitForFunction(() => window.state && window.state.sections.some((s) => s.type === 'services'));
    await page.evaluate(() => { const s = state.sections.find((x) => x.type === 'services'); state.selected = s.id; state.rightTab = 'section'; state.inspOpen = true; hard(); });
    await page.waitForSelector('#inspector .dk-slide[data-dk="bg"]');
    /* swipe to the Background slide and scroll to the bottom of it, as a person would */
    await page.evaluate(() => { const sl = document.querySelector('#inspector .dk-slide[data-dk="bg"]'); const tr = sl.parentElement; tr.scrollLeft = sl.offsetLeft - tr.offsetLeft; sl.scrollTop = sl.scrollHeight; });
    const label = page.locator('#inspector input[data-bgx$="|cardon"]').locator('xpath=..');
    const box = await label.boundingBox();
    await page.mouse.click(box.x + 10, box.y + box.height / 2);
    await page.waitForTimeout(500);
    const pane = await page.evaluate(() => { const p = document.querySelector('#fInsp'); const s = state.sections.find((x) => x.type === 'services'); return { top: p.scrollTop, left: p.scrollLeft, card: s.bg && s.bg.card }; });
    assert.ok(pane.card, 'the card color was turned on');
    assert.equal(pane.top, 0, 'the edit pane stays scrolled to its top');
    assert.equal(pane.left, 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
