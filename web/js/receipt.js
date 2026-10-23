/* A customer's receipt link (/receipt?r=...), sent by email or text from the register. */
import { fmt, lineNet, tenderName } from './pos-core.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const el = document.getElementById('r');
const token = new URLSearchParams(location.search).get('r') || '';
fetch(`/api/pos/receipt/${encodeURIComponent(token)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(({ shop, sale }) => {
  document.title = `Receipt from ${shop.name}`;
  el.innerHTML = `<div class="rc"><h3>${esc(shop.name)}</h3>${shop.address ? `<p>${esc(shop.address)}</p>` : ''}${shop.phone ? `<p>${esc(shop.phone)}</p>` : ''}
    <p>${new Date(sale.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p><p>Receipt ${esc(sale.no)}${sale.staffName ? ` · ${esc(sale.staffName)}` : ''}</p>
    <table>${sale.lines.map((l) => `<tr><td>${l.qty} × ${esc(l.name)}${l.variant ? ` (${esc(l.variant)})` : ''}${l.mods.length ? `<br><small>${esc(l.mods.map((m) => m.label).join(', '))}</small>` : ''}</td><td>${fmt(lineNet(l))}</td></tr>`).join('')}</table>
    <table>${sale.discount ? `<tr><td>${esc(sale.discountLabel || 'Discount')}</td><td>−${fmt(sale.discount)}</td></tr>` : ''}<tr><td>Subtotal</td><td>${fmt(sale.subtotal - sale.discount)}</td></tr><tr><td>Tax</td><td>${fmt(sale.tax)}</td></tr>${sale.tip ? `<tr><td>Tip</td><td>${fmt(sale.tip)}</td></tr>` : ''}<tr class="b"><td>Total</td><td>${fmt(sale.total + sale.tip)}</td></tr>
    ${sale.tenders.map((t) => `<tr><td>${esc(tenderName(t))}${t.last4 ? ` ····${esc(t.last4)}` : ''}</td><td>${fmt(t.amount + (t.tip || 0))}</td></tr>`).join('')}
    ${(sale.refunds || []).map((r) => `<tr><td>Refund ${new Date(r.at).toLocaleDateString('en-US')}</td><td>−${fmt(r.amount)}</td></tr>`).join('')}</table>
    <p class="rc-f">${esc(shop.footer || 'Thank you!')}</p></div>`;
}).catch(() => { el.innerHTML = '<p>We couldn’t find that receipt. Ask the shop to send it again.</p>'; });
