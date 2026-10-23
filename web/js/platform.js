/* Connects the studio to the Think Web Pros server.
   - window.claude.use('sample') is the interface the AI logo maker already calls; here it is backed by POST /api/ai/sample,
     so the API key stays on the server. If the server has no key, use() rejects and the studio falls back to quick ideas.
   - TWP.submitOrder() sends a placed order (plus the design it was placed for) to POST /api/orders.
   - TWP.fetch() is fetch() that passes the server's bot check: when the server answers 403 'challenge', it runs
     Cloudflare Turnstile (usually without the visitor seeing anything) and sends the request again with the token.
   - Every form in a popup gets a hidden 'company_url' field. People never see it; bots fill it in, and the server
     quietly drops orders that have it.
   - TWP.site is the shop's slug when this page is a published shop site (/s/<slug>).
   Paying for an order lives in payments.js. */
(()=>{
'use strict';
let cfg=null;
const config=()=>cfg||(cfg=fetch('/api/config').then(r=>r.ok?r.json():{}).catch(()=>({})));

function apiError(code,message){const e=new Error(message||code);e.code=code;return e}

/* bot check */
let tsLoad=null;
function turnstile(){
 return tsLoad||(tsLoad=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=()=>res(window.turnstile);s.onerror=()=>{tsLoad=null;rej(apiError('challenge_unavailable','The security check didn’t load. Check your connection and try again.'))};document.head.appendChild(s)}));
}
async function humanToken(siteKey){
 const ts=await turnstile();
 const box=document.createElement('div');box.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647';document.body.appendChild(box);
 try{return await new Promise((res,rej)=>{ts.render(box,{sitekey:siteKey,appearance:'interaction-only',callback:res,'error-callback':()=>rej(apiError('challenge_failed','The security check didn’t pass. Please try again.')),'timeout-callback':()=>rej(apiError('challenge_failed','The security check timed out. Please try again.'))})})}
 finally{setTimeout(()=>box.remove(),0)}
}
async function guardedFetch(url,opts={}){
 const r=await fetch(url,opts);
 if(r.status!==403)return r;
 const d=await r.clone().json().catch(()=>({}));
 if(d.code!=='challenge'||!d.siteKey)return r;
 const token=await humanToken(d.siteKey);
 return fetch(url,{...opts,headers:{...(opts.headers||{}),'X-Turnstile-Token':token}});
}

/* hidden field for bots */
const HP='company_url';
function addHoneypot(form){if(form.querySelector(`input[name="${HP}"]`))return;const l=document.createElement('label');l.setAttribute('aria-hidden','true');l.style.cssText='position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';l.innerHTML=`Leave this empty <input type="text" name="${HP}" tabindex="-1" autocomplete="off">`;form.appendChild(l)}
new MutationObserver(()=>document.querySelectorAll('#modalRoot form').forEach(addHoneypot)).observe(document.documentElement,{childList:true,subtree:true});
const honeypot=()=>[...document.querySelectorAll(`input[name="${HP}"]`)].map(i=>i.value).join('').trim();

async function call(body,signal){
 let r;
 try{r=await guardedFetch('/api/ai/sample',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})}
 catch(e){if(e&&e.name==='AbortError')throw apiError('cancelled');throw apiError('network',e&&e.message)}
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw apiError(d.code||(r.status===429?'rate_limited':'server_error'),d.error);
 return d;
}

function makeSample(){
 const sample=(prompt,opts={})=>call({prompt},opts.signal).then(d=>({text:d.text||''}));
 sample.json=(prompt,opts={})=>call({prompt,json:true},opts.signal).then(d=>{if(!d.json)throw apiError('bad_json');return d.json});
 return sample;
}

if(!window.claude){
 window.claude={use(name){
  if(name!=='sample')return Promise.reject(apiError('not_declared'));
  return config().then(c=>{if(!c.ai)throw apiError('not_granted');return makeSample()});
 }};
}

const send=body=>{const hp=honeypot();return guardedFetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hp?{...body,order:{...body.order,hp}}:body)})};
window.TWP=Object.assign(window.TWP||{},{
 fetch:guardedFetch,
 // a published shop's address, /s/<slug>: the studio opens that shop's site for shoppers instead of the editor
 site:(location.pathname.match(/^\/s\/([a-z0-9-]{1,60})\/?$/)||[])[1]||null,
 // Resolves to { id, number, payment } or null. A design too big for the host (Vercel takes 4.5 MB) is dropped
 // so the order and payment still go through; our team asks for the photos afterwards.
 submitOrder(order,design){
  return send({order,design}).then(r=>r.status===413?send({order:{...order,designTooLarge:true},design:null}):r)
   .then(r=>r.ok?r.json():null).catch(()=>null);
 }
});
})();
