/* ---------- receipts and order alerts ----------
   Email goes through Resend (RESEND_API_KEY, EMAIL_FROM); texts through Twilio (TWILIO_ACCOUNT_SID,
   TWILIO_AUTH_TOKEN, TWILIO_FROM). Each is off until its keys are set, and a failed message never stops an order.
   Shoppers get a receipt and a note when their order is ready, shipped or cancelled. Owners get every new order. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export function createMailer({ apiKey, from, fetchImpl = fetch } = {}) {
  if (!apiKey || !from) return null;
  return {
    async send({ to, subject, html, text, replyTo }) {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Email not sent (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return res.json();
    },
  };
}

// US numbers only for now: (207) 555-0142 -> +12075550142
export function usPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  return null;
}

export function createTexter({ sid, token, from, fetchImpl = fetch } = {}) {
  if (!sid || !token || !from) return null;
  return {
    async send({ to, body }) {
      const num = usPhone(to);
      if (!num) return null;
      const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: num, From: from, Body: body.slice(0, 600) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Text not sent (${res.status})`);
      return res.json();
    },
  };
}

export function notifyFromEnv(env = process.env) {
  return {
    mailer: createMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
    texter: createTexter({ sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM }),
  };
}

const howText = (o) => (o.method === 'ship' ? `Shipping to ${o.addr}` : o.method === 'delivery' ? `Delivery ${o.when || ''} to ${o.addr}` : `Pickup ${o.when || ''}`).trim();
const payText = (o) => (o.payment?.status === 'paid' ? 'Paid by card' : o.payment?.method === 'later' ? 'Pay at pickup' : 'Payment pending');

function orderTable(o) {
  const rows = o.lines.map((l) => `<tr><td style="padding:6px 0">${l.qty} × ${esc(l.name)}${l.variant ? ` <span style="color:#6b6470">(${esc(l.variant)})</span>` : ''}${l.sub ? ` <span style="color:#6b6470">· ${esc(l.every)}</span>` : ''}</td><td style="padding:6px 0;text-align:right">${money(l.unit * l.qty)}</td></tr>`).join('');
  const extra = [
    o.discount ? [`Discount${o.code ? ` (${esc(o.code)})` : ''}`, `−${money(o.discount)}`] : null,
    o.fee ? [o.method === 'ship' ? 'Shipping' : 'Delivery', money(o.fee)] : null,
    o.tax ? ['Sales tax', money(o.tax)] : null,
  ].filter(Boolean).map(([a, b]) => `<tr><td style="padding:4px 0;color:#6b6470">${a}</td><td style="padding:4px 0;text-align:right;color:#6b6470">${b}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}<tr><td colspan="2" style="border-top:1px solid #e7dfe6;padding-top:4px"></td></tr><tr><td style="padding:4px 0;color:#6b6470">Subtotal</td><td style="padding:4px 0;text-align:right;color:#6b6470">${money(o.subtotal)}</td></tr>${extra}<tr><td style="padding:8px 0;font-weight:700">Total</td><td style="padding:8px 0;text-align:right;font-weight:700">${money(o.total)}</td></tr></table>`;
}
const wrap = (shop, inner) => `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#24202a"><h2 style="margin:0 0 4px;font-size:20px">${esc(shop.name)}</h2>${inner}<p style="margin-top:28px;font-size:12px;color:#8a828f">Sent for ${esc(shop.name)} by Think Web Pros.</p></div>`;
const linesText = (o) => o.lines.map((l) => `${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ''}  ${money(l.unit * l.qty)}`).join('\n');

export function receiptEmail(shop, o, siteUrl) {
  return {
    subject: `Your order #${o.no} from ${shop.name}`,
    html: wrap(shop, `<p style="font-size:16px">Thanks, ${esc(o.name.split(' ')[0])}! We got your order <b>#${o.no}</b>.</p><p style="color:#6b6470">${esc(howText(o))} · ${esc(payText(o))}</p>${orderTable(o)}${o.note ? `<p style="color:#6b6470">Your note: ${esc(o.note)}</p>` : ''}<p>Questions? Just reply to this email.${siteUrl ? ` <a href="${esc(siteUrl)}" style="color:#C2287C">Visit ${esc(shop.name)}</a>` : ''}</p>`),
    text: `Thanks for your order #${o.no} from ${shop.name}.\n${howText(o)} · ${payText(o)}\n\n${linesText(o)}\nTotal ${money(o.total)}\n\nQuestions? Just reply to this email.`,
  };
}
export function ownerEmail(shop, o, dashUrl) {
  return {
    subject: `New order #${o.no}: ${money(o.total)} from ${o.name}`,
    html: wrap(shop, `<p style="font-size:16px">New order <b>#${o.no}</b> from ${esc(o.name)}.</p><p style="color:#6b6470">${esc(howText(o))} · ${esc(payText(o))}<br>${esc(o.email)}${o.phone ? ` · ${esc(o.phone)}` : ''}</p>${orderTable(o)}${o.note ? `<p><b>Note:</b> ${esc(o.note)}</p>` : ''}<p><a href="${esc(dashUrl)}" style="display:inline-block;background:#C2287C;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open your Store panel</a></p>`),
    text: `New order #${o.no} from ${o.name} (${o.email}${o.phone ? `, ${o.phone}` : ''}).\n${howText(o)} · ${payText(o)}\n\n${linesText(o)}\nTotal ${money(o.total)}${o.note ? `\nNote: ${o.note}` : ''}\n\n${dashUrl}`,
  };
}
const STATUS_NOTE = {
  ready: (o) => (o.method === 'delivery' ? 'is out for delivery' : 'is ready for pickup'),
  shipped: () => 'has shipped',
  cancelled: () => 'was cancelled',
  done: null,
  preparing: null,
  new: null,
};
export function statusEmail(shop, o) {
  const note = STATUS_NOTE[o.status];
  if (!note) return null;
  const what = note(o);
  const track = o.status === 'shipped' && o.shipping?.trackingUrl ? `<p><a href="${esc(o.shipping.trackingUrl)}" style="color:#C2287C">Track your package</a>${o.shipping.carrier ? ` (${esc(o.shipping.carrier)} ${esc(o.shipping.tracking || '')})` : ''}</p>` : '';
  return {
    subject: `Your order #${o.no} ${what}`,
    html: wrap(shop, `<p style="font-size:16px">Hi ${esc(o.name.split(' ')[0])}, your order <b>#${o.no}</b> ${esc(what)}.</p>${o.status === 'cancelled' && o.payment?.refunded ? `<p>We refunded ${money(o.payment.refunded)} to your card. It can take 5 to 10 days to show.</p>` : ''}${track}${orderTable(o)}<p>Questions? Just reply to this email.</p>`),
    text: `Hi ${o.name.split(' ')[0]}, your order #${o.no} from ${shop.name} ${what}.${o.shipping?.trackingUrl ? `\nTrack it: ${o.shipping.trackingUrl}` : ''}`,
    sms: `${shop.name}: your order #${o.no} ${what}.${o.shipping?.trackingUrl ? ` Track: ${o.shipping.trackingUrl}` : ''}`,
  };
}

// The shop hooks (see shop.js): placed after an order is saved and paid for (or pay at pickup), status on each change.
export function orderHooks({ mailer, texter, origin }) {
  const safe = (p) => p.catch((err) => console.error(err.message));
  return {
    emails: Boolean(mailer),
    async placed(shop, o) {
      const base = origin();
      const jobs = [];
      if (mailer) {
        const r = receiptEmail(shop, o, base && `${base}/s/${shop.slug}`);
        jobs.push(safe(mailer.send({ to: o.email, replyTo: shop.email, ...r })));
        if (shop.email && shop.settings?.orderEmails !== false) jobs.push(safe(mailer.send({ to: shop.email, replyTo: o.email, ...ownerEmail(shop, o, `${base}/builder#dashboard`) })));
      }
      if (texter && shop.settings?.alertPhone) jobs.push(safe(texter.send({ to: shop.settings.alertPhone, body: `New order #${o.no}: ${money(o.total)} from ${o.name}. ${howText(o)}` })));
      await Promise.all(jobs);
    },
    async status(shop, o) {
      const m = statusEmail(shop, o);
      if (!m) return;
      const jobs = [];
      if (mailer) jobs.push(safe(mailer.send({ to: o.email, replyTo: shop.email, subject: m.subject, html: m.html, text: m.text })));
      if (texter && o.phone && o.textOk !== false) jobs.push(safe(texter.send({ to: o.phone, body: m.sms })));
      await Promise.all(jobs);
    },
  };
}
