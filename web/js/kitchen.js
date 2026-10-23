/* Kitchen screen (/kitchen): orders from the register (and online orders, when the store sends them) as tickets.
   Tap an item to cross it off, Bump when the order is ready, Recall to bring the last one back.
   Paired with a 6-digit code from the register (Settings, Devices, Add a kitchen screen). Practice mode shows the
   practice register's orders from this same browser. */
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KEY = 'twp-kitchen-v1';
const LOCAL = 'twp-kitchen-local';
const LATE = 8 * 60000;
const VERY = 15 * 60000;
const TYPE = { here: 'For here', togo: 'To go', pickup: 'Pickup', delivery: 'Delivery' };

let K = { token: '', device: null, shop: null, mode: 'none' };
try { K = { ...K, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; if (K.token) K.mode = 'server'; } catch (e) { /* fresh */ }
let open = [];
let done = [];
const known = new Set();
const fresh = new Set();
let loaded = false;
let online = true;
let filter = 'all';
let sound = false;
let audio = null;
let skew = 0;

async function api(path, opts = {}) {
  const r = await fetch(`/api/pos${path}`, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(K.token ? { Authorization: `Bearer ${K.token}` } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && d.code === 'no_device') { localStorage.removeItem(KEY); K = { mode: 'none' }; render(); }
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

function render() {
  const app = $('#app');
  if (K.mode === 'none') {
    app.innerHTML = `<div class="setup"><div class="setup-card"><h1>Kitchen screen</h1>
      <p class="mut">On the register, a manager opens <b>Settings → Devices & card readers</b> and taps <b>Add a kitchen screen</b>. Type the code here.</p>
      <form id="pair" class="setup-f"><label>Pairing code<input name="code" inputmode="numeric" maxlength="7" class="code-in" required autocomplete="one-time-code"></label><label>Name this screen<input name="name" maxlength="60" placeholder="Kitchen"></label><button class="btn pri big" type="submit">Connect</button><p class="err" id="err" hidden></p></form>
      <button type="button" class="link" data-k="practice">Practice: show the practice register’s orders from this browser</button></div></div>`;
    return;
  }
  app.innerHTML = `<header class="kds-bar"><h1>${esc(K.shop?.name || 'Kitchen')}</h1><span class="pill ${online ? 'ok' : 'warn'}" id="net">${online ? (K.mode === 'local' ? 'Practice' : 'Live') : 'Offline, retrying'}</span>
    <div class="seg">${[['all', 'All'], ['here', 'For here'], ['togo', 'To go'], ['pickup', 'Pickup']].map(([k, l]) => `<button type="button" class="${filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
    <div class="sp"><span id="clock" class="mut"></span><button type="button" class="btn sm" data-k="recall">Recall</button><button type="button" class="btn sm" data-k="sound">${sound ? 'Sound on' : 'Turn on sound'}</button><button type="button" class="btn sm" data-k="full">Full screen</button></div></header>
    <main id="tickets" class="kds-grid"></main><section class="kds-done" id="doneList"></section>`;
  paint();
}
function paint() {
  const now = Date.now() + skew;
  const list = open.filter((t) => filter === 'all' || t.type === filter || (filter === 'pickup' && t.type === 'delivery'));
  const el = $('#tickets');
  if (!el) return;
  el.innerHTML = list.length ? list.map((t) => {
    const age = now - t.at;
    const cls = age > VERY ? 'very' : age > LATE ? 'late' : fresh.has(t.id) ? 'new' : '';
    return `<article class="tk ${cls}"><div class="tk-h"><b>${esc(t.no || '')}${t.name ? ` · ${esc(t.name)}` : ''}</b><span class="tm">${mins(age)}</span></div>
      <div class="tk-m">${esc(TYPE[t.type] || 'Order')}${t.source === 'web' ? ' · Online' : ''}${t.staff ? ` · ${esc(t.staff.split(' ')[0])}` : ''}${t.status === 'cooking' ? ' · <b>Cooking</b>' : ''}</div>
      ${t.note ? `<p class="tk-n">${esc(t.note)}</p>` : ''}
      <ul>${t.lines.map((l, i) => `<li class="${l.done ? 'done' : ''}"><button type="button" data-strike="${esc(t.id)}|${i}"><b>${l.qty}×</b> ${esc(l.name)}${l.variant ? ` <small>${esc(l.variant)}</small>` : ''}${l.mods?.length ? `<small>${esc(l.mods.join(', '))}</small>` : ''}${l.note ? `<small class="nt">“${esc(l.note)}”</small>` : ''}</button></li>`).join('')}</ul>
      <div class="tk-a"><button type="button" class="btn" data-cook="${esc(t.id)}">${t.status === 'cooking' ? 'Cooking…' : 'Start'}</button><button type="button" class="btn pri" data-bump="${esc(t.id)}">Bump</button></div></article>`;
  }).join('') : '<div class="kds-empty">No open orders. New ones show up here.</div>';
  const dl = $('#doneList');
  if (dl) dl.innerHTML = done.length ? `<details><summary>Done (${done.length})</summary><div class="kds-grid">${done.slice(0, 8).map((t) => `<article class="tk"><div class="tk-h"><b>${esc(t.no)}${t.name ? ` · ${esc(t.name)}` : ''}</b><button type="button" class="btn sm" data-recall="${esc(t.id)}">Recall</button></div><div class="tk-m">${esc(t.lines.map((l) => `${l.qty} ${l.name}`).join(', '))}</div></article>`).join('')}</div></details>` : '';
  const c = $('#clock');
  if (c) c.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
const mins = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); const s = Math.max(0, Math.floor((ms % 60000) / 1000)); return `${m}:${String(s).padStart(2, '0')}`; };

function beep() {
  if (!sound) return;
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.5);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.5);
  } catch (e) { /* no audio */ }
}

// new tickets glow and chime for a minute (not the ones already there when the screen opened)
function take(list, doneList) {
  const arrived = list.filter((t) => !known.has(t.id));
  list.forEach((t) => known.add(t.id));
  if (loaded && arrived.length) {
    beep();
    arrived.forEach((t) => { fresh.add(t.id); setTimeout(() => { fresh.delete(t.id); paint(); }, 60000); });
  }
  loaded = true;
  open = list;
  done = doneList;
  paint();
}

async function poll() {
  if (K.mode === 'server') {
    try {
      const d = await api('/kitchen');
      skew = d.now - Date.now();
      online = true;
      take(d.open, d.done);
    } catch (e) {
      online = false;
    }
    const n = $('#net');
    if (n) { n.className = `pill ${online ? 'ok' : 'warn'}`; n.textContent = online ? 'Live' : 'Offline, retrying'; }
  } else if (K.mode === 'local') {
    const d = readLocal();
    take(d.open, d.done);
  }
}
function readLocal() { try { return JSON.parse(localStorage.getItem(LOCAL) || '{"open":[],"done":[]}'); } catch (e) { return { open: [], done: [] }; } }
function writeLocal(d) { try { localStorage.setItem(LOCAL, JSON.stringify(d)); } catch (e) { /* full */ } }

async function act(id, body) {
  if (K.mode === 'local') {
    const d = readLocal();
    const t = [...d.open, ...d.done].find((x) => x.id === id);
    if (!t) return;
    if (body.lines) t.lines.forEach((l, i) => { l.done = Boolean(body.lines[i]); });
    if (body.status === 'done') { t.status = 'done'; t.doneAt = Date.now(); d.open = d.open.filter((x) => x.id !== id); d.done = [t, ...d.done].slice(0, 12); }
    else if (body.status === 'recall') { t.status = 'new'; d.done = d.done.filter((x) => x.id !== id); d.open.push(t); d.open.sort((a, b) => a.at - b.at); }
    else if (body.status) t.status = body.status;
    writeLocal(d);
    return poll();
  }
  try { await api(`/kitchen/${encodeURIComponent(id)}`, { method: 'POST', body }); } catch (e) { alert(e.message); }
  poll();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.k === 'practice') { K = { mode: 'local', shop: { name: 'Practice kitchen' } }; localStorage.setItem(KEY, JSON.stringify({ mode: 'local', shop: K.shop })); render(); poll(); return; }
  if (d.filter) { filter = d.filter; render(); return; }
  if (d.k === 'sound') { sound = !sound; audio = audio || new AudioContext(); beep(); render(); return; }
  if (d.k === 'full') { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}); return; }
  if (d.k === 'recall') { if (done[0]) act(done[0].id, { status: 'recall' }); return; }
  if (d.recall) return act(d.recall, { status: 'recall' });
  if (d.bump) { const tk = open.find((x) => x.id === d.bump); if (tk) { open = open.filter((x) => x !== tk); paint(); } return act(d.bump, { status: 'done' }); }
  if (d.cook) { const tk = open.find((x) => x.id === d.cook); return act(d.cook, { status: tk?.status === 'cooking' ? 'new' : 'cooking' }); }
  if (d.strike) {
    const [id, i] = d.strike.split('|');
    const tk = open.find((x) => x.id === id);
    if (!tk) return;
    tk.lines[+i].done = !tk.lines[+i].done;
    paint();
    return act(id, { lines: tk.lines.map((l) => l.done) });
  }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = Object.fromEntries(new FormData(e.target));
  const err = $('#err');
  try {
    const r = await fetch('/api/pos/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: String(v.code).replace(/\D/g, ''), name: v.name || 'Kitchen' }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'That code didn’t work.');
    if (d.device.kind !== 'kitchen') throw new Error('That code is for a register. Make a kitchen screen code instead.');
    K = { token: d.token, device: d.device, shop: d.shop, mode: 'server' };
    localStorage.setItem(KEY, JSON.stringify({ token: d.token, device: d.device, shop: d.shop }));
    render();
    poll();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
});
document.addEventListener('input', (e) => { if (e.target.name === 'code') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
try { new BroadcastChannel('twp-kitchen').onmessage = () => { if (K.mode === 'local') poll(); }; } catch (e) { /* older browser */ }
addEventListener('storage', (e) => { if (e.key === LOCAL && K.mode === 'local') poll(); });

render();
poll();
setInterval(poll, 4000);
setInterval(paint, 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/pos-sw.js', { scope: '/kitchen' }).catch(() => {});
