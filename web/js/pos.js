/* Think Web Pros register (/pos)
   Runs on a tablet, phone or computer, and keeps working when the internet drops: sales, refunds, drawer shifts and
   the time clock are saved on the device first (IndexedDB) and sent to the server when it is reachable.
   Three ways to run it:
   - server: set up with a shop name and owner PIN, or joined with a pairing code. Shares products, stock, sales and the
     kitchen screen with the shop's other devices. Cards go through Stripe Terminal when the server has a Stripe key.
   - local ("practice"): sample products, nothing leaves this browser, cards use a practice reader.
   Screens: lock (staff PIN), sell, orders, drawer, reports, products, settings. */
import * as C from './pos-core.js';

const { fmt, uid } = C;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ROLES = ['cashier', 'manager', 'owner'];
const rank = (r) => ROLES.indexOf(r);
const ROLE_NAME = { cashier: 'Cashier', manager: 'Manager', owner: 'Owner' };
const COLORS = ['#1e6b52', '#2f5fb3', '#b3472f', '#7a3fb0', '#b38a1e', '#2f8fa3', '#a32f6f', '#4a5560'];
const LS = 'twp-pos-v1';
const STUDIO = 'twp-studio-v3';

/* ---------- icons ---------- */
const IC = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>', other: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>', off: '<path d="M2 2l20 20M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.4M2 9a15 15 0 0 1 4.5-3"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', check: '<path d="M5 12l5 5 9-10"/>', back: '<path d="M15 6l-6 6 6 6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', note: '<path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chef: '<path d="M6 14a4 4 0 1 1 2-7.5 4 4 0 0 1 8 0A4 4 0 1 1 18 14v6H6z"/><path d="M6 17h12"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>', sync: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/>', pause: '<path d="M8 5v14M16 5v14"/>',
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- saved state ---------- */
const blankCart = () => ({ lines: [], discount: null, discountLabel: '', type: 'here', ticket: '', customer: { name: '', email: '', phone: '' }, note: '', parkedId: null });
let S = {
  mode: 'none', token: '', device: null, shop: null, catalog: { items: [], cats: [] }, stock: {}, devices: [],
  terminal: { enabled: false }, receipts: { email: false, text: false }, readerId: '', nextNo: 1, parked: [], shift: null, clocks: {},
  cart: blankCart(), staff: null, staffKey: '', view: 'sell', cat: 'All', q: '', online: navigator.onLine, outbox: 0, syncing: false, lastSync: 0,
};
const KEEP = ['mode', 'token', 'device', 'shop', 'catalog', 'stock', 'devices', 'terminal', 'receipts', 'readerId', 'nextNo', 'parked', 'shift', 'clocks', 'cart'];
function save() { try { localStorage.setItem(LS, JSON.stringify(Object.fromEntries(KEEP.map((k) => [k, S[k]])))); } catch (e) { toast('This device is out of space. Sync and clear old sales.'); } }
function load() { try { const d = JSON.parse(localStorage.getItem(LS) || 'null'); if (d) S = { ...S, ...d, cart: { ...blankCart(), ...(d.cart || {}) } }; } catch (e) { /* fresh */ } }

/* IndexedDB: sales, refunds, shifts, clock history and the outbox of things waiting to go to the server */
const STORES = ['sales', 'refunds', 'shifts', 'clock', 'outbox'];
let dbp = null;
function idb() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('twp-pos', 1);
    r.onupgradeneeded = () => STORES.forEach((s) => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function tx(store, mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
const put = (store, v) => tx(store, 'readwrite', (s) => s.put(v));
const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));
const all = (store) => tx(store, 'readonly', (s) => s.getAll());
const getOne = (store, id) => tx(store, 'readonly', (s) => s.get(id));
async function queue(kind, data) {
  await put('outbox', { id: `${kind}:${data.id}`, kind, data, at: Date.now() });
  S.outbox = (await all('outbox')).length;
  paintStatus();
  sync();
}

/* ---------- server ---------- */
class ApiError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }
async function api(path, { method = 'GET', body, staff = false, key = '', timeout = 15000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;
  if (staff || key) headers['X-Staff-Key'] = key || (await staffKey());
  let r;
  try {
    r = await fetch(`/api/pos${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    setOnline(false);
    throw new ApiError('No connection to the server.', 0, 'offline');
  }
  setOnline(true);
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && d.code === 'no_staff') S.staffKey = '';
  if (r.status === 401 && d.code === 'no_device' && S.mode === 'server') {
    toast('This register was removed from the shop. Set it up again.');
    resetDevice();
  }
  if (!r.ok) throw new ApiError(d.error || `Server error ${r.status}`, r.status, d.code);
  return d;
}
let pinMemo = null; // the signed-in person's PIN, in memory only, to get a server key once the connection is back
async function staffKey() {
  if (S.staffKey) return S.staffKey;
  if (!pinMemo || !S.staff) throw new ApiError('Sign in again to do that.', 401, 'no_staff');
  const d = await api('/login', { method: 'POST', body: { staffId: S.staff.id, pin: pinMemo } });
  S.staffKey = d.key;
  return d.key;
}
function setOnline(v) { if (S.online !== v) { S.online = v; paintStatus(); if (v) sync(); } }

let syncTimer = null;
async function sync() {
  if (S.mode !== 'server' || S.syncing) return;
  S.syncing = true;
  try {
    const box = await all('outbox');
    const pick = (k) => box.filter((b) => b.kind === k).slice(0, 50).map((b) => b.data);
    if (box.length) {
      const d = await api('/sync', { method: 'POST', body: { sales: pick('sale'), refunds: pick('refund'), shifts: pick('shift'), clock: pick('clock') } });
      for (const [k, list] of [['sale', d.accepted.sales], ['refund', d.accepted.refunds], ['shift', d.accepted.shifts], ['clock', d.accepted.clock]]) {
        for (const id of list) {
          const b = box.find((x) => x.id === `${k}:${id}`);
          // a newer copy of the same shift or clock record may have been queued while this one was on its way
          if (b) { const now = await getOne('outbox', b.id); if (now && now.at === b.at) await del('outbox', b.id); }
        }
      }
      for (const id of d.accepted.sales) { const s = await getOne('sales', id); if (s && !s.synced) { s.synced = true; await put('sales', s); } }
      S.stock = d.stock;
    } else if (Date.now() - S.lastSync > 60000) {
      await refreshState();
    }
    S.lastSync = Date.now();
    S.outbox = (await all('outbox')).length;
    save();
    paintStatus();
    if (S.view === 'sell' && !$('#modal:not([hidden])')) paintGrid();
    if (S.outbox && box.length) setTimeout(sync, 500);
  } catch (e) {
    if (e.code !== 'offline') console.warn('Sync failed:', e.message);
  } finally {
    S.syncing = false;
  }
}
async function refreshState() {
  const d = await api('/state');
  Object.assign(S, { device: d.device, shop: d.shop, catalog: d.catalog, stock: d.stock, devices: d.devices, terminal: d.terminal, receipts: d.receipts });
  if (S.staff && !S.shop.staff.some((m) => m.id === S.staff.id && m.active)) lock();
  save();
}
function startSyncLoop() { clearInterval(syncTimer); syncTimer = setInterval(sync, 15000); }
addEventListener('online', () => { S.online = true; sync(); paintStatus(); });
addEventListener('offline', () => setOnline(false));

/* ---------- PINs (same PBKDF2 as the server, so sign-in works offline) ---------- */
const PIN_ROUNDS = 60000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PIN_ROUNDS }, key, 256);
  return hex(bits);
}
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
async function pinOk(pin, member) { return Boolean(member?.salt && member?.hash) && (await pinHash(pin, member.salt)) === member.hash; }

/* ---------- small UI helpers ---------- */
let toastT = null;
function toast(msg, ms = 3200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
let modalDone = null;
function modal(html, { wide = false, onClose = null, cls = '' } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  modalDone = onClose;
  const f = m.querySelector('[autofocus]') || m.querySelector('input,select,textarea,button');
  if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; const f = modalDone; modalDone = null; if (f) f(); }
const head = (title, sub = '') => `<div class="sh-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button type="button" class="icon" data-act="close" aria-label="Close">${ic('x')}</button></div>`;
const isMgr = () => S.staff && rank(S.staff.role) >= 1;
const isOwner = () => S.staff && S.staff.role === 'owner';
const settings = () => S.shop?.settings || {};
const time = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dateLbl = (t) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Keypad used for PINs, custom amounts and cash. mode 'pin' shows dots, 'money' shows dollars.
function keypad(id) { return `<div class="keypad" data-pad="${id}">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => `<button type="button" data-key="${k}">${k}</button>`).join('')}</div>`; }
const pads = {};
function padPress(id, k) {
  const p = pads[id];
  if (!p) return;
  if (k === 'C') p.v = '';
  else if (k === '⌫') p.v = p.v.slice(0, -1);
  else if (p.v.length < (p.max || 9)) p.v += k;
  p.on(p.v);
}

/* ---------- start ---------- */
function render() {
  const app = $('#app');
  document.body.dataset.view = S.view;
  if (S.mode === 'none') return renderSetup(app);
  if (!S.staff) return renderLock(app);
  app.innerHTML = `<header class="bar">
    <button type="button" class="icon" data-act="nav" aria-label="Menu">${ic('menu')}</button>
    <div class="bar-name"><b>${esc(S.shop.name)}</b><small>${esc(S.device?.name || 'Register')}${S.mode === 'local' ? ' · practice' : ''}</small></div>
    <nav class="tabs" aria-label="Register">${navItems().map(([v, l]) => `<button type="button" class="${S.view === v ? 'on' : ''}" data-view="${v}">${l}</button>`).join('')}</nav>
    <span id="status" class="status"></span>
    <button type="button" class="who" data-act="lock" title="Lock the register">${ic('lock', 16)}<span>${esc(S.staff.name.split(' ')[0])}</span></button>
  </header><main id="main"></main>`;
  paintStatus();
  paintMain();
}
function navItems() {
  const n = [['sell', 'Sell'], ['orders', 'Orders']];
  n.push(['drawer', 'Drawer']);
  if (isMgr()) n.push(['reports', 'Reports'], ['products', 'Products']);
  if (isOwner() || isMgr()) n.push(['settings', 'Settings']);
  return n;
}
function paintMain() {
  const m = $('#main');
  if (!m) return;
  ({ sell: renderSell, orders: renderOrders, drawer: renderDrawer, reports: renderReports, products: renderProducts, settings: renderSettings }[S.view] || renderSell)(m);
}
function paintStatus() {
  const el = $('#status');
  if (!el) return;
  if (S.mode === 'local') { el.innerHTML = `<span class="pill">Practice</span>`; return; }
  el.innerHTML = S.online
    ? `<span class="pill ok" title="Connected">${ic('wifi', 14)}${S.outbox ? `<span>Sending ${S.outbox}</span>` : '<span>Online</span>'}</span>`
    : `<span class="pill warn" title="Sales are saved on this device and sent when the connection is back">${ic('off', 14)}<span>Offline${S.outbox ? ` · ${S.outbox} waiting` : ''}</span></span>`;
}

/* ---------- setup ---------- */
let ownerInfo = null; // { shop:{name}, setUp, owner } when the owner is signed in on this browser
function renderSetup(app) {
  const studio = studioProducts();
  const signed = ownerInfo;
  app.innerHTML = `<div class="setup"><div class="setup-card">
    <img src="/logo-light.png" alt="Think Web Pros" class="setup-logo">
    <h1>Set up your register</h1>
    <p class="mut">Ring up sales on this tablet, phone or computer. It keeps working if the internet drops.</p>
    <div class="setup-tabs" role="tablist"><button type="button" class="on" data-setup="new">Sign in</button><button type="button" data-setup="join">Join with a code</button><button type="button" data-setup="try">Just try it</button></div>
    <div id="fNew">${signed ? `
      <form class="setup-f" data-form="device">
        <p>Signed in to <b>${esc(signed.shop.name)}</b>. <button type="button" class="link" data-act="signout">Not you?</button></p>
        ${signed.setUp ? '<p class="mut">Your shop already has a register. This device joins it, and everyone signs in with the PIN they already have.</p>' : `
        <label>Your name<input name="owner" maxlength="80" value="${esc(signed.owner)}" autocomplete="name"></label>
        <div class="row2"><label>Pick a PIN for the register (4 to 8 digits)<input name="pin" required inputmode="numeric" pattern="\\d{4,8}" maxlength="8" type="password" autocomplete="new-password"></label>
        <label>PIN again<input name="pin2" required inputmode="numeric" pattern="\\d{4,8}" maxlength="8" type="password" autocomplete="new-password"></label></div>
        <label>Sales tax %<input name="tax" inputmode="decimal" placeholder="e.g. 8.25"></label>
        ${studio.extra.length ? `<label class="chk"><input type="checkbox" name="studio" checked> Add the ${studio.extra.length} menu items and services from my website design</label>` : ''}
        <p class="mut sm">Products you sell in your online store come over by themselves once your site is published, with the same stock counts.</p>`}
        <label>Name this device<input name="name" maxlength="60" placeholder="Front counter"></label>
        <button class="btn pri big" type="submit">Set up this register</button>
        <p class="err" id="setupErr" hidden></p>
      </form>` : `
      <form class="setup-f" data-form="signin">
        <p class="mut">Sign in with your Think Web Pros account. Your password isn’t kept on this device.</p>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn pri big" type="submit">Sign in</button>
        <p class="err" id="setupErr" hidden></p>
      </form>
      <button type="button" class="link" data-act="signup-show">New to Think Web Pros? Create an account</button>
      <form class="setup-f" data-form="signup" hidden id="fSignup"><label>Business name<input name="business" required maxlength="80" value="${esc(studio.name)}"></label><label>Your name<input name="name" maxlength="80" autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password (8 or more characters)<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn pri big" type="submit">Create account</button><p class="err" hidden></p></form>`}</div>
    <form id="fJoin" class="setup-f" data-form="join" hidden>
      <p class="mut">On a register that is already set up, a manager opens <b>Settings → Devices & card readers</b> and taps <b>Add a register</b>. Type the 6-digit code here.</p>
      <label>Pairing code<input name="code" required inputmode="numeric" maxlength="7" autocomplete="one-time-code" class="code-in"></label>
      <label>Name this device<input name="name" maxlength="60" placeholder="Register 2"></label>
      <button class="btn pri big" type="submit">Join shop</button>
      <p class="mut sm">Setting up the kitchen screen? Open <a href="/kitchen">/kitchen</a> on that tablet instead.</p>
      <p class="err" id="joinErr" hidden></p>
    </form>
    <div id="fTry" class="setup-f" hidden>
      <p class="mut">Practice mode uses sample products and a practice card reader. Nothing is charged and nothing leaves this browser. The owner PIN is <b>1234</b>.</p>
      <button class="btn pri big" type="button" data-act="practice">Open practice register</button>
    </div>
  </div></div>`;
}
async function checkOwner() {
  try {
    const r = await fetch('/api/pos/owner', { headers: ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {} });
    ownerInfo = r.ok ? await r.json() : null;
  } catch (e) { ownerInfo = null; }
}
let ownerToken = '';
async function doSignin(f, kind) {
  const v = Object.fromEntries(new FormData(f));
  const err = f.querySelector('.err');
  const btn = f.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const go = window.TWP?.fetch || fetch;
    const r = await go(`/api/account/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'That didn’t work. Try again.');
    ownerToken = d.token || '';
    await checkOwner();
    if (!ownerInfo) throw new Error('Signed in, but the register couldn’t see your shop. Try again.');
    render();
  } catch (e) {
    err.textContent = e.message === 'Failed to fetch' ? 'Signing in needs the internet.' : e.message;
    err.hidden = false;
    btn.disabled = false;
  }
}
async function doDevice(f) {
  const v = Object.fromEntries(new FormData(f));
  const err = $('#setupErr');
  const show = (m) => { err.textContent = m; err.hidden = false; };
  const body = { name: v.name || 'Register' };
  if (!ownerInfo.setUp) {
    if (v.pin !== v.pin2) return show('The two PINs don’t match.');
    if (!/^\d{4,8}$/.test(v.pin)) return show('Pick a PIN of 4 to 8 digits.');
    const studio = v.studio ? studioProducts() : { extra: [], stock: {} };
    body.owner = { name: v.owner, pin: v.pin };
    body.settings = { taxRate: parseFloat(v.tax) || 0, kitchenOn: studio.extra.some((i) => i.kitchen) };
    body.catalog = { items: studio.extra, stock: {} };
  }
  const btn = f.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Setting up…';
  try {
    const r = await fetch('/api/pos/devices', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}) }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Setup didn’t work. Try again.');
    ownerToken = '';
    adopt(d, 'server');
    toast('Your register is ready. Sign in with your PIN.');
  } catch (e) {
    show(e.message === 'Failed to fetch' ? 'Setup needs the internet.' : e.message);
    btn.disabled = false;
    btn.textContent = 'Set up this register';
  }
}
// products in the website designer in this browser; extra = the ones that aren't online store products
function studioProducts() {
  let r = { name: '', items: [], stock: {} };
  try { r = C.itemsFromStudio(JSON.parse(localStorage.getItem(STUDIO) || 'null')); } catch (e) { /* none */ }
  return { ...r, extra: r.items.filter((i) => !i.shop) };
}
async function doJoin(f) {
  const v = Object.fromEntries(new FormData(f));
  const err = $('#joinErr');
  try {
    const d = await api('/pair', { method: 'POST', body: { code: v.code, name: v.name || 'Register' } });
    if (d.device.kind === 'kitchen') { localStorage.setItem('twp-kitchen-v1', JSON.stringify({ token: d.token, device: d.device, shop: d.shop })); location.href = '/kitchen'; return; }
    adopt(d, 'server');
    toast('Joined. Sign in with your PIN.');
  } catch (e) { err.textContent = e.code === 'offline' ? 'Joining needs the internet.' : e.message; err.hidden = false; }
}
function adopt(d, mode) {
  Object.assign(S, { mode, token: d.token || S.token, device: d.device, shop: d.shop, catalog: d.catalog, stock: d.stock || {}, devices: d.devices || [], terminal: d.terminal || { enabled: false }, receipts: d.receipts || {}, staff: null, view: 'sell', cart: blankCart() });
  save();
  startSyncLoop();
  render();
}
async function practice() {
  const salt = newSalt();
  const owner = { id: uid('st'), name: 'Owner', role: 'owner', color: COLORS[0], active: true, salt, hash: await pinHash('1234', salt) };
  const salt2 = newSalt();
  const cashier = { id: uid('st'), name: 'Sam Cashier', role: 'cashier', color: COLORS[1], active: true, salt: salt2, hash: await pinHash('1111', salt2) };
  const studio = studioProducts();
  const items = studio.items.length ? studio.items : SAMPLE;
  adopt({ device: { id: uid('dv'), name: 'Practice register', kind: 'register' }, shop: { id: 'local', name: studio.name || 'Corner Café', settings: { taxRate: 8.25, tipsOn: true, tipPresets: [15, 20, 25], cashierMaxDiscount: 10, kitchenOn: true, receiptFooter: 'Thanks for visiting!', address: '12 Main St', phone: '' }, staff: [owner, cashier], terminal: {} }, catalog: { items, cats: [...new Set(items.map((i) => i.cat))] }, stock: studio.items.length ? studio.stock : { 'tee-000001|S': 4, 'tee-000001|M': 6, 'tee-000001|L': 1, 'mug-000001': 12 } }, 'local');
  toast('Practice register ready. Owner PIN 1234, cashier PIN 1111.', 6000);
}
const SAMPLE = [
  ['latte-00001', 'Latte', 450, 'Coffee', true, [{ name: 'Size', variant: false, vals: [{ label: '12 oz', add: 0 }, { label: '16 oz', add: 75 }] }, { name: 'Milk', vals: [{ label: 'Whole', add: 0 }, { label: 'Oat', add: 75 }, { label: 'Almond', add: 75 }] }, { name: 'Extras', multi: true, vals: [{ label: 'Extra shot', add: 100 }, { label: 'Vanilla', add: 60 }, { label: 'Caramel', add: 60 }] }]],
  ['drip-00001', 'Drip coffee', 300, 'Coffee', true, [{ name: 'Size', vals: [{ label: '12 oz', add: 0 }, { label: '16 oz', add: 50 }] }]],
  ['cold-00001', 'Cold brew', 500, 'Coffee', true, []],
  ['chai-00001', 'Chai latte', 525, 'Coffee', true, [{ name: 'Milk', vals: [{ label: 'Whole', add: 0 }, { label: 'Oat', add: 75 }] }]],
  ['crois-0001', 'Butter croissant', 375, 'Bakery', false, []],
  ['bun-000001', 'Cardamom bun', 450, 'Bakery', false, []],
  ['sour-00001', 'Sourdough loaf', 900, 'Bakery', false, [{ name: 'Sliced', vals: [{ label: 'Whole', add: 0 }, { label: 'Sliced', add: 0 }] }]],
  ['bfs-000001', 'Breakfast sandwich', 875, 'Kitchen', true, [{ name: 'Bread', vals: [{ label: 'English muffin', add: 0 }, { label: 'Croissant', add: 150 }] }, { name: 'Add', multi: true, vals: [{ label: 'Bacon', add: 200 }, { label: 'Avocado', add: 150 }] }]],
  ['toast-0001', 'Avocado toast', 1100, 'Kitchen', true, []],
  ['tee-000001', 'Logo T-shirt', 2400, 'Shop', false, [{ name: 'Size', variant: true, vals: [{ label: 'S', add: 0 }, { label: 'M', add: 0 }, { label: 'L', add: 0 }] }], true],
  ['mug-000001', 'Ceramic mug', 1800, 'Shop', false, [], true],
  ['beans-0001', 'Whole beans 12 oz', 1600, 'Shop', false, [], false, false],
].map(([id, name, price, cat, kitchen, opts, track = false, taxable = true]) => ({ id, name, price, cat, kitchen, opts: opts.map((g) => ({ multi: false, variant: false, ...g })), track, taxable, image: '', color: '' }));

/* ---------- lock screen ---------- */
let lockPick = null;
function renderLock(app) {
  const staff = (S.shop?.staff || []).filter((m) => m.active !== false);
  if (!lockPick && staff.length === 1) lockPick = staff[0].id;
  const who = staff.find((m) => m.id === lockPick);
  app.innerHTML = `<div class="lock"><div class="lock-card">
    <h1>${esc(S.shop.name)}</h1><p class="mut">${who ? `Enter ${esc(who.name.split(' ')[0])}’s PIN` : 'Who’s working?'}</p>
    <div class="staff-pick">${staff.map((m) => `<button type="button" class="staff ${m.id === lockPick ? 'on' : ''}" data-pick="${m.id}" style="--c:${esc(m.color || COLORS[0])}"><i>${esc(m.name.slice(0, 1).toUpperCase())}</i><span>${esc(m.name)}</span><small>${ROLE_NAME[m.role]}${S.clocks[m.id] ? ' · clocked in' : ''}</small></button>`).join('')}</div>
    ${who ? `<div class="dots" id="pinDots"></div>${keypad('pin')}<p class="err" id="pinErr" hidden></p>` : ''}
    <p class="mut sm lock-foot">${S.mode === 'local' ? 'Practice mode · owner PIN 1234, cashier PIN 1111 · ' : ''}<a href="/kitchen">Kitchen screen</a></p>
  </div></div>`;
  if (who) {
    const dots = $('#pinDots');
    const paint = (v) => { dots.innerHTML = Array.from({ length: Math.max(4, v.length) }, (_, i) => `<i class="${i < v.length ? 'on' : ''}"></i>`).join(''); };
    paint('');
    pads.pin = { v: '', max: 8, on: async (v) => { paint(v); if (v.length >= 4 && (await pinOk(v, who))) signIn(who, v); else if (v.length === 8) { $('#pinErr').textContent = 'Wrong PIN.'; $('#pinErr').hidden = false; pads.pin.v = ''; paint(''); } } };
  }
}
let failed = 0;
function signIn(member, pin) {
  failed = 0;
  S.staff = { id: member.id, name: member.name, role: member.role };
  pinMemo = pin;
  S.staffKey = '';
  lockPick = null;
  if (S.mode === 'server' && S.online) staffKey().catch(() => {});
  if (!S.clocks[member.id]) {
    const c = { id: uid('ck'), staffId: member.id, staffName: member.name, in: Date.now(), out: 0, day: C.localDay() };
    S.clocks[member.id] = c;
    put('clock', c).then(() => queue('clock', c));
    toast(`Clocked in at ${time(c.in)}. Welcome, ${member.name.split(' ')[0]}.`);
  }
  save();
  if (!S.shift && S.view === 'sell') S.view = 'drawer';
  render();
}
function lock() { S.staff = null; pinMemo = null; S.staffKey = ''; closeModal(); render(); }
async function clockOut() {
  const c = S.clocks[S.staff.id];
  if (c) { c.out = Date.now(); await put('clock', c); await queue('clock', c); delete S.clocks[S.staff.id]; }
  const hrs = c ? ((c.out - c.in) / 3600000).toFixed(2) : '0';
  toast(`Clocked out. ${hrs} hours today.`);
  save();
  lock();
}

// Asks for a manager's PIN when the person signed in can't do something alone. Resolves with the approver.
function approve(reason, role = 'manager') {
  if (S.staff && rank(S.staff.role) >= rank(role)) return Promise.resolve({ ...S.staff, self: true });
  const ok = (S.shop.staff || []).filter((m) => m.active !== false && rank(m.role) >= rank(role));
  return new Promise((resolve) => {
    let pick = ok[0]?.id;
    const draw = () => {
      modal(`${head(`${ROLE_NAME[role]} approval`, esc(reason))}<div class="staff-pick sm">${ok.map((m) => `<button type="button" class="staff ${m.id === pick ? 'on' : ''}" data-apick="${m.id}" style="--c:${esc(m.color || COLORS[0])}"><i>${esc(m.name[0])}</i><span>${esc(m.name)}</span></button>`).join('')}</div><div class="dots" id="apDots"></div>${keypad('ap')}<p class="err" id="apErr" hidden></p>`, { onClose: () => resolve(null) });
      const dots = $('#apDots');
      const paint = (v) => { dots.innerHTML = Array.from({ length: Math.max(4, v.length) }, (_, i) => `<i class="${i < v.length ? 'on' : ''}"></i>`).join(''); };
      paint('');
      pads.ap = { v: '', max: 8, on: async (v) => { paint(v); const m = ok.find((x) => x.id === pick); if (v.length >= 4 && m && (await pinOk(v, m))) { modalDone = null; closeModal(); resolve({ ...m, pin: v }); } else if (v.length === 8) { $('#apErr').textContent = 'Wrong PIN.'; $('#apErr').hidden = false; } } };
    };
    approvePick = (id) => { pick = id; draw(); };
    draw();
  });
}
let approvePick = null;
// a server key for whoever approved (the signed-in person, or a manager who just typed their PIN)
async function keyFor(approver) {
  if (!approver || approver.self) return staffKey();
  const d = await api('/login', { method: 'POST', body: { staffId: approver.id, pin: approver.pin } });
  return d.key;
}

/* ---------- sell ---------- */
function renderSell(m) {
  m.innerHTML = `<div class="sell">
    <section class="catalog">
      <div class="cat-bar"><label class="search">${ic('search', 18)}<input id="q" type="search" placeholder="Search or scan" value="${esc(S.q)}" autocomplete="off" enterkeyhint="search"></label>
      <button type="button" class="btn" data-act="custom" aria-label="Custom amount">${ic('plus', 16)}<span>Custom amount</span></button></div>
      <div class="cats" id="cats"></div>
      <div class="grid" id="grid"></div>
    </section>
    <aside class="cart" id="cart"></aside>
  </div>
  <button type="button" class="cart-peek" id="peek" data-act="peek"></button>`;
  paintGrid();
  paintCart();
}
function visibleItems() {
  const q = S.q.trim().toLowerCase();
  return S.catalog.items.filter((i) => !i.hidden && (S.cat === 'All' || i.cat === S.cat) && (!q || i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase() === q || (i.barcode || '') === q || (i.cat || '').toLowerCase().includes(q)));
}
function paintGrid() {
  const g = $('#grid');
  if (!g) return;
  const cats = ['All', ...new Set(S.catalog.items.filter((i) => !i.hidden).map((i) => i.cat || 'Other'))];
  $('#cats').innerHTML = cats.length > 2 ? cats.map((c) => `<button type="button" class="${S.cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('') : '';
  const items = visibleItems();
  g.innerHTML = items.length ? items.map((i) => {
    const left = C.stockLeft(i, '', S.stock, S.cart.lines);
    const tone = i.color || COLORS[Math.abs(hashStr(i.cat || i.name)) % COLORS.length];
    return `<button type="button" class="tile ${left !== null && left <= 0 ? 'out' : ''}" data-item="${esc(i.id)}" style="--c:${esc(tone)}">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : `<i>${esc(i.name.slice(0, 2))}</i>`}<b>${esc(i.name)}</b><span>${fmt(i.price)}${i.opts.length ? ' +' : ''}</span>${left !== null ? `<small class="${left <= 3 ? 'low' : ''}">${left <= 0 ? 'Out of stock' : `${left} left`}</small>` : ''}</button>`;
  }).join('') : `<div class="empty">${S.catalog.items.length ? 'Nothing matches.' : `No products yet. ${isMgr() ? '<button type="button" class="btn" data-view="products">Add products</button>' : 'Ask a manager to add products.'}`}</div>`;
}
const hashStr = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
function cartTotals() { return C.totals(S.cart.lines, { discount: S.cart.discount, taxRate: settings().taxRate || 0 }); }
function paintCart() {
  const el = $('#cart');
  if (!el) return;
  const c = S.cart;
  const t = cartTotals();
  el.innerHTML = `<div class="cart-head"><div class="seg">${[['here', 'For here'], ['togo', 'To go'], ['pickup', 'Pickup']].map(([k, l]) => `<button type="button" class="${c.type === k ? 'on' : ''}" data-type="${k}">${l}</button>`).join('')}</div>
    <button type="button" class="icon sm" data-act="cart-close" aria-label="Close">${ic('x', 18)}</button></div>
    <div class="cart-who"><button type="button" class="link" data-act="customer">${ic('user', 15)} ${c.customer.name || c.ticket ? esc(c.ticket || c.customer.name) : 'Add name or customer'}</button>${c.parkedId ? '<span class="pill">Saved ticket</span>' : ''}</div>
    <ol class="lines">${c.lines.map((l, i) => `<li><button type="button" class="line" data-line="${i}"><span class="q">${l.qty}</span><span class="n"><b>${esc(l.name)}</b>${l.variant ? `<small>${esc(l.variant)}</small>` : ''}${l.mods.length ? `<small>${esc(l.mods.map((x) => x.label).join(', '))}</small>` : ''}${l.note ? `<small class="nt">“${esc(l.note)}”</small>` : ''}${l.discount ? `<small class="dc">−${fmt(l.discount)} off</small>` : ''}</span><span class="p">${fmt(C.lineNet(l))}</span></button></li>`).join('') || '<li class="none">Tap a product to start a sale.</li>'}</ol>
    <div class="sums">
      ${t.lineDiscount || t.discount ? `<div><span>Items</span><span>${fmt(t.gross)}</span></div>` : ''}
      ${t.lineDiscount ? `<div class="dc"><span>Item discounts</span><span>−${fmt(t.lineDiscount)}</span></div>` : ''}
      ${t.discount ? `<div class="dc"><span>${esc(c.discountLabel || 'Discount')}</span><span>−${fmt(t.discount)} <button type="button" class="x" data-act="undisc" aria-label="Remove discount">${ic('x', 12)}</button></span></div>` : ''}
      <div><span>Subtotal</span><span>${fmt(t.subtotal - t.discount)}</span></div>
      <div><span>Tax${settings().taxRate ? ` (${settings().taxRate}%)` : ''}</span><span>${fmt(t.tax)}</span></div>
      <div class="tot"><span>Total</span><span>${fmt(t.total)}</span></div>
    </div>
    <div class="cart-acts"><button type="button" class="btn" data-act="discount" ${c.lines.length ? '' : 'disabled'}>${ic('tag', 16)} Discount</button><button type="button" class="btn" data-act="park" ${c.lines.length ? '' : 'disabled'}>${ic('pause', 16)} Save</button><button type="button" class="btn" data-act="clear" ${c.lines.length ? '' : 'disabled'}>${ic('trash', 16)} Clear</button></div>
    <button type="button" class="btn pri charge" data-act="charge" ${c.lines.length ? '' : 'disabled'}>Charge ${fmt(t.total)}</button>`;
  const p = $('#peek');
  if (p) { p.hidden = !c.lines.length; p.innerHTML = `<span>${t.count} item${t.count === 1 ? '' : 's'}</span><b>Review ${fmt(t.total)}</b>`; }
}
function addLine(item, { mods = [], variant = '', qty = 1, note = '', unit = null } = {}) {
  const same = S.cart.lines.find((l) => l.itemId === item.id && l.variant === variant && !l.note && !note && !l.discount && JSON.stringify(l.mods) === JSON.stringify(mods) && (unit == null || l.unit === unit));
  if (same) same.qty += qty;
  else S.cart.lines.push({ itemId: item.id, name: item.name, unit: unit ?? item.price, qty, mods, variant, note, discount: 0, taxable: item.taxable !== false, kitchen: Boolean(item.kitchen) });
  save();
  paintCart();
  paintGrid();
}
function tapItem(id) {
  const item = S.catalog.items.find((i) => i.id === id);
  if (!item) return;
  if (!item.opts.length) {
    const left = C.stockLeft(item, '', S.stock, S.cart.lines);
    if (left !== null && left <= 0) toast(`${item.name} shows 0 in stock. Added anyway; fix the count in Products.`);
    return addLine(item);
  }
  itemModal(item);
}
function itemModal(item, lineIdx = null) {
  const line = lineIdx != null ? S.cart.lines[lineIdx] : null;
  const picks = {};
  item.opts.forEach((g) => {
    if (g.multi) picks[g.name] = new Set(line ? line.mods.filter((m) => g.vals.some((v) => v.label === m.label)).map((m) => m.label) : []);
    else picks[g.name] = line ? (g.variant ? line.variant.split(' / ').find((x) => g.vals.some((v) => v.label === x)) : line.mods.find((m) => g.vals.some((v) => v.label === m.label))?.label) || g.vals[0].label : g.vals[0].label;
  });
  let qty = line ? line.qty : 1;
  const draw = () => {
    const vk = C.variantLabel(item, picks);
    const mods = modsOf(item, picks);
    const unit = item.price + mods.reduce((a, m) => a + m.add, 0);
    const left = C.stockLeft(item, vk, S.stock, S.cart.lines.filter((_, i) => i !== lineIdx));
    modal(`${head(item.name, fmt(item.price))}
      ${item.opts.map((g) => `<fieldset class="opt"><legend>${esc(g.name)}${g.multi ? ' <small>(any)</small>' : ''}</legend><div class="chips">${g.vals.map((v) => {
        const on = g.multi ? picks[g.name].has(v.label) : picks[g.name] === v.label;
        let sub = v.add ? `+${fmt(v.add).slice(1)}` : '';
        if (g.variant && item.track) { const p2 = { ...picks, [g.name]: v.label }; const l2 = C.stockLeft(item, C.variantLabel(item, p2), S.stock, S.cart.lines.filter((_, i) => i !== lineIdx)); if (l2 !== null) sub = (sub ? sub + ' · ' : '') + (l2 <= 0 ? 'out' : `${l2} left`); }
        return `<button type="button" class="chip ${on ? 'on' : ''}" data-opt="${esc(g.name)}" data-val="${esc(v.label)}">${esc(v.label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
      }).join('')}</div></fieldset>`).join('')}
      <label class="note-in">${ic('note', 16)}<input id="lineNote" placeholder="Note for this item (no onions, name on cup…)" maxlength="200" value="${esc(line?.note || '')}"></label>
      <div class="qty-row"><div class="stepper"><button type="button" data-q="-1" aria-label="One less">${ic('minus', 18)}</button><b>${qty}</b><button type="button" data-q="1" aria-label="One more">${ic('plus', 18)}</button></div>${left !== null ? `<span class="mut sm">${left <= 0 ? 'Out of stock' : `${left} in stock`}</span>` : ''}</div>
      <div class="sh-foot">${line ? `<button type="button" class="btn danger" data-act="line-del">${ic('trash', 16)} Remove</button>` : ''}<button type="button" class="btn pri big" data-act="item-add">${line ? 'Update' : 'Add'} · ${fmt(unit * qty)}</button></div>`);
    const note = $('#lineNote');
    itemHandlers = {
      opt(name, val) { const g = item.opts.find((x) => x.name === name); keepNote(); if (g.multi) { const s = picks[name]; s.has(val) ? s.delete(val) : s.add(val); } else picks[name] = val; draw(); },
      q(d) { keepNote(); qty = Math.max(1, qty + d); draw(); },
      add() {
        const n = note.value.trim();
        if (line) { Object.assign(line, { mods, variant: vk, qty, note: n }); save(); paintCart(); paintGrid(); } else addLine(item, { mods, variant: vk, qty, note: n });
        closeModal();
      },
      del() { S.cart.lines.splice(lineIdx, 1); save(); paintCart(); paintGrid(); closeModal(); },
    };
    function keepNote() { if (line) line.note = note.value.trim(); else itemNoteDraft = note.value; }
    if (!line && itemNoteDraft) note.value = itemNoteDraft;
  };
  itemNoteDraft = '';
  draw();
}
let itemHandlers = null;
let itemNoteDraft = '';
function modsOf(item, picks) {
  const out = [];
  for (const g of item.opts) {
    if (g.variant) { const v = g.vals.find((x) => x.label === picks[g.name]); if (v && v.add) out.push({ label: v.label, add: v.add }); continue; }
    if (g.multi) for (const v of g.vals) { if (picks[g.name].has(v.label)) out.push({ label: v.label, add: v.add }); }
    else { const v = g.vals.find((x) => x.label === picks[g.name]); if (v) out.push({ label: v.label, add: v.add }); }
  }
  return out;
}
// tapping a line in the cart: change it, or for plain items just quantity, discount and note
function lineModal(i) {
  const l = S.cart.lines[i];
  const item = S.catalog.items.find((x) => x.id === l.itemId);
  if (item && item.opts.length && !l.custom) return lineEdit(i, item);
  lineEdit(i, null);
}
function lineEdit(i, item) {
  const l = S.cart.lines[i];
  modal(`${head(l.name, `${fmt(C.unitWithMods(l))} each`)}
    <div class="qty-row"><div class="stepper"><button type="button" data-lq="-1" aria-label="One less">${ic('minus', 18)}</button><b id="lq">${l.qty}</b><button type="button" data-lq="1" aria-label="One more">${ic('plus', 18)}</button></div></div>
    ${item ? `<button type="button" class="btn" data-act="line-opts">Change options</button>` : ''}
    <label class="note-in">${ic('note', 16)}<input id="lineNote" placeholder="Note for this item" maxlength="200" value="${esc(l.note)}"></label>
    <fieldset class="opt"><legend>Discount on this item</legend><div class="chips">${[0, 10, 25, 50, 100].map((p) => `<button type="button" class="chip ${l.discPct === p || (!l.discount && p === 0) ? 'on' : ''}" data-ldisc="${p}">${p === 0 ? 'None' : p === 100 ? 'Free' : p + '%'}</button>`).join('')}</div></fieldset>
    <div class="sh-foot"><button type="button" class="btn danger" data-act="line-del2">${ic('trash', 16)} Remove</button><button type="button" class="btn pri big" data-act="line-done">Done</button></div>`);
  lineCtx = { i, item };
}
let lineCtx = null;
async function setLineDiscount(pct) {
  const { i } = lineCtx;
  const l = S.cart.lines[i];
  if (pct > (settings().cashierMaxDiscount ?? 10) && !(await approve(`Give ${pct}% off ${l.name}`))) return lineEdit(i, lineCtx.item);
  l.discPct = pct;
  l.discount = Math.round((C.lineGross(l) * pct) / 100);
  save();
  paintCart();
  lineEdit(i, lineCtx.item);
}
function customAmount() {
  let cents = 0;
  modal(`${head('Custom amount')}<div class="amount" id="caAmt">$0.00</div><input id="caName" class="inp" placeholder="What is it for? (optional)" maxlength="80">
    <label class="chk"><input type="checkbox" id="caTax" checked> Charge tax</label>${keypad('ca')}<div class="sh-foot"><button type="button" class="btn pri big" data-act="ca-add">Add</button></div>`);
  pads.ca = { v: '', max: 7, on: (v) => { cents = +v || 0; $('#caAmt').textContent = fmt(cents); } };
  customAdd = () => {
    if (!cents) return toast('Type an amount first.');
    S.cart.lines.push({ itemId: '', name: $('#caName').value.trim() || 'Custom amount', unit: cents, qty: 1, mods: [], variant: '', note: '', discount: 0, taxable: $('#caTax').checked, kitchen: false, custom: true });
    save();
    paintCart();
    closeModal();
  };
}
let customAdd = null;
function discountModal() {
  const presets = [['10% off', 'pct', 10], ['15% off', 'pct', 15], ['20% off', 'pct', 20], ['Staff 25%', 'pct', 25], ['$5 off', 'amt', 500], ['$10 off', 'amt', 1000]];
  modal(`${head('Discount on the whole sale', `Cashiers can give up to ${settings().cashierMaxDiscount ?? 10}% without a manager.`)}
    <div class="chips big">${presets.map(([l, k, v]) => `<button type="button" class="chip" data-disc="${k}|${v}|${esc(l)}">${esc(l)}</button>`).join('')}</div>
    <div class="row2"><label>Percent off<input id="dPct" class="inp" inputmode="decimal" placeholder="e.g. 12"></label><label>Dollars off<input id="dAmt" class="inp" inputmode="decimal" placeholder="e.g. 3.50"></label></div>
    <label>Reason or name (shows on the receipt)<input id="dLbl" class="inp" maxlength="60" placeholder="Discount"></label>
    <div class="sh-foot"><button type="button" class="btn pri big" data-act="disc-apply">Apply</button></div>`);
}
async function applyDiscount(kind, value, label) {
  if (!(value > 0)) return toast('Enter an amount.');
  const t = cartTotals();
  const pct = kind === 'pct' ? value : (value / Math.max(1, t.subtotal)) * 100;
  const who = pct > (settings().cashierMaxDiscount ?? 10) ? await approve(`Give ${Math.round(pct)}% off this sale`) : S.staff;
  if (!who) return;
  S.cart.discount = { kind, value };
  S.cart.discountLabel = label || (kind === 'pct' ? `${value}% off` : `${fmt(value)} off`);
  if (!who.self && who !== S.staff) S.cart.discountLabel += ` (OK’d by ${who.name.split(' ')[0]})`;
  save();
  closeModal();
  paintCart();
}
function customerModal() {
  const c = S.cart;
  modal(`${head('Name on the order', 'Shown on the kitchen ticket and the receipt. Email or phone is used to send the receipt.')}
    <label>Name or table<input id="cTicket" class="inp" maxlength="60" value="${esc(c.ticket || c.customer.name)}" placeholder="e.g. Maya or Table 4"></label>
    <div class="row2"><label>Email<input id="cEmail" class="inp" type="email" maxlength="254" value="${esc(c.customer.email)}" autocomplete="off"></label><label>Phone<input id="cPhone" class="inp" type="tel" maxlength="30" value="${esc(c.customer.phone)}" autocomplete="off"></label></div>
    <label>Order note<input id="cNote" class="inp" maxlength="300" value="${esc(c.note)}" placeholder="Allergies, pickup time…"></label>
    <div class="sh-foot"><button type="button" class="btn pri big" data-act="cust-save">Save</button></div>`);
}
async function park() {
  const t = cartTotals();
  const c = S.cart;
  if (!c.ticket && !c.customer.name) {
    const name = await ask('Save this ticket', 'Name or table, so you can find it again', 'e.g. Table 4');
    if (!name) return;
    c.ticket = name;
  }
  const rec = { ...JSON.parse(JSON.stringify(c)), id: c.parkedId || uid('pk'), at: Date.now(), total: t.total, by: S.staff.name };
  rec.parkedId = rec.id;
  S.parked = [...S.parked.filter((p) => p.id !== rec.id), rec];
  S.cart = blankCart();
  save();
  toast(`Saved “${rec.ticket || rec.customer.name}”. Find it under Orders.`);
  paintCart();
  paintGrid();
}
function ask(title, sub, placeholder = '', value = '') {
  return new Promise((resolve) => {
    modal(`${head(title, esc(sub))}<form data-form="ask"><input id="askIn" class="inp" maxlength="80" placeholder="${esc(placeholder)}" value="${esc(value)}" autofocus><div class="sh-foot"><button class="btn pri big" type="submit">OK</button></div></form>`, { onClose: () => resolve(null) });
    askDone = (v) => { modalDone = null; closeModal(); resolve(v); };
  });
}
let askDone = null;

/* ---------- checkout ---------- */
let P = null; // the payment in progress
function charge() {
  if (!S.cart.lines.length) return;
  if (!S.shift) toast('Tip: start the drawer under Drawer so cash adds up at the end of the day.');
  const t = cartTotals();
  P = { id: uid('sl'), t, tip: 0, tipAsked: false, tenders: [], step: settings().tipsOn ? 'tip' : 'pay', msg: '' };
  payModal();
}
const due = () => P.t.total + P.tip - C.paid(P.tenders) - C.tipsOf(P.tenders);
function payModal() {
  if (P.step === 'tip') return tipModal();
  const left = due();
  const tipLeft = P.tip - C.tipsOf(P.tenders);
  const top = P.tenders.length ? `<div class="sh-head"><div><h2>Remaining</h2><p>Paid ${fmt(C.paid(P.tenders) + C.tipsOf(P.tenders))} so far. Finish the payment to close this sale.</p></div></div>` : head('Payment');
  modal(`${top}
    <div class="amount big">${fmt(left)}</div>
    <p class="mut ctr">${fmt(P.t.total)} sale${P.tip ? ` + ${fmt(P.tip)} tip` : ''}${tipLeft && P.tenders.length ? ` (${fmt(tipLeft)} tip left)` : ''}</p>
    ${P.msg ? `<p class="err ctr">${esc(P.msg)}</p>` : ''}
    <div class="split"><label>Charge now<input id="partAmt" class="inp" inputmode="decimal" value="${(left / 100).toFixed(2)}"></label>
      <div class="chips">${[2, 3, 4].map((n) => `<button type="button" class="chip" data-splitn="${n}">Split ${n} ways</button>`).join('')}</div></div>
    <div class="tenders">
      <button type="button" class="tender" data-tender="card">${ic('card', 28)}<b>Card</b><small>${cardLabel()}</small></button>
      <button type="button" class="tender" data-tender="cash">${ic('cash', 28)}<b>Cash</b><small>Count change</small></button>
      <button type="button" class="tender" data-tender="other">${ic('other', 28)}<b>Other</b><small>Gift card, check, Venmo…</small></button>
    </div>
    ${P.tenders.length ? `<ul class="paid">${P.tenders.map((t) => `<li><span>${esc(C.tenderName(t))}${t.last4 ? ` ····${esc(t.last4)}` : ''}</span><b>${fmt(t.amount + t.tip)}</b></li>`).join('')}</ul>` : `${settings().tipsOn ? `<button type="button" class="link ctr" data-act="tip-again">${P.tip ? `Tip ${fmt(P.tip)} · change` : 'Add a tip'}</button>` : ''}`}`, { onClose: () => { if (P && !P.tenders.length) P = null; } });
}
const realReader = () => S.mode === 'server' && S.terminal.enabled && S.terminal.ready && S.readerId && S.readerId !== 'practice';
function cardLabel() {
  if (realReader()) return S.online ? 'Tap, insert or swipe' : 'Needs internet';
  return 'Practice reader';
}
// the part of the remaining amount being paid now, split into sale amount and tip
function portion() {
  const left = due();
  const want = Math.round(parseFloat(($('#partAmt')?.value || '').replace(/[^\d.]/g, '')) * 100);
  const charge = Math.min(left, want > 0 ? want : left);
  const tipLeft = P.tip - C.tipsOf(P.tenders);
  const tip = charge >= left ? tipLeft : Math.round((charge * tipLeft) / left);
  return { charge, amount: charge - tip, tip };
}
function tipModal() {
  const base = P.t.total;
  const pre = settings().tipPresets?.length ? settings().tipPresets : [15, 20, 25];
  modal(`<div class="tipscreen"><p class="mut">Hand the screen to your customer</p><h2>Add a tip?</h2><div class="amount">${fmt(base)}</div>
    <div class="tips">${pre.map((p) => `<button type="button" class="tipb" data-tip="${C.tipFor(base, p)}"><b>${p}%</b><span>${fmt(C.tipFor(base, p))}</span></button>`).join('')}<button type="button" class="tipb" data-act="tip-custom"><b>Other</b><span>amount</span></button></div>
    <button type="button" class="btn big wide" data-tip="0">No tip</button>${P.tenders.length ? '' : '<button type="button" class="link" data-act="pay-cancel">Back to the sale</button>'}</div>`, { cls: 'customer' });
}
function setTip(c) { P.tip = Math.max(0, c); P.step = 'pay'; payModal(); }

async function payCard() {
  const p = portion();
  if (p.charge <= 0) return;
  const real = realReader();
  if (real && !S.online) { P.msg = 'Cards need the internet. Take cash or another payment, or try again when the connection is back.'; return payModal(); }
  if (real && p.charge < 50) { P.msg = 'Card payments must be at least $0.50.'; return payModal(); }
  const tenderId = uid('tn');
  const reader = (S.shop.terminal?.readers || []).find((r) => r.id === S.readerId);
  const sim = real && (reader?.simulated || S.terminal.testMode);
  modal(`<div class="cardwait"><div class="pulse">${ic('card', 40)}</div><h2>${fmt(p.charge)}</h2><p id="cwMsg">${real ? `Starting ${esc(reader?.label || 'the reader')}…` : 'Practice reader: no card is charged.'}</p>
    ${!real ? `<div class="chips"><button type="button" class="btn pri big" data-sim="ok">Approve</button><button type="button" class="btn" data-sim="decline">Decline</button></div>` : ''}
    ${sim ? `<div class="sim"><p class="mut sm">Test reader: tap a test card</p><div class="chips"><button type="button" class="chip" data-tap="">Visa that works</button><button type="button" class="chip" data-tap="4000000000000002">Declined card</button></div></div>` : ''}
    <button type="button" class="btn wide" data-act="card-cancel">Cancel</button></div>`, { cls: 'customer' });
  const finish = (res) => {
    cardFlow = null;
    if (res.status === 'succeeded') {
      P.tenders.push({ id: tenderId, kind: 'card', label: 'Card', amount: p.amount, tip: p.tip, ref: res.ref || '', brand: res.brand || '', last4: res.last4 || '', practice: !real });
      P.msg = '';
      afterTender();
    } else {
      P.msg = res.status === 'canceled' ? 'Card payment canceled.' : res.message || 'The card was declined.';
      payModal();
    }
  };
  if (!real) { cardFlow = { practice: true, finish: (ok) => finish(ok ? { status: 'succeeded', brand: 'visa', last4: '4242' } : { status: 'failed', message: 'Declined (practice).' }) }; return; }
  let pi = '';
  let stop = false;
  cardFlow = { practice: false, reader: S.readerId, cancel: async () => { stop = true; if (pi) await api(`/terminal/pay/${pi}/cancel`, { method: 'POST', body: { readerId: S.readerId } }).catch(() => {}); finish({ status: 'canceled' }); } };
  try {
    pi = (await api('/terminal/pay', { method: 'POST', body: { readerId: S.readerId, amount: p.charge, saleId: P.id, tenderId } })).paymentIntent;
    cardFlow.pi = pi;
    const msg = $('#cwMsg');
    if (msg) msg.textContent = 'Ask the customer to tap, insert or swipe on the reader.';
    const until = Date.now() + 120000;
    while (!stop && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 1500));
      if (stop) return;
      const st = await api(`/terminal/pay/${pi}?reader=${encodeURIComponent(S.readerId)}`).catch((e) => ({ status: e.code === 'offline' ? 'waiting' : 'failed', message: e.message }));
      if (st.status === 'succeeded') return finish({ status: 'succeeded', ref: pi, brand: st.brand, last4: st.last4 });
      if (st.status === 'failed' || st.status === 'canceled') { await api(`/terminal/pay/${pi}/cancel`, { method: 'POST', body: { readerId: S.readerId } }).catch(() => {}); return finish(st); }
    }
    if (!stop) { await api(`/terminal/pay/${pi}/cancel`, { method: 'POST', body: { readerId: S.readerId } }).catch(() => {}); finish({ status: 'failed', message: 'The reader timed out. Try again.' }); }
  } catch (e) {
    if (!stop) finish({ status: 'failed', message: e.message });
  }
}
let cardFlow = null;
function payCash() {
  const p = portion();
  if (p.charge <= 0) return;
  const sugg = C.cashSuggestions(p.charge);
  let given = 0;
  modal(`${head('Cash', `Due ${fmt(p.charge)}`)}<div class="chips big">${sugg.map((v) => `<button type="button" class="chip" data-given="${v}">${v === p.charge ? 'Exact ' : ''}${fmt(v)}</button>`).join('')}</div>
    <div class="amount" id="cashGiven">$0.00</div><p class="ctr mut" id="cashChange">Type what the customer gave you</p>${keypad('cash')}
    <div class="sh-foot"><button type="button" class="btn" data-act="pay-back">${ic('back', 16)} Back</button><button type="button" class="btn pri big" data-act="cash-ok" id="cashOk" disabled>Done</button></div>`, { onClose: () => {} });
  const paint = () => { $('#cashGiven').textContent = fmt(given); const ch = given - p.charge; $('#cashChange').innerHTML = given ? ch >= 0 ? `Change <b>${fmt(ch)}</b>` : `<span class="err">${fmt(-ch)} short. Charge less or add more.</span>` : 'Type what the customer gave you'; $('#cashOk').disabled = !given; };
  pads.cash = { v: '', max: 7, on: (v) => { given = +v || 0; paint(); } };
  cashGive = (v) => { given = v; pads.cash.v = String(v); paint(); };
  cashDone = () => {
    // giving less than due pays that much and leaves the rest open (split cash and card)
    const amt = Math.min(given, p.charge);
    const tip = amt >= p.charge ? p.tip : Math.round((amt * p.tip) / p.charge);
    P.tenders.push({ id: uid('tn'), kind: 'cash', label: 'Cash', amount: amt - tip, tip, given, change: Math.max(0, given - p.charge) });
    P.lastChange = Math.max(0, given - p.charge);
    afterTender();
  };
}
let cashGive = null;
let cashDone = null;
function payOther() {
  const p = portion();
  if (p.charge <= 0) return;
  const kinds = ['Gift card', 'Check', 'Venmo', 'Zelle', 'Cash App', 'PayPal', 'House account'];
  modal(`${head('Other payment', `${fmt(p.charge)}. Take the payment, then tap how it was paid.`)}<div class="chips big">${kinds.map((k) => `<button type="button" class="chip" data-otherk="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <label>Reference (check number, gift card code…)<input id="otherRef" class="inp" maxlength="80"></label>
    <div class="sh-foot"><button type="button" class="btn" data-act="pay-back">${ic('back', 16)} Back</button></div>`);
  otherDone = (label) => { P.tenders.push({ id: uid('tn'), kind: 'other', label, amount: p.amount, tip: p.tip, ref: $('#otherRef').value.trim() }); afterTender(); };
}
let otherDone = null;
function afterTender() {
  if (due() > 0) { P.step = 'pay'; return payModal(); }
  finishSale();
}
async function finishSale() {
  const c = S.cart;
  const t = P.t;
  // receipt numbers: register number, then a count (1-1001, 1-1002 … on register 1; 2-1001 on register 2)
  const regNo = Math.max(1, S.devices.filter((d) => d.kind !== 'kitchen').findIndex((d) => d.id === S.device?.id) + 1);
  const no = `${regNo}-${1000 + S.nextNo++}`;
  const sale = {
    id: P.id, no, at: Date.now(), day: C.localDay(), deviceId: S.device?.id || '', staffId: S.staff.id, staffName: S.staff.name, shiftId: S.shift?.id || '',
    type: c.type, ticket: c.ticket, customer: { ...c.customer }, note: c.note,
    lines: c.lines.map((l) => ({ ...l, total: C.lineNet(l) })), subtotal: t.subtotal, discount: t.discount, discountLabel: t.discount ? c.discountLabel : '', tax: t.tax,
    tip: C.tipsOf(P.tenders), total: t.total, tenders: P.tenders, refunds: [], offline: S.mode === 'server' && !S.online, synced: false,
  };
  // stock on this device goes down now; the server's count comes back on the next sync
  for (const l of sale.lines) {
    const item = S.catalog.items.find((i) => i.id === l.itemId);
    if (!item?.track) continue;
    const k = C.stockKey(item.id, item.opts.some((g) => g.variant) ? l.variant : '');
    if (S.stock[k] != null) S.stock[k] -= l.qty;
  }
  if (c.parkedId) S.parked = S.parked.filter((p) => p.id !== c.parkedId);
  S.cart = blankCart();
  save();
  await put('sales', sale);
  if (S.mode === 'server') await queue('sale', sale);
  else if (settings().kitchenOn) localKitchen(sale);
  const change = sale.tenders.filter((x) => x.kind === 'cash').reduce((a, x) => a + x.change, 0);
  P = null;
  doneModal(sale, change);
  paintMain();
}
function doneModal(sale, change) {
  const c = sale.customer;
  modal(`<div class="done">${ic('check', 44)}<h2>${change ? `Change ${fmt(change)}` : 'Paid'}</h2><p class="mut">${fmt(sale.total + sale.tip)} · receipt ${esc(sale.no)}</p>
    <div class="rcpt-acts"><button type="button" class="btn big" data-rcpt="print" data-sale="${sale.id}">${ic('print', 18)} Print</button>
    <button type="button" class="btn big" data-rcpt="email" data-sale="${sale.id}">${ic('mail', 18)} Email</button>
    <button type="button" class="btn big" data-rcpt="text" data-sale="${sale.id}">${ic('phone', 18)} Text</button></div>
    ${c.email || c.phone ? `<p class="mut sm">On file: ${esc([c.email, c.phone].filter(Boolean).join(' · '))}</p>` : ''}
    <button type="button" class="btn pri big wide" data-act="close">New sale</button></div>`);
}

/* ---------- receipts ---------- */
function receiptHtml(sale, { copy = '' } = {}) {
  const st = settings();
  const refunds = sale.refunds || [];
  return `<div class="rc">${copy ? `<p class="rc-c">${esc(copy)}</p>` : ''}<h3>${esc(S.shop.name)}</h3>${st.address ? `<p>${esc(st.address)}</p>` : ''}${st.phone ? `<p>${esc(st.phone)}</p>` : ''}
    <p>${new Date(sale.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p><p>Receipt ${esc(sale.no)} · ${esc((sale.staffName || '').split(' ')[0])}${sale.ticket ? ` · ${esc(sale.ticket)}` : ''}</p>
    <table>${sale.lines.map((l) => `<tr><td>${l.qty} × ${esc(l.name)}${l.variant ? ` (${esc(l.variant)})` : ''}${l.mods.length ? `<br><small>${esc(l.mods.map((m) => m.label + (m.add ? ` +${fmt(m.add)}` : '')).join(', '))}</small>` : ''}${l.discount ? `<br><small>−${fmt(l.discount)} off</small>` : ''}</td><td>${fmt(C.lineNet(l))}</td></tr>`).join('')}</table>
    <table class="rc-t">${sale.discount ? `<tr><td>${esc(sale.discountLabel || 'Discount')}</td><td>−${fmt(sale.discount)}</td></tr>` : ''}<tr><td>Subtotal</td><td>${fmt(sale.subtotal - sale.discount)}</td></tr><tr><td>Tax</td><td>${fmt(sale.tax)}</td></tr>${sale.tip ? `<tr><td>Tip</td><td>${fmt(sale.tip)}</td></tr>` : ''}<tr class="b"><td>Total</td><td>${fmt(sale.total + sale.tip)}</td></tr>
    ${sale.tenders.map((t) => `<tr><td>${esc(C.tenderName(t))}${t.last4 ? ` ····${esc(t.last4)}` : ''}${t.ref && t.kind === 'other' ? ` ${esc(t.ref)}` : ''}</td><td>${fmt(t.amount + (t.tip || 0))}</td></tr>${t.change ? `<tr><td>Change</td><td>${fmt(t.change)}</td></tr>` : ''}`).join('')}
    ${refunds.map((r) => `<tr><td>Refund ${new Date(r.at).toLocaleDateString('en-US')}</td><td>−${fmt(r.amount)}</td></tr>`).join('')}</table>
    ${sale.tenders.some((t) => t.practice) ? '<p><b>PRACTICE: no card was charged</b></p>' : ''}<p class="rc-f">${esc(st.receiptFooter || 'Thank you!')}</p></div>`;
}
function printHtml(html) {
  $('#print').innerHTML = html;
  setTimeout(() => window.print(), 50);
}
async function sendReceipt(sale, how) {
  const c = sale.customer;
  const value = await ask(how === 'email' ? 'Email the receipt' : 'Text the receipt', how === 'email' ? 'Customer’s email address' : 'Customer’s mobile number', how === 'email' ? 'name@example.com' : '(555) 555-0123', how === 'email' ? c.email : c.phone);
  if (!value) return;
  if (how === 'email') c.email = value;
  else c.phone = value;
  await put('sales', sale);
  const text = receiptText(sale);
  const fallback = (url) => {
    const body = url ? `Your receipt from ${S.shop.name}: ${url}` : text;
    location.href = how === 'email' ? `mailto:${encodeURIComponent(value)}?subject=${encodeURIComponent(`Your receipt from ${S.shop.name}`)}&body=${encodeURIComponent(body)}` : `sms:${encodeURIComponent(value)}?&body=${encodeURIComponent(body)}`;
  };
  if (S.mode !== 'server') { fallback(''); return closeModal(); }
  try {
    await sync();
    const d = await api('/receipt', { method: 'POST', body: { saleId: sale.id, [how === 'email' ? 'email' : 'phone']: value } });
    if (d.sent[how === 'email' ? 'email' : 'text']) toast(how === 'email' ? 'Receipt emailed.' : 'Receipt texted.');
    else fallback(d.url);
  } catch (e) {
    fallback('');
  }
  closeModal();
}
function receiptText(sale) {
  return [`${S.shop.name}`, new Date(sale.at).toLocaleString('en-US'), `Receipt ${sale.no}`, '', ...sale.lines.map((l) => `${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ''}  ${fmt(C.lineNet(l))}`), '', sale.discount ? `Discount -${fmt(sale.discount)}` : '', `Tax ${fmt(sale.tax)}`, sale.tip ? `Tip ${fmt(sale.tip)}` : '', `Total ${fmt(sale.total + sale.tip)}`, ...sale.tenders.map((t) => `${C.tenderName(t)} ${fmt(t.amount + (t.tip || 0))}`), '', settings().receiptFooter || 'Thank you!'].filter((x) => x !== '').join('\n');
}

/* ---------- kitchen (practice mode, same browser) ---------- */
function localKitchen(sale) {
  const lines = sale.lines.filter((l) => l.kitchen).map((l) => ({ name: l.name, qty: l.qty, mods: l.mods.map((m) => m.label), variant: l.variant, note: l.note, done: false }));
  if (!lines.length) return;
  const t = { id: sale.id, no: sale.no, name: sale.ticket || sale.customer.name, type: sale.type, note: sale.note, at: sale.at, staff: sale.staffName, lines, status: 'new', source: 'register' };
  try {
    const k = JSON.parse(localStorage.getItem('twp-kitchen-local') || '{"open":[],"done":[]}');
    k.open.push(t);
    localStorage.setItem('twp-kitchen-local', JSON.stringify(k));
    new BroadcastChannel('twp-kitchen').postMessage({ ticket: t });
  } catch (e) { /* no kitchen in this browser */ }
}

/* ---------- orders ---------- */
let ordersDay = C.localDay();
let ordersQ = '';
async function renderOrders(m) {
  m.innerHTML = `<div class="page"><div class="page-h"><h1>Orders</h1><div class="row"><input type="date" id="oDay" class="inp" value="${ordersDay}" max="${C.localDay()}"><label class="search sm">${ic('search', 16)}<input id="oQ" type="search" placeholder="Receipt # or name" value="${esc(ordersQ)}"></label></div></div>
    ${S.parked.length ? `<h2 class="sub">Saved tickets</h2><div class="cards">${S.parked.map((p) => `<button type="button" class="card-b" data-unpark="${p.id}"><b>${esc(p.ticket || p.customer.name || 'Ticket')}</b><span>${fmt(p.total)} · ${p.lines.length} item${p.lines.length === 1 ? '' : 's'}</span><small>${time(p.at)} · ${esc(p.by)}</small></button>`).join('')}</div>` : ''}
    <h2 class="sub">Sales ${ordersDay === C.localDay() ? 'today' : dateLbl(ordersDay + 'T12:00')}</h2><div id="oList" class="list"><p class="mut">Loading…</p></div></div>`;
  const sales = await salesFor(ordersDay);
  const q = ordersQ.trim().toLowerCase();
  const list = sales.filter((s) => !q || s.no.toLowerCase().includes(q) || (s.ticket || '').toLowerCase().includes(q) || (s.customer?.name || '').toLowerCase().includes(q)).sort((a, b) => b.at - a.at);
  const el = $('#oList');
  if (!el) return;
  el.innerHTML = list.length ? list.map((s) => {
    const rf = (s.refunds || []).reduce((a, r) => a + r.amount, 0);
    return `<button type="button" class="row-b" data-sale="${s.id}"><span class="t">${time(s.at)}</span><span class="n"><b>${esc(s.no)}${s.ticket ? ` · ${esc(s.ticket)}` : ''}</b><small>${esc(s.lines.map((l) => `${l.qty} ${l.name}`).join(', ')).slice(0, 90)}</small></span><span class="k">${esc([...new Set(s.tenders.map(C.tenderName))].join(' + '))}${s.synced === false && S.mode === 'server' ? ' · <i class="warn">not sent</i>' : ''}</span><span class="p">${fmt(s.total + s.tip)}${rf ? `<small class="dc">−${fmt(rf)} refunded</small>` : ''}</span></button>`;
  }).join('') : '<p class="mut">No sales for this day.</p>';
}
// sales for a day: what this device has, plus the server's copy from the other registers (managers only)
async function salesFor(day, { withEarlier = false } = {}) {
  const local = (await all('sales')).filter((s) => s.day === day);
  const byId = new Map(local.map((s) => [s.id, s]));
  let extra = { earlierSales: [], shifts: [], clock: [] };
  if (S.mode === 'server' && isMgr() && S.online) {
    try {
      const d = await api(`/day/${day}`, { staff: true });
      for (const s of d.sales) {
        const mine = byId.get(s.id);
        // keep refunds made here that haven't been sent yet
        if (mine) { const ids = new Set(s.refunds.map((r) => r.id)); s.refunds = [...s.refunds, ...(mine.refunds || []).filter((r) => !ids.has(r.id))]; }
        byId.set(s.id, { ...s, synced: true });
      }
      extra = d;
    } catch (e) { /* offline: this device's sales only */ }
  }
  const out = [...byId.values()];
  return withEarlier ? { sales: out, ...extra } : out;
}
async function saleModal(id) {
  let sale = await getOne('sales', id);
  if (!sale && S.mode === 'server') sale = await api(`/sales/${id}`, { staff: true }).catch(() => null);
  if (!sale) return toast('Sale not found.');
  saleCtx = sale;
  const left = C.refundableQty(sale);
  modal(`${head(`Receipt ${sale.no}`, `${dateLbl(sale.at)} ${time(sale.at)} · ${esc(sale.staffName)}`)}<div class="rc-view">${receiptHtml(sale)}</div>
    <div class="rcpt-acts"><button type="button" class="btn" data-rcpt="print" data-sale="${sale.id}">${ic('print', 16)} Print</button><button type="button" class="btn" data-rcpt="email" data-sale="${sale.id}">${ic('mail', 16)} Email</button><button type="button" class="btn" data-rcpt="text" data-sale="${sale.id}">${ic('phone', 16)} Text</button>
    ${left.some((n) => n > 0) ? `<button type="button" class="btn danger" data-act="refund">${ic('back', 16)} Refund</button>` : '<span class="pill">Fully refunded</span>'}</div>`, { wide: true });
}
let saleCtx = null;
async function refundModal() {
  const sale = saleCtx;
  const left = C.refundableQty(sale);
  const pick = sale.lines.map((_, i) => left[i]);
  const draw = () => {
    const sel = pick.map((qty, index) => ({ index, qty })).filter((x) => x.qty > 0);
    const v = C.refundValue(sale, sel);
    const tenders = C.refundTenders(sale, v.amount);
    modal(`${head(`Refund ${sale.no}`, 'Pick what is coming back. The tip is not refunded.')}
      <ul class="rf">${sale.lines.map((l, i) => left[i] > 0 ? `<li><span>${esc(l.name)}${l.variant ? ` <small>${esc(l.variant)}</small>` : ''}</span><div class="stepper sm"><button type="button" data-rq="${i}|-1" aria-label="Less">${ic('minus', 14)}</button><b>${pick[i]}</b><button type="button" data-rq="${i}|1" aria-label="More">${ic('plus', 14)}</button></div><small>of ${left[i]}</small></li>` : '').join('')}</ul>
      <label class="chk"><input type="checkbox" id="rfStock" checked> Put the items back in stock</label>
      <label>Reason<input id="rfWhy" class="inp" maxlength="200" placeholder="Wrong size, changed mind…"></label>
      <div class="sums"><div class="tot"><span>Refund</span><span>${fmt(v.amount)}</span></div>${tenders.map((t) => `<div><span>To ${esc(C.tenderName(t))}${t.last4 ? ` ····${esc(t.last4)}` : ''}</span><span>${fmt(t.amount)}</span></div>`).join('')}</div>
      <p class="err" id="rfErr" hidden></p>
      <div class="sh-foot"><button type="button" class="btn" data-act="refund-back">${ic('back', 16)} Back</button><button type="button" class="btn danger big" data-act="refund-go" ${v.amount ? '' : 'disabled'}>Refund ${fmt(v.amount)}</button></div>`, { wide: true });
    refundCtx = { sale, sel, v, tenders, step: (i, d) => { pick[i] = Math.max(0, Math.min(left[i], pick[i] + d)); draw(); } };
  };
  draw();
}
let refundCtx = null;
async function doRefund() {
  const { sale, sel, v, tenders } = refundCtx;
  const restock = $('#rfStock').checked;
  const reason = $('#rfWhy').value.trim();
  const who = await approve(`Refund ${fmt(v.amount)} on ${sale.no}`);
  if (!who) return refundModal();
  const r = { id: uid('rf'), saleId: sale.id, at: Date.now(), day: C.localDay(), staffId: S.staff.id, staffName: S.staff.name, approvedBy: who.name, reason, lines: sel, amount: v.amount, tax: v.tax, tenders, restock, shiftId: S.shift?.id || '' };
  // card money goes back through Stripe right away; everything else is handed back at the counter
  for (const t of tenders) {
    if (t.kind !== 'card' || t.practice || !/^pi_/.test(t.ref || '')) continue;
    if (!S.online) { modal(`${head('Card refunds need the internet')}<p>Refund this as cash instead, or wait for the connection.</p><div class="sh-foot"><button type="button" class="btn pri" data-act="close">OK</button></div>`); return; }
    try {
      const key = await keyFor(who);
      const d = await api('/terminal/refund', { method: 'POST', key, body: { paymentIntent: t.ref, amount: t.amount, refundId: r.id } });
      t.refundRef = d.id;
    } catch (e) {
      return modal(`${head('The card refund didn’t go through')}<p>${esc(e.message)}</p><div class="sh-foot"><button type="button" class="btn pri" data-act="close">OK</button></div>`);
    }
  }
  sale.refunds = [...(sale.refunds || []), r];
  await put('sales', sale);
  await put('refunds', r);
  if (restock) for (const x of sel) {
    const l = sale.lines[x.index];
    const item = S.catalog.items.find((i) => i.id === l.itemId);
    if (!item?.track) continue;
    const k = C.stockKey(item.id, item.opts.some((g) => g.variant) ? l.variant : '');
    if (S.stock[k] != null) S.stock[k] += x.qty;
  }
  save();
  if (S.mode === 'server') await queue('refund', r);
  const cash = tenders.filter((t) => t.kind === 'cash').reduce((a, t) => a + t.amount, 0);
  modal(`<div class="done">${ic('check', 44)}<h2>Refunded ${fmt(v.amount)}</h2>${cash ? `<p>Give back <b>${fmt(cash)}</b> in cash.</p>` : ''}${tenders.some((t) => t.kind === 'card') ? '<p class="mut">Card refunds reach the customer’s account in 5 to 10 days.</p>' : ''}
    <div class="rcpt-acts"><button type="button" class="btn big" data-rcpt="print" data-sale="${sale.id}">${ic('print', 18)} Print receipt</button></div><button type="button" class="btn pri big wide" data-act="close">Done</button></div>`);
  if (S.view === 'orders') paintMain();
}

/* ---------- drawer ---------- */
async function renderDrawer(m) {
  const sh = S.shift;
  if (!sh) {
    m.innerHTML = `<div class="page narrow"><h1>Start the drawer</h1><p class="mut">Count the cash in the drawer before the first sale. At closing you count it again and the register shows if it is over or short.</p>
      ${countForm('open')}<div class="sh-foot"><button type="button" class="btn" data-view="sell">Skip for now</button><button type="button" class="btn pri big" data-act="shift-open">Start with <span id="cntTot">$0.00</span></button></div></div>`;
    return;
  }
  const sales = (await all('sales')).filter((s) => s.shiftId === sh.id);
  const refunds = (await all('refunds')).filter((r) => r.shiftId === sh.id);
  const exp = C.drawerExpected(sh, sales, refunds);
  const cashIn = sales.reduce((a, s) => a + s.tenders.filter((t) => t.kind === 'cash').reduce((b, t) => b + t.amount + (t.tip || 0), 0), 0);
  const cashOut = refunds.reduce((a, r) => a + r.tenders.filter((t) => t.kind === 'cash').reduce((b, t) => b + t.amount, 0), 0);
  m.innerHTML = `<div class="page narrow"><div class="page-h"><h1>Drawer</h1><span class="mut">Opened ${time(sh.openedAt)} by ${esc(sh.openedBy)}</span></div>
    <div class="kpis"><div><span>Should be in the drawer</span><b>${fmt(exp)}</b></div><div><span>Starting cash</span><b>${fmt(sh.openCash)}</b></div><div><span>Cash sales and tips</span><b>${fmt(cashIn)}</b></div><div><span>Cash refunds</span><b>${fmt(cashOut)}</b></div></div>
    <div class="row wrap"><button type="button" class="btn" data-drawer="in">${ic('plus', 16)} Pay in</button><button type="button" class="btn" data-drawer="out">${ic('minus', 16)} Pay out</button><button type="button" class="btn" data-drawer="drop">Cash drop to safe</button><button type="button" class="btn" data-act="no-sale">Open drawer (no sale)</button></div>
    ${sh.events.length ? `<h2 class="sub">Drawer activity</h2><ul class="list plain">${sh.events.map((e) => `<li><span>${time(e.at)} · ${{ in: 'Pay in', out: 'Pay out', drop: 'Drop' }[e.kind]}${e.note ? ` · ${esc(e.note)}` : ''} · ${esc(e.by)}</span><b>${e.kind === 'in' ? '+' : '−'}${fmt(e.amount)}</b></li>`).join('')}</ul>` : ''}
    <h2 class="sub">Close the drawer</h2><p class="mut">Count what is in the drawer now.</p>${countForm('close')}
    <div class="sh-foot"><button type="button" class="btn pri big" data-act="shift-close">Close with <span id="cntTot">$0.00</span></button></div></div>`;
}
let counts = {};
function countForm(kind) {
  counts = {};
  return `<div class="denoms" data-count="${kind}">${C.DENOMS.map(([k]) => `<label><span>${k}</span><input inputmode="numeric" data-denom="${k}" placeholder="0" class="inp"></label>`).join('')}</div><label class="or">Or type the total<input class="inp" inputmode="decimal" id="cntTotal" placeholder="$0.00"></label>`;
}
function countTotal() {
  const typed = Math.round(parseFloat(($('#cntTotal')?.value || '').replace(/[^\d.]/g, '')) * 100);
  return typed > 0 ? typed : C.countDenoms(counts);
}
async function shiftOpen() {
  const sh = { id: uid('sh'), deviceId: S.device?.id || '', deviceName: S.device?.name || '', day: C.localDay(), openedAt: Date.now(), openedBy: S.staff.name, openCash: countTotal(), events: [], closedAt: 0, closedBy: '', counted: null, expected: null };
  S.shift = sh;
  save();
  await put('shifts', sh);
  if (S.mode === 'server') await queue('shift', sh);
  toast(`Drawer started with ${fmt(sh.openCash)}.`);
  S.view = 'sell';
  render();
}
async function drawerEvent(kind) {
  const who = kind === 'in' ? S.staff : await approve(kind === 'out' ? 'Take cash out of the drawer' : 'Drop cash to the safe');
  if (!who) return;
  const amt = await ask({ in: 'Pay in', out: 'Pay out', drop: 'Cash drop' }[kind], 'Amount', '$0.00');
  const c = Math.round(parseFloat(String(amt || '').replace(/[^\d.]/g, '')) * 100);
  if (!(c > 0)) return;
  const note = kind === 'drop' ? '' : (await ask('What for?', 'A short note for the report', kind === 'out' ? 'e.g. milk from the store' : 'e.g. more change')) || '';
  S.shift.events.push({ kind, amount: c, note, at: Date.now(), by: who.name });
  save();
  await put('shifts', S.shift);
  if (S.mode === 'server') await queue('shift', S.shift);
  paintMain();
}
async function shiftClose() {
  const who = await approve('Close the drawer');
  if (!who) return;
  const sh = S.shift;
  const sales = (await all('sales')).filter((s) => s.shiftId === sh.id);
  const refunds = (await all('refunds')).filter((r) => r.shiftId === sh.id);
  sh.expected = C.drawerExpected(sh, sales, refunds);
  sh.counted = countTotal();
  sh.closedAt = Date.now();
  sh.closedBy = who.name;
  await put('shifts', sh);
  if (S.mode === 'server') await queue('shift', sh);
  S.shift = null;
  save();
  const diff = sh.counted - sh.expected;
  const rep = C.dayReport({ sales, refunds, shifts: [sh], catalog: S.catalog });
  modal(`<div class="done">${ic('check', 44)}<h2>Drawer closed</h2><p>Counted ${fmt(sh.counted)} · expected ${fmt(sh.expected)}</p><p class="${diff ? 'err' : 'ok'}"><b>${diff === 0 ? 'Right on' : diff > 0 ? `Over ${fmt(diff)}` : `Short ${fmt(-diff)}`}</b></p>
    <p class="mut">${rep.count} sales · ${fmt(rep.collected)} taken on this register this shift</p>
    <div class="rcpt-acts"><button type="button" class="btn big" data-act="print-shift" data-shift="${sh.id}">${ic('print', 18)} Print shift report</button></div><button type="button" class="btn pri big wide" data-act="close">Done</button></div>`);
  lastShift = { sh, rep };
  paintMain();
}
let lastShift = null;

/* ---------- reports ---------- */
let repDay = C.localDay();
let repData = null;
async function renderReports(m) {
  m.innerHTML = `<div class="page"><div class="page-h"><h1>Reports</h1><div class="row"><input type="date" id="rDay" class="inp" value="${repDay}" max="${C.localDay()}"><button type="button" class="btn" data-act="rep-print">${ic('print', 16)} Print</button><button type="button" class="btn" data-act="rep-csv">Download CSV</button></div></div><div id="rep"><p class="mut">Loading…</p></div></div>`;
  const d = await salesFor(repDay, { withEarlier: true });
  const localRefunds = (await all('refunds')).filter((r) => r.day === repDay);
  const rmap = new Map(localRefunds.map((r) => [r.id, r]));
  for (const s of [...d.sales, ...(d.earlierSales || [])]) for (const r of s.refunds || []) if (r.day === repDay) rmap.set(r.id, r);
  const shifts = d.shifts?.length ? d.shifts : (await all('shifts')).filter((s) => s.day === repDay);
  const clock = d.clock?.length ? d.clock : (await all('clock')).filter((c) => c.day === repDay);
  const rep = C.dayReport({ sales: d.sales, refunds: [...rmap.values()], shifts, clock, catalog: S.catalog });
  repData = { rep, sales: d.sales, day: repDay };
  const el = $('#rep');
  if (!el) return;
  el.innerHTML = reportHtml(rep, repDay);
}
function reportHtml(r, day) {
  const maxH = Math.max(1, ...r.hours);
  const hrs = r.hours.map((v, h) => [h, v]).filter(([h, v]) => v || (h >= 7 && h <= 20));
  return `<div class="kpis">
      <div><span>Net sales</span><b>${fmt(r.net)}</b><small>after discounts and refunds</small></div>
      <div><span>Sales</span><b>${r.count}</b><small>avg ${fmt(r.avg)}</small></div>
      <div><span>Tips</span><b>${fmt(r.tips)}</b></div>
      <div><span>Tax collected</span><b>${fmt(r.tax - r.refundTax)}</b></div>
      <div><span>Total taken in</span><b>${fmt(r.collected)}</b><small>all payments, less refunds</small></div>
    </div>
    ${r.practice ? `<p class="pill warn">${fmt(r.practice)} was taken on the practice reader (no card was charged).</p>` : ''}
    ${r.offline ? `<p class="mut">${r.offline} sale${r.offline === 1 ? ' was' : 's were'} rung up while offline.</p>` : ''}
    <div class="rep-grid">
      <section><h2 class="sub">Summary</h2><table class="tbl"><tr><td>Gross sales</td><td>${fmt(r.gross)}</td></tr><tr><td>Discounts</td><td>−${fmt(r.discounts)}</td></tr><tr><td>Refunds (${r.refundCount})</td><td>−${fmt(r.refunds - r.refundTax)}</td></tr><tr class="b"><td>Net sales</td><td>${fmt(r.net)}</td></tr><tr><td>Tax</td><td>${fmt(r.tax - r.refundTax)}</td></tr><tr><td>Tips</td><td>${fmt(r.tips)}</td></tr><tr class="b"><td>Total taken in</td><td>${fmt(r.collected)}</td></tr></table></section>
      <section><h2 class="sub">By payment</h2><table class="tbl"><tr><th>Type</th><th>#</th><th>Sales</th><th>Tips</th><th>Refunds</th></tr>${Object.entries(r.tenders).map(([k, t]) => `<tr><td>${esc(k)}</td><td>${t.count}</td><td>${fmt(t.amount)}</td><td>${fmt(t.tips)}</td><td>${t.refunds ? '−' + fmt(t.refunds) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No payments</td></tr>'}</table></section>
      <section><h2 class="sub">Top items</h2><table class="tbl"><tr><th>Item</th><th>Sold</th><th>Sales</th></tr>${r.topItems.slice(0, 15).map(([n, i]) => `<tr><td>${esc(n)}</td><td>${i.qty}</td><td>${fmt(i.amount)}</td></tr>`).join('') || '<tr><td colspan="3" class="mut">Nothing sold</td></tr>'}</table></section>
      <section><h2 class="sub">By category</h2><table class="tbl">${Object.entries(r.cats).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<tr><td>${esc(n)}</td><td>${fmt(v)}</td></tr>`).join('') || '<tr><td class="mut">Nothing sold</td></tr>'}</table></section>
      <section><h2 class="sub">Staff</h2><table class="tbl"><tr><th>Name</th><th>Sales</th><th>Total</th><th>Tips</th><th>Hours</th></tr>${Object.entries(r.staff).map(([n, s]) => `<tr><td>${esc(n)}</td><td>${s.count}</td><td>${fmt(s.amount)}</td><td>${fmt(s.tips)}</td><td>${s.hours ? s.hours.toFixed(2) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No one yet</td></tr>'}</table></section>
      <section><h2 class="sub">Drawers</h2><table class="tbl"><tr><th>Register</th><th>Opened</th><th>Start</th><th>Counted</th><th>Over/short</th></tr>${r.shifts.map((s) => `<tr><td>${esc(s.deviceName || 'Register')}</td><td>${time(s.openedAt)}${s.closedAt ? '–' + time(s.closedAt) : ' (open)'}</td><td>${fmt(s.openCash)}</td><td>${s.counted != null ? fmt(s.counted) : ''}</td><td>${s.counted != null && s.expected != null ? (s.counted - s.expected === 0 ? 'Even' : fmt(s.counted - s.expected, true)) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No drawer started</td></tr>'}</table></section>
    </div>
    <section><h2 class="sub">Sales by hour</h2><div class="bars">${hrs.map(([h, v]) => `<div class="bar-c" title="${fmt(v)}"><i style="height:${Math.round((v / maxH) * 100)}%"></i><small>${h % 12 || 12}${h < 12 ? 'a' : 'p'}</small></div>`).join('')}</div></section>
    <p class="mut sm">Report for ${dateLbl(day + 'T12:00')}${S.mode === 'server' ? (S.online ? ', all registers.' : '. Offline: this register only.') : '.'}</p>`;
}
function reportCsv() {
  const { rep: r, sales, day } = repData;
  const rows = [['Receipt', 'Time', 'Staff', 'Type', 'Items', 'Subtotal', 'Discount', 'Tax', 'Tip', 'Total', 'Payments', 'Refunded']];
  for (const s of sales.sort((a, b) => a.at - b.at)) rows.push([s.no, new Date(s.at).toLocaleTimeString('en-US'), s.staffName, s.type, s.lines.map((l) => `${l.qty}x ${l.name}${l.variant ? ` (${l.variant})` : ''}`).join('; '), s.subtotal / 100, s.discount / 100, s.tax / 100, s.tip / 100, s.total / 100, s.tenders.map((t) => `${C.tenderName(t)} ${(t.amount + (t.tip || 0)) / 100}`).join('; '), (s.refunds || []).reduce((a, x) => a + x.amount, 0) / 100]);
  rows.push([], ['Net sales', r.net / 100], ['Tax', (r.tax - r.refundTax) / 100], ['Tips', r.tips / 100], ['Total taken in', r.collected / 100]);
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `sales-${day}.csv`;
  a.click();
}

/* ---------- products ---------- */
let prodQ = '';
function renderProducts(m) {
  const items = S.catalog.items.filter((i) => !prodQ || i.name.toLowerCase().includes(prodQ.toLowerCase()) || (i.cat || '').toLowerCase().includes(prodQ.toLowerCase()));
  const studio = studioProducts();
  const importable = S.mode === 'server' ? studio.extra : studio.items;
  m.innerHTML = `<div class="page"><div class="page-h"><h1>Products</h1><div class="row"><label class="search sm">${ic('search', 16)}<input id="pQ" type="search" placeholder="Search" value="${esc(prodQ)}"></label><button type="button" class="btn" data-act="studio-import" ${importable.length ? '' : 'disabled title="Nothing new to bring in from the website designer in this browser"'}>Bring in from my website${importable.length ? ` (${importable.length})` : ''}</button><button type="button" class="btn pri" data-edit="">${ic('plus', 16)} New product</button></div></div>
    <p class="mut sm">Stock counts are shared by every register${S.mode === 'server' ? ' and go down as each sale reaches the server' : ''}. Items marked “Kitchen” print on the kitchen screen.</p>
    <div class="list">${items.map((i) => {
      const keys = Object.keys(S.stock).filter((k) => k === i.id || k.startsWith(i.id + '|'));
      const n = keys.reduce((a, k) => a + S.stock[k], 0);
      return `<button type="button" class="row-b" data-edit="${esc(i.id)}"><span class="sw" style="--c:${esc(i.color || COLORS[Math.abs(hashStr(i.cat || i.name)) % COLORS.length])}"></span><span class="n"><b>${esc(i.name)}</b><small>${i.online ? 'Online store · ' : ''}${esc(i.cat || 'No category')}${i.opts.length ? ` · ${i.opts.map((g) => g.name).join(', ')}` : ''}${i.kitchen ? ' · Kitchen' : ''}${i.hidden ? ' · Hidden' : ''}</small></span><span class="k">${i.track ? `<span class="${n <= 3 ? 'warn' : ''}">${n} in stock</span>` : '<span class="mut">Not tracked</span>'}</span><span class="p">${fmt(i.price)}</span></button>`;
    }).join('') || '<p class="mut">No products yet.</p>'}</div></div>`;
}
function editProduct(id) {
  const orig = S.catalog.items.find((i) => i.id === id);
  const it = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid('it'), name: '', price: 0, cat: '', color: '', image: '', sku: '', barcode: '', taxable: true, kitchen: false, track: false, hidden: false, opts: [] };
  const optText = (g) => g.vals.map((v) => v.label + (v.add ? ` (+${(v.add / 100).toFixed(2)})` : '')).join(', ');
  const variants = () => { const vg = it.opts.filter((g) => g.variant); if (!vg.length) return []; return vg.reduce((acc, g) => acc.flatMap((a) => g.vals.map((v) => a.concat(v.label))), [[]]).map((a) => a.join(' / ')); };
  const cats = [...new Set(S.catalog.items.map((i) => i.cat).filter(Boolean))];
  const draw = () => {
    const vs = variants();
    modal(`${head(orig ? 'Edit product' : 'New product')}<form data-form="product" class="pf">
      ${it.online ? '<p class="pill">From your online store: change the name, price and options in the website designer and publish.</p>' : ''}
      <div class="row2"><label>Name<input name="name" class="inp" required maxlength="120" value="${esc(it.name)}" ${it.online ? 'readonly' : ''}></label><label>Price<input name="price" class="inp" inputmode="decimal" required value="${(it.price / 100).toFixed(2)}" ${it.online ? 'readonly' : ''}></label></div>
      <div class="row2"><label>Category<input name="cat" class="inp" maxlength="60" list="catList" value="${esc(it.cat)}"><datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label><label>Barcode or SKU<input name="barcode" class="inp" maxlength="64" value="${esc(it.barcode || it.sku)}" placeholder="Scan or type"></label></div>
      <div class="chips">${COLORS.map((c) => `<button type="button" class="swatch ${it.color === c ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Tile color"></button>`).join('')}</div>
      <div class="checks"><label class="chk"><input type="checkbox" name="taxable" ${it.taxable ? 'checked' : ''}> Charge tax</label><label class="chk"><input type="checkbox" name="kitchen" ${it.kitchen ? 'checked' : ''}> Send to kitchen</label><label class="chk"><input type="checkbox" name="track" ${it.track ? 'checked' : ''}> Track stock</label><label class="chk"><input type="checkbox" name="hidden" ${it.hidden ? 'checked' : ''}> Hide from the register</label></div>
      ${it.online ? '' : `<h3 class="sub">Options</h3><p class="mut sm">Sizes and colors you keep stock for are <b>variants</b>. Add-ons like “Oat milk (+0.75)” change the price.</p>
      <div class="optlist">${it.opts.map((g, i) => `<div class="optrow"><input class="inp" data-og="${i}|name" value="${esc(g.name)}" placeholder="Size"><input class="inp grow" data-og="${i}|vals" value="${esc(optText(g))}" placeholder="Small, Medium (+0.50), Large (+1)"><select class="inp" data-og="${i}|kind"><option value="one" ${!g.multi && !g.variant ? 'selected' : ''}>Pick one</option><option value="multi" ${g.multi ? 'selected' : ''}>Pick any</option><option value="variant" ${g.variant ? 'selected' : ''}>Variant (stock)</option></select><button type="button" class="icon sm" data-ogdel="${i}" aria-label="Remove option">${ic('x', 16)}</button></div>`).join('')}</div>
      <button type="button" class="btn sm" data-act="og-add">${ic('plus', 14)} Add an option</button>`}
      ${it.track ? `<h3 class="sub">Stock</h3><div class="denoms">${(vs.length ? vs : ['']).map((v) => `<label><span>${esc(v || 'In stock')}</span><input class="inp" inputmode="numeric" data-stk="${esc(v)}" value="${S.stock[C.stockKey(it.id, v)] ?? ''}" placeholder="0"></label>`).join('')}</div>` : ''}
      <p class="err" id="pErr" hidden></p>
      <div class="sh-foot">${orig && !it.online ? `<button type="button" class="btn danger" data-act="prod-del">${ic('trash', 16)} Delete</button>` : ''}<button type="submit" class="btn pri big">Save</button></div></form>`, { wide: true });
  };
  const readForm = () => {
    const f = $('form[data-form=product]');
    if (!f) return;
    const v = Object.fromEntries(new FormData(f));
    Object.assign(it, { name: v.name.trim(), price: C.parsePrice(v.price) ?? 0, cat: v.cat.trim(), barcode: v.barcode.trim(), taxable: !!v.taxable, kitchen: !!v.kitchen, track: !!v.track, hidden: !!v.hidden });
    $$('[data-og]').forEach((el) => {
      const [i, k] = el.dataset.og.split('|');
      const g = it.opts[+i];
      if (k === 'name') g.name = el.value.trim();
      if (k === 'vals') g.vals = el.value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const mm = s.match(/\(\s*\+\s*\$?([\d.]+)\s*\)/); return { label: s.replace(/\(\s*\+\s*\$?[\d.]+\s*\)/, '').trim(), add: mm ? Math.round(parseFloat(mm[1]) * 100) : 0 }; });
      if (k === 'kind') { g.multi = el.value === 'multi'; g.variant = el.value === 'variant'; }
    });
    it._stock = {};
    $$('[data-stk]').forEach((el) => { if (el.value !== '') it._stock[C.stockKey(it.id, el.dataset.stk)] = Math.trunc(+el.value) || 0; });
  };
  prodCtx = {
    redraw() { readForm(); draw(); },
    color(c) { readForm(); it.color = it.color === c ? '' : c; draw(); },
    addOpt() { readForm(); it.opts.push({ name: '', vals: [], multi: false, variant: false }); draw(); },
    delOpt(i) { readForm(); it.opts.splice(i, 1); draw(); },
    async save() {
      readForm();
      if (!it.name) return;
      it.opts = it.opts.filter((g) => g.name && g.vals.length);
      const stock = it._stock;
      delete it._stock;
      const items = orig ? S.catalog.items.map((x) => (x.id === it.id ? it : x)) : [...S.catalog.items, it];
      try {
        await saveCatalog(items, stock);
        closeModal();
        paintMain();
        toast('Saved.');
      } catch (e) { $('#pErr').textContent = e.message; $('#pErr').hidden = false; }
    },
    async del() {
      if (!confirm(`Delete ${it.name}?`)) return;
      await saveCatalog(S.catalog.items.filter((x) => x.id !== it.id), {});
      closeModal();
      paintMain();
    },
  };
  draw();
}
let prodCtx = null;
async function saveCatalog(items, stockSet) {
  if (S.mode === 'server') {
    if (!S.online) throw new Error('Changing products needs the internet, so every register gets the same list.');
    const d = await api('/catalog', { method: 'PUT', staff: true, body: { items, cats: [...new Set(items.map((i) => i.cat).filter(Boolean))] } });
    S.catalog = d.catalog;
    S.stock = d.stock;
    if (stockSet && Object.keys(stockSet).length) S.stock = (await api('/stock', { method: 'PUT', staff: true, body: { set: stockSet } })).stock;
  } else {
    S.catalog = { items, cats: [...new Set(items.map((i) => i.cat).filter(Boolean))], updatedAt: Date.now() };
    Object.assign(S.stock, stockSet || {});
  }
  save();
}
async function studioImport() {
  const st0 = studioProducts();
  // online store products come from the published site in a real shop; only menus and services are added here
  const st = S.mode === 'server' ? { ...st0, items: st0.extra, stock: {} } : st0;
  if (!st.items.length) return toast(S.mode === 'server' && st0.items.length ? 'Your store products come over when you publish your site. There are no menu items or services to add.' : 'No products found in the website designer in this browser.');
  const byId = new Map(S.catalog.items.map((i) => [i.id, i]));
  let added = 0;
  let updated = 0;
  for (const it of st.items) {
    const prev = byId.get(it.id);
    if (prev) { Object.assign(prev, { name: it.name, price: it.price, cat: it.cat, opts: it.opts, track: it.track || prev.track }); updated++; } else { byId.set(it.id, { color: '', sku: '', barcode: '', hidden: false, ...it }); added++; }
  }
  const newStock = {};
  for (const [k, n] of Object.entries(st.stock)) if (S.stock[k] == null) newStock[k] = n;
  try {
    await saveCatalog([...byId.values()], newStock);
    toast(`Brought in ${added} new and updated ${updated} products from your website.`);
    paintMain();
  } catch (e) { toast(e.message); }
}

/* ---------- settings ---------- */
let setTab = 'shop';
async function renderSettings(m) {
  const tabs = [['shop', 'Business'], ['staff', 'Staff'], ['devices', 'Devices & card readers'], ['this', 'This register']].filter(([k]) => isOwner() || k === 'devices' || k === 'this');
  if (!tabs.some(([k]) => k === setTab)) setTab = tabs[0][0];
  m.innerHTML = `<div class="page"><div class="page-h"><h1>Settings</h1></div><div class="seg wide">${tabs.map(([k, l]) => `<button type="button" class="${setTab === k ? 'on' : ''}" data-settab="${k}">${l}</button>`).join('')}</div><div id="setBody"></div></div>`;
  const b = $('#setBody');
  const st = settings();
  if (setTab === 'shop') {
    b.innerHTML = `<form data-form="settings" class="pf narrow">
      <label>Business name<input name="name" class="inp" maxlength="100" value="${esc(S.shop.name)}"></label>
      <div class="row2"><label>Address (on receipts)<input name="address" class="inp" maxlength="300" value="${esc(st.address)}"></label><label>Phone (on receipts)<input name="phone" class="inp" maxlength="30" value="${esc(st.phone)}"></label></div>
      <div class="row2"><label>Sales tax %<input name="taxRate" class="inp" inputmode="decimal" value="${st.taxRate || 0}"></label><label>Cashiers can discount up to %<input name="cashierMaxDiscount" class="inp" inputmode="numeric" value="${st.cashierMaxDiscount ?? 10}"></label></div>
      <label class="chk"><input type="checkbox" name="tipsOn" ${st.tipsOn ? 'checked' : ''}> Ask for a tip before payment</label>
      <label>Tip choices %<input name="tipPresets" class="inp" value="${(st.tipPresets || []).join(', ')}" placeholder="15, 20, 25"></label>
      <label class="chk"><input type="checkbox" name="kitchenOn" ${st.kitchenOn ? 'checked' : ''}> Send orders to the kitchen screen</label>
      <label>Receipt message<input name="receiptFooter" class="inp" maxlength="300" value="${esc(st.receiptFooter)}"></label>
      <div class="sh-foot"><button class="btn pri big" type="submit">Save</button></div></form>`;
  } else if (setTab === 'staff') {
    staffDraft = S.shop.staff.map((x) => ({ ...x, pin: '' }));
    paintStaff();
  } else if (setTab === 'devices') {
    const readers = S.shop.terminal?.readers || [];
    b.innerHTML = `<section class="narrow"><h2 class="sub">Registers and kitchen screens</h2>
      ${S.mode === 'server' ? `<ul class="list plain">${S.devices.map((d) => `<li><span>${esc(d.name)} <small class="mut">${d.kind === 'kitchen' ? 'Kitchen screen' : 'Register'}${d.id === S.device?.id ? ' · this one' : ''}</small></span>${isOwner() && d.id !== S.device?.id ? `<button type="button" class="btn sm danger" data-devdel="${d.id}">Remove</button>` : ''}</li>`).join('')}</ul>
      <div class="row wrap"><button type="button" class="btn" data-pair="register">${ic('plus', 16)} Add a register</button><button type="button" class="btn" data-pair="kitchen">${ic('chef', 16)} Add a kitchen screen</button></div>` : '<p class="mut">Practice mode runs on this device only. Open <a href="/kitchen">/kitchen</a> in another tab of this browser to see the kitchen screen.</p>'}
      <h2 class="sub">Card readers</h2>
      ${S.mode !== 'server' ? '<p class="mut">Practice mode uses a practice reader that approves every card. Set up a real shop to use Stripe card readers.</p>' : !S.terminal.enabled ? `<p class="mut">Card readers need Stripe connected to the server. Until then the register uses a practice reader and no card is charged.</p>` : !S.terminal.ready ? `<p class="mut">Set up card payments first (Studio, Owner dashboard, Set up card payments), so card money goes straight to your bank. Until then the register uses a practice reader and no card is charged.</p>` : `
        <p class="mut">${S.terminal.testMode ? 'Stripe is in <b>test mode</b>: use the simulated reader, no real cards are charged.' : 'Stripe is <b>live</b>: cards are charged for real.'}</p>
        <ul class="list plain">${readers.map((r) => `<li><label class="chk"><input type="radio" name="reader" value="${esc(r.id)}" data-reader ${S.readerId === r.id ? 'checked' : ''}> ${esc(r.label)} <small class="mut">${esc(r.type || '')}${r.status && r.status !== 'online' ? ' · ' + esc(r.status) : ''}</small></label>${isMgr() ? `<button type="button" class="btn sm danger" data-rdel="${esc(r.id)}">Remove</button>` : ''}</li>`).join('')}
        <li><label class="chk"><input type="radio" name="reader" value="practice" data-reader ${!S.readerId || S.readerId === 'practice' ? 'checked' : ''}> Practice reader <small class="mut">no card is charged</small></label></li></ul>
        ${isMgr() ? `<form data-form="reader" class="pf"><div class="row2"><label>Pairing code from the reader<input name="code" class="inp" placeholder="e.g. apple-banana-cherry" maxlength="100"></label><label>Name<input name="label" class="inp" placeholder="Front counter" maxlength="60"></label></div>
        <div class="row wrap"><button class="btn pri" type="submit">Add reader</button>${S.terminal.testMode ? '<button type="button" class="btn" data-act="sim-reader">Add Stripe’s simulated reader</button>' : ''}<button type="button" class="btn" data-act="reader-refresh">${ic('sync', 16)} Refresh</button></div>
        <p class="mut sm">On a Stripe Reader S700 or BBPOS WisePOS E: swipe in from the left, Settings, then Generate pairing code.</p></form>` : ''}`}
    </section>`;
  } else {
    b.innerHTML = `<section class="narrow"><ul class="list plain"><li><span>This device</span><b>${esc(S.device?.name || '')}</b></li><li><span>Waiting to send</span><b>${S.outbox}</b></li><li><span>Last sync</span><b>${S.lastSync ? time(S.lastSync) : 'never'}</b></li></ul>
      <div class="row wrap"><button type="button" class="btn" data-act="sync-now">${ic('sync', 16)} Sync now</button><button type="button" class="btn" data-act="install" id="installBtn" ${installEvt ? '' : 'hidden'}>Install as an app</button><button type="button" class="btn" data-act="print-test">${ic('print', 16)} Test print</button></div>
      <p class="mut sm">Receipt printers: any printer this device can print to works. For 80 mm receipt printers (Star TSP143IV, Epson TM-m30III), pick the receipt paper size in the print dialog, and turn on “open cash drawer when printing” in the printer’s settings so the drawer pops with each receipt.</p>
      <p class="mut sm">Barcode scanners: any USB or Bluetooth scanner that types like a keyboard works. Scan on the Sell screen.</p>
      ${isOwner() ? `<h2 class="sub">Remove this device</h2><p class="mut sm">Signs this device out of the shop. Sales not sent yet stay on it.</p><button type="button" class="btn danger" data-act="forget">Sign this device out</button>` : ''}</section>`;
  }
}
let staffDraft = [];
function paintStaff() {
  const b = $('#setBody');
  b.innerHTML = `<form data-form="staff" class="pf"><div class="staff-list">${staffDraft.map((s, i) => `<div class="staff-row ${s.active === false ? 'off' : ''}"><span class="sw" style="--c:${esc(s.color || COLORS[i % COLORS.length])}"></span>
    <input class="inp" data-sf="${i}|name" value="${esc(s.name)}" placeholder="Name" maxlength="80"><select class="inp" data-sf="${i}|role">${ROLES.map((r) => `<option value="${r}" ${s.role === r ? 'selected' : ''}>${ROLE_NAME[r]}</option>`).join('')}</select>
    <input class="inp" data-sf="${i}|pin" value="${esc(s.pin)}" placeholder="${s.hash ? 'New PIN (optional)' : 'PIN'}" inputmode="numeric" maxlength="8" type="password" autocomplete="new-password">
    <label class="chk"><input type="checkbox" data-sf="${i}|active" ${s.active !== false ? 'checked' : ''}> Active</label></div>`).join('')}</div>
    <button type="button" class="btn" data-act="staff-add">${ic('plus', 16)} Add a person</button>
    <p class="mut sm">Cashiers ring up sales. Managers also refund, discount, take cash out, see reports and edit products. Owners also change settings and staff.</p>
    <p class="err" id="sErr" hidden></p><div class="sh-foot"><button class="btn pri big" type="submit">Save staff</button></div></form>`;
}
function readStaff() { $$('[data-sf]').forEach((el) => { const [i, k] = el.dataset.sf.split('|'); staffDraft[+i][k] = k === 'active' ? el.checked : el.value.trim(); }); }
async function saveStaff() {
  readStaff();
  const err = $('#sErr');
  const show = (msg) => { err.textContent = msg; err.hidden = false; };
  for (const s of staffDraft) {
    if (!s.name) return show('Every person needs a name.');
    if (s.pin && !/^\d{4,8}$/.test(s.pin)) return show(`${s.name}: the PIN must be 4 to 8 digits.`);
    if (!s.hash && !s.pin) return show(`${s.name}: pick a PIN.`);
  }
  if (!staffDraft.some((s) => s.role === 'owner' && s.active !== false)) return show('Keep at least one owner.');
  try {
    if (S.mode === 'server') {
      const d = await api('/staff', { method: 'PUT', staff: true, body: { staff: staffDraft.map(({ id, name, role, pin, active, color }) => ({ id: S.shop.staff.some((x) => x.id === id) ? id : undefined, name, role, pin: pin || undefined, active, color })) } });
      S.shop = d.shop;
    } else {
      const next = [];
      for (const s of staffDraft) {
        let { salt, hash } = s;
        if (s.pin) { salt = newSalt(); hash = await pinHash(s.pin, salt); }
        next.push({ id: s.id || uid('st'), name: s.name, role: s.role, color: s.color, active: s.active !== false, salt, hash });
      }
      S.shop.staff = next;
    }
    save();
    toast('Staff saved.');
    renderSettings($('#main'));
  } catch (e) { show(e.message); }
}
async function saveSettings(f) {
  const v = Object.fromEntries(new FormData(f));
  const next = { ...settings(), address: v.address, phone: v.phone, taxRate: parseFloat(v.taxRate) || 0, cashierMaxDiscount: parseInt(v.cashierMaxDiscount, 10) || 0, tipsOn: !!v.tipsOn, tipPresets: v.tipPresets.split(/[,\s]+/).map((n) => parseInt(n, 10)).filter((n) => n > 0).slice(0, 4), kitchenOn: !!v.kitchenOn, receiptFooter: v.receiptFooter };
  try {
    if (S.mode === 'server') S.shop = (await api('/settings', { method: 'PUT', staff: true, body: { settings: next, name: v.name } })).shop;
    else { S.shop.settings = next; S.shop.name = v.name || S.shop.name; }
    save();
    toast('Saved.');
    render();
  } catch (e) { toast(e.message); }
}
async function pairCode(kind) {
  try {
    const d = await api('/pair-code', { method: 'POST', staff: true, body: { kind } });
    modal(`${head(kind === 'kitchen' ? 'Add a kitchen screen' : 'Add a register')}<p>On the new device, open <b>${esc(location.host)}/${kind === 'kitchen' ? 'kitchen' : 'pos'}</b>, choose <b>Join with a code</b> and type:</p><div class="amount big code">${d.code.slice(0, 3)} ${d.code.slice(3)}</div><p class="mut ctr">The code works once, for 10 minutes.</p><div class="sh-foot"><button type="button" class="btn pri" data-act="close">Done</button></div>`);
  } catch (e) { toast(e.message); }
}
async function addReader(code, label) {
  try {
    const d = await api('/terminal/readers', { method: 'POST', staff: true, body: { code, label } });
    S.shop.terminal = { ...(S.shop.terminal || {}), readers: d.readers };
    S.readerId = d.reader.id;
    save();
    toast(`${d.reader.label} added and picked for this register.`);
    renderSettings($('#main'));
  } catch (e) { toast(e.message, 6000); }
}
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; const b = $('#installBtn'); if (b) b.hidden = false; });
function resetDevice() {
  localStorage.removeItem(LS);
  S = { ...S, mode: 'none', token: '', device: null, shop: null, staff: null, catalog: { items: [], cats: [] }, stock: {}, cart: blankCart(), shift: null, clocks: {}, parked: [] };
  render();
}

/* ---------- events ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button,[data-act],a');
  if (!t) { if (e.target.id === 'modal' && !P && !cardFlow) closeModal(); return; }
  if (t.tagName === 'A' && !t.dataset.act) return;
  const d = t.dataset;
  if (d.key && t.closest('[data-pad]')) return padPress(t.closest('[data-pad]').dataset.pad, d.key);
  if (d.setup) { $$('.setup-tabs button').forEach((b) => b.classList.toggle('on', b === t)); $('#fNew').hidden = d.setup !== 'new'; $('#fJoin').hidden = d.setup !== 'join'; $('#fTry').hidden = d.setup !== 'try'; return; }
  if (d.pick) { lockPick = d.pick; return render(); }
  if (d.apick) return approvePick(d.apick);
  if (d.view) { S.view = d.view; closeModal(); document.body.classList.remove('nav-open'); return render(); }
  if (d.cat) { S.cat = d.cat; return paintGrid(); }
  if (d.item) return tapItem(d.item);
  if (d.line) return lineModal(+d.line);
  if (d.type) { S.cart.type = d.type; save(); return paintCart(); }
  if (d.opt) return itemHandlers.opt(d.opt, d.val);
  if (d.q) return itemHandlers.q(+d.q);
  if (d.lq) { const l = S.cart.lines[lineCtx.i]; l.qty = Math.max(1, l.qty + +d.lq); if (l.discPct) l.discount = Math.round((C.lineGross(l) * l.discPct) / 100); $('#lq').textContent = l.qty; save(); return paintCart(); }
  if (d.ldisc) return setLineDiscount(+d.ldisc);
  if (d.disc) { const [k, v, l] = d.disc.split('|'); return applyDiscount(k, +v, l); }
  if (d.tip !== undefined) return setTip(+d.tip);
  if (d.splitn) { const left = due(); $('#partAmt').value = (Math.ceil(left / +d.splitn) / 100).toFixed(2); return; }
  if (d.tender === 'card') return payCard();
  if (d.tender === 'cash') return payCash();
  if (d.tender === 'other') return payOther();
  if (d.given) return cashGive(+d.given);
  if (d.otherk) return otherDone(d.otherk);
  if (d.sim) return cardFlow?.finish(d.sim === 'ok');
  if (d.tap != null && cardFlow?.reader) { api('/terminal/simulate', { method: 'POST', body: { readerId: cardFlow.reader, card: d.tap || undefined } }).catch((er) => toast(er.message)); return; }
  if (d.rcpt) {
    const sale = await getOne('sales', d.sale) || (saleCtx?.id === d.sale ? saleCtx : null);
    if (!sale) return;
    if (d.rcpt === 'print') { printHtml(receiptHtml(sale)); return; }
    return sendReceipt(sale, d.rcpt);
  }
  if (d.sale && t.classList.contains('row-b')) return saleModal(d.sale);
  if (d.unpark) { const p = S.parked.find((x) => x.id === d.unpark); if (!p) return; if (S.cart.lines.length && !confirm('Replace the sale in the cart?')) return; S.cart = { ...blankCart(), ...p, parkedId: p.id }; S.view = 'sell'; save(); return render(); }
  if (d.rq) { const [i, n] = d.rq.split('|'); return refundCtx.step(+i, +n); }
  if (d.drawer) return drawerEvent(d.drawer);
  if (d.edit !== undefined) return editProduct(d.edit);
  if (d.color) return prodCtx.color(d.color);
  if (d.ogdel) return prodCtx.delOpt(+d.ogdel);
  if (d.settab) { setTab = d.settab; return renderSettings($('#main')); }
  if (d.pair) return pairCode(d.pair);
  if (d.devdel) { if (!confirm('Remove this device from the shop?')) return; try { S.devices = (await api(`/devices/${d.devdel}`, { method: 'DELETE', staff: true })).devices; renderSettings($('#main')); } catch (er) { toast(er.message); } return; }
  if (d.rdel) { try { const r = await api(`/terminal/readers/${encodeURIComponent(d.rdel)}`, { method: 'DELETE', staff: true }); S.shop.terminal.readers = r.readers; if (S.readerId === d.rdel) S.readerId = 'practice'; save(); renderSettings($('#main')); } catch (er) { toast(er.message); } return; }
  switch (d.act) {
    case 'close': if (cardFlow && !cardFlow.practice) return; closeModal(); return;
    case 'practice': return practice();
    case 'signup-show': $('#fSignup').hidden = false; $('form[data-form=signin]').hidden = true; t.hidden = true; return;
    case 'signout': await fetch('/api/account/logout', { method: 'POST' }).catch(() => {}); ownerInfo = null; ownerToken = ''; return render();
    case 'nav': document.body.classList.toggle('nav-open'); return navMenu();
    case 'lock': return lockMenu();
    case 'lock-now': return lock();
    case 'clock-out': return clockOut();
    case 'custom': return customAmount();
    case 'ca-add': return customAdd();
    case 'item-add': return itemHandlers.add();
    case 'line-del': return itemHandlers.del();
    case 'line-del2': S.cart.lines.splice(lineCtx.i, 1); save(); paintCart(); paintGrid(); return closeModal();
    case 'line-done': { const l = S.cart.lines[lineCtx.i]; if (l) { l.note = $('#lineNote').value.trim(); save(); paintCart(); } return closeModal(); }
    case 'line-opts': { const { i, item } = lineCtx; return itemModal(item, i); }
    case 'discount': return discountModal();
    case 'disc-apply': { const pct = parseFloat($('#dPct').value); const amt = C.parsePrice($('#dAmt').value); const lbl = $('#dLbl').value.trim(); return pct > 0 ? applyDiscount('pct', Math.min(100, pct), lbl) : applyDiscount('amt', amt || 0, lbl); }
    case 'undisc': S.cart.discount = null; S.cart.discountLabel = ''; save(); return paintCart();
    case 'customer': return customerModal();
    case 'cust-save': S.cart.ticket = $('#cTicket').value.trim(); S.cart.customer = { name: $('#cTicket').value.trim(), email: $('#cEmail').value.trim(), phone: $('#cPhone').value.trim() }; S.cart.note = $('#cNote').value.trim(); save(); paintCart(); return closeModal();
    case 'park': return park();
    case 'clear': if (S.cart.lines.length && confirm('Clear this sale?')) { S.cart = blankCart(); save(); paintCart(); paintGrid(); } return;
    case 'charge': document.body.classList.remove('cart-open'); return charge();
    case 'peek': document.body.classList.add('cart-open'); return;
    case 'cart-close': document.body.classList.remove('cart-open'); return;
    case 'tip-custom': { const v = await ask('Tip amount', 'Dollars', '$0.00'); return setTip(C.parsePrice(v) || 0); }
    case 'tip-again': P.step = 'tip'; return payModal();
    case 'pay-cancel': P = null; return closeModal();
    case 'pay-back': return payModal();
    case 'cash-ok': return cashDone();
    case 'card-cancel': if (cardFlow) { if (cardFlow.practice) { cardFlow = null; P.msg = 'Card payment canceled.'; return payModal(); } return cardFlow.cancel(); } return payModal();
    case 'refund': return refundModal();
    case 'refund-back': return saleModal(saleCtx.id);
    case 'refund-go': return doRefund();
    case 'shift-open': return shiftOpen();
    case 'shift-close': return shiftClose();
    case 'no-sale': { printHtml(`<div class="rc"><h3>${esc(S.shop.name)}</h3><p>No sale · ${new Date().toLocaleString('en-US')}</p><p>${esc(S.staff.name)}</p></div>`); if (S.shift) { S.shift.events.push({ kind: 'in', amount: 0, note: 'No sale (drawer opened)', at: Date.now(), by: S.staff.name }); save(); put('shifts', S.shift); if (S.mode === 'server') queue('shift', S.shift); } return; }
    case 'print-shift': if (lastShift) printHtml(`<div class="rc"><h3>${esc(S.shop.name)}</h3><p>Shift report · ${esc(lastShift.sh.deviceName || '')}</p><p>${new Date(lastShift.sh.openedAt).toLocaleString('en-US')} – ${time(lastShift.sh.closedAt)}</p><table><tr><td>Starting cash</td><td>${fmt(lastShift.sh.openCash)}</td></tr><tr><td>Expected</td><td>${fmt(lastShift.sh.expected)}</td></tr><tr><td>Counted</td><td>${fmt(lastShift.sh.counted)}</td></tr><tr class="b"><td>Over/short</td><td>${fmt(lastShift.sh.counted - lastShift.sh.expected, true)}</td></tr><tr><td>Sales</td><td>${lastShift.rep.count}</td></tr>${Object.entries(lastShift.rep.tenders).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${fmt(v.amount + v.tips - v.refunds)}</td></tr>`).join('')}</table><p>Closed by ${esc(lastShift.sh.closedBy)}</p></div>`); return;
    case 'rep-print': if (repData) printHtml(`<div class="rc wide"><h3>${esc(S.shop.name)} · ${dateLbl(repData.day + 'T12:00')}</h3>${reportHtml(repData.rep, repData.day)}</div>`); return;
    case 'rep-csv': if (repData) reportCsv(); return;
    case 'studio-import': return studioImport();
    case 'og-add': return prodCtx.addOpt();
    case 'prod-del': return prodCtx.del();
    case 'staff-add': readStaff(); staffDraft.push({ id: '', name: '', role: 'cashier', pin: '', active: true, color: COLORS[staffDraft.length % COLORS.length] }); return paintStaff();
    case 'sim-reader': return addReader('simulated', 'Test reader');
    case 'reader-refresh': try { const r = await api('/terminal/readers'); S.shop.terminal = { ...(S.shop.terminal || {}), readers: r.readers }; save(); renderSettings($('#main')); } catch (er) { toast(er.message); } return;
    case 'sync-now': await sync(); toast(S.outbox ? `${S.outbox} still waiting. Check the connection.` : 'Everything is sent.'); return renderSettings($('#main'));
    case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; } return;
    case 'print-test': return printHtml(`<div class="rc"><h3>${esc(S.shop.name)}</h3><p>Test print ${new Date().toLocaleString('en-US')}</p><p class="rc-f">If you can read this, the printer works.</p></div>`);
    case 'forget': if (confirm('Sign this device out of the shop? You will need a pairing code to add it again.')) resetDevice(); return;
    default:
  }
});
function navMenu() {
  modal(`${head(S.shop.name)}<nav class="navlist">${navItems().map(([v, l]) => `<button type="button" class="${S.view === v ? 'on' : ''}" data-view="${v}">${l}</button>`).join('')}<a href="/kitchen" class="btn">${ic('chef', 16)} Kitchen screen</a></nav>`, { onClose: () => document.body.classList.remove('nav-open') });
}
function lockMenu() {
  const c = S.clocks[S.staff.id];
  modal(`${head(S.staff.name, `${ROLE_NAME[S.staff.role]}${c ? ` · clocked in at ${time(c.in)}` : ''}`)}<div class="rcpt-acts"><button type="button" class="btn big" data-act="lock-now">${ic('lock', 18)} Lock</button><button type="button" class="btn big" data-act="clock-out">${ic('clock', 18)} Clock out</button></div>`);
}
document.addEventListener('submit', (e) => {
  const f = e.target;
  e.preventDefault();
  const k = f.dataset.form;
  if (k === 'signin') return doSignin(f, 'login');
  if (k === 'signup') return doSignin(f, 'signup');
  if (k === 'device') return doDevice(f);
  if (k === 'join') return doJoin(f);
  if (k === 'ask') return askDone($('#askIn').value.trim());
  if (k === 'product') return prodCtx.save();
  if (k === 'settings') return saveSettings(f);
  if (k === 'staff') return saveStaff();
  if (k === 'reader') { const v = Object.fromEntries(new FormData(f)); if (!v.code.trim()) return toast('Type the pairing code from the reader.'); return addReader(v.code.trim(), v.label.trim()); }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') { S.q = t.value; paintGrid(); return; }
  if (t.id === 'oQ') { ordersQ = t.value; clearTimeout(t._t); t._t = setTimeout(() => renderOrders($('#main')).then(() => { const q = $('#oQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }), 300); return; }
  if (t.id === 'pQ') { prodQ = t.value; renderProducts($('#main')); const q = $('#pQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); return; }
  if (t.dataset.denom != null) { counts[t.dataset.denom] = t.value; const el = $('#cntTot'); if (el) el.textContent = fmt(countTotal()); return; }
  if (t.id === 'cntTotal') { const el = $('#cntTot'); if (el) el.textContent = fmt(countTotal()); return; }
  if (t.name === 'code' && t.classList.contains('code-in')) t.value = t.value.replace(/\D/g, '').slice(0, 6);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'oDay') { ordersDay = t.value || C.localDay(); return renderOrders($('#main')); }
  if (t.id === 'rDay') { repDay = t.value || C.localDay(); return renderReports($('#main')); }
  if (t.dataset.reader != null) { S.readerId = t.value; save(); toast(t.value === 'practice' ? 'Using the practice reader.' : 'This register will use that reader.'); return; }
  if (t.name === 'track' || (t.dataset.og && t.dataset.og.endsWith('|kind'))) prodCtx?.redraw();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden && !cardFlow && !P?.tenders.length) return closeModal();
  // a barcode scanner types the code and presses Enter; on the sell screen that adds the matching product
  if (e.key === 'Enter' && e.target.id === 'q') {
    const code = e.target.value.trim();
    const hit = S.catalog.items.find((i) => code && (i.barcode === code || (i.sku && i.sku === code)));
    const only = visibleItems();
    if (hit || only.length === 1) { tapItem((hit || only[0]).id); S.q = ''; e.target.value = ''; paintGrid(); }
    return;
  }
  // PIN pads also take the number keys
  if (/^[0-9]$/.test(e.key) || e.key === 'Backspace') {
    if (e.target.matches('input,textarea,select')) return;
    const pad = $('#modal:not([hidden]) [data-pad]') || $('[data-pad]');
    if (pad) padPress(pad.dataset.pad, e.key === 'Backspace' ? '⌫' : e.key);
    return;
  }
  // scanning while nothing has focus on the sell screen
  if (S.view === 'sell' && S.staff && $('#modal').hidden && e.key.length === 1 && !e.target.matches('input,textarea,select')) { const q = $('#q'); if (q) q.focus(); }
});

/* ---------- boot ---------- */
load();
if (S.mode === 'server') { startSyncLoop(); sync(); refreshState().then(() => { if (!S.staff) render(); }).catch(() => {}); }
if (S.mode === 'none') checkOwner().then(render); else render();
all('outbox').then((b) => { S.outbox = b.length; paintStatus(); }).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/pos-sw.js', { scope: '/pos' }).catch(() => {});
// lock after 10 minutes untouched, so the next person signs in as themselves
let idleT = null;
const idle = () => { clearTimeout(idleT); idleT = setTimeout(() => { if (S.staff && !P && !cardFlow) lock(); }, 10 * 60000); };
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, idle, { passive: true }));
idle();
