/* Paying for an order: card and wallets through Stripe Checkout, PayPal and Venmo through PayPal's buttons, and Zelle
   by instructions. The server sets every price; this file only shows it and hands off to the provider.
   - TWP.payPicker() is the method list inside the checkout form, TWP.startPayment(id, method) takes it from there.
   - /builder?pay=<order id> opens the pay screen for an order (a priced quote, a retry, Design storage).
   - /builder?paid=<order id>&session_id=… is where Stripe sends people back.
   - TWP.mountAdmin(el) is the payments panel in Admin > Orders. */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>{const n=(Number(c)||0)/100;return '$'+n.toLocaleString('en-US',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2})};
const per=i=>i==='year'?'/year':'/month';
const X='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const TWP=window.TWP=window.TWP||{};

let methods=null;
const ready=fetch('/api/config').then(r=>r.ok?r.json():{}).catch(()=>({})).then(c=>{methods=c.payments||null;TWP.payMethods=methods;return methods});
const anyMethod=m=>!!(m&&(m.card||m.paypal||m.zelle));

async function api(path,opts={}){
 const r=await fetch(path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})},body:opts.body?JSON.stringify(opts.body):undefined});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Try again.'),{status:r.status,code:d.code});
 return d;
}

function modal(title,inner,label){
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal" role="dialog" aria-label="${esc(label||title)}"><div class="modal-h"><h2>${esc(title)}</h2><button type="button" class="iconbtn" data-closemodal aria-label="Close">${X}</button></div>${inner}</div></div>`;
 return $('#modalRoot .modal');
}

/* ---------- the method list ---------- */
const OPTIONS=[
 ['card','Card, Apple Pay or Google Pay','Also Cash App Pay, Link, bank transfer and pay over time where offered. Secure checkout by Stripe.'],
 ['paypal','PayPal or Venmo','Pay from your PayPal or Venmo account, bank or card.'],
 ['zelle','Zelle','Send it from your bank app. We start once it arrives.']
];
function available(m){return OPTIONS.filter(([k])=>k==='card'?m.card:k==='paypal'?!!m.paypal:!!m.zelle)}
TWP.payPicker=()=>{
 if(!anyMethod(methods))return `<p class="demo-note">Online payment isn't switched on yet. We'll send your order to our team and email you how to pay.</p>`;
 const opts=available(methods);
 return `<fieldset class="pay-methods"><legend>How would you like to pay?</legend>${opts.map(([k,t,d],i)=>`<label class="pay-opt"><input type="radio" name="payMethod" value="${k}" ${i?'':'checked'}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label>`).join('')}</fieldset>${methods.test?'<p class="demo-note">Test mode: no real money moves. Use card 4242 4242 4242 4242, any future date and any CVC.</p>':''}`;
};
TWP.chosenMethod=()=>{const r=document.querySelector('input[name="payMethod"]:checked');return r?r.value:null};
TWP.paymentsOn=()=>anyMethod(methods);

/* ---------- handing off to a provider ---------- */
TWP.startPayment=async(id,method)=>{
 try{
  if(method==='card'){
   modal('Opening secure checkout','<p class="muted">Taking you to Stripe to pay…</p>');
   const {url}=await api(`/api/pay/${id}/card`,{method:'POST'});
   location.href=url;return;
  }
  if(method==='paypal')return payPal(id);
  if(method==='zelle')return zelle(id);
 }catch(e){failed(id,e)}
};
function failed(id,e){
 if(e&&e.code==='paid')return modal('Already paid','<p>This order is already paid. Thank you!</p>');
 modal('Payment didn’t start',`<p>${esc(e&&e.message||'Something went wrong.')}</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-closemodal>Close</button><button type="button" class="btn pri" data-payagain="${esc(id)}">Try again</button></div>`);
}

let ppLoaded=null;
function loadPayPal(subscription){
 const key=subscription?'sub':'once';
 if(ppLoaded&&ppLoaded.key===key)return ppLoaded.p;
 document.querySelectorAll('script[data-paypal]').forEach(s=>s.remove());delete window.paypal;
 const q=new URLSearchParams({'client-id':methods.paypal.clientId,currency:'USD','enable-funding':'venmo',components:'buttons'});
 if(subscription){q.set('vault','true');q.set('intent','subscription')}
 const p=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://www.paypal.com/sdk/js?'+q;s.dataset.paypal='1';s.onload=()=>res(window.paypal);s.onerror=()=>rej(new Error('PayPal didn’t load. Check your connection and try again.'));document.head.appendChild(s)});
 ppLoaded={key,p};p.catch(()=>{ppLoaded=null});return p;
}
async function payPal(id){
 const o=await api(`/api/pay/${id}`);const p=o.payment;const sub=p.recurring>0;
 const box=modal('Pay with PayPal or Venmo',`${summary(p)}<div id="ppButtons" style="margin-top:14px;min-height:50px"><p class="muted">Loading PayPal…</p></div><p class="muted" style="font-size:12px">${sub?`This sets up your plan: ${money(p.recurring)}${per(p.interval)} after today, and you can cancel any time.`:'You’ll confirm the payment in a PayPal window.'} Venmo shows on phones where Venmo is available.</p>`);
 const paypal=await loadPayPal(sub);if(!box.isConnected)return;
 $('#ppButtons').innerHTML='';
 const done=r=>paidModal(r.number||o.number,'paid');
 const onError=e=>failed(id,e);
 const buttons=sub?{
  style:{label:'subscribe'},
  createSubscription:async(d,actions)=>{const {planId}=await api(`/api/pay/${id}/paypal`,{method:'POST'});return actions.subscription.create({plan_id:planId,custom_id:id})},
  onApprove:async d=>done(await api(`/api/pay/${id}/paypal/confirm`,{method:'POST',body:{subscriptionId:d.subscriptionID}})),onError
 }:{
  createOrder:async()=>(await api(`/api/pay/${id}/paypal`,{method:'POST'})).paypalOrderId,
  onApprove:async d=>done(await api(`/api/pay/${id}/paypal/confirm`,{method:'POST',body:{paypalOrderId:d.orderID}})),onError
 };
 // one button per funding source, so Venmo gets its own button where it's available
 const sources=[paypal.FUNDING.PAYPAL,paypal.FUNDING.VENMO,paypal.FUNDING.PAYLATER,paypal.FUNDING.CARD].filter(Boolean);
 for(const fundingSource of sources){const b=paypal.Buttons({...buttons,fundingSource});if(b.isEligible()){const div=document.createElement('div');div.style.marginBottom='8px';$('#ppButtons').appendChild(div);b.render(div)}}
}
async function zelle(id){
 const z=await api(`/api/pay/${id}/zelle`,{method:'POST'});
 modal('Pay with Zelle',`<p>Open your bank’s app, choose Zelle, and send:</p>
 <div class="sum-tot" style="margin:12px 0"><div class="big"><span>Amount</span><b class="num">${money(z.amount)}</b></div>
 <div class="sum-line"><span>To</span><b>${esc(z.to)}</b></div><div class="sum-line"><span>Name shown</span><span>${esc(z.name)}</span></div><div class="sum-line"><span>Memo</span><b>${esc(z.memo)}</b></div></div>
 <p class="muted">Put the order number in the memo so we can match it. We’ll email you when it arrives and start on your site.${z.recurring?` Zelle can’t repeat on its own, so after today we’ll email you each ${z.interval} to send ${money(z.recurring)}, or you can switch to card or PayPal.`:''}</p>
 <div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-copy="${esc(z.to)}">Copy Zelle address</button><button type="button" class="btn pri" data-closemodal>Done</button></div>`);
}

function summary(p){
 return `<div class="sum-lines">${p.lines.map(l=>`<div class="sum-line"><span>${esc(l.name)}</span><span class="num">${money(l.amount)}${l.recurring?per(p.interval):' once'}</span></div>`).join('')}</div>
 <div class="sum-tot"><div class="big"><span>Due today</span><b class="num">${money(p.dueToday)}</b></div>${p.recurring?`<div class="sum-line"><span>Then</span><span class="num">${money(p.recurring)}${per(p.interval)}</span></div>`:''}</div>`;
}
function paidModal(number,status){
 const processing=status==='processing';
 modal(processing?'Payment on its way':'Payment received',`<p>${processing?`Thanks! Bank payments take a few business days to clear. We’ll email you when order ${esc(number)} is paid.`:`Thank you! Order ${esc(number)} is paid. We’ll email you a receipt and your launch date.`}</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn pri" data-closemodal>Keep designing</button></div>`);
}

/* ---------- pay screen for an existing order ---------- */
async function openPay(id){
 await ready;
 let o;try{o=await api(`/api/pay/${id}`)}catch(e){return modal('Order not found','<p>We couldn’t find that order. Check the link in your email, or contact us.</p>')}
 const p=o.payment;
 if(!p)return modal(`Order ${o.number}`,'<p>We’re still pricing this one. We’ll email you a link to pay as soon as your quote is ready.</p>');
 if(p.status==='paid')return paidModal(o.number,'paid');
 if(!anyMethod(o.methods))return modal(`Order ${o.number}`,`${summary(p)}<p class="muted" style="margin-top:10px">Online payment isn’t switched on yet. We’ll email you how to pay.</p>`);
 methods=o.methods;
 modal(`Pay for order ${o.number}`,`<p class="muted" style="margin-bottom:10px">${esc(o.business)}</p>${summary(p)}<form id="payForm" style="margin-top:14px">${TWP.payPicker()}<div class="row" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-closemodal>Not now</button><button class="btn pri" type="submit">Continue</button></div></form>`);
 $('#payForm').addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();TWP.startPayment(id,TWP.chosenMethod())});
}
async function returned(id,sessionId){
 modal('Checking your payment','<p class="muted">One moment…</p>');
 try{const r=await api(`/api/pay/${id}/card/result?session_id=${encodeURIComponent(sessionId)}`);
  if(r.status==='paid'||r.status==='processing')return paidModal(r.number||'',r.status);
  openPay(id);
 }catch(e){modal('Payment',`<p>We couldn’t confirm the payment yet. If you were charged, you’ll get an email receipt from us shortly.</p>`)}
}

document.addEventListener('click',e=>{
 const again=e.target.closest('[data-payagain]');if(again){openPay(again.dataset.payagain);return}
 const copy=e.target.closest('[data-copy]');if(copy){navigator.clipboard?.writeText(copy.dataset.copy).then(()=>{copy.textContent='Copied'}).catch(()=>{})}
});

const qs=new URLSearchParams(location.search);
const idOk=v=>/^[0-9a-f-]{36}$/.test(v||'');
const pay=qs.get('pay'),paid=qs.get('paid'),sid=qs.get('session_id');
if(idOk(pay)||idOk(paid)){
 TWP.payScreen=true;
 history.replaceState(null,'',location.pathname+location.hash);
 // let the studio draw first so the modal lands on top
 setTimeout(()=>{if(idOk(paid)&&sid)returned(paid,sid);else openPay(pay||paid)},60);
}

/* ---------- Admin: real orders from the server ---------- */
const TOKEN='twp-admin-token';
const getTok=()=>{try{return sessionStorage.getItem(TOKEN)||''}catch(e){return''}};
const setTok=v=>{try{v?sessionStorage.setItem(TOKEN,v):sessionStorage.removeItem(TOKEN)}catch(e){}};
const PAY_LABEL={paid:['Paid','ok'],unpaid:['Not paid','gold'],pending:['Checkout opened','gold'],processing:['Bank payment clearing','acc'],awaiting_zelle:['Waiting for Zelle','gold'],failed:['Failed','bad'],past_due:['Past due','bad'],cancelled:['Cancelled','']};
const METHOD={card:'Card / wallet',paypal:'PayPal / Venmo',zelle:'Zelle'};
let adminRows=null,adminErr='';

TWP.mountAdmin=el=>{if(!el)return;el.innerHTML=adminHtml();if(getTok()&&!adminRows&&!adminErr)loadAdmin(el)};
function adminHtml(){
 const head=`<div class="between" style="margin-bottom:10px"><div><h3>Payments</h3><p class="muted">Real orders from your website, with what’s been paid. Mark Zelle payments paid here once they arrive, and price custom quotes to send a pay link.</p></div>${getTok()?'<div class="row"><button type="button" class="btn sm" data-srvload>Refresh</button><button type="button" class="btn sm" data-srvout>Lock</button></div>':''}</div>`;
 if(!getTok())return `<div class="card" style="margin-bottom:16px">${head}<form id="srvTokForm" class="row" style="gap:8px;flex-wrap:wrap"><input class="inp sm" type="password" id="srvTok" placeholder="Admin password (ADMIN_TOKEN)" autocomplete="current-password" style="max-width:300px" aria-label="Admin password"><button class="btn pri sm" type="submit">Show orders</button></form>${adminErr?`<p class="limit-note" style="margin-top:8px">${esc(adminErr)}</p>`:''}</div>`;
 if(!adminRows)return `<div class="card" style="margin-bottom:16px">${head}<p class="muted">${adminErr?esc(adminErr):'Loading…'}</p></div>`;
 if(!adminRows.length)return `<div class="card" style="margin-bottom:16px">${head}<p class="muted">No orders yet.</p></div>`;
 return `<div class="card" style="margin-bottom:16px">${head}<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Business</th><th>What</th><th class="r">Due today</th><th class="r">Then</th><th>Paid by</th><th>Payment</th><th></th></tr></thead><tbody>${adminRows.map(r=>{const p=r.payment,o=r.order||{};const [lab,cls]=p?PAY_LABEL[p.status]||[p.status,'']:['Needs a price','gold'];const what=r.kind==='quote'?'Custom quote':r.kind==='storage'?'Design storage':((o.plan||'').charAt(0).toUpperCase()+(o.plan||'').slice(1))+(o.annual?' · yearly':'');
  const act=!p?`<form class="row" data-srvquote="${r.id}" style="gap:6px;flex-wrap:wrap"><input class="inp sm" type="number" min="0" name="setup" placeholder="Design fee $" style="width:110px" aria-label="Design fee"><input class="inp sm" type="number" min="0" name="monthly" placeholder="Monthly $" style="width:100px" aria-label="Monthly"><button class="btn sm pri" type="submit">Set price</button></form>`
   :p.status==='paid'?'':`<div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" class="btn sm" data-copy="${esc(location.origin+'/builder?pay='+r.id)}">Copy pay link</button><button type="button" class="btn sm pri" data-srvpaid="${r.id}">Mark paid</button></div>`;
  return `<tr><td><b>${esc(r.number||r.clientOrderId)}</b></td><td>${new Date(r.receivedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td><td>${esc(o.business)}<br><span class="muted">${esc(o.email)}</span></td><td>${esc(what)}</td><td class="r">${p?money(p.dueToday):'Quote'}</td><td class="r">${p&&p.recurring?money(p.recurring)+per(p.interval):'None'}</td><td>${esc(p&&METHOD[p.method]||'')}</td><td><span class="badge ${cls}">${esc(lab)}</span></td><td>${act}</td></tr>`}).join('')}</tbody></table></div></div>`;
}
async function adminCall(path,opts={}){return api(path,{...opts,headers:{Authorization:'Bearer '+getTok()}})}
async function loadAdmin(el){
 adminErr='';
 try{adminRows=await adminCall('/api/orders')}catch(e){adminRows=null;if(e.status===401){setTok('');adminErr='That password didn’t work. It’s the ADMIN_TOKEN set in Vercel.'}else adminErr=e.message}
 el=el&&el.isConnected?el:$('#srvOrders');if(el)el.innerHTML=adminHtml();
}
document.addEventListener('submit',e=>{
 const f=e.target;
 if(f.id==='srvTokForm'){e.preventDefault();e.stopPropagation();setTok($('#srvTok').value.trim());adminRows=null;loadAdmin($('#srvOrders'));return}
 if(f.dataset.srvquote){e.preventDefault();e.stopPropagation();const fd=new FormData(f);
  adminCall(`/api/orders/${f.dataset.srvquote}`,{method:'PATCH',body:{quote:{setup:+fd.get('setup')||0,monthly:+fd.get('monthly')||0}}})
   .then(r=>{navigator.clipboard?.writeText(r.payLink).catch(()=>{});alert('Price set. The pay link is copied, so you can paste it into an email to the customer:\n\n'+r.payLink);loadAdmin($('#srvOrders'))})
   .catch(err=>alert(err.message))}
},true);
document.addEventListener('click',e=>{
 if(e.target.closest('[data-srvload]')){loadAdmin($('#srvOrders'));return}
 if(e.target.closest('[data-srvout]')){setTok('');adminRows=null;TWP.mountAdmin($('#srvOrders'));return}
 const b=e.target.closest('[data-srvpaid]');
 if(b&&confirm('Mark this order paid? Do this once the money has arrived.'))adminCall(`/api/orders/${b.dataset.srvpaid}`,{method:'PATCH',body:{paymentStatus:'paid'}}).then(()=>loadAdmin($('#srvOrders'))).catch(err=>alert(err.message));
});
})();
