/* Connects the studio to the Think Web Pros server.
   - window.claude.use('sample') is the interface the AI logo maker already calls; here it is backed by POST /api/ai/sample,
     so the API key stays on the server. If the server has no key, use() rejects and the studio falls back to quick ideas.
   - TWP.submitOrder() sends a placed order (plus the design it was placed for) to POST /api/orders.
   Paying for an order lives in payments.js. */
(()=>{
'use strict';
let cfg=null;
const config=()=>cfg||(cfg=fetch('/api/config').then(r=>r.ok?r.json():{}).catch(()=>({})));

function apiError(code,message){const e=new Error(message||code);e.code=code;return e}

async function call(body,signal){
 let r;
 try{r=await fetch('/api/ai/sample',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})}
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

const send=body=>fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
window.TWP=Object.assign(window.TWP||{},{
 // Resolves to { id, number, payment } or null. A design too big for the host (Vercel takes 4.5 MB) is dropped
 // so the order and payment still go through; our team asks for the photos afterwards.
 submitOrder(order,design){
  return send({order,design}).then(r=>r.status===413?send({order:{...order,designTooLarge:true},design:null}):r)
   .then(r=>r.ok?r.json():null).catch(()=>null);
 }
});
})();
