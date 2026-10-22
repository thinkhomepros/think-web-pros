(()=>{
'use strict';
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const clone=o=>JSON.parse(JSON.stringify(o));
const money=(n,dec)=>{n=Number(n)||0;const d=dec!=null?dec:(Math.round(n*100)%100?2:0);return (n<0?'-$':'$')+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})};
const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
function setPath(o,p,v){const ks=p.split('.');const last=ks.pop();const t=ks.reduce((a,k)=>a[k],o);if(t)t[last]=v;}
const isHex=h=>/^#[0-9a-f]{6}$/i.test(h||'');
function lum(h){const n=parseInt(h.slice(1),16);const f=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4};return .2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255)}
function hexMix(a,b,t){const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);const m=sh=>Math.round(((x>>sh)&255)*(1-t)+((y>>sh)&255)*t);return '#'+[16,8,0].map(sh=>m(sh).toString(16).padStart(2,'0')).join('').toUpperCase()}
function darkOf(c){const ink='#0C0D12';const lift=h=>lum(h)<.18?hexMix(h,'#FFFFFF',.5):h;return{p:lift(c.p),a:lift(c.a),bg:hexMix(ink,c.p,.14),sf:hexMix(hexMix(ink,c.p,.14),'#FFFFFF',.07),tx:hexMix(c.p,'#F4F4F8',.92)}}
function lightOf(c){const drop=h=>lum(h)>.45?hexMix(h,'#000000',.38):h;return{p:drop(c.p),a:drop(c.a),bg:'#FFFFFF',sf:hexMix(c.p,'#FFFFFF',.9),tx:hexMix(c.bg,'#000000',.15)}}
function themePal(k){const c=(THEMES[k]||THEMES.harbor).colors;return lum(c.bg)<.25?{light:lightOf(c),dark:{...c}}:{light:{...c},dark:darkOf(c)}}
const onColor=h=>isHex(h)&&lum(h)>0.42?'#15171B':'#FFFFFF';
const ago=t=>{const m=Math.round((Date.now()-t)/60000);if(m<1)return'just now';if(m<60)return m+' min ago';const h=Math.round(m/60);if(h<24)return h+' hr ago';const d=Math.round(h/24);return d+(d===1?' day ago':' days ago')};
const fmtDate=t=>new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmtTime=t=>{if(!t)return'';let[h,m]=t.split(':').map(Number);const ap=h>=12?'pm':'am';h=h%12||12;return h+(m?':'+String(m).padStart(2,'0'):'')+ap};
const initials=n=>String(n||'').replace(/&/g,' ').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const slug=n=>String(n||'site').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'')||'yoursite';

const P={
 grip:'<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
 save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
 folder:'<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
 restart:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
 filePlus:'<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
 video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 eyeOff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.7-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
 up:'<path d="M12 19V5M5 12l7-7 7 7"/>', down:'<path d="M12 5v14M19 12l-7 7-7-7"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 check:'<path d="M5 12l5 5L20 7"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
 home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', grid4:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>', image:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>', help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5"/>', bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 desktop:'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
 tablet:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>',
 phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/>', pin:'<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>', camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 l:'<path d="M15 6l-6 6 6 6"/>', r:'<path d="M9 6l6 6-6 6"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
 phoneCall:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
 card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
 reader:'<rect x="6" y="2" width="12" height="20" rx="3"/><rect x="9" y="5" width="6" height="5" rx="1"/><path d="M9 14h6M9 17h6"/>',
 terminal:'<rect x="3" y="3" width="18" height="12" rx="2"/><path d="M7 21h10l-1-6H8z"/>',
 kit:'<rect x="4" y="3" width="13" height="10" rx="1.5"/><path d="M10.5 13v3M3 21h18v-5H3z"/>',
 kds:'<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M6 8h4M6 11h4M14 8h4M14 11h4M9 21h6M12 17v4"/>',
 star:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'
};
const ic=(n,s=16)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
const SOC={instagram:['Instagram','#E1306C','instagram.com/'],facebook:['Facebook','#1877F2','facebook.com/'],tiktok:['TikTok','#111111','tiktok.com/'],youtube:['YouTube','#FF0000','youtube.com/'],x:['X','#111111','x.com/'],linkedin:['LinkedIn','#0A66C2','linkedin.com/in/'],pinterest:['Pinterest','#E60023','pinterest.com/'],yelp:['Yelp','#D32323','yelp.com/biz/'],google:['Google reviews','#4285F4','g.page/'],nextdoor:['Nextdoor','#8ED500','nextdoor.com/pages/']};
const SOC_NAMES=Object.fromEntries(Object.entries(SOC).map(([k,v])=>[k,v[0]]));
const SS_IND={dots:'Dots',pills:'Pills',bars:'Progress bars',thumbs:'Thumbnails',count:'Counter (2 / 5)',none:'None'};
const ssDur=d=>Math.max(2,Math.min(15,+d.interval||4));
const icFill=(n,s=16)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P[n]}</svg>`;

/* ---------- catalog ---------- */
const THEMES={
 harbor:{name:'Harbor',colors:{p:'#1D3557',a:'#E76F51',bg:'#FFFFFF',sf:'#F1F4F8',tx:'#1B2430'},font:'fraunces',radius:10,btn:'rounded'},
 meadow:{name:'Meadow',colors:{p:'#2F6B3B',a:'#E2B33C',bg:'#FBFBF6',sf:'#EEF2E4',tx:'#1C2A1E'},font:'lora',radius:16,btn:'pill'},
 studio:{name:'Studio',colors:{p:'#111111',a:'#FF5A36',bg:'#FFFFFF',sf:'#F2F2F2',tx:'#111111'},font:'archivo',radius:0,btn:'square'},
 blush:{name:'Blush',colors:{p:'#9D4E6B',a:'#E9A594',bg:'#FFF9F8',sf:'#FBEDEB',tx:'#3B2730'},font:'playfair',radius:22,btn:'pill'},
 midnight:{name:'Midnight',colors:{p:'#7DD3FC',a:'#FBBF24',bg:'#0F172A',sf:'#1E293B',tx:'#E2E8F0'},font:'sora',radius:14,btn:'rounded'},
 workshop:{name:'Workshop',colors:{p:'#B45309',a:'#1E3A8A',bg:'#FFFDF8',sf:'#F5EEE1',tx:'#292524'},font:'bitter',radius:6,btn:'rounded'},
 paper:{name:'Newsprint',colors:{p:'#141414',a:'#D62828',bg:'#F7F3EC',sf:'#EDE6D9',tx:'#141414'},font:'dmserif',radius:0,btn:'square'},
 loud:{name:'Loud',colors:{p:'#111111',a:'#FFE14D',bg:'#FFFFFF',sf:'#FFE14D',tx:'#111111'},font:'grotesk',radius:0,btn:'square'},
 luxe:{name:'Linen',colors:{p:'#2B2622',a:'#B08D5B',bg:'#FBF8F3',sf:'#F1EADF',tx:'#2B2622'},font:'cormorant',radius:0,btn:'square'},
 candy:{name:'Candy',colors:{p:'#6C4CF1',a:'#FF7AA8',bg:'#FFFBF2',sf:'#FFEFD2',tx:'#2A2350'},font:'fredoka',radius:28,btn:'pill'},
 neon:{name:'Neon',colors:{p:'#8B5CF6',a:'#22D3EE',bg:'#0A0A14',sf:'#16162A',tx:'#ECECF7'},font:'sora',radius:18,btn:'pill'},
 folio:{name:'Gallery white',colors:{p:'#1F1F1F',a:'#FF4D2E',bg:'#FFFFFF',sf:'#F3F3F1',tx:'#1F1F1F'},font:'syne',radius:2,btn:'square'},
 diner:{name:'Diner',colors:{p:'#C1272D',a:'#1F8A8A',bg:'#FFF6E5',sf:'#FBE7C2',tx:'#2B1B12'},font:'slab',radius:10,btn:'rounded'}
};
const FONTS={
 fraunces:{name:'Fraunces + Work Sans',h:"'Fraunces', Georgia, serif",b:"'Work Sans', system-ui, sans-serif"},
 lora:{name:'Lora + Nunito Sans',h:"'Lora', Georgia, serif",b:"'Nunito Sans', system-ui, sans-serif"},
 archivo:{name:'Archivo Black + Archivo',h:"'Archivo Black', Impact, sans-serif",b:"'Archivo', system-ui, sans-serif"},
 playfair:{name:'Playfair Display + Karla',h:"'Playfair Display', Georgia, serif",b:"'Karla', system-ui, sans-serif"},
 sora:{name:'Sora + DM Sans',h:"'Sora', system-ui, sans-serif",b:"'DM Sans', system-ui, sans-serif"},
 bitter:{name:'Bitter + Source Sans 3',h:"'Bitter', Georgia, serif",b:"'Source Sans 3', system-ui, sans-serif"},
 dmserif:{name:'DM Serif Display + Inter',h:"'DM Serif Display', Georgia, serif",b:"'Inter', system-ui, sans-serif"},
 grotesk:{name:'Space Grotesk + Space Mono',h:"'Space Grotesk', system-ui, sans-serif",b:"'Space Grotesk', system-ui, sans-serif"},
 cormorant:{name:'Cormorant + Karla',h:"'Cormorant Garamond', Georgia, serif",b:"'Karla', system-ui, sans-serif"},
 fredoka:{name:'Fredoka + Nunito Sans',h:"'Fredoka', system-ui, sans-serif",b:"'Nunito Sans', system-ui, sans-serif"},
 syne:{name:'Syne + DM Sans',h:"'Syne', system-ui, sans-serif",b:"'DM Sans', system-ui, sans-serif"},
 slab:{name:'Alfa Slab + Source Sans 3',h:"'Alfa Slab One', Rockwell, serif",b:"'Source Sans 3', system-ui, sans-serif"}
};
const CATALOG={
 hero:{name:'Hero banner',desc:'Headline, photo and buttons',variants:{split:'Split',centered:'Centered',overlay:'Photo overlay',poster:'Big headline',arch:'Arched photo',bubble:'Blob photo',bento:'Tiles',badge:'Emblem',marquee:'Ticker'}},
 slideshow:{name:'Image rotator',desc:'Slideshow that rotates on its own',variants:{framed:'Framed',full:'Full width',split:'Captions on photo'}},
 about:{name:'About us',desc:'Your story with a photo',variants:{left:'Photo left',right:'Photo right',stacked:'Stacked'}},
 services:{name:'Services',desc:'What you offer, with prices',variants:{grid:'Grid',cards:'Cards',menu:'Price list'}},
 testimonials:{name:'Testimonials',desc:'Customer reviews',variants:{cards:'Cards',spotlight:'Spotlight',carousel:'Scrolling'}},
 gallery:{name:'Photo gallery',desc:'Grid of your photos',variants:{mosaic:'Mosaic',grid:'Grid'}},
 faq:{name:'FAQ',desc:'Common questions',variants:{list:'List',two:'Two columns'}},
 cta:{name:'Call to action',desc:'Banner that drives one action',variants:{band:'Color band',card:'Card'}},
 social:{name:'Social media',desc:'Your social pages and a photo feed',variants:{icons:'Icon row',cards:'Profile cards',feed:'Photo feed'}},
 map:{name:'Map & hours',desc:'Location, directions, hours',variants:{side:'Side by side',wide:'Wide map'}},
 contact:{name:'Contact us',desc:'Form that lands in your inbox',variants:{split:'Split',centered:'Centered'}},
 booking:{name:'Online booking',desc:'Customers pick a time',variants:{standard:'Standard'}},
 shop:{name:'Online store',desc:'Sell products, synced with POS',variants:{grid:'Grid'}}
};
const TH={
 social:'<rect x="3" y="5" width="38" height="22" rx="3" opacity=".25"/><circle cx="12" cy="16" r="4"/><circle cx="22" cy="16" r="4" opacity=".7"/><circle cx="32" cy="16" r="4" opacity=".45"/>',
 hero:'<rect x="3" y="7" width="16" height="3" rx="1"/><rect x="3" y="13" width="12" height="2" rx="1" opacity=".5"/><rect x="3" y="19" width="8" height="4" rx="2"/><rect x="23" y="4" width="18" height="24" rx="2" opacity=".35"/>',
 slideshow:'<rect x="3" y="4" width="38" height="20" rx="2" opacity=".35"/><path d="M8 14l3-3v6zM36 14l-3-3v6z"/><circle cx="18" cy="28" r="1.5"/><circle cx="22" cy="28" r="1.5" opacity=".4"/><circle cx="26" cy="28" r="1.5" opacity=".4"/>',
 about:'<rect x="3" y="5" width="16" height="22" rx="2" opacity=".35"/><rect x="23" y="7" width="16" height="3" rx="1"/><rect x="23" y="13" width="18" height="2" rx="1" opacity=".5"/><rect x="23" y="17" width="18" height="2" rx="1" opacity=".5"/><rect x="23" y="21" width="12" height="2" rx="1" opacity=".5"/>',
 services:'<rect x="3" y="6" width="11" height="20" rx="2" opacity=".35"/><rect x="16.5" y="6" width="11" height="20" rx="2" opacity=".35"/><rect x="30" y="6" width="11" height="20" rx="2" opacity=".35"/>',
 testimonials:'<path d="M5 8h6v6l-3 5H6l2-5H5zM13 8h6v6l-3 5h-2l2-5h-3z"/><rect x="24" y="9" width="17" height="2" rx="1" opacity=".5"/><rect x="24" y="14" width="13" height="2" rx="1" opacity=".5"/><rect x="24" y="20" width="8" height="2" rx="1"/>',
 gallery:'<rect x="3" y="4" width="18" height="24" rx="2" opacity=".35"/><rect x="23" y="4" width="8" height="11" rx="1.5" opacity=".35"/><rect x="33" y="4" width="8" height="11" rx="1.5" opacity=".35"/><rect x="23" y="17" width="8" height="11" rx="1.5" opacity=".35"/><rect x="33" y="17" width="8" height="11" rx="1.5" opacity=".35"/>',
 faq:'<rect x="3" y="6" width="38" height="2" rx="1" opacity=".5"/><rect x="3" y="15" width="38" height="2" rx="1" opacity=".5"/><rect x="3" y="24" width="38" height="2" rx="1" opacity=".5"/><path d="M37 3v6M34 6h6"/>',
 cta:'<rect x="3" y="6" width="38" height="20" rx="3" opacity=".35"/><rect x="7" y="12" width="16" height="3" rx="1"/><rect x="28" y="12" width="10" height="7" rx="3.5"/>',
 map:'<rect x="3" y="4" width="38" height="24" rx="2" opacity=".2"/><path d="M3 18l14-8 10 10 14-9" stroke="currentColor" fill="none" stroke-width="2" opacity=".5"/><path d="M27 6c-3 0-5 2-5 5 0 4 5 9 5 9s5-5 5-9c0-3-2-5-5-5z"/>',
 contact:'<rect x="3" y="5" width="22" height="4" rx="1" opacity=".35"/><rect x="3" y="12" width="22" height="4" rx="1" opacity=".35"/><rect x="3" y="19" width="22" height="8" rx="1" opacity=".35"/><rect x="29" y="6" width="12" height="2" rx="1"/><rect x="29" y="12" width="10" height="2" rx="1" opacity=".5"/>',
 booking:'<rect x="5" y="5" width="34" height="23" rx="2" opacity=".35"/><rect x="5" y="5" width="34" height="5" rx="2"/><rect x="10" y="14" width="5" height="4" rx="1"/><rect x="19" y="14" width="5" height="4" rx="1" opacity=".5"/><rect x="28" y="14" width="5" height="4" rx="1" opacity=".5"/><rect x="10" y="21" width="5" height="4" rx="1" opacity=".5"/>',
 shop:'<path d="M10 11h24l-2 16H12z" opacity=".35"/><path d="M16 11a6 6 0 0 1 12 0" stroke="currentColor" fill="none" stroke-width="2"/>'
};
const thumb=t=>`<svg class="th" width="44" height="32" viewBox="0 0 44 32" fill="currentColor" aria-hidden="true">${TH[t]}</svg>`;

const DEFAULTS={
 hero:{eyebrow:'Wood-fired bakery · Portland, Maine',heading:'Bread worth getting up early for',sub:'Naturally leavened loaves, flaky croissants and custom cakes, baked every morning since 2014 on the Portland waterfront.',cta:'Order for pickup',cta2:'See the menu',image:null},
 slideshow:{heading:'Fresh from the oven',interval:4,ind:'dots',slides:[{image:null,caption:'Country sourdough, out at 7am'},{image:null,caption:'Seasonal fruit galettes'},{image:null,caption:'Custom celebration cakes'}]},
 about:{eyebrow:'Our story',heading:'A neighborhood bakery with a wood-fired heart',body:'Harbor & Pine started with one oven and a 40-year-old starter from our grandmother’s kitchen. Today our team of nine bakes everything from scratch, with flour milled in Maine and butter from farms within 60 miles.',image:null,stats:[{value:'2014',label:'Baking since'},{value:'38',label:'Loaves per bake'},{value:'4.9',label:'Google rating'}]},
 services:{heading:'What we bake',intro:'Order ahead for pickup or stop by the counter. Catering boxes need 48 hours notice.',items:[{title:'Country sourdough',desc:'Our everyday loaf, 36-hour ferment with a crackling crust.',price:'$9'},{title:'Morning pastries',desc:'Croissants, cardamom buns and seasonal danishes.',price:'From $4.50'},{title:'Celebration cakes',desc:'Layer cakes for birthdays and weddings, serving 12 to 80.',price:'From $65'},{title:'Office catering',desc:'Pastry and sandwich boxes delivered within 10 miles.',price:'From $120'}]},
 testimonials:{heading:'What the neighbors say',items:[{quote:'The cardamom buns are the reason I walk the long way to work. Worth every step.',name:'Jordan M.',role:'Regular since 2019',stars:5},{quote:'They made our wedding cake on two weeks notice and it was the first thing guests asked about.',name:'Alicia & Ben R.',role:'Wedding, June 2026',stars:5},{quote:'Best sourdough in Maine, and the staff remembers your order.',name:'Sam K.',role:'Google review',stars:5}]},
 gallery:{heading:'Inside the bakery',images:[null,null,null,null,null,null]},
 faq:{heading:'Good to know',items:[{q:'Do you have gluten-free options?',a:'Yes. We bake a gluten-free loaf and two pastries every Saturday in a dedicated batch.'},{q:'How far ahead should I order a cake?',a:'Two weeks for custom designs, 48 hours for our standard flavors.'},{q:'Is there parking?',a:'Metered street parking on Commercial St and a public garage on Fore St, two minutes away.'}]},
 social:{heading:'Follow along',sub:'New bakes, behind the scenes and weekly specials.',tone:'brand',links:[{net:'instagram',handle:'@yourbusiness'},{net:'facebook',handle:'yourbusiness'},{net:'tiktok',handle:'@yourbusiness'}],posts:[{image:null},{image:null},{image:null},{image:null},{image:null},{image:null}]},
 cta:{heading:'Planning a party or office breakfast?',sub:'Tell us the date and headcount and we will build a box that fits.',button:'Start a catering order'},
 map:{heading:'Visit the bakery',address:'214 Commercial St\nPortland, ME 04101',phone:'(207) 555-0148'},
 contact:{heading:'Get in touch',sub:'Questions, cake orders or wholesale inquiries. We reply within one business day.',phone:'(207) 555-0148',email:'hello@harborandpine.com',address:'214 Commercial St, Portland, ME 04101',button:'Send message'},
 booking:{heading:'Book a cake consultation',sub:'Meet our cake designer to taste flavors and sketch your design.',services:[{title:'Wedding cake tasting',duration:'45 min'},{title:'Birthday cake consult',duration:'20 min'}]},
 shop:{heading:'Order online for pickup',items:[{name:'Country sourdough',price:'$9.00',image:null,stock:14},{name:'Half-dozen croissants',price:'$21.00',image:null,stock:6},{name:'Maine blueberry pie',price:'$32.00',image:null,stock:3},{name:'Gift card',price:'$25.00',image:null,stock:99}]}
};
const FIELDS={
 social:[['heading','Heading','text'],['sub','Supporting text','text'],['tone','Icon colors','select',{brand:'Each network’s own colors',site:'Match my site'}],['links','Social pages','list',[['net','Network','select',SOC_NAMES],['handle','Your name or link','text']]],['posts','Feed photos','list',[['image','Photo','image']]]],
 hero:[['eyebrow','Small line above headline','text'],['heading','Headline','text'],['sub','Supporting text','textarea'],['cta','Main button','text'],['cta2','Second button','text'],['image','Photo','image']],
 slideshow:[['heading','Heading (optional)','text'],['interval','Seconds per slide','number'],['ind','Slide indicator','select',SS_IND],['slides','Slides','list',[['image','Photo','image'],['caption','Caption','text']]]],
 about:[['eyebrow','Small label','text'],['heading','Heading','text'],['body','Your story','textarea'],['image','Photo','image'],['stats','Highlights','list',[['value','Number','text'],['label','Label','text']]]],
 services:[['heading','Heading','text'],['intro','Intro','textarea'],['items','Services','list',[['title','Name','text'],['desc','Description','textarea'],['price','Price','text']]]],
 testimonials:[['heading','Heading','text'],['items','Reviews','list',[['quote','Quote','textarea'],['name','Name','text'],['role','Detail','text'],['stars','Stars (1 to 5)','number']]]],
 gallery:[['heading','Heading','text'],['images','Photos','gallery']],
 faq:[['heading','Heading','text'],['items','Questions','list',[['q','Question','text'],['a','Answer','textarea']]]],
 cta:[['heading','Heading','text'],['sub','Supporting text','textarea'],['button','Button','text']],
 map:[['heading','Heading','text'],['address','Address','textarea'],['phone','Phone','text'],['hours','Hours','hours']],
 contact:[['heading','Heading','text'],['sub','Supporting text','textarea'],['phone','Phone','text'],['email','Email','text'],['address','Address','text'],['button','Button','text']],
 booking:[['heading','Heading','text'],['sub','Supporting text','textarea'],['services','Bookable services','list',[['title','Service','text'],['duration','Length','text']]]],
 shop:[['heading','Heading','text'],['items','Products','list',[['name','Name','text'],['price','Price','text'],['stock','In stock','number'],['image','Photo','image']]]]
};
const LIST_BLANK={slides:{image:null,caption:'New slide'},stats:{value:'10+',label:'New highlight'},items:null,services:{title:'New service',duration:'30 min'}};
const ITEM_BLANK={services:{title:'New service',desc:'Describe it in a sentence.',price:'$0'},testimonials:{quote:'A new review.',name:'Customer name',role:'',stars:5},faq:{q:'New question?',a:'The answer.'},shop:{name:'New product',price:'$10.00',image:null,stock:10}};
const WIDGETS={controls:'Website controls',leads:'Messages & leads',traffic:'Website visits',pos:'Register sales (POS)',payouts:'Payments & deposits',hours:'Business hours',reviews:'Reviews on your site',quickedit:'Quick edit',bookings:'Bookings',seo:'Search checklist'};
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

/* ---------- default data ---------- */
function mk(type,variant){return{id:uid(),type,variant:variant||Object.keys(CATALOG[type].variants)[0],hidden:false,data:clone(DEFAULTS[type])}}
function defaultState(){
 const H=3600e3;
 return {v:3,tab:'builder',
  brand:{name:'Harbor & Pine Bakery',tagline:'Wood-fired bread and pastries on Commercial Street',logo:null,logoSize:44,showName:true,theme:'harbor',colors:{...THEMES.harbor.colors},font:'fraunces',radius:10,btn:'rounded',header:'left',look:'standard',style:'classic',mode:'light',pal:themePal('harbor')},
  announce:{on:false,text:'',v:2,style:'bar',speed:'normal',size:'md',where:'all',close:false},
  sections:[],started:false,designId:null,designName:'Untitled design',draftAt:null,keep:null,
  hours:[{closed:true,open:'07:00',close:'15:00'},{closed:false,open:'07:00',close:'15:00'},{closed:false,open:'07:00',close:'15:00'},{closed:false,open:'07:00',close:'15:00'},{closed:false,open:'07:00',close:'15:00'},{closed:false,open:'07:00',close:'16:00'},{closed:false,open:'08:00',close:'13:00'}],
  leads:[{id:uid(),name:'Maria Chen',email:'maria.chen@example.com',msg:'Do you make gluten-free birthday cakes for about 20 people?',at:Date.now()-5*H,sample:true,read:false},{id:uid(),name:'Tom Alvarez',email:'tom@alvarezlaw.example',msg:'Looking for a standing Friday pastry order for our office, 15 people.',at:Date.now()-28*H,sample:true,read:true}],
  bookings:[{id:uid(),name:'Priya & Dev',service:'Wedding cake tasting',date:'2026-10-24',time:'10:00',sample:true}],
  dash:{order:['controls','leads','pos','traffic','payouts','hours','quickedit','reviews','bookings','seo'],off:{}},
  cart:{tier:'growth',addons:[],annual:false,pos:null,hw:{},merchant:false,volume:18000,inPerson:70},
  device:'desktop',selected:null,rightTab:'info',adminTab:'overview',onboarded:true,libOpen:false,inspOpen:true,coach:true,presets:[],biz:{name:'',industry:'',phone:'',email:'',address:'',about:'',show:{phone:true,email:true,address:true}},aiTries:0,aiLog:0};
}
function defaultAdmin(){
 const D=864e5,now=Date.now();
 return {v:3,aiFree:3,company:'Think Web Pros',domain:'thinkwebpros.com',popular:'growth',
  storage:{price:20,hours:1},
  tiers:[
   {id:'starter',name:'Starter',setup:299,monthly:19,maxSections:6,includes:[],features:['Up to 6 sections','Free thinkwebpros.com address','Hosting and SSL included','Owner dashboard (basic)','Email support']},
   {id:'growth',name:'Growth',setup:599,monthly:39,maxSections:10,includes:['domain'],features:['Up to 10 sections','Your own domain and email','Full owner dashboard','1 hour of edits by our team each month','Phone and email support']},
   {id:'pro',name:'Pro',setup:1199,monthly:79,maxSections:20,includes:['domain','seo','whitelabel','chat'],features:['Up to 20 sections','SEO boost and live chat included','No Think Web Pros badge','3 hours of edits each month','Priority support, same-day changes']}
  ],
  addons:[
   {id:'booking',name:'Online booking',desc:'Customers pick a service and time on your site.',price:15,billing:'monthly',enabled:true},
   {id:'store',name:'Online store',desc:'Sell products with checkout and pickup or shipping.',price:29,billing:'monthly',enabled:true},
   {id:'domain',name:'Custom domain & email',desc:'yourbusiness.com plus 5 email inboxes.',price:8,billing:'monthly',enabled:true},
   {id:'seo',name:'SEO boost',desc:'Google Business setup, monthly keyword report.',price:49,billing:'monthly',enabled:true},
   {id:'chat',name:'Live chat',desc:'Chat bubble on every page, messages go to your phone.',price:12,billing:'monthly',enabled:true},
   {id:'whitelabel',name:'Remove our badge',desc:'Hide the “Built with Think Web Pros” footer line.',price:5,billing:'monthly',enabled:true},
   {id:'logomaker',name:'AI logo package',desc:'Unlimited AI logo requests and changes, and keep the logo you like in every size.',price:49,billing:'once',enabled:true},
   {id:'logo',name:'Logo by a designer',desc:'A Think Web Pros designer draws 3 concepts with 2 rounds of changes.',price:149,billing:'once',enabled:true},
   {id:'copy',name:'Professional copywriting',desc:'We write every page in your voice.',price:199,billing:'once',enabled:true},
   {id:'photos',name:'On-site photo shoot',desc:'Two hours with a local photographer, 40 edited photos.',price:249,billing:'once',enabled:true}
  ],
  pos:{
   plans:[
    {id:'pos-lite',name:'POS Lite',price:39,desc:'One register. Menu, prices and stock sync with your website store.',enabled:true},
    {id:'pos-pro',name:'POS Pro',price:89,desc:'Up to 3 registers, staff logins and tips, low-stock alerts, online orders print in the kitchen.',enabled:true},
    {id:'pos-multi',name:'POS Multi-location',price:149,desc:'Unlimited registers across locations with one shared menu and reports per location.',enabled:true}
   ],
   hardware:[
    {id:'reader',name:'Tap & chip card reader',price:59,desc:'Pocket reader for Apple Pay, Google Pay and chip cards.',icon:'reader',enabled:true},
    {id:'terminal',name:'Countertop terminal',price:299,desc:'All-in-one screen with a built-in receipt printer.',icon:'terminal',enabled:true},
    {id:'kit',name:'Register kit',price:799,desc:'Tablet stand, cash drawer, receipt printer and barcode scanner.',icon:'kit',enabled:true},
    {id:'kds',name:'Kitchen display',price:399,desc:'Website and in-store orders on one screen in the back.',icon:'kds',enabled:true}
   ],
   rates:[
    {id:'inperson',name:'In person: tap, chip or swipe',pct:2.6,fixed:0.10},
    {id:'online',name:'Online: website store and booking deposits',pct:2.9,fixed:0.30},
    {id:'keyed',name:'Keyed in by hand',pct:3.5,fixed:0.15}
   ],
   cost:{pct:2.05,fixed:0.08},avgTicket:22,merchantMonthly:0
  },
  themes:Object.fromEntries(Object.keys(THEMES).map(k=>[k,true])),
  sections:Object.fromEntries(Object.keys(CATALOG).map(k=>[k,{enabled:true,addon:k==='booking'?'booking':k==='shop'?'store':null}])),
  customers:[
   {id:uid(),business:'Rosa’s Taqueria',owner:'Rosa Delgado',plan:'growth',addons:['store'],pos:'pos-pro',vol:42000,status:'Live',mrr:157,since:now-210*D,sample:true},
   {id:uid(),business:'Summit Roofing Co.',owner:'Dan Okafor',plan:'pro',addons:['booking'],pos:null,vol:0,status:'Live',mrr:94,since:now-180*D,sample:true},
   {id:uid(),business:'Bright Paws Grooming',owner:'Kelly Nguyen',plan:'growth',addons:['booking'],pos:'pos-lite',vol:16500,status:'Live',mrr:93,since:now-150*D,sample:true},
   {id:uid(),business:'Lakeside Yoga',owner:'Priya Shah',plan:'starter',addons:[],pos:null,vol:0,status:'Live',mrr:19,since:now-120*D,sample:true},
   {id:uid(),business:'Ironwood Barbers',owner:'Marcus Hill',plan:'growth',addons:['booking','chat'],pos:'pos-lite',vol:21000,status:'Live',mrr:105,since:now-95*D,sample:true},
   {id:uid(),business:'Fern & Folly Florist',owner:'Jess Romero',plan:'starter',addons:['store'],pos:'pos-lite',vol:12800,status:'Past due',mrr:87,since:now-70*D,sample:true},
   {id:uid(),business:'Coastal Tax Pros',owner:'Alan Brooks',plan:'pro',addons:[],pos:null,vol:0,status:'In build',mrr:79,since:now-6*D,sample:true},
   {id:uid(),business:'Little Oak Daycare',owner:'Tasha Grant',plan:'growth',addons:[],pos:null,vol:0,status:'In build',mrr:39,since:now-3*D,sample:true}
  ],
  orders:[
   {id:'TWP-1038',at:now-5*D,business:'Coastal Tax Pros',owner:'Alan Brooks',email:'alan@coastaltax.example',plan:'pro',addons:[],pos:null,hw:{},setup:1199,monthly:79,status:'In build',sample:true},
   {id:'TWP-1039',at:now-3*D,business:'Little Oak Daycare',owner:'Tasha Grant',email:'tasha@littleoak.example',plan:'growth',addons:[],pos:null,hw:{},setup:599,monthly:39,status:'In build',sample:true},
   {id:'TWP-1040',at:now-1*D,business:'Mill Street Coffee',owner:'Ana Ruiz',email:'ana@millst.example',plan:'starter',addons:['logomaker','store'],pos:'pos-pro',hw:{terminal:1,reader:2},setup:1065,monthly:137,status:'New',sample:true}
  ],
  nextOrder:1041};
}

/* ---------- state + storage ---------- */
const KEY='twp-studio-v3';
let state=defaultState(), admin=defaultAdmin();
try{const raw=localStorage.getItem(KEY);if(raw){const d=JSON.parse(raw);if(d&&d.state&&d.state.v===3&&d.admin&&d.admin.v===3){
  const ds=defaultState();state={...ds,...d.state,brand:{...ds.brand,...d.state.brand},cart:{...ds.cart,...d.state.cart},biz:{...ds.biz,...(d.state.biz||{}),show:{...ds.biz.show,...((d.state.biz||{}).show||{})}},dash:{...ds.dash,...d.state.dash}};
  const da=defaultAdmin();admin={...da,...d.admin,pos:{...da.pos,...(d.admin.pos||{})}};
  if(!d.state.brand.pal){state.brand.pal=themePal(state.brand.theme);state.brand.pal.light={...state.brand.colors};state.brand.mode='light'}
  state.onboarded=true;if(!d.state.biz)state.rightTab='info';
  if(d.state.started===undefined){state.sections=[];state.started=false;state.selected=null}
  const lm=admin.addons.find(a=>a.id==='logomaker');if(lm&&lm.name==='Logo maker'){const n=da.addons.find(a=>a.id==='logomaker');lm.name=n.name;lm.desc=n.desc}
}}}catch(e){}
let saveT=null,warnedQuota=false;
function save(){const B=state.brand;if(B&&B.pal&&B.mode)B.pal[B.mode]={...B.colors};clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify({state,admin}))}catch(e){if(!warnedQuota&&e&&e.name==='QuotaExceededError'){warnedQuota=true;toast('Your photos are too large to keep after you close this page. Try smaller images.')}}},350)}

/* ---------- derived ---------- */
const tierById=id=>admin.tiers.find(t=>t.id===id)||admin.tiers[0];
const addonById=id=>admin.addons.find(a=>a.id===id);
const rule=t=>admin.sections[t]||{enabled:true,addon:null};
const posPlan=id=>admin.pos.plans.find(p=>p.id===id);
function curTier(){return tierById(state.cart.tier)}
function hasAddon(id){const a=addonById(id);if(!a||!a.enabled)return false;return state.cart.addons.includes(id)||(curTier().includes||[]).includes(id)}
const hasPOS=()=>!!(state.cart.pos&&posPlan(state.cart.pos));
const hasMerchant=()=>state.cart.merchant||hasPOS();
const sec=id=>state.sections.find(s=>s.id===id);
const firstOf=t=>state.sections.find(s=>s.type===t&&!s.hidden);
function processing(){const p=admin.pos,v=+state.cart.volume||0,ip=(+state.cart.inPerson||0)/100;const rIn=p.rates.find(r=>r.id==='inperson')||p.rates[0],rOn=p.rates.find(r=>r.id==='online')||p.rates[0];const tx=v/(p.avgTicket||20);
 const fees=v*ip*rIn.pct/100+tx*ip*rIn.fixed+v*(1-ip)*rOn.pct/100+tx*(1-ip)*rOn.fixed;return{fees,eff:v?fees/v*100:0,tx}}
function cartCalc(){
 const t=curTier(),inc=new Set(t.includes||[]);const annual=state.cart.annual;
 let setup=t.setup,monthly=t.monthly;const lines=[{label:`${t.name} plan`,m:t.monthly},{label:`${t.name} site design`,o:t.setup}];
 state.cart.addons.map(addonById).filter(a=>a&&a.enabled&&!inc.has(a.id)).forEach(a=>{if(a.billing==='once'){setup+=a.price;lines.push({label:a.name,o:a.price})}else{monthly+=a.price;lines.push({label:a.name,m:a.price})}});
 const pp=state.cart.pos&&posPlan(state.cart.pos);if(pp){monthly+=pp.price;lines.push({label:pp.name,m:pp.price})}
 let hwTotal=0;Object.entries(state.cart.hw||{}).forEach(([id,q])=>{const h=admin.pos.hardware.find(x=>x.id===id);if(h&&q>0){hwTotal+=h.price*q;lines.push({label:`${h.name}${q>1?' × '+q:''}`,o:h.price*q})}});
 setup+=hwTotal;if(hasMerchant()&&admin.pos.merchantMonthly){monthly+=admin.pos.merchantMonthly;lines.push({label:'Merchant account',m:admin.pos.merchantMonthly})}
 return{t,inc,setup,monthly,yearly:monthly*10,annual,lines,proc:hasMerchant()?processing():null};
}

/* ---------- site renderer ---------- */
let EDIT=false;const ssIdx={};
function siteVars(b){const c=b.colors,f=FONTS[b.font]||FONTS.fraunces;const pick=(k,d)=>isHex(c[k])?c[k]:d;
 const p=pick('p','#1D3557'),a=pick('a','#E76F51');const rb=b.btn==='pill'?'999px':b.btn==='square'?'0px':Math.min(b.radius,12)+'px';
 return `--p:${p};--a:${a};--bg-s:${pick('bg','#FFFFFF')};--sf:${pick('sf','#F1F4F8')};--tx:${pick('tx','#1B2430')};--onp:${onColor(p)};--ona:${onColor(a)};--r:${+b.radius||0}px;--rb:${rb};--fh:${f.h};--fb:${f.b};--logo:${+b.logoSize||44}px`}
const IP=(s,path)=>`${s.id}:${path}`;
const CE=(()=>{try{const d=document.createElement('div');d.contentEditable='plaintext-only';return d.contentEditable==='plaintext-only'?'plaintext-only':'true'}catch(e){return'true'}})();
var SUB=false,HSEL=false,HSUB=false;
const tcAttr=(h,path)=>{const m=h&&h._tc&&h._tc[state.brand.mode||'light'];const c=m&&m[path];return c&&isHex(c)?` style="color:${c}"`:''};
const T=(s,path)=>tcAttr(s.data,path)+(EDIT?` contenteditable="${CE}" spellcheck="false" data-edit="${s.id}|${path}"`:'');
const TB=path=>tcAttr(state.brand,path)+(EDIT?` contenteditable="${CE}" spellcheck="false" data-editb="${path}"`:'');
const isVid=v=>typeof v==='string'&&((v.startsWith('idb:')&&!v.startsWith('idb:im'))||v.startsWith('data:video'));
function mediaHtml(v,still){if(typeof v==='string'&&v.startsWith('idb:im')){const u=mediaUrl(v);return u?`<img src="${u}" alt="">`:`<span class="vid-wait">${ic('image',22)}</span>`}if(isVid(v)){const u=mediaUrl(v);return u?`<video src="${u}" muted playsinline preload="metadata"${still?'':' autoplay loop'}></video>`:`<span class="vid-wait">${ic('video',22)}</span>`}return `<img src="${v}" alt="">`}
function pic(src,path,ang=135,label='Photo or video'){
 const ed=EDIT&&path,attr=ed?` data-img="${path}" title="Click or drop a photo or video here"`:'';
 return src?`<div class="pic${isVid(src)?' is-vid':''}"${attr}>${mediaHtml(src)}${ed?`<span class="pic-chg">${ic('camera',13)} Change</span>`:''}</div>`:`<div class="pic ph" style="--ang:${ang}deg"${attr}>${ed?`<span class="ph-add"><b>+</b>${label}</span>`:`<span>${ic('camera',24)}<em>Photo</em></span>`}</div>`}
const stars=n=>`<span class="stars" aria-label="${n} stars">${Array.from({length:Math.max(0,Math.min(5,+n||0))},()=>icFill('star',16)).join('')}</span>`;
const lines=t=>esc(t).replace(/\n/g,'<br>');
function logoHtml(b,forceMono){return b.logo&&!forceMono?`<img class="slogo" src="${b.logo}" alt="${esc(b.name)} logo">`:`<span class="mono">${esc(initials(b.name))}</span>`}
const HID=k=>!!(state.biz&&state.biz.show&&state.biz.show[k]===false);const JP=k=>EDIT?` data-jump="${k}"`:'';const JL=(l,k)=>EDIT?` data-jumpli="${l}|${k}"`:'';const bv=(k,v)=>HID(k)?'':v;
const phoneOf=()=>{if(HID('phone'))return'';const s=firstOf('contact')||firstOf('map');return s?s.data.phone:''};
const addrOf=()=>{if(HID('address'))return'';const m=firstOf('map');if(m)return m.data.address.replace(/\n/g,', ');const c=firstOf('contact');return c?c.data.address:''};
const R={
 hero(s){const d=s.data,v=s.variant;const btns=`<div class="btns">${d.cta?btnHtml(s.id,'cta',d.cta,''):''}${d.cta2?btnHtml(s.id,'cta2',d.cta2,'ghost'):''}</div>`;
  const copy=`${d.eyebrow?`<p class="eyebrow"${T(s,'eyebrow')}>${esc(d.eyebrow)}</p>`:''}<h1${T(s,'heading')}>${esc(d.heading)}</h1>${d.sub?`<p class="lead"${T(s,'sub')}>${esc(d.sub)}</p>`:''}${btns}`;
  if(v==='poster')return `<section class="hero hero-poster"><div class="wrap"><div class="poster-top">${d.eyebrow?`<p class="eyebrow"${T(s,'eyebrow')}>${esc(d.eyebrow)}</p>`:'<span></span>'}<span class="poster-no">No. 01</span></div><h1${T(s,'heading')}>${esc(d.heading)}</h1><div class="poster-row">${d.sub?`<p class="lead"${T(s,'sub')}>${esc(d.sub)}</p>`:'<span></span>'}${btns}</div>${pic(d.image,IP(s,'image'),120)}</div></section>`;
  if(v==='arch')return `<section class="hero hero-arch"><div class="wrap arch-in"><div class="hero-copy">${copy}</div><div class="arch-pic">${pic(d.image,IP(s,'image'),160)}</div></div></section>`;
  if(v==='bubble')return `<section class="hero hero-bubble"><i class="blob b1"></i><i class="blob b2"></i><div class="wrap grid2"><div class="hero-copy">${copy}</div><div class="bub-pic">${pic(d.image,IP(s,'image'),135)}</div></div></section>`;
  if(v==='bento'){const t=firstOf('testimonials'),r=t&&t.data.items&&t.data.items[0],ph=phoneOf(),ab=firstOf('about'),st=ab&&ab.data.stats&&ab.data.stats[0];
   return `<section class="hero hero-bento"><div class="wrap bento"><div class="tile t-copy hero-copy">${copy}</div><div class="tile t-pic">${pic(d.image,IP(s,'image'),140)}</div><div class="tile t-stat"><b>${esc(st?st.value:'5★')}</b><span>${esc(st?st.label:'Rated by locals')}</span></div><div class="tile t-quote">${r?`${stars(r.stars)}<p>${esc(r.quote.length>90?r.quote.slice(0,88)+'…':r.quote)}</p><small>${esc(r.name)}</small>`:'<p>Loved by our neighbors</p>'}</div><div class="tile t-call"><small>Talk to us</small><b>${esc(ph||'Say hello')}</b></div></div></section>`}
  if(v==='badge')return `<section class="hero hero-badge"><div class="wrap"><div class="emblem"><span class="em-ring">${esc(d.eyebrow||state.brand.name)}</span><h1${T(s,'heading')}>${esc(d.heading)}</h1></div>${d.sub?`<p class="lead"${T(s,'sub')}>${esc(d.sub)}</p>`:''}${btns}<div class="checker"></div>${pic(d.image,IP(s,'image'),130)}</div></section>`;
  if(v==='marquee'){const sv=firstOf('services'),items=(sv&&sv.data.items||[]).map(x=>x.title).filter(Boolean);const tick=(items.length?items:['Open today','Locally owned','Come say hi']).map(x=>`<span>${esc(x)}</span><i>✱</i>`).join('');
   return `<section class="hero hero-marquee"><div class="wrap grid2"><div class="hero-copy">${copy}</div>${pic(d.image,IP(s,'image'),135)}</div><div class="ticker" aria-hidden="true"><div class="tick-in">${tick}${tick}${tick}</div></div></section>`}
  if(v==='overlay')return `<section class="hero hero-overlay">${pic(d.image,IP(s,'image'),160)}<div class="hero-shade"></div><div class="wrap hero-copy">${copy}</div></section>`;
  if(v==='centered')return `<section class="hero hero-centered"><div class="wrap"><div class="hero-copy center">${copy}</div>${pic(d.image,IP(s,'image'),110)}</div></section>`;
  return `<section class="hero hero-split"><div class="wrap grid2"><div class="hero-copy">${copy}</div>${pic(d.image,IP(s,'image'),135)}</div></section>`},
 slideshow(s){const d=s.data,v=s.variant,sl=d.slides||[];const i=Math.min(ssIdx[s.id]||0,Math.max(0,sl.length-1));const n=sl.length,ind=SS_IND[d.ind]?d.ind:'dots',dur=ssDur(d);
  const cap=(x,k)=>{const c=x.caption||'';if(!EDIT&&!c)return'';const p=`<p${T(s,`slides.${k}.caption`)} data-ph="Add a caption">${esc(c)}</p>`;return v==='split'?`<div class="ss-gcap">${p}</div>`:`<div class="ss-cap">${p}</div>`};
  const dots=n<2||ind==='none'?'':ind==='count'?`<div class="ss-ind ss-ind-count"><b class="ss-cur">${i+1}</b><span>/ ${n}</span></div>`:`<div class="ss-ind ss-ind-${ind}" style="--dur:${dur}s">${sl.map((x,k)=>`<button type="button" class="${k===i?'on':''}${k<i?' past':''}" data-ss-to="${k}" aria-label="Slide ${k+1}">${ind==='thumbs'?(x.image?mediaHtml(x.image,true):'<span class="th-ph"></span>'):ind==='bars'?'<i></i>':''}</button>`).join('')}</div>`;
  const slides=n?sl.map((x,k)=>`<div class="ss-slide${k===i?' on':''}">${pic(x.image,IP(s,`slides.${k}.image`),110+k*45)}${cap(x,k)}</div>`).join(''):`<div class="ss-slide on">${pic(null,IP(s,'+slides'),120,'Add your first photo or video')}</div>`;
  const tray=EDIT?ssTray(s,sl,i,ind,dur):'';
  const box=`<div class="ss ss-i-${ind}" data-ss="${s.id}" data-int="${dur}">${slides}${n>1?`<button type="button" class="ss-arrow l" data-ss-go="-1" aria-label="Previous slide">${ic('l',20)}</button><button type="button" class="ss-arrow r" data-ss-go="1" aria-label="Next slide">${ic('r',20)}</button>`:''}${dots}</div>`;
  const head=d.heading?`<div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2></div>`:'';
  if(v==='split')return `<section class="ss-sec ss-split"><div class="wrap">${head}${box}${tray}</div></section>`;
  if(v==='full')return `<section class="ss-sec ss-full">${d.heading?`<div class="wrap" style="padding-block:40px 24px">${head.replace('margin-bottom:34px','')}</div>`:''}${box}${tray?`<div class="wrap">${tray}</div>`:''}</section>`;
  return `<section class="ss-sec ss-framed"><div class="wrap">${head}${box}${tray}</div></section>`},
 social(s){const d=s.data,v=s.variant,L=(d.links||[]).filter(x=>SOC[x.net]);const tone=d.tone==='site'?'site':'brand';
  const head=`<div class="sec-head center"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div>`;
  const icon=(x,k)=>`<span class="soc-ic soc-${x.net}" style="--soc:${tone==='site'?'var(--p)':SOC[x.net][1]}">${socGlyph(x.net)}</span>`;
  const href=x=>socUrl(x);
  if(v==='cards')return `<section class="soc-sec soc-cards"><div class="wrap">${head}<div class="soc-grid">${L.map((x,k)=>`<a class="soc-card" data-soc="${esc(href(x))}"${JL('links',(d.links||[]).indexOf(x))} role="link" tabindex="0">${icon(x,k)}<b>${esc(SOC[x.net][0])}</b><small>${esc(x.handle||'')}</small><span class="sbtn sm">Follow</span></a>`).join('')}</div></div></section>`;
  if(v==='feed'){const first=L[0];return `<section class="soc-sec soc-feed"><div class="wrap">${head}<div class="soc-feed-h">${first?`${icon(first,0)}<b>${esc(first.handle||'')}</b>`:''}<span class="soc-row">${L.map((x,k)=>`<a data-soc="${esc(href(x))}"${JL('links',(d.links||[]).indexOf(x))} role="link" tabindex="0" aria-label="${esc(SOC[x.net][0])}">${icon(x,k)}</a>`).join('')}</span></div><div class="soc-posts">${(d.posts||[]).map((p,k)=>pic(p.image,IP(s,`posts.${k}.image`),120+k*35,'Photo or video')).join('')}</div></div></section>`}
  return `<section class="soc-sec soc-icons"><div class="wrap">${head}<div class="soc-row big">${L.map((x,k)=>`<a data-soc="${esc(href(x))}"${JL('links',(d.links||[]).indexOf(x))} role="link" tabindex="0">${icon(x,k)}<span>${esc(SOC[x.net][0])}</span></a>`).join('')}</div></div></section>`},
 about(s){const d=s.data;return `<section class="about about-${s.variant}"><div class="wrap grid2">${pic(d.image,IP(s,'image'),200)}<div class="about-copy">${d.eyebrow?`<p class="eyebrow"${T(s,'eyebrow')}>${esc(d.eyebrow)}</p>`:''}<h2${T(s,'heading')}>${esc(d.heading)}</h2><p class="muted" data-ml${T(s,'body')}>${lines(d.body)}</p>${(d.stats||[]).length?`<div class="stats">${d.stats.map((x,i)=>`<div><b${T(s,`stats.${i}.value`)}>${esc(x.value)}</b><span${T(s,`stats.${i}.label`)}>${esc(x.label)}</span></div>`).join('')}</div>`:''}</div></div></section>`},
 services(s){const d=s.data,v=s.variant;const head=`<div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.intro?`<p${T(s,'intro')}>${esc(d.intro)}</p>`:''}</div>`;
  if(v==='menu')return `<section class="svc-menu"><div class="wrap">${head}<div class="menu">${(d.items||[]).map((x,i)=>`<div class="menu-row"><h3${T(s,`items.${i}.title`)}>${esc(x.title)}</h3><span class="dots"></span><b${T(s,`items.${i}.price`)}>${esc(x.price)}</b>${x.desc?`<p${T(s,`items.${i}.desc`)}>${esc(x.desc)}</p>`:''}</div>`).join('')}</div></div></section>`;
  return `<section class="svc-${v}"><div class="wrap">${head}<div class="svc-grid">${(d.items||[]).map((x,i)=>`<div class="svc"><h3${T(s,`items.${i}.title`)}>${esc(x.title)}</h3><p${T(s,`items.${i}.desc`)}>${esc(x.desc)}</p>${x.price||EDIT?`<span class="price"${T(s,`items.${i}.price`)}>${esc(x.price)}</span>`:''}</div>`).join('')}</div></div></section>`},
 testimonials(s){const d=s.data,v=s.variant,it=(d.items||[]).map((x,i)=>({...x,_i:i})).filter(x=>!x.hidden);
  if(v==='spotlight'&&it.length){const f=it[0];return `<section class="tst-sec"><div class="wrap"><div class="spot">${stars(f.stars)}<blockquote${T(s,`items.${f._i}.quote`)}>${esc(f.quote)}</blockquote><cite style="font-style:normal;font-weight:700"><span${T(s,`items.${f._i}.name`)}>${esc(f.name)}</span>${f.role?` <span class="muted" style="font-weight:400">· ${esc(f.role)}</span>`:''}</cite>${it.length>1?`<div class="spot-more">${it.slice(1).map(x=>`<span>${'★'.repeat(+x.stars||5)} ${esc(x.name)}</span>`).join('')}</div>`:''}</div></div></section>`}
  return `<section class="tst-sec tst-${v}"><div class="wrap"><div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2></div><div class="tst-grid">${it.map(x=>`<figure class="tst" style="margin:0">${stars(x.stars)}<blockquote${T(s,`items.${x._i}.quote`)}>${esc(x.quote)}</blockquote><cite><b${T(s,`items.${x._i}.name`)}>${esc(x.name)}</b>${x.role?`<span${T(s,`items.${x._i}.role`)}>${esc(x.role)}</span>`:''}</cite></figure>`).join('')}</div></div></section>`},
 gallery(s){const d=s.data;return `<section class="gal-${s.variant}"><div class="wrap">${d.heading?`<div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2></div>`:''}<div class="gal">${(d.images||[]).map((x,k)=>pic(x,IP(s,`images.${k}`),100+k*37,'Photo '+(k+1))).join('')}</div></div></section>`},
 faq(s){const d=s.data;return `<section class="faq-${s.variant}"><div class="wrap"><div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2></div><div class="faq">${(d.items||[]).map((x,k)=>`<details${k===0||EDIT?' open':''}><summary>${esc(x.q)}</summary><p${T(s,`items.${k}.a`)}>${esc(x.a)}</p></details>`).join('')}</div></div></section>`},
 cta(s){const d=s.data;return `<section class="cta-${s.variant}"><div class="wrap cta-in"><div><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div>${d.button?btnHtml(s.id,'button',d.button,''):''}</div></section>`},
 map(s){const d=s.data;const today=(new Date().getDay()+6)%7;const q=encodeURIComponent(d.address.replace(/\n/g,' '));
  const hrs=`<div class="hours">${state.hours.map((h,k)=>`<span class="${k===today?'today':''}">${DAYS[k]}</span><span class="${h.closed?'closed':''} ${k===today?'today':''}">${h.closed?'Closed':fmtTime(h.open)+' – '+fmtTime(h.close)}</span>`).join('')}</div>`;
  return `<section class="map-${s.variant}"><div class="wrap"><div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2></div><div class="map-wrap${HID('address')?' noaddr':''}"><div class="map-info">${HID('address')?'':`<div${JP('address')}><h4>Address</h4><p>${lines(d.address)}</p></div>`}${bv('phone',d.phone)?`<div${JP('phone')}><h4>Phone</h4><p>${esc(d.phone)}</p></div>`:''}<div${JP('@hours')}><h4>Hours</h4>${hrs}</div>${HID('address')?'':`<a class="slnk" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${ic('pin',16)} Get directions</a>`}</div>${HID('address')?'':`<div class="map-box">${mapSvg()}</div>`}</div></div></section>`},
 contact(s){const d=s.data;const form=`<form class="cform" data-contact><div class="r2"><label>Name<input name="name" required placeholder="Your name"></label><label>Email<input name="email" type="email" required placeholder="you@example.com"></label></div><label>Message<textarea name="msg" required placeholder="How can we help?"></textarea></label><button class="sbtn" type="submit" data-btn="${s.id}|button">${esc(d.button||'Send message')}</button></form>`;
  if(s.variant==='centered')return `<section class="ct-sec ct-centered"><div class="wrap"><div class="ct-box"><h2${T(s,'heading')}>${esc(d.heading)}</h2><p class="muted"${T(s,'sub')}>${esc(d.sub)}</p><div class="ct-row">${bv('phone',d.phone)?`<span${JP('phone')}>${esc(d.phone)}</span>`:''}${bv('email',d.email)?`<span${JP('email')}>${esc(d.email)}</span>`:''}</div>${form}</div></div></section>`;
  return `<section class="ct-sec"><div class="wrap grid2" style="align-items:start"><div class="ct-info"><h2${T(s,'heading')}>${esc(d.heading)}</h2><p class="muted"${T(s,'sub')}>${esc(d.sub)}</p>${bv('phone',d.phone)?`<div class="ct-line"${JP('phone')}>${ic('phoneCall',18)}<span>${esc(d.phone)}</span></div>`:''}${bv('email',d.email)?`<div class="ct-line"${JP('email')}>${ic('mail',18)}<span>${esc(d.email)}</span></div>`:''}${bv('address',d.address)?`<div class="ct-line"${JP('address')}>${ic('pin',18)}<span>${esc(d.address)}</span></div>`:''}</div>${form}</div></section>`},
 booking(s){const d=s.data;const slots=['9:00am','10:30am','1:00pm','2:30pm','4:00pm'];
  return `<section><div class="wrap"><div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2><p${T(s,'sub')}>${esc(d.sub)}</p></div><form class="bk" data-booking><div class="cform"><label>Service<select name="service">${(d.services||[]).map(x=>`<option>${esc(x.title)} (${esc(x.duration)})</option>`).join('')}</select></label><label>Date<input type="date" name="date" required value="2026-10-28"></label><label>Your name<input name="name" required placeholder="Your name"></label></div><div style="display:grid;gap:14px;align-content:start"><b>Pick a time</b><div class="slots">${slots.map((t,k)=>`<button type="button" class="slot${k===1?' on':''}" data-slot>${t}</button>`).join('')}</div><button class="sbtn" type="submit" style="justify-self:start" data-btn="${s.id}|button">${esc(s.data.button||'Request this time')}</button>${hasMerchant()?`<p class="muted" style="font-size:.85rem">A $20 deposit is taken at booking.</p>`:''}</div></form></div></section>`},
 shop(s){const d=s.data,pos=hasPOS();return `<section><div class="wrap"><div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${pos?`<span class="possync">${ic('check',14)} Prices and stock synced with the register</span>`:''}</div><div class="shop">${(d.items||[]).map((x,k)=>`<div class="prod">${pic(x.image,IP(s,`items.${k}.image`),90+k*50,'Product photo')}<div class="prod-row"><h3${T(s,`items.${k}.name`)}>${esc(x.name)}</h3><b${T(s,`items.${k}.price`)}>${esc(x.price)}</b></div>${pos?`<span class="stock">${+x.stock>0?(+x.stock<=3?'Only '+x.stock+' left':'In stock'):'Sold out'}</span>`:''}<button type="button" class="sbtn sm ghost" data-shopadd="${esc(x.name)}" data-btn="${s.id}|addLabel">${esc(s.data.addLabel||'Add to cart')}</button></div>`).join('')}</div></div></section>`}
};
function mapSvg(){return `<svg class="mapsvg" viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" aria-label="Map"><rect width="600" height="420" style="fill:var(--sf)"/><path d="M0 330 C120 300 210 360 330 330 S520 270 600 290 L600 420 L0 420Z" style="fill:color-mix(in srgb,var(--p) 22%,var(--sf))"/><rect x="380" y="40" width="150" height="110" rx="10" style="fill:color-mix(in srgb,var(--a) 22%,var(--sf))"/><g style="stroke:var(--bg-s);stroke-linecap:round" fill="none"><path d="M-10 120 L620 80" stroke-width="16"/><path d="M-10 230 L620 210" stroke-width="12"/><path d="M120 -10 L170 440" stroke-width="12"/><path d="M300 -10 L280 440" stroke-width="16"/><path d="M450 -10 L520 440" stroke-width="10"/><path d="M0 40 L240 300" stroke-width="8"/></g><g transform="translate(290 196)"><ellipse cx="0" cy="4" rx="16" ry="5" style="fill:color-mix(in srgb,var(--tx) 25%,transparent)"/><path d="M0 0 C-10 -16 -22 -28 -22 -44 a22 22 0 0 1 44 0 C22 -28 10 -16 0 0z" style="fill:var(--a)"/><circle cx="0" cy="-44" r="8" style="fill:var(--bg-s)"/></g></svg>`}
function headerHtml(){const b=state.brand,md=menuD(),mm=menuM(),items=navItems();const cta=btnLabel('hdr','cta');
 const ctaH=cta?btnHtml('hdr','cta',cta,'sm hdr-cta'):'';
 return `<header class="hdr hdr-${b.header} hm-${md} mm-${mm} hlm-${logoM()}${EDIT&&HSEL?' hsel'+(HSUB?' hsub':''):''}${MOPEN?' m-open':''}"><div class="wrap hdr-in"><div class="brandmark"${EDIT?' data-img="brand:logo" title="Click or drop your logo"':''}>${logoHtml(b)}${b.showName||!b.logo?`<span class="bname"${TB('brand.name')}>${esc(b.name)}</span>`:''}</div><nav class="hnav" aria-label="Menu">${items.map(navA).join('')}</nav>${ctaH}<button type="button" class="burger" data-mtoggle aria-label="${MOPEN?'Close menu':'Open menu'}" aria-expanded="${MOPEN}">${ic(MOPEN?'x':'menu',24)}</button></div><nav class="mnav" aria-label="Menu">${items.map(navA).join('')}${cta?btnHtml('hdr','cta',cta,'mn-cta'):''}</nav>${EDIT?`<button type="button" class="hdr-pill" data-hdrwhole>${ic('layout',11)} Header</button><button type="button" class="hdr-edit" data-hdredit>${ic('layout',13)} Logo &amp; menu</button>`:''}</header>`}
function footerHtml(){const b=state.brand;const ph=phoneOf(),ad=addrOf();
 const fn=state.pages&&state.pages.length>1?`<nav class="fnav" aria-label="Pages">${navItems().map(navA).join('')}</nav>`:'';
 const FJ=(k,t)=>EDIT?` data-fjump="${k}" title="${t}"`:'';
 return `<footer class="foot"${FJ('info|yourbusiness','Click to change your business details')}><div class="wrap foot-in"><div class="brandmark"${FJ('info|businessname','Click to change your business name')}>${logoHtml(b,true)}<span>${esc(b.name)}</span></div>${fn}<p${FJ('info|streetaddress','Click to change your address and phone')}>${[ad,ph].filter(Boolean).map(esc).join(' · ')}</p>${hasMerchant()?`<span class="pay">We accept <i>VISA</i><i>MC</i><i>AMEX</i><i>Apple Pay</i></span>`:''}${hasAddon('whitelabel')?'':`<p class="built">Built with ${esc(admin.company)}</p>`}</div></footer>`}
function wrapEdit(s,inner){const c=CATALOG[s.type];const r=rule(s.type);const needs=r.addon&&!hasAddon(r.addon)?addonById(r.addon):null;
 return `<div class="sec${state.selected===s.id?' sel'+(SUB?' sub':''):''}" data-sec="${s.id}"><button type="button" class="sec-pill" data-secwhole="${s.id}" title="Select the whole section to move or change it">${ic('grip',12)} ${esc(c.name)} <small>section</small></button><button type="button" class="sec-grab" data-grab="${s.id}" aria-label="Drag to move ${esc(c.name)}. Arrow keys also move it." title="Drag to move">${ic('grip',18)}<span>Drag</span></button><div class="sec-tools"><span class="sec-name" draggable="true" data-dragsec="${s.id}">${ic('grip',12)} ${esc(c.name)}</span>${Object.keys(c.variants).length>1?`<button type="button" data-act="layout" title="Switch layout">${ic('swap',13)} ${esc(c.variants[s.variant])}</button>`:''}<button type="button" data-act="edit">${ic('edit',13)} Edit</button><button type="button" data-act="up" aria-label="Move up">${ic('up',13)}</button><button type="button" data-act="down" aria-label="Move down">${ic('down',13)}</button><button type="button" data-act="hide" aria-label="Hide">${ic('eyeOff',13)}</button><button type="button" data-act="del" aria-label="Delete">${ic('trash',13)}</button></div>${needs?`<div class="sec-lock">${ic('lock',13)} Needs ${esc(needs.name)}<button type="button" data-act="addaddon" data-addon="${needs.id}">Add ${money(needs.price)}${needs.billing==='monthly'?'/mo':''}</button></div>`:''}${inner}</div>`}
function socUrl(x){const h=String(x.handle||'').trim();if(!h)return'';if(/^https?:\/\//i.test(h)||/\.[a-z]{2,}\//i.test(h))return normUrl(h);return 'https://'+SOC[x.net][2]+h.replace(/^@/,x.net==='tiktok'?'@':'')}
function socGlyph(n){const G={instagram:'<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".9" fill="currentColor"/>',facebook:'<path d="M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6.5H14V14h2.5l.5-3.5h-3V8.5a.5.5 0 0 1 .5-.5z"/>',tiktok:'<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2.3 4 5 4.2"/>',youtube:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10.5 9.5v5l4.2-2.5z" fill="currentColor"/>',x:'<path d="M5 4l14 16M19 4L5 20"/>',linkedin:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10.5V16M8 8v.2M11.5 16v-5.5M11.5 13c0-1.5 1-2.5 2.3-2.5S16 11.5 16 13v3"/>',pinterest:'<circle cx="12" cy="12" r="8.5"/><path d="M11 9.5c.5-1.5 4-1.7 4 1 0 2.5-2.5 3.5-3.6 2M11.6 10.5L9.8 19"/>',yelp:'<path d="M12 3.5v8M12 11.5l6.5-2.5M12 11.5l5 5.5M12 11.5l-4 6M12 11.5L5.5 9"/>',google:'<path d="M19.5 12.2H12v3h4.3a4.6 4.6 0 1 1-1.3-5"/>',nextdoor:'<path d="M5 19v-7l7-6 7 6v7h-5v-5h-4v5z"/>'};return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[n]||G.instagram}</svg>`}
/* top banner: off until the owner adds a message */
let ANN_CLOSED=false;
const ANN_SPEED={slow:40,normal:24,fast:14};
function annHtml(edit){const A=state.announce||{};const home=!state.pages||!state.pages.length||state.pageId===state.pages[0].id;
 if(!A.on||!String(A.text||'').trim()){return edit?`<button type="button" class="ann-add" data-annadd><b>+</b> Add a banner message across the top <small>optional</small></button>`:''}
 if(A.where==='home'&&!home&&!edit)return'';if(ANN_CLOSED&&!edit)return'';
 const st=`${isHex(A.bg)?`--ann-bg:${A.bg};`:''}${isHex(A.tx)?`--ann-tx:${A.tx};`:''}--ann-sp:${ANN_SPEED[A.speed]||24}s`;const t=esc(A.text);
 const inner=A.style==='ticker'?`<div class="ann-track" aria-hidden="true">${Array.from({length:8},()=>`<span>${t}</span><i>✦</i>`).join('')}</div><span class="sr-only">${t}</span>`:`<span class="ann-t">${t}</span>`;
 const L=A.link&&A.link.t&&A.link.t!=='none';
 return `<div class="announce ann-${A.style==='ticker'?'ticker':'bar'} ann-${A.size||'md'}${L?' ann-link':''}${A.where==='home'&&!home?' ann-dim':''}" style="${st}" ${edit?'data-annedit role="button" tabindex="0" title="Click to edit the banner"':L?'data-annlink role="link" tabindex="0"':''}>${inner}${A.close?`<button type="button" class="ann-x" data-annclose aria-label="Close banner">${ic('x',14)}</button>`:''}</div>`}
function renderSite(edit){EDIT=edit;let h='';
 h+=annHtml(edit);
const hdr=headerHtml();let body='';
 state.sections.forEach(s=>{if(!CATALOG[s.type])return;if(s.hidden){if(edit)body+=`<div class="sec-hidden" data-sec="${s.id}"><span>Hidden: ${esc(CATALOG[s.type].name)}</span><button type="button" data-act="hide">Show</button></div>`;return}
  if(!rule(s.type).enabled&&!edit)return;const inner=bgApply(R[s.type](s),s);body+=edit?wrapEdit(s,inner):inner});
 if(edit){const vis=state.sections.filter(x=>!x.hidden).length;const nx=nextSuggested();
  if(!vis)body+=state.started?`<div class="es"><div class="es-card"><span class="es-ic">${ic('plus',22)}</span><h3>Your page is empty</h3><p>Add sections one at a time. We’ll suggest the next one that most sites need.</p><div class="es-btns">${nx?`<button type="button" class="es-pri" data-addsugg>${ic('spark',16)} Add a suggested section: ${esc(CATALOG[nx].name)}</button>`:''}<button type="button" class="es-sec" data-browse>Browse all sections</button></div></div></div>`
   :kitStart();
  else if(nx)body+=`<div class="es-bar"><button type="button" class="es-pri" data-addsugg>${ic('plus',16)} Add a suggested section: ${esc(CATALOG[nx].name)}</button><button type="button" class="es-sec" data-browse>Browse all</button></div>`}
 h+=`<div class="sframe">${hdr}<div class="smain">${body}${footerHtml()}${edit?`<button type="button" class="pgbg-add" data-pgbg>${ic('image',14)} Page background <small>color, texture or photo</small></button>`:''}</div>${menuTabbar()}</div>`;if(hasAddon('chat'))h+=`<div class="chat-dock"><span class="chatb" title="Live chat">${ic('chat',24)}</span></div>`;
 EDIT=false;return h}

/* ---------- backgrounds: color, gradient and texture layers for the page and each section ---------- */
const TEXTURES={none:'None',grain:'Film grain',paper:'Paper',linen:'Linen',canvas:'Canvas',concrete:'Concrete',stone:'Stone',marble:'Marble',wood:'Wood grain',terrazzo:'Terrazzo',dots:'Dots',halftone:'Halftone',grid:'Grid',diagonal:'Diagonal',stripes:'Stripes',checker:'Checker',plaid:'Plaid',zigzag:'Zigzag',waves:'Waves',hex:'Honeycomb',topo:'Topographic',confetti:'Confetti'};
const CARD_TYPES=['services','testimonials','contact','booking','shop','map','hero'];
function bgDefaults(){const c=state.brand.colors;return{color:'',grad:false,g1:c.p,g2:c.a,angle:135,gtype:'linear',gop:60,tex:'none',tc:c.tx,top:18,tsize:24,card:'',cop:100,photo:null,pop:100,fdir:'none',famt:50,timg:null,tblend:'normal'}}
function bgOf(target){if(target==='page')return state.brand.bg;const s=sec(target.slice(4));return s&&s.bg}
function bgEnsure(target){if(target==='page'){if(!state.brand.bg)state.brand.bg=bgDefaults();return state.brand.bg}const s=sec(target.slice(4));if(!s.bg)s.bg=bgDefaults();return s.bg}
const alpha=(h,op)=>isHex(h)?`color-mix(in srgb,${h} ${Math.max(0,Math.min(100,+op))}%,transparent)`:'transparent';
function texCss(t,c,sz){sz=Math.max(8,+sz||24);const k=sz/24;const svg=x=>`url("data:image/svg+xml,${encodeURIComponent(x)}")`;
 const rgb=isHex(c)?[1,3,5].map(i=>(parseInt(c.slice(i,i+2),16)/255).toFixed(3)):[0,0,0];
 /* tintable noise tile: turbulence alpha mapped to the texture color */
 const noise=(o)=>{const w=Math.round((o.w||160)*k),h=Math.round((o.h||o.w||160)*k);return `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${o.w||160} ${o.h||o.w||160}' preserveAspectRatio='none'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='${o.type||'fractalNoise'}' baseFrequency='${o.f}' numOctaves='${o.oct||2}' seed='${o.seed||3}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  ${o.m||'0 0 0 1.4 -.4'}'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)} 0 0/${w}px ${h}px`};
 switch(t){case'dots':return `radial-gradient(${c} 1.5px,transparent 1.8px) 0 0/${sz}px ${sz}px`;
  case'halftone':return `radial-gradient(${c} 30%,transparent 33%) 0 0/${sz/2}px ${sz/2}px,radial-gradient(${c} 18%,transparent 21%) ${sz/4}px ${sz/4}px/${sz/2}px ${sz/2}px`;
  case'grid':return `linear-gradient(${c} 1px,transparent 1px) 0 0/${sz}px ${sz}px,linear-gradient(90deg,${c} 1px,transparent 1px) 0 0/${sz}px ${sz}px`;
  case'diagonal':return `repeating-linear-gradient(45deg,${c} 0 2px,transparent 2px ${sz/2}px)`;
  case'stripes':return `repeating-linear-gradient(0deg,${c} 0 ${sz/4}px,transparent ${sz/4}px ${sz/2}px)`;
  case'checker':return `repeating-conic-gradient(${c} 0 25%,transparent 0 50%) 0 0/${sz}px ${sz}px`;
  case'plaid':return `repeating-linear-gradient(0deg,${c} 0 ${sz/6}px,transparent ${sz/6}px ${sz/2}px,${c} ${sz/2}px ${sz/2+2}px,transparent ${sz/2+2}px ${sz}px),repeating-linear-gradient(90deg,${c} 0 ${sz/6}px,transparent ${sz/6}px ${sz/2}px,${c} ${sz/2}px ${sz/2+2}px,transparent ${sz/2+2}px ${sz}px)`;
  case'zigzag':return `linear-gradient(135deg,${c} 25%,transparent 25%) ${-sz/2}px 0/${sz}px ${sz}px,linear-gradient(225deg,${c} 25%,transparent 25%) ${-sz/2}px 0/${sz}px ${sz}px,linear-gradient(315deg,${c} 25%,transparent 25%) 0 0/${sz}px ${sz}px,linear-gradient(45deg,${c} 25%,transparent 25%) 0 0/${sz}px ${sz}px`;
  case'linen':return `repeating-linear-gradient(45deg,${c} 0 1px,transparent 1px ${Math.max(3,sz/5)}px),repeating-linear-gradient(-45deg,${c} 0 1px,transparent 1px ${Math.max(3,sz/5)}px)`;
  case'canvas':return `repeating-linear-gradient(0deg,${c} 0 1px,transparent 1px ${Math.max(3,sz/6)}px),repeating-linear-gradient(90deg,${c} 0 1px,transparent 1px ${Math.max(3,sz/6)}px),${noise({f:'.8',oct:1,m:'0 0 0 .9 -.3',w:120})}`;
  case'waves':return `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='${sz*2}' height='${sz}' viewBox='0 0 48 24'><path d='M0 12c6 0 6-8 12-8s6 8 12 8 6-8 12-8 6 8 12 8' fill='none' stroke='${c}' stroke-width='2'/></svg>`)} 0 0/${sz*2}px ${sz}px`;
  case'hex':return `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'><path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='${c}'/></svg>`)} 0 0/${sz*1.17}px ${sz*2.04}px`;
  case'topo':return `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><g fill='none' stroke='${c}' stroke-width='1.3'><path d='M30 100c0-40 30-70 72-68s68 34 64 72-40 62-76 58S30 140 30 100z'/><path d='M52 100c0-28 22-50 50-48s46 24 44 50-28 44-54 42-40-18-40-44z'/><path d='M74 100c0-16 12-28 28-27s26 14 25 29-16 25-30 24-23-11-23-26z'/><path d='M94 99c0-5 4-8 8-8s8 4 8 9-5 8-9 8-7-4-7-9z'/><path d='M-20 20c40-10 60 20 100 0s70-40 140-10M-20 190c50 10 80-20 120-10s80 30 120 0'/><path d='M-20 170c40 8 70-14 110-6s90 20 130-6'/></g></svg>`)} 0 0/${sz*8}px ${sz*8}px`;
  case'terrazzo':return `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='${c}'><path d='M10 14l9-4 4 7-8 5z'/><path d='M60 8l11 3-3 9-10-3z'/><path d='M96 30l9 5-5 8-8-6z'/><path d='M30 50l6-7 8 4-5 9z'/><path d='M76 62l12-2 1 9-11 2z'/><path d='M14 90l10 2-2 10-9-3z'/><path d='M52 100l7-6 7 6-7 6z'/><path d='M100 96l8 4-4 8-8-5z'/><circle cx='46' cy='26' r='2.5'/><circle cx='88' cy='12' r='1.8'/><circle cx='18' cy='66' r='2'/><circle cx='64' cy='80' r='2.2'/><circle cx='108' cy='70' r='1.6'/><circle cx='36' cy='112' r='1.8'/><circle cx='84' cy='112' r='2.4'/></g></svg>`)} 0 0/${sz*5}px ${sz*5}px`;
  case'confetti':return `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><g fill='${c}'><circle cx='8' cy='10' r='2.5'/><rect x='34' y='6' width='9' height='3' rx='1.5' transform='rotate(30 38 8)'/><circle cx='50' cy='40' r='2'/><rect x='14' y='38' width='8' height='3' rx='1.5' transform='rotate(-35 18 40)'/><path d='M30 28l3 5h-6z'/></g></svg>`)} 0 0/${sz*2.5}px ${sz*2.5}px`;
  case'grain':return noise({f:'.9',oct:2,w:160});
  case'paper':return `${noise({f:'.65',oct:2,m:'0 0 0 1.1 -.45',w:160})},${noise({f:'.03',oct:4,m:'0 0 0 1.6 -.75',w:300,seed:7})}`;
  case'concrete':return `${noise({f:'.012',oct:5,m:'0 0 0 2.2 -.9',w:400,seed:11})},${noise({f:'.7',oct:2,m:'0 0 0 1.3 -.5',w:160})}`;
  case'stone':return noise({type:'turbulence',f:'.02',oct:6,m:'0 0 0 2.4 -1',w:400,seed:5});
  case'marble':return noise({type:'turbulence',f:'.004 .012',oct:5,m:'0 0 0 -3.2 1.4',w:600,seed:9});
  case'wood':return noise({type:'turbulence',f:'.005 .16',oct:3,m:'0 0 0 2.2 -.8',w:400,seed:2});
  default:return''}}
/* inline style for a target: base color, gradient (alpha-mixed so its opacity is independent), texture layer via ::after */
function bgStyle(bg){if(!bg)return'';let st='';
 if(bg.color&&isHex(bg.color))st+=`background-color:${bg.color};`;
 if(bg.grad){const a=alpha(bg.g1,bg.gop),b=alpha(bg.g2,bg.gop);st+=`background-image:${bg.gtype==='radial'?`radial-gradient(circle at 30% 20%,${a},${b})`:`linear-gradient(${+bg.angle||0}deg,${a},${b})`};`}
 if(bg.photo){const m=fadeMask(bg.fdir,bg.famt);st+=`--ph-l:url("${bg.photo}");--ph-o:${(bg.pop==null?100:+bg.pop)/100};${m?`--ph-m:${m};`:''}`}
 const tl=texLayer(bg);if(tl)st+=`--tx-l:${tl};--tx-o:${(+bg.top||0)/100};--tx-b:${bg.tex==='custom'&&TBLEND[bg.tblend]?bg.tblend:'normal'};`;
 if(bg.card&&isHex(bg.card))st+=`--card-bg:${alpha(bg.card,bg.cop)};`;
 return st}
function bgClasses(bg){if(!bg)return'';return [texLayer(bg)?'bgx-t':'',bg.photo?'bgx-p':'',bg.card&&isHex(bg.card)?'bgx-c':''].filter(Boolean).join(' ')}
const TBLEND={normal:'Normal',multiply:'Multiply',overlay:'Overlay','soft-light':'Soft light',screen:'Screen'};
function texLayer(bg){if(!bg||!bg.tex||bg.tex==='none')return'';if(bg.tex==='custom')return bg.timg?`url("${bg.timg}") 0 0/${Math.round(Math.max(8,+bg.tsize||24)*8)}px auto`:'';return texCss(bg.tex,isHex(bg.tc)?bg.tc:'#000000',bg.tsize)}
function fadeMask(d,a){a=Math.max(0,Math.min(100,+a||0));if(!d||d==='none'||!a)return'';const s=100-a;
 if(d==='bottom')return `linear-gradient(to bottom,#000 ${s}%,transparent)`;if(d==='top')return `linear-gradient(to top,#000 ${s}%,transparent)`;
 if(d==='left')return `linear-gradient(to left,#000 ${s}%,transparent)`;if(d==='right')return `linear-gradient(to right,#000 ${s}%,transparent)`;
 if(d==='sides')return `linear-gradient(to right,transparent,#000 ${a/2}%,#000 ${100-a/2}%,transparent)`;return `radial-gradient(ellipse at center,#000 ${Math.max(0,s-20)}%,transparent 72%)`}
function bgApply(html,s){if(!s.bg)return html;const st=bgStyle(s.bg),cl=bgClasses(s.bg);if(!st)return html;
 return html.replace(/^<section( class="([^"]*)")?/,(m,a,c)=>`<section class="${c||''} ${cl}" style="${esc(st)}"`)}
function bgActive(bg){return !!bg&&(!!bg.color||bg.grad||(bg.tex&&bg.tex!=='none')||!!bg.card||!!bg.photo)}
function bgPanel(target,title,withCards){const has=bgOf(target),bg=has||bgDefaults();const id=target.replace(/[^a-z0-9]/gi,'');const B=(k,extra='')=>`data-bgx="${target}|${k}" ${extra}`;
 const rng=(k,label,min,max,unit,val)=>`<label class="bgx-r"><span>${label}<b>${val}${unit}</b></span><input type="range" id="bg-${id}-${k}" min="${min}" max="${max}" value="${val}" ${B(k)}></label>`;
 const col=(k,label)=>`<label class="bgx-c"><input type="color" id="bg-${id}-${k}" value="${isHex(bg[k])?bg[k]:'#888888'}" ${B(k)}><span>${label}</span></label>`;
 const seg=(k,opts)=>`<div class="seg sm bgx-seg">${Object.entries(opts).map(([v,l])=>`<button type="button" ${B(k)} data-v="${v}" class="${(bg[k]||Object.keys(opts)[0])===v?'on':''}">${l}</button>`).join('')}</div>`;
 return `<details class="bgx"${bgActive(has)?' open':''}><summary>${ic('spark',14)} ${title}${bgActive(has)?'<span class="badge acc">On</span>':''}</summary><div class="bgx-in">
 <div class="bgx-row"><span class="bgx-lab">Background photo</span></div>${imgField(`bgx:${target}|photo`,bg.photo)}
 ${bg.photo?`<div class="bgx-sub"><div class="bgx-cols"><label class="bgx-c"><input type="color" id="bg-${id}-color" value="${isHex(bg.color)?bg.color:(target==='page'?state.brand.colors.bg:state.brand.colors.sf)}" ${B('color')}><span>Color behind the photo</span></label></div>${rng('pop','Photo opacity',0,100,'%',bg.pop==null?100:bg.pop)}<div class="bgx-row"><span class="bgx-lab">Fade</span></div>${seg('fdir',{none:'None',bottom:'Bottom',top:'Top',sides:'Sides',edges:'Edges'})}${bg.fdir&&bg.fdir!=='none'?rng('famt','Fade amount',0,100,'%',bg.famt==null?50:bg.famt):''}</div>`:
 `<div class="bgx-row"><label class="bgx-sw"><input type="checkbox" id="bg-${id}-colon" ${B('coloron')} ${bg.color?'checked':''}><i></i><span>Custom color</span></label>${bg.color?col('color','Color'):''}</div>`}
 <div class="bgx-row"><label class="bgx-sw"><input type="checkbox" id="bg-${id}-grad" ${B('grad')} ${bg.grad?'checked':''}><i></i><span>Gradient</span></label></div>
 ${bg.grad?`<div class="bgx-sub"><div class="bgx-cols">${col('g1','From')}${col('g2','To')}<div class="seg sm">${[['linear','Linear'],['radial','Radial']].map(([k,l])=>`<button type="button" ${B('gtype')} data-v="${k}" class="${bg.gtype===k?'on':''}">${l}</button>`).join('')}</div></div>${bg.gtype==='linear'?rng('angle','Angle',0,360,'°',bg.angle):''}${rng('gop','Strength',0,100,'%',bg.gop)}</div>`:''}
 <div class="bgx-row"><span class="bgx-lab">Texture</span></div>
 <div class="tex-grid">${Object.entries(TEXTURES).map(([k,l])=>`<button type="button" class="tex${(bg.tex||'none')===k?' on':''}" ${B('tex')} data-v="${k}" title="${l}"><span class="tex-sw" style="${k==='none'?'':esc(`background:${texCss(k,'#555',16)}`)}"></span><small>${l}</small></button>`).join('')}<button type="button" class="tex tex-up${bg.tex==='custom'?' on':''}" ${bg.timg?`${B('tex')} data-v="custom"`:`data-pick="bgx:${target}|timg"`} title="Use your own image as a texture"><span class="tex-sw" style="${bg.timg?esc(`background:url("${bg.timg}") center/cover`):''}">${bg.timg?'':'<b>+</b>'}</span><small>${bg.timg?'Your image':'Upload'}</small></button></div>
 ${bg.tex&&bg.tex!=='none'?`<div class="bgx-sub">${bg.tex==='custom'?`<div class="bgx-cols"><button type="button" class="btn sm" data-pick="bgx:${target}|timg">${ic('camera',13)} Change image</button><button type="button" class="btn sm" data-imgclear="bgx:${target}|timg">Remove</button></div><div class="bgx-row"><span class="bgx-lab">Blend</span></div>${seg('tblend',TBLEND)}`:`<div class="bgx-cols">${col('tc','Texture color')}</div>`}${rng('top','Intensity',0,100,'%',bg.top)}${rng('tsize','Size',8,120,'px',bg.tsize)}<p class="hint" style="margin:0">Drag the sliders and watch the page change.</p></div>`:''}
 ${withCards?`<div class="bgx-row"><label class="bgx-sw"><input type="checkbox" id="bg-${id}-cardon" ${B('cardon')} ${bg.card?'checked':''}><i></i><span>Card and panel color</span></label></div>${bg.card?`<div class="bgx-sub"><div class="bgx-cols">${col('card','Cards')}</div>${rng('cop','Opacity',0,100,'%',bg.cop)}</div>`:''}`:''}
 <div class="bgx-act">${target!=='page'?`<button type="button" class="btn sm" data-bgxall="${target}" ${has?'':'disabled'}>Use on every section</button>`:''}<button type="button" class="btn sm" data-bgxreset="${target}" ${has?'':'disabled'}>Reset</button></div>
 </div></details>`}
function setBgx(target,key,val,fromRange){const bg=bgEnsure(target);
 if(key==='coloron'){bg.color=val?(target==='page'?state.brand.colors.bg:state.brand.colors.sf):''}
 else if(key==='cardon'){bg.card=val?state.brand.colors.bg:''}
 else if(['angle','gop','top','tsize','cop','pop','famt'].includes(key))bg[key]=+val;
 else bg[key]=val;
 if(fromRange){const lab=document.querySelector(`[data-bgx="${target}|${key}"]`);const b=lab&&lab.closest('.bgx-r')?.querySelector('b');if(b)b.textContent=val+(key==='angle'?'°':key==='tsize'?'px':'%');
  if(bgLive(target,bg)){save();clearTimeout(bgT);bgT=setTimeout(soft,400);return}}
 save();soft()}
let bgT=0;
function bgLive(target,bg){const site=$('#site');if(!site)return false;let el;if(target==='page'){el=site;el.setAttribute('style',siteVars(state.brand)+';'+bgStyle(bg));el.classList.toggle('bgx-t',!!texLayer(bg));el.classList.toggle('bgx-p',!!bg.photo);return true}
 el=site.querySelector(`[data-sec="${target.slice(4)}"] section`);if(!el)return false;el.setAttribute('style',bgStyle(bg));el.classList.toggle('bgx-t',!!texLayer(bg));el.classList.toggle('bgx-p',!!bg.photo);el.classList.toggle('bgx-c',!!(bg.card&&isHex(bg.card)));return true}

function paintSite(el,edit){const cv=edit?el.closest('#canvas'):null,st=cv?cv.scrollTop:0,h=el.offsetHeight;if(cv&&h){el.style.minHeight=h+'px'}
 paintSite0(el,edit);if(cv){el.style.minHeight=h+'px';cv.scrollTop=st;if(FS&&Date.now()<FS.until){const f=FS;FS=null;focusSection(f.id,true)}clearTimeout(el._mh);el._mh=setTimeout(()=>{el.style.minHeight=''},900)}}
function paintSite0(el,edit){el.setAttribute('style',siteVars(state.brand)+';'+bgStyle(state.brand.bg));el.classList.toggle('bgx-t',!!texLayer(state.brand.bg));el.classList.toggle('bgx-p',!!(state.brand.bg&&state.brand.bg.photo));el.dataset.look=state.brand.look||'standard';el.innerHTML=renderSite(edit);startSlides(el);if(el.querySelector('.st-mini'))requestAnimationFrame(fitObMinis)}
function startSlides(root){(root._t||[]).forEach(clearInterval);root._t=[];
 $$('[data-ss]',root).forEach(el=>{const n=$$('.ss-slide',el).length;if(n<2)return;const sec=Math.max(1.5,+el.dataset.int||4);
  root._t.push(setInterval(()=>{if(document.hidden||!el.isConnected||el.matches(':hover')||el.contains(document.activeElement)||Date.now()-(el._tap||0)<8000)return;ssGo(el,(ssIdx[el.dataset.ss]||0)+1)},sec*1000))})}
function ssGo(el,i){const sl=$$('.ss-slide',el),n=sl.length;if(!n)return;i=((i%n)+n)%n;ssIdx[el.dataset.ss]=i;
 sl.forEach((s,k)=>{s.classList.toggle('on',k===i);const vd=s.querySelector('video');if(vd){if(k===i){try{vd.currentTime=0;vd.play().catch(()=>{})}catch(e){}}else vd.pause()}});$$('.ss-ind [data-ss-to]',el).forEach((d,k)=>{d.classList.toggle('on',k===i);d.classList.toggle('past',k<i)});const cu=el.querySelector('.ss-cur');if(cu)cu.textContent=i+1;
 const sc=el.closest('section');if(sc){$$('[data-ss-li]',sc).forEach((li,k)=>li.classList.toggle('on',k===i));$$('.ss-th',sc).forEach((li,k)=>li.classList.toggle('on',k===i))}}

/* ---------- toasts, history ---------- */
function toast(msg,action){const t=document.createElement('div');t.className='toast';t.innerHTML=`<span>${esc(msg)}</span>`;
 if(action){const b=document.createElement('button');b.textContent=action.label;b.onclick=()=>{action.fn();t.remove()};t.appendChild(b)}
 const box=$('#toasts');box.appendChild(t);const max=innerWidth<=700?1:2;while(box.children.length>max)box.firstElementChild.remove();setTimeout(()=>t.remove(),action?6500:(innerWidth<=700?2400:3200))}
const hist=[];
var fut=[],FUT_AT=null,DIRTY=false;
function histState(){return JSON.stringify({sections:state.sections,pages:pagesCopy(),pageId:state.pageId,brand:state.brand,announce:state.announce,hours:state.hours})}
function snap(){const c=histState();if(hist[hist.length-1]===c)return;hist.push(c);if(hist.length>40)hist.shift();DIRTY=true;if(fut.length&&c!==FUT_AT)fut.length=0;histBtns()}
function undo(){const c=histState();let s;do{s=hist.pop()}while(s===c&&hist.length);if(!s||s===c){histBtns();return}if(fut[fut.length-1]!==c)fut.push(c);Object.assign(state,JSON.parse(s));FUT_AT=histState();DIRTY=true;histBtns();hard()}
function redo(){if(!fut.length)return;const c=histState();if(FUT_AT&&c!==FUT_AT&&hist[hist.length-1]!==FUT_AT){fut.length=0;histBtns();return}const s=fut.pop();if(hist[hist.length-1]!==c)hist.push(c);Object.assign(state,JSON.parse(s));FUT_AT=histState();DIRTY=true;histBtns();hard()}

/* ---------- render scheduling ---------- */
let softQ=false;
function soft(){if(softQ)return;softQ=true;requestAnimationFrame(()=>{softQ=false;renderSites();renderCartPill();save()})}
function hard(){renderCurrent();renderCartPill();save()}
function renderSites(){if(state.tab==='builder'&&state.onboarded){const a=document.activeElement;if(a&&a.closest&&a.closest('#site [data-edit],#site [data-editb]'))return;paintSite($('#site'),true);renderUrl()}if(state.tab==='dashboard'&&$('#miniSite'))paintSite($('#miniSite'),false)}
function renderCurrent(){
 $$('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===state.tab));
 const view=state.tab==='builder'&&!state.onboarded?'start':state.tab;
 ['builder','designs','dashboard','plans','admin','start'].forEach(v=>$('#v-'+v).hidden=v!==view);
 if(view==='start')renderStart();else if(state.tab==='designs')renderDesigns();else if(state.tab==='builder')renderBuilder();else if(state.tab==='dashboard')renderDashboard();else if(state.tab==='plans')renderPlans();else renderAdmin();
}
function renderCartPill(){const c=cartCalc();$('#cartPill').innerHTML=`<span>${esc(c.t.name)}${hasPOS()?' + POS':''}</span><b class="num">${money(c.annual?c.yearly:c.monthly)}/${c.annual?'yr':'mo'} · ${money(c.setup)} once</b>`}
function renderUrl(){const ps=pageSlug(curPage());$('#urlbar').textContent=`https://${hasAddon('domain')?slug(state.brand.name)+'.com':slug(state.brand.name)+'.'+admin.domain}${ps?'/'+ps:''}`}

/* ---------- builder ---------- */
function renderBuilder(){
 $('#fLib').hidden=!state.libOpen;$('#fInsp').hidden=!state.inspOpen;sheetState();$('#coach').hidden=!state.coach||(isNarrow()&&(state.libOpen||state.inspOpen));
 [['#tglLib',state.libOpen],['#tglInsp',state.inspOpen]].forEach(([s,on])=>{const b=$(s);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 $('#deviceSeg').innerHTML=[['desktop','Computer'],['tablet','Tablet'],['phone','Phone']].map(([k,l])=>`<button type="button" data-device="${k}" class="${state.device===k?'on':''}" aria-label="${l}" title="${l}">${ic(k,15)}<span>${l}</span></button>`).join('');
 $('#device').dataset.device=state.device;requestAnimationFrame(fitDevice);histBtns();
 const dk=state.brand.mode==='dark',mb=$('#modeBtn');mb.innerHTML=`${ic(dk?'moon':'sun',15)}<span>${dk?'Dark':'Light'}</span>`;mb.setAttribute('aria-label',`Showing the ${dk?'dark':'light'} version. Switch to ${dk?'light':'dark'}`);mb.title=`Switch to the ${dk?'light':'dark'} version`;
 renderLibrary();renderList();renderInspector();paintSite($('#site'),true);renderUrl();renderPagebar()}
function renderLibrary_v1(){
 $('#library').innerHTML=Object.entries(CATALOG).filter(([t])=>rule(t).enabled).map(([t,c])=>{const ad=rule(t).addon,a=ad&&addonById(ad);const owned=ad&&hasAddon(ad);
  return `<div class="libitem" draggable="true" data-new="${t}">${thumb(t)}<span class="libtxt"><b>${esc(c.name)}</b><small>${esc(t==='shop'&&hasPOS()?'Synced with your POS register':c.desc)}</small>${a?`<span class="badge ${owned?'ok':'gold'}">${owned?'In your plan':'Add-on '+money(a.price)+(a.billing==='monthly'?'/mo':'')}</span>`:''}</span><button type="button" class="iconbtn" data-add="${t}" aria-label="Add ${esc(c.name)}">${ic('plus',18)}</button></div>`}).join('')}
function renderList(){const t=curTier();const vis=state.sections.filter(s=>!s.hidden).length;
 $('#secMeter').innerHTML=`<span class="meter ${vis>t.maxSections?'over':''} num">${vis} of ${t.maxSections} on ${esc(t.name)}</span>`;
 $('#secList').innerHTML=state.sections.map((s,i)=>`<li class="secitem${s.id===state.selected?' sel':''}${s.hidden?' is-hidden':''}" draggable="true" data-id="${s.id}"><span class="grip">${ic('grip',14)}</span><button type="button" class="secname" data-select="${s.id}"><b>${esc(CATALOG[s.type].name)}</b><small>${esc(CATALOG[s.type].variants[s.variant]||'')}${s.hidden?' · hidden':''}</small></button><button type="button" class="iconbtn" data-sact="hide" title="${s.hidden?'Show':'Hide'}">${ic(s.hidden?'eyeOff':'eye',15)}</button><button type="button" class="iconbtn" data-sact="up" ${i===0?'disabled':''} title="Move up">${ic('up',15)}</button><button type="button" class="iconbtn" data-sact="down" ${i===state.sections.length-1?'disabled':''} title="Move down">${ic('down',15)}</button><button type="button" class="iconbtn" data-sact="del" title="Delete">${ic('trash',15)}</button></li>`).join('');
 const nxt=admin.tiers.find(x=>x.maxSections>=vis&&x.monthly>t.monthly);
 $('#limitNote').innerHTML=vis>t.maxSections?`<div class="limit-note"><span>Your page has ${vis} sections. The ${esc(t.name)} plan publishes up to ${t.maxSections}.</span>${nxt?`<button class="btn sm" data-settier="${nxt.id}">Switch to ${esc(nxt.name)} · ${money(nxt.monthly)}/mo</button>`:''}</div>`:''}
function imgField(target,v,isLogo){return `<div class="imgf${isLogo?' logo':''}" data-drop-img="${target}">${v?mediaHtml(v,true):`<span class="imgf-empty">${ic('camera',20)}</span>`}<div class="imgf-txt"><span>${v?'Drop a new file to replace':'Drop a file here or'}</span><div class="imgf-btns"><button type="button" class="btn sm" data-pick="${target}">${v?ic('camera',13)+' Replace':isLogo?ic('camera',13)+' Upload':'<b class="plus">+</b> Photo or video'}</button>${v?`<button type="button" class="btn sm" data-imgclear="${target}">Remove</button>`:''}</div></div></div>`}
function hoursEditor(){return `<div class="hours-ed">${state.hours.map((h,i)=>`<b>${DAYS[i]}</b><input type="time" id="h-open-${i}" aria-label="${DAYS[i]} opens" value="${h.open}" data-bind="hours.${i}.open" ${h.closed?'disabled':''}><input type="time" id="h-close-${i}" aria-label="${DAYS[i]} closes" value="${h.close}" data-bind="hours.${i}.close" ${h.closed?'disabled':''}><label><input type="checkbox" id="h-closed-${i}" data-bind="hours.${i}.closed" ${h.closed?'checked':''}> Closed</label>`).join('')}</div>`}
function fieldHtml(s,f,prefix){const[k,label,type,sub]=f;const path=prefix?prefix+'.'+k:k;const v=getPath(s.data,path);const id=`f-${s.id}-${path.replace(/\./g,'-')}`;const sf=`${s.id}|${path}`;
 if(type==='text')return `<label class="fld"><span>${label}</span><input type="text" id="${id}" data-sf="${sf}" value="${esc(v)}"></label>`;
 if(type==='textarea')return `<label class="fld"><span>${label}</span><textarea id="${id}" data-sf="${sf}">${esc(v)}</textarea></label>`;
 if(type==='number')return `<label class="fld"><span>${label}</span><input type="number" id="${id}" data-sf="${sf}" data-num value="${esc(v)}"></label>`;
 if(type==='select')return `<label class="fld"><span>${label}</span><select id="${id}" data-sf="${sf}">${Object.entries(sub).map(([k,l])=>`<option value="${k}"${(v||Object.keys(sub)[0])===k?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
 if(type==='image')return `<div class="fld"><span>${label}</span>${imgField(`${s.id}:${path}`,v)}</div>`;
 if(type==='hours')return `<div class="fld"><span>${label} (shared with your dashboard)</span>${hoursEditor()}</div>`;
 if(type==='gallery')return `<div class="fld"><span>${label}</span><div class="gal-edit">${(v||[]).map((x,i)=>`<div data-drop-img="${s.id}:${path}.${i}" ${x?'':`data-pick="${s.id}:${path}.${i}" style="cursor:pointer"`}>${x?`<img src="${x}" alt="">`:ic('camera',18)}<button type="button" data-gdel="${s.id}|${path}|${i}" aria-label="Remove photo">${ic('x',12)}</button></div>`).join('')}</div><label class="btn sm" style="justify-self:start">${ic('plus',13)} Add photos<input type="file" accept="image/*" multiple hidden data-gadd="${s.id}|${path}"></label></div>`;
 if(type==='portfolio')return pfEditor(s);
 if(type==='list'){const arr=v||[];return `<div class="fld"><span>${label}</span>${arr.map((it,i)=>`<div class="li"><div class="li-h"><b>${esc(label.replace(/s$/,''))} ${i+1}</b><span class="row" style="gap:2px"><button type="button" class="iconbtn" data-limove="${s.id}|${path}|${i}|-1" ${i===0?'disabled':''} aria-label="Move up">${ic('up',14)}</button><button type="button" class="iconbtn" data-limove="${s.id}|${path}|${i}|1" ${i===arr.length-1?'disabled':''} aria-label="Move down">${ic('down',14)}</button><button type="button" class="iconbtn" data-lidel="${s.id}|${path}|${i}" aria-label="Remove">${ic('trash',14)}</button></span></div>${sub.map(sf2=>fieldHtml(s,sf2,`${path}.${i}`)).join('')}</div>`).join('')}<button type="button" class="btn sm" data-liadd="${s.id}|${path}" style="justify-self:start">${ic('plus',13)} Add ${esc(label.replace(/s$/,'').toLowerCase())}</button></div>`}
 return ''}
function renderInspector(){
 $$('#rtSeg button').forEach(b=>b.classList.toggle('on',b.dataset.rt===state.rightTab));
 const el=$('#inspector');bizDot();requestAnimationFrame(fitObMinis);
 if(state.rightTab==='info'){el.innerHTML=renderInfo();return}
 if(state.rightTab==='section'){const s=sec(state.selected);
  if(!s){el.innerHTML=`<div class="empty">${ic('edit',26)}<b>Pick a section to edit</b><p>Click any part of the preview, or a section in the list.</p></div>`;return}
  const c=CATALOG[s.type],r=rule(s.type),needs=r.addon&&!hasAddon(r.addon)?addonById(r.addon):null;
  el.innerHTML=`<div class="insp-head"><h3>${esc(c.name)}<span class="row" style="gap:2px"><button type="button" class="iconbtn" data-sact2="dup" title="Duplicate">${ic('copy',15)}</button><button type="button" class="iconbtn" data-sact2="hide" title="${s.hidden?'Show':'Hide'}">${ic(s.hidden?'eyeOff':'eye',15)}</button><button type="button" class="iconbtn" data-sact2="del" title="Delete">${ic('trash',15)}</button></span></h3>${Object.keys(c.variants).length>1?`<div><div class="sectitle" style="margin-top:0">Layout</div><div class="seg">${Object.entries(c.variants).map(([k,l])=>`<button type="button" data-variant="${k}" class="${s.variant===k?'on':''}">${esc(l)}</button>`).join('')}</div></div>`:''}</div>${needs?`<div class="lock-note"><span>This section needs the <b>${esc(needs.name)}</b> add-on to go live.</span><button class="btn sm gold" data-cartadd="${needs.id}" style="justify-self:start">Add for ${money(needs.price)}${needs.billing==='monthly'?'/mo':''}</button></div>`:''}${s.type==='shop'&&!hasPOS()?`<div class="lock-note"><span>Add a POS plan and your register stock and prices sync with this store automatically.</span><button class="btn sm" data-tab="plans" style="justify-self:start">See POS plans</button></div>`:''}${btnsPanel(s)}${bgPanel('sec:'+s.id,'Background, gradient and texture',CARD_TYPES.includes(s.type))}${FIELDS[s.type].map(f=>fieldHtml(s,f,'')).join('')}`;return}
 const b=state.brand,lm=addonById('logomaker');
 el.innerHTML=`${styleTop()}
 <label class="fld"><span>Business name</span><input type="text" id="b-name" data-bind="brand.name" value="${esc(b.name)}"></label>
 <label class="fld"><span>Tagline</span><input type="text" id="b-tag" data-bind="brand.tagline" value="${esc(b.tagline)}"></label>
 <div class="fld"><span>Logo</span>${imgField('brand:logo',b.logo,true)}</div>
 ${lm&&lm.enabled?`<button type="button" class="btn" data-logomaker style="width:100%;margin-bottom:12px">${ic('spark',15)} Create a logo in the logo maker <span class="badge ${hasAddon('logomaker')?'ok':'gold'}">${hasAddon('logomaker')?'Unlocked':money(lm.price)+' once'}</span></button>`:''}
 <label class="fld"><span>Logo size · <span class="num">${b.logoSize}px</span></span><input type="range" id="b-logosize" min="28" max="84" value="${b.logoSize}" data-bind="brand.logoSize" data-num></label>
 <label class="switch" style="margin-bottom:6px"><input type="checkbox" id="b-showname" data-bind="brand.showName" ${b.showName?'checked':''}><i></i> Show business name next to logo</label>
 <div class="sectitle">Theme</div>
 <div class="themes">${Object.entries(THEMES).filter(([k])=>admin.themes[k]!==false).map(([k,t])=>`<button type="button" class="theme${b.theme===k?' on':''}" data-theme-pick="${k}"><span class="sw">${['p','a','sf','bg'].map(c=>`<span style="background:${t.colors[c]}"></span>`).join('')}</span><span class="between"><b>${t.name}</b><small style="font-family:${FONTS[t.font].h}">Aa</small></span></button>`).join('')}</div>
 <div class="sectitle">Colors</div>
 <div class="colors">${[['p','Main'],['a','Accent'],['bg','Page'],['sf','Panels'],['tx','Text']].map(([k,l])=>`<label>${l}<input type="color" id="c-${k}" value="${b.colors[k]}" data-bind="brand.colors.${k}"></label>`).join('')}</div>
 <button type="button" class="btn sm" data-resetcolors style="margin-top:8px">Reset to theme colors</button>
 <div class="sectitle">Fonts</div>
 <label class="fld"><select id="b-font" data-bind="brand.font" aria-label="Font pairing">${Object.entries(FONTS).map(([k,f])=>`<option value="${k}" ${b.font===k?'selected':''}>${f.name}</option>`).join('')}</select></label>
 <div class="sectitle">Shape</div>
 <label class="fld"><span>Corner roundness · <span class="num">${b.radius}px</span></span><input type="range" id="b-radius" min="0" max="28" value="${b.radius}" data-bind="brand.radius" data-num></label>
 <div class="fld"><span>Buttons</span><div class="seg">${[['square','Square'],['rounded','Rounded'],['pill','Pill']].map(([k,l])=>`<button type="button" data-brandset="btn|${k}" class="${b.btn===k?'on':''}">${l}</button>`).join('')}</div></div>
 <div class="fld"><span>Header layout</span><div class="seg">${[['left','Logo left'],['center','Centered'],['call','Call button']].map(([k,l])=>`<button type="button" data-brandset="header|${k}" class="${b.header===k?'on':''}">${l}</button>`).join('')}</div></div>
 <div class="sectitle">Top banner</div>
 <p class="hint">${state.announce.on&&state.announce.text?`Showing: “${esc(state.announce.text)}”`:'Off. Add a short message, like a sale or new hours.'}</p>
 <button type="button" class="btn sm" data-annopen style="width:100%">${ic('edit',14)} ${state.announce.on&&state.announce.text?'Edit the banner':'Add a banner message'}</button>`}

/* section operations */
function insertSection(type,index){const r=rule(type);if(!r.enabled)return;snap();state.started=true;const s=smartSection(type);
 if(index==null||index<0||index>state.sections.length)index=state.sections.length;state.sections.splice(index,0,s);state.selected=s.id;state.rightTab='section';
 if(r.addon&&!hasAddon(r.addon)){const a=addonById(r.addon);if(a){state.cart.addons.push(a.id);toast(`${a.name} added to your plan (${money(a.price)}${a.billing==='monthly'?'/mo':''})`,{label:'Remove',fn:()=>{state.cart.addons=state.cart.addons.filter(x=>x!==a.id);hard()}})}}
 else toast(`${CATALOG[type].name} added`);
 hard();requestAnimationFrame(()=>{const el=$(`#site [data-sec="${s.id}"]`);if(el)el.scrollIntoView({behavior:'smooth',block:'center'})})}
function moveSection(id,to){const i=state.sections.findIndex(s=>s.id===id);if(i<0)return;snap();const[s]=state.sections.splice(i,1);if(to>i)to--;to=Math.max(0,Math.min(state.sections.length,to));state.sections.splice(to,0,s);hard()}
function sectionAct(id,act){const i=state.sections.findIndex(s=>s.id===id);const s=state.sections[i];if(!s)return;
 if(act==='up'&&i>0){snap();[state.sections[i-1],state.sections[i]]=[state.sections[i],state.sections[i-1]]}
 else if(act==='down'&&i<state.sections.length-1){snap();[state.sections[i+1],state.sections[i]]=[state.sections[i],state.sections[i+1]]}
 else if(act==='hide'){snap();s.hidden=!s.hidden}
 else if(act==='del'){snap();state.sections.splice(i,1);if(state.selected===id)state.selected=null;toast(`${CATALOG[s.type].name} removed`,{label:'Undo',fn:undo})}
 else if(act==='dup'){snap();const c=clone(s);c.id=uid();state.sections.splice(i+1,0,c);state.selected=c.id}
 else if(act==='layout'){snap();const ks=Object.keys(CATALOG[s.type].variants);s.variant=ks[(ks.indexOf(s.variant)+1)%ks.length]}
 else if(act==='edit'){state.selected=id;state.rightTab='section';openPanel('insp')}
 else return;hard()}
const isNarrow=()=>matchMedia('(max-width:1020px)').matches;
function sheetState(){const n=isNarrow();$('#builder').classList.toggle('sheet-open',n&&(state.libOpen||state.inspOpen));$$('.pane.float').forEach(x=>x.classList.toggle('tall',n&&!!SHEET_TALL))}
let SHEET_TALL=false;
function openPanel(p){requestAnimationFrame(fitObMinis);if(isNarrow()&&p!=='none')$('#coach').hidden=true;if(p==='insp'){state.inspOpen=true;if(isNarrow())state.libOpen=false}else if(p==='lib'){state.libOpen=true;if(isNarrow())state.inspOpen=false}
 $('#fLib').hidden=!state.libOpen;$('#fInsp').hidden=!state.inspOpen;sheetState();[['#tglLib',state.libOpen],['#tglInsp',state.inspOpen]].forEach(([s,on])=>{const b=$(s);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
function selectSection(id){state.selected=id;state.rightTab='section';if(!isNarrow()&&!state.inspOpen)openPanel('insp');$$('#site .sec').forEach(e=>e.classList.toggle('sel',e.dataset.sec===id));renderList();renderInspector()}

/* images */
let pickTarget=null;
function readImage(file,max=1600,type='image/jpeg'){return new Promise((res,rej)=>{if(!file||!/^image\//.test(file.type)){rej(new Error('That file is not an image. Use a JPG, PNG, WebP or SVG.'));return}
 const fr=new FileReader();fr.onerror=()=>rej(new Error('The file could not be read.'));fr.onload=()=>{const img=new Image();img.onload=()=>{const w=img.naturalWidth||800,h=img.naturalHeight||600;const s=Math.min(1,max/Math.max(w,h));const c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);res(c.toDataURL(type,0.84))};img.onerror=()=>rej(new Error('That image format is not supported here.'));img.src=fr.result};fr.readAsDataURL(file)})}
function setImage(target,val){if(target==='ob:logo'){OB.f.logo=val;renderStart();return}
 if(target.startsWith('bgx:')){const[tg,k]=target.slice(4).split('|');snap();const bg=bgEnsure(tg);bg[k]=val;if(k==='timg')bg.tex=val?'custom':'none';if(k==='photo'&&val&&bg.pop==null)bg.pop=100;save();hard();return}snap();if(target==='brand:logo'){state.brand.logo=val;LOGO_ASK=!!val}else{const[id,path]=target.split(':');const s=sec(id);if(!s)return;if(path==='+slides'){(s.data.slides=s.data.slides||[]).push({image:val,caption:''});ssIdx[id]=s.data.slides.length-1}else setPath(s.data,path,val);if(state.tab==='builder'&&state.selected!==id){state.selected=id;state.rightTab='section'}}hard()}
async function loadInto(target,file){try{if(file&&/^video\//.test(file.type)){if(/logo$/.test(target)||target.startsWith('bgx:'))throw new Error('Backgrounds and logos need to be an image. Use a JPG, PNG or SVG.');if(file.size>80e6)throw new Error('That video is over 80 MB. Try a shorter clip.');const id=await mediaPut(file);setImage(target,'idb:'+id);toast('Video added. It plays on a silent loop.');return}if(target==='ob:logo'){OB.f.logo=await readImage(file,600,'image/png');renderStart();return}const isLogo=target==='brand:logo',isTex=/\|timg$/.test(target);const url=await readImage(file,isLogo?600:isTex?1000:1600,isLogo||(isTex&&file.type==='image/png')?'image/png':'image/jpeg');setImage(target,url);toast(isLogo?'Logo updated across your site and dashboard':isTex?'Texture added. Use Intensity, Size and Blend to style it.':target.startsWith('bgx:')?'Background photo added. Adjust its opacity and fade below.':'Photo updated')}catch(e){toast(e.message)}}

/* ---------- logo maker ---------- */
const LM_ICONS={wheat:'M12 21V8M12 8c-2-1-3-3-3-5 2 1 3 3 3 5zm0 0c2-1 3-3 3-5-2 1-3 3-3 5zM12 13c-2-1-3.5-2.5-4-5 2 .5 3.5 2.5 4 5zm0 0c2-1 3.5-2.5 4-5-2 .5-3.5 2.5-4 5zM12 18c-2-1-3.5-2.5-4-5 2 .5 3.5 2.5 4 5zm0 0c2-1 3.5-2.5 4-5-2 .5-3.5 2.5-4 5z',
 cup:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2c0 1.5 1 1.5 1 3M12 2c0 1.5 1 1.5 1 3',
 fork:'M7 2v8M5 2v5a2 2 0 0 0 4 0V2M7 10v12M17 2c-2 2-3 5-3 8h3v12',
 scissors:'M3 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.1 8.1L20 20M8.1 15.9L20 4',
 wrench:'M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
 house:'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
 leaf:'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l8-8',
 paw:'M12 13c-3 0-5.5 3-5.5 5a2 2 0 0 0 2 2c1.2 0 2.2-.8 3.5-.8s2.3.8 3.5.8a2 2 0 0 0 2-2c0-2-2.5-5-5.5-5zM4 10a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0M8 6a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0M13 6a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0M17 10a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0',
 drop:'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
 bolt:'M13 2L4 14h7l-1 8 9-12h-7z',
 mountain:'M2 20l7-11 4 6 3-4 6 9zM8 12l1.5 1.5L11 12',
 heart:'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
 star:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
 spark:'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6'};
const LM_FONTS={fraunces:["'Fraunces'",700],archivo:["'Archivo Black'",400],playfair:["'Playfair Display'",700],pacifico:["'Pacifico'",400],oswald:["'Oswald'",700],sora:["'Sora'",700],bitter:["'Bitter'",700]};
let LM=null;
function lmDefaults(){const b=state.brand;return{name:b.name,tag:'',icon:'wheat',font:'fraunces',layout:'left',shape:'circle',iconColor:onColor(b.colors.p),shapeColor:b.colors.p,textColor:b.colors.tx,upper:false}}
function drawLogo(cv,o,scale){scale=scale||1;const ctx=cv.getContext('2d');const[ff,fw]=LM_FONTS[o.font]||LM_FONTS.fraunces;const name=o.upper?o.name.toUpperCase():o.name;
 const nameSize=o.layout==='top'?54:58,tagSize=17,icon=o.layout==='top'?104:96,gap=22,pad=24;
 const meas=document.createElement('canvas').getContext('2d');meas.font=`${fw} ${nameSize}px ${ff}, Georgia, serif`;const nw=meas.measureText(name).width;
 meas.font=`600 ${tagSize}px 'Figtree', sans-serif`;const tw=o.tag?meas.measureText(o.tag.toUpperCase()).width+o.tag.length*2.5:0;const textW=Math.max(nw,tw);
 const textH=nameSize*1.15+(o.tag?tagSize+10:0);let W,H;
 if(o.layout==='top'){W=Math.max(icon,textW)+pad*2;H=pad+icon+18+textH+pad}else if(o.layout==='text'){W=textW+pad*2;H=textH+pad*2}else{W=pad+icon+gap+textW+pad;H=Math.max(icon,textH)+pad*2}
 cv.width=Math.ceil(W*scale);cv.height=Math.ceil(H*scale);ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,W,H);
 const drawIcon=(x,y)=>{if(o.shape!=='none'){ctx.fillStyle=o.shapeColor;ctx.beginPath();if(o.shape==='circle')ctx.arc(x+icon/2,y+icon/2,icon/2,0,Math.PI*2);else if(ctx.roundRect)ctx.roundRect(x,y,icon,icon,icon*.24);else ctx.rect(x,y,icon,icon);ctx.fill()}
  const isMono=o.icon==='mono';const inner=o.shape==='none'?icon:icon*.58;
  if(isMono){ctx.fillStyle=o.shape==='none'?o.iconColor:onColor(o.shapeColor);ctx.font=`${fw} ${icon*(o.shape==='none'?.62:.42)}px ${ff}, Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(initials(o.name),x+icon/2,y+icon/2+2);ctx.textAlign='left';return}
  ctx.save();ctx.translate(x+(icon-inner)/2,y+(icon-inner)/2);ctx.scale(inner/24,inner/24);ctx.strokeStyle=o.shape==='none'?o.iconColor:o.iconColor;ctx.lineWidth=1.9;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(LM_ICONS[o.icon]||LM_ICONS.star));ctx.restore()};
 const drawText=(x,y,align)=>{ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle=o.textColor;ctx.font=`${fw} ${nameSize}px ${ff}, Georgia, serif`;ctx.fillText(name,x,y+nameSize*.92);
  if(o.tag){ctx.font=`600 ${tagSize}px 'Figtree', sans-serif`;if('letterSpacing' in ctx)ctx.letterSpacing='2.5px';ctx.fillStyle=o.shape==='none'?o.iconColor:o.shapeColor;ctx.fillText(o.tag.toUpperCase(),x,y+nameSize*1.15+tagSize+4);if('letterSpacing' in ctx)ctx.letterSpacing='0px'}};
 if(o.layout==='top'){drawIcon((W-icon)/2,pad);drawText(W/2,pad+icon+14,'center')}
 else if(o.layout==='text'){drawText(pad,pad,'left')}
 else{drawIcon(pad,(H-icon)/2);drawText(pad+icon+gap,(H-textH)/2,'left')}}
function lmRandom(){const ks=Object.keys(LM_ICONS),fs=Object.keys(LM_FONTS);const b=state.brand.colors;const pal=[[b.p,b.a,b.tx],[b.a,b.p,b.tx],['#1C1D22','#F3C34A','#1C1D22'],[b.p,b.sf,b.p],['#C2287C','#1C1D22','#1C1D22'],[b.tx,b.a,b.tx]];const p=pal[Math.floor(Math.random()*pal.length)];
 const shape=['circle','square','none'][Math.floor(Math.random()*3)];return{...LM,icon:Math.random()<.18?'mono':ks[Math.floor(Math.random()*ks.length)],font:fs[Math.floor(Math.random()*fs.length)],layout:['left','left','top','text'][Math.floor(Math.random()*4)],shape,iconColor:shape==='none'?p[0]:onColor(p[1]),shapeColor:p[1],textColor:p[2],upper:Math.random()<.35}}
let lmIdeas=[],lmChat=[],lmBusy=false,lmAbort=null,SAMPLE;
const LM_COLORS={red:'#C8312E',crimson:'#A3162B',burgundy:'#7A1F33',maroon:'#6B1B2A',orange:'#E8772E',coral:'#F06D5B',peach:'#F4A582',yellow:'#F3C34A',gold:'#C9A227',mustard:'#C99A2E',cream:'#F5ECD7',beige:'#E6D5B8',tan:'#C8A97E',brown:'#7A4E2D',chocolate:'#4E2F1E',coffee:'#5B3A29',green:'#2E8B57',sage:'#8FA58A',olive:'#6B7A2E',forest:'#1F4D36',mint:'#7FD1B9',teal:'#1C8C8C',turquoise:'#2BB3B1',aqua:'#4CC9D6',blue:'#2D6CDF',navy:'#1B2A4A',sky:'#6BB7E8',royal:'#2846A8',purple:'#6B3FA0',violet:'#7D4CDB',lavender:'#B39DDB',plum:'#6E2C5E',pink:'#E25A9A',magenta:'#C2287C',rose:'#D9708A',blush:'#E8A7B4',black:'#1C1D22',charcoal:'#2E3036',gray:'#7A7D85',grey:'#7A7D85',silver:'#B9BCC2',white:'#FFFFFF'};
const LM_WORDS={wheat:'bake bakery bread wheat grain farm flour pastry',cup:'coffee cafe cup tea espresso latte drink',fork:'restaurant food eat dining kitchen chef fork diner',scissors:'salon hair barber cut scissors stylist beauty',home:'home house roof real estate property build construction',wrench:'repair fix plumbing mechanic tool wrench handyman auto',leaf:'leaf plant garden green eco nature organic lawn landscape',paw:'pet dog cat paw vet groom animal',dumbbell:'gym fitness strength training weight dumbbell workout',heart:'love heart care health wellness kind',star:'star best premium top shine',spark:'spark sparkle clean shine magic new bright modern tech',bolt:'electric bolt power fast energy lightning',briefcase:'law office business consult account professional finance briefcase'};
function lmFreeLeft(){return Math.max(0,(admin.aiFree??3)-(state.aiTries||0))}
function lmLocked(){return !hasAddon('logomaker')&&lmFreeLeft()<=0}
function lmClean(o,base){const out={...base};if(!o||typeof o!=='object')return out;const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v.trim())?v.trim():null;
 if(typeof o.name==='string'&&o.name.trim())out.name=o.name.trim().slice(0,32);if(typeof o.tag==='string')out.tag=o.tag.trim().slice(0,32);
 if(o.icon==='mono'||LM_ICONS[o.icon])out.icon=o.icon;if(LM_FONTS[o.font])out.font=o.font;if(['left','top','text'].includes(o.layout))out.layout=o.layout;if(['circle','square','none'].includes(o.shape))out.shape=o.shape;
 ['iconColor','shapeColor','textColor'].forEach(k=>{const h=hex(o[k]);if(h)out[k]=h});if(typeof o.upper==='boolean')out.upper=o.upper;return out}
function lmLocal(cmd){const t=' '+cmd.toLowerCase()+' ',o={...LM},did=[];const has=w=>t.includes(w);
 const cols=Object.keys(LM_COLORS).filter(c=>new RegExp('\\b'+c+'\\b').test(t));if(cols.length){o.shapeColor=LM_COLORS[cols[0]];o.iconColor=onColor(o.shapeColor);o.textColor=cols[1]?LM_COLORS[cols[1]]:(cols[0]==='white'||cols[0]==='cream'?'#1C1D22':LM_COLORS[cols[0]]);if(o.shape==='none')o.iconColor=o.shapeColor;did.push('colors')}
 for(const[k,ws]of Object.entries(LM_WORDS)){if(ws.split(' ').some(w=>new RegExp('\\b'+w).test(t))&&!/initial/.test(t)){o.icon=k;did.push('symbol');break}}
 if(/initial|monogram|letters/.test(t)){o.icon='mono';did.push('initials')}
 const st=[[/modern|clean|minimal|tech|sleek/,'sora'],[/bold|strong|loud|heavy|impact/,'archivo'],[/elegant|luxury|fancy|classy|upscale/,'playfair'],[/fun|playful|script|handwrit|cute|friendly/,'pacifico'],[/tall|sport|condensed|industrial/,'oswald'],[/classic|vintage|traditional|old|rustic/,'fraunces'],[/sturdy|serif|craft|workshop/,'bitter']];for(const[r,f]of st)if(r.test(t)){o.font=f;did.push('lettering');break}
 if(/stack|center|vertical|on top|above/.test(t)){o.layout='top';did.push('layout')}else if(/side|horizontal|left/.test(t)){o.layout='left';did.push('layout')}if(/name only|no (icon|symbol)|just the name|text only|wordmark/.test(t)){o.layout='text';did.push('layout')}
 if(/circle|round/.test(t)){o.shape='circle'}else if(/square|box|badge/.test(t)){o.shape='square'}else if(/no (background|circle|shape)|outline|plain/.test(t)){o.shape='none';o.iconColor=o.shapeColor}
 if(/caps|uppercase|capital/.test(t))o.upper=true;if(/lower ?case|no caps|normal case/.test(t))o.upper=false;
 const tm=cmd.match(/(?:tagline|slogan|subtitle|underneath|under it)[^"']*["']([^"']+)["']/i)||cmd.match(/["']([^"']+)["']\s*(?:as|for)\s*(?:the\s*)?(?:tagline|slogan)/i);if(tm){o.tag=tm[1].slice(0,32);did.push('tagline')}
 const nm=cmd.match(/(?:call it|name it|rename (?:it )?to|change the name to)\s*["']?([^"'.,]+)["']?/i);if(nm){o.name=nm[1].trim().slice(0,32);did.push('name')}
 const ideas=[o,...Array.from({length:2},()=>{const r=lmRandom();return{...r,name:o.name,tag:o.tag,...(cols.length?{shapeColor:o.shapeColor,iconColor:o.iconColor,textColor:o.textColor}:{}),...(did.includes('symbol')||did.includes('initials')?{icon:o.icon}:{})}})];
 return{reply:did.length?`Updated the ${[...new Set(did)].join(', ')}. Here are two more takes on it.`:'Here are three fresh directions. Try naming colors, a symbol, or a feel like "modern" or "elegant".',options:ideas}}
function lmPrompt(cmd){const b=state.brand;return `You are the logo designer inside Think Web Pros, a website builder for small businesses. A business owner is designing a logo by typing requests. The logo is drawn from these settings only:
- name: text on the logo (max 32 chars)
- tag: small line under the name, or "" (max 32 chars)
- icon: one of ${['mono',...Object.keys(LM_ICONS)].join(', ')} ("mono" shows the business initials)
- font: one of ${Object.keys(LM_FONTS).map(k=>`${k} (${LM_FONTS[k][0].replace(/'/g,'')})`).join(', ')}
- layout: "left" (symbol left of name), "top" (stacked), or "text" (name only)
- shape: "circle", "square", or "none" (background behind the symbol)
- iconColor, shapeColor, textColor: 6-digit hex colors like "#1B2A4A"
- upper: true for ALL CAPS
Business: ${b.name}${(()=>{try{return OB&&OB.f&&OB.f.industry?`, industry: ${OB.f.industry}`:''}catch(e){return''}})()}. Site colors: primary ${b.colors.p}, accent ${b.colors.a}.
Current logo: ${JSON.stringify(LM)}
Recent requests: ${JSON.stringify(lmChat.filter(m=>m.who==='you').slice(-4).map(m=>m.text))}
New request: ${JSON.stringify(cmd)}
Apply the request to the current logo, keeping everything it does not mention. If it is vague, make tasteful choices. Make sure the symbol color contrasts with the shape color and the text reads on white. Return 3 options: option 1 follows the request most faithfully, options 2 and 3 are distinct variations on it.
Reply with only JSON: {"reply":"one friendly sentence on what you changed","options":[{...all settings...},{...},{...}]}`}
async function lmAsk(cmd){cmd=(cmd||'').trim();if(!cmd||lmBusy)return;if(lmLocked()){renderLogoMaker();return}
 lmChat.push({who:'you',text:cmd});lmBusy=true;renderLogoMaker();let res=null,via='ai';await lmSampleReady();
 if(SAMPLE){lmAbort=new AbortController();try{const r=await lmJson(lmPrompt(cmd),lmAbort.signal);if(r&&Array.isArray(r.options)&&r.options.length)res={reply:String(r.reply||'Here you go.').slice(0,240),options:r.options.slice(0,3).map(o=>lmClean(o,LM))}}
  catch(e){const c=e&&e.code;if(c==='cancelled'){lmBusy=false;lmChat.pop();renderLogoMaker();return}
   if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(c))SAMPLE=null;
   else if(c==='rate_limited'||c==='session_expired'||c==='refused'){lmBusy=false;lmChat.push({who:'ai',text:c==='rate_limited'?'The AI is busy right now. Give it a minute and try again.':c==='session_expired'?'Please sign in again to keep using the AI.':'The AI could not do that one. Try wording it differently.',err:true});renderLogoMaker();return}}
  finally{lmAbort=null}}
 if(!res){res=lmLocal(cmd);via='quick';if(!lmNoted){lmNoted=true;res.reply+=' Live AI is not connected here, so these are quick ideas. For a fully designed logo, try one of the AI tools below.'}}
 lmBusy=false;state.aiTries=(state.aiTries||0)+1;state.aiLog=(state.aiLog||0)+1;save();
 LM={...res.options[0]};lmIdeas=res.options.concat(Array.from({length:Math.max(0,3-res.options.length)},lmRandom));
 lmChat.push({who:'ai',text:res.reply,via});renderLogoMaker();
 if(!hasAddon('logomaker')&&lmFreeLeft()===0)toast('That was your last free AI request')}
function openLogoMaker(){LM=LM||lmDefaults();if(!lmIdeas.length)lmIdeas=Array.from({length:3},lmRandom);
 lmSampleReady();
 renderLogoMaker()}
function lmModeHtml(){return `<span id="lmMode" class="badge ${SAMPLE?'ok':''}" title="${SAMPLE?'Requests go to a live AI model':'No AI model is connected in this view, so requests use the built-in idea engine'}">${SAMPLE?'Live AI':SAMPLE_P&&SAMPLE===undefined?'Connecting…':'Quick ideas'}</span>`}
const LM_SUGGEST=['Make it feel modern and clean','Navy and gold, stacked','Use a coffee cup symbol','Try my initials in a circle','More playful and friendly','Add the tagline "Since 2014"'];
async function renderLogoMaker(){const owned=hasAddon('logomaker'),a=addonById('logomaker'),price=money(a?a.price:49),left=lmFreeLeft(),free=admin.aiFree??3,locked=lmLocked();
 const pref=$('#lm-ask');const draft=pref?pref.value:'';
 const chat=lmChat.slice(-6).map(m=>`<div class="lm-msg ${m.who}${m.err?' err':''}">${m.who==='ai'?`<span class="lm-av">${ic('spark',12)}</span>`:''}<p>${esc(m.text)}</p></div>`).join('')+(lmBusy?`<div class="lm-msg ai"><span class="lm-av">${ic('spark',12)}</span><p class="lm-dots">Designing<i>.</i><i>.</i><i>.</i></p></div>`:'');
 const meter=owned?`<span class="badge ok">Unlimited</span>`:`<span class="lm-meter" aria-label="${left} of ${free} free requests left">${Array.from({length:free},(_,i)=>`<i class="${i<left?'on':''}"></i>`).join('')}<b>${left} of ${free} free</b></span>`;
 const ask=locked?`<div class="lm-pay"><div class="lm-pay-ic">${ic('spark',20)}</div><h3>You've used your ${free} free AI requests</h3><p>Keep going with the <b>${esc(a?a.name:'AI logo package')}</b>: unlimited AI requests and changes, no watermark, and your logo in every size for your site, dashboard and print.</p><button class="btn pri" data-lmbuy>Unlock unlimited · ${price} once</button><p class="muted sm">You can still fine-tune by hand below for free.</p></div>`
  :`<form class="lm-ask" data-lmform><label for="lm-ask" class="lm-ask-l"><b>Tell the AI what you want</b>${meter}</label><div class="lm-ask-row"><textarea id="lm-ask" rows="2" placeholder="Describe your logo or a change, like &quot;earthy greens with a leaf, stacked&quot;" ${lmBusy?'disabled':''}>${esc(draft)}</textarea><button class="btn pri" type="submit" ${lmBusy?'disabled':''}>${lmBusy?'Working':'Ask AI'}</button></div>
   <div class="lm-sugg">${LM_SUGGEST.map(x=>`<button type="button" class="chip" data-lmsugg="${esc(x)}" ${lmBusy?'disabled':''}>${esc(x)}</button>`).join('')}</div></form>`;
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal wide" role="dialog" aria-label="AI logo maker"><div class="modal-h"><div><h2>AI logo maker ${lmModeHtml()}</h2><p class="muted">${owned?'Unlocked. Ask for as many changes as you like.':`Describe it in your own words. Your first ${free} requests are free, then the ${esc(a?a.name:'AI logo package')} is ${price} once.`}</p></div><button class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <div class="lm"><div class="lm-stage"><div class="lm-canvas"><canvas id="lmCanvas"></canvas>${owned?'':'<span class="lm-wm">PREVIEW</span>'}</div>
 ${chat?`<div class="lm-chat" id="lmChat">${chat}</div>`:''}
 <div class="between lm-oh"><b>${lmChat.length?'AI options':'Starter ideas'}</b>${lmChat.length?'':`<button class="btn sm" data-lmshuffle>${ic('spark',13)} Shuffle</button>`}</div><div class="lm-ideas">${lmIdeas.map((x,i)=>`<button type="button" data-lmidea="${i}" aria-label="Use option ${i+1}"><canvas data-lmc="${i}"></canvas></button>`).join('')}</div></div>
 <div class="lm-side">${ask}${lmOutsideHtml()}
 <details class="lm-hand"${locked?' open':''}><summary>Fine-tune by hand</summary>
 <label class="fld"><span>Name on the logo</span><input type="text" id="lm-name" data-lm="name" value="${esc(LM.name)}"></label>
 <label class="fld"><span>Small line underneath (optional)</span><input type="text" id="lm-tag" data-lm="tag" value="${esc(LM.tag)}" placeholder="Est. 2014"></label>
 <div class="fld"><span>Symbol</span><div class="lm-icons" style="grid-template-columns:repeat(8,1fr)">${['mono',...Object.keys(LM_ICONS)].map(k=>`<button type="button" data-lmset="icon|${k}" class="${LM.icon===k?'on':''}" title="${k==='mono'?'Initials':k}">${k==='mono'?`<b>${esc(initials(LM.name))}</b>`:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${LM_ICONS[k]}"/></svg>`}</button>`).join('')}</div></div>
 <div class="fld"><span>Layout</span><div class="seg">${[['left','Symbol left'],['top','Stacked'],['text','Name only']].map(([k,l])=>`<button type="button" data-lmset="layout|${k}" class="${LM.layout===k?'on':''}">${l}</button>`).join('')}</div></div>
 <div class="fld"><span>Symbol background</span><div class="seg">${[['circle','Circle'],['square','Square'],['none','None']].map(([k,l])=>`<button type="button" data-lmset="shape|${k}" class="${LM.shape===k?'on':''}">${l}</button>`).join('')}</div></div>
 <div class="grid2f"><label class="fld"><span>Lettering</span><select id="lm-font" data-lm="font">${Object.keys(LM_FONTS).map(k=>`<option value="${k}" ${LM.font===k?'selected':''}>${LM_FONTS[k][0].replace(/'/g,'')}</option>`).join('')}</select></label>
 <label class="fld"><span>Capitals</span><select id="lm-upper" data-lm="upper"><option value="" ${LM.upper?'':'selected'}>As typed</option><option value="1" ${LM.upper?'selected':''}>ALL CAPS</option></select></label></div>
 <div class="colors" style="grid-template-columns:repeat(3,1fr)"><label>Symbol<input type="color" id="lm-ic" data-lm="iconColor" value="${LM.iconColor}"></label><label>Background<input type="color" id="lm-sc" data-lm="shapeColor" value="${LM.shapeColor}"></label><label>Name<input type="color" id="lm-tc" data-lm="textColor" value="${LM.textColor}"></label></div>
 </details>
 <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-closemodal>Cancel</button><button class="btn pri" data-lmuse>${owned?'Use this logo':`Use this logo · ${price}`}</button></div></div></div></div></div>`;
 const ch=$('#lmChat');if(ch)ch.scrollTop=ch.scrollHeight;const ta=$('#lm-ask');if(ta&&!lmBusy&&lmChat.length&&!isNarrow())ta.focus();
 try{await Promise.all(Object.values(LM_FONTS).map(([f,w])=>document.fonts.load(`${w} 40px ${f}`)))}catch(e){}
 lmPaint();lmIdeas.forEach((x,i)=>{const c=$(`[data-lmc="${i}"]`);if(c)drawLogo(c,x,.6)})}
function lmBuy(){if(!state.cart.addons.includes('logomaker'))state.cart.addons.push('logomaker');save();toast(`${addonById('logomaker').name} added to your order. Unlimited AI requests are on.`);renderLogoMaker()}
function lmPaint(){const c=$('#lmCanvas');if(c)drawLogo(c,LM,1.5)}
function lmUse(){if(!hasAddon('logomaker')){state.cart.addons.push('logomaker');toast(`${addonById('logomaker').name} added to your order (${money(addonById('logomaker').price)} once)`)}
 const c=document.createElement('canvas');drawLogo(c,LM,2);snap();state.brand.logo=c.toDataURL('image/png');LOGO_ASK=true;state.brand.showName=false;state.brand.logoSize=Math.max(state.brand.logoSize,52);closeModal();hard()}
function closeModal(){$('#modalRoot').innerHTML=''}

/* ---------- owner dashboard ---------- */
function areaChart(vals,w,h,stroke,fill,labels){const max=Math.max(...vals)*1.15||1,n=vals.length;const x=i=>16+i*(w-32)/(n-1),y=v=>h-22-(v/max)*(h-40);
 const pts=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');const grid=[.33,.66,1].map(f=>`<line x1="16" x2="${w-16}" y1="${y(max/1.15*f)}" y2="${y(max/1.15*f)}" style="stroke:${fill}" stroke-dasharray="2 4"/>`).join('');
 return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Chart">${grid}<polygon points="16,${h-22} ${pts} ${w-16},${h-22}" style="fill:${fill}"/><polyline points="${pts}" fill="none" style="stroke:${stroke}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${x(n-1)}" cy="${y(vals[n-1])}" r="4.5" style="fill:${stroke}"/>${labels?`<text x="16" y="${h-5}">${labels[0]}</text><text x="${w-16}" y="${h-5}" text-anchor="end">${labels[1]}</text>`:''}</svg>`}
function lockedW(title,text,btn){return `<div class="w lockw"><div class="w-h"><h3>${title}</h3><small>${ic('lock',13)}</small></div><div class="lockc"><p class="mut">${text}</p>${btn}</div></div>`}
function seoChecks(){const imgs=state.sections.reduce((n,s)=>n+JSON.stringify(s.data).split('data:image').length-1,0);const hero=firstOf('hero');
 return[['Logo added',!!state.brand.logo],['Tagline between 20 and 90 characters',state.brand.tagline.length>=20&&state.brand.tagline.length<=90],['Headline under 60 characters',!!hero&&hero.data.heading.length<60],['At least 3 of your own photos',imgs>=3],['Contact form on the page',!!firstOf('contact')],['Map and hours listed',!!firstOf('map')],['Customer reviews shown',!!firstOf('testimonials')],['Your own domain',hasAddon('domain')],['Google Business profile (SEO boost)',hasAddon('seo')]]}
const W={
 controls(){return{wide:true,html:`<div class="w wide"><div class="w-h"><h3>Website controls</h3><small>Changes go live instantly</small></div>
  <label class="switch"><input type="checkbox" id="d-ann" data-bind="announce.on" ${state.announce.on?'checked':''}><i></i> Announcement bar</label>
  <input type="text" id="d-ann-t" data-bind="announce.text" value="${esc(state.announce.text)}" aria-label="Announcement text">
  <div>${state.sections.map(s=>`<div class="w-row"><span class="t"><b>${esc(CATALOG[s.type].name)}</b><span>${esc(CATALOG[s.type].variants[s.variant]||'')}</span></span><label class="switch"><input type="checkbox" id="vis-${s.id}" data-vis="${s.id}" ${s.hidden?'':'checked'}><i></i><span class="mut">${s.hidden?'Hidden':'Showing'}</span></label></div>`).join('')}</div></div>`}},
 leads(){const L=[...state.leads].sort((a,b)=>b.at-a.at);const un=L.filter(l=>!l.read).length;return{html:`<div class="w"><div class="w-h"><h3>Messages &amp; leads</h3><small>${un} new</small></div>${L.length?L.slice(0,5).map(l=>`<div class="w-row"><span class="t"><b>${l.read?'':'<span class="dot-unread" style="display:inline-block;margin-right:6px"></span>'}${esc(l.name)}${l.sample?' <span class="badge ex">Example</span>':''}</b><span>${esc(l.msg)}</span><span>${esc(l.email)} · ${ago(l.at)}</span></span>${l.read?'':`<button type="button" class="od-btn ghost" style="padding:4px 9px;font-size:12px" data-leadread="${l.id}">Mark read</button>`}</div>`).join(''):'<p class="mut">No messages yet. Messages from your contact form land here.</p>'}<p class="mut">Try it: send a message from the contact form in the preview.</p></div>`}},
 traffic(){const v=[212,240,198,260,310,295,330,301,345,390,362,410,398,446];return{wide:true,html:`<div class="w wide"><div class="w-h"><h3>Website visits</h3><span class="badge ex">Example data</span></div><div class="wk"><div><b>4,707</b><span>Visits, 14 days</span></div><div><b>183</b><span>Calls from site</span></div><div><b>64</b><span>Direction taps</span></div></div>${areaChart(v,560,150,'var(--p)','color-mix(in srgb,var(--p) 14%,transparent)',['Oct 6','Today'])}</div>`}},
 pos(){if(!hasPOS())return{html:lockedW('Register sales (POS)','Ring up sales in the shop and see them here next to your website orders. Stock syncs to your online store.',`<button type="button" class="od-btn gold" data-tab="plans">See POS plans</button>`)};
  const pp=posPlan(state.cart.pos);const tx=[['Latte, cardamom bun','$11.25','Tap · 9:41am'],['Country sourdough ×2','$18.00','Chip · 9:32am'],['Online order #2041','$46.50','Website · 9:15am'],['Half-dozen croissants','$21.00','Apple Pay · 8:58am']];
  const low=(firstOf('shop')?.data.items||DEFAULTS.shop.items).filter(x=>+x.stock<=6).slice(0,3);
  return{wide:true,html:`<div class="w wide"><div class="w-h"><h3>Register sales · ${esc(pp.name)}</h3><span class="badge ex">Example data</span></div><div class="wk"><div><b>$1,284</b><span>Sales today</span></div><div><b>71</b><span>Transactions</span></div><div><b>$18.08</b><span>Average ticket</span></div></div>${tx.map(t=>`<div class="w-row"><span class="t"><b>${t[0]}</b><span>${t[2]}</span></span><b class="num">${t[1]}</b></div>`).join('')}${low.length?`<p class="mut"><b>Low stock:</b> ${low.map(x=>esc(x.name)+' ('+x.stock+')').join(', ')}. Counts update your online store too.</p>`:''}</div>`}},
 payouts(){if(!hasMerchant())return{html:lockedW('Payments &amp; deposits','Accept cards in person and online with Think Web Pros merchant services. Deposits land in your bank next business day.',`<button type="button" class="od-btn gold" data-merchanton>Turn on card payments</button>`)};
  const pr=processing();return{html:`<div class="w"><div class="w-h"><h3>Payments &amp; deposits</h3><span class="badge ex">Example data</span></div><div class="w-row"><span class="t"><b>Next deposit</b><span>Tomorrow, to checking ••4417</span></span><b class="num">$1,236.40</b></div><div class="w-row"><span class="t"><b>This month's card sales</b><span>Estimated from your plan</span></span><b class="num">${money(+state.cart.volume)}</b></div><div class="w-row"><span class="t"><b>Processing fees</b><span>${pr.eff.toFixed(2)}% effective rate</span></span><b class="num">${money(pr.fees,2)}</b></div></div>`}},
 hours(){return{html:`<div class="w"><div class="w-h"><h3>Business hours</h3><small>Shown on your map section</small></div>${hoursEditor()}</div>`}},
 reviews(){const ts=state.sections.filter(s=>s.type==='testimonials');if(!ts.length)return{html:`<div class="w"><div class="w-h"><h3>Reviews on your site</h3></div><p class="mut">Add a Testimonials section to show reviews.</p></div>`};
  return{html:`<div class="w"><div class="w-h"><h3>Reviews on your site</h3><small>Choose which ones show</small></div>${ts.map(s=>s.data.items.map((x,i)=>`<div class="w-row"><span class="t"><b>${'★'.repeat(+x.stars||5)} ${esc(x.name)}</b><span>${esc(x.quote)}</span></span><label class="switch"><input type="checkbox" id="rv-${s.id}-${i}" data-rev="${s.id}|${i}" ${x.hidden?'':'checked'}><i></i></label></div>`).join('')).join('')}</div>`}},
 quickedit(){const h=firstOf('hero');return{html:`<div class="w"><div class="w-h"><h3>Quick edit</h3><small>Homepage headline</small></div>${h?`<input type="text" id="qe-h" data-sf="${h.id}|heading" value="${esc(h.data.heading)}" aria-label="Headline"><textarea id="qe-s" data-sf="${h.id}|sub" rows="3" aria-label="Supporting text">${esc(h.data.sub)}</textarea>`:'<p class="mut">Add a hero banner to edit it here.</p>'}</div>`}},
 bookings(){if(!hasAddon('booking')){const a=addonById('booking');return{html:lockedW('Bookings','Let customers book appointments from your site and manage them here.',a?`<button type="button" class="od-btn gold" data-cartadd="booking">Add for ${money(a.price)}/mo</button>`:'')}}
  const B=[...state.bookings].reverse();return{html:`<div class="w"><div class="w-h"><h3>Bookings</h3><small>${B.length} upcoming</small></div>${B.map(b=>`<div class="w-row"><span class="t"><b>${esc(b.name)}${b.sample?' <span class="badge ex">Example</span>':''}</b><span>${esc(b.service)}</span></span><span class="mut num">${esc(b.date)} ${esc(b.time)}</span></div>`).join('')}<p class="mut">${firstOf('booking')?'Try it: book a time in the preview.':'Add the Online booking section to your page so customers can book.'}</p></div>`}},
 seo(){const c=seoChecks(),ok=c.filter(x=>x[1]).length,pct=Math.round(ok/c.length*100),C=2*Math.PI*26;
  return{html:`<div class="w"><div class="w-h"><h3>Search checklist</h3><small>${ok} of ${c.length} done</small></div><div class="ring"><svg width="66" height="66" viewBox="0 0 66 66"><circle cx="33" cy="33" r="26" fill="none" style="stroke:var(--ln)" stroke-width="7"/><circle cx="33" cy="33" r="26" fill="none" style="stroke:var(--p)" stroke-width="7" stroke-dasharray="${C*pct/100} ${C}" stroke-linecap="round" transform="rotate(-90 33 33)"/><text x="33" y="38" text-anchor="middle" style="font-size:15px;font-weight:700;fill:var(--tx)">${pct}</text></svg><p class="mut">Each item helps customers find you on Google.</p></div><div>${c.map(([l,v])=>`<div class="chk ${v?'ok':'no'}"><i>${v?'✓':''}</i>${l}</div>`).join('')}</div></div>`}}
};
function renderDashboard(){const b=state.brand,c=cartCalc();const order=state.dash.order.filter(k=>W[k]);Object.keys(W).forEach(k=>{if(!order.includes(k))order.push(k)});state.dash.order=order;
 const un=state.leads.filter(l=>!l.read).length;const hr=new Date().getHours();const greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
 $('#v-dashboard').innerHTML=`<div class="dash-layout">
 <aside class="dcust"><div class="pane-h"><h2>Build your dashboard</h2></div><p class="muted" style="font-size:12.5px;margin-bottom:12px">This is the back office your customer gets. Turn panels on or off and drag to reorder. It uses their logo and colors from the designer.</p>
  <div class="wlist" id="wlist">${order.map((k,i)=>`<div class="witem" draggable="true" data-wid="${k}"><span class="grip">${ic('grip',14)}</span><b>${WIDGETS[k]}</b><button type="button" class="iconbtn" data-wmove="${k}|-1" ${i===0?'disabled':''} aria-label="Move up">${ic('up',14)}</button><label class="switch" title="Show panel"><input type="checkbox" id="w-${k}" data-wtoggle="${k}" ${state.dash.off[k]?'':'checked'}><i></i></label></div>`).join('')}</div>
  <div class="sectitle">Quick links</div><div class="row"><button class="btn sm" data-tab="builder">${ic('edit',13)} Back to designer</button><button class="btn sm" data-tab="plans">Plans &amp; POS</button></div></aside>
 <div class="dmain"><div class="odash" style="${siteVars(b)}">
  <div class="od-side"><div class="brandmark">${b.logo?`<img class="slogo" src="${b.logo}" alt="">`:`<span class="mono">${esc(initials(b.name))}</span>`}${b.logo&&!b.showName?'':`<span>${esc(b.name)}</span>`}</div>
   <nav class="od-nav"><span class="on">Overview</span><span>Messages ${un?`<i>${un}</i>`:''}</span><span>Website</span>${hasPOS()?'<span>Register</span>':''}${hasAddon('store')||firstOf('shop')?'<span>Orders</span>':''}${hasAddon('booking')?'<span>Bookings</span>':''}${hasMerchant()?'<span>Payments</span>':''}<span>Settings</span></nav>
   <div class="od-plan">${esc(c.t.name)} plan${hasPOS()?' + '+esc(posPlan(state.cart.pos).name):''}<br><span style="opacity:.8">Managed by ${esc(admin.company)}</span></div></div>
  <div class="od-main"><div class="od-top"><div><h2>${greet}</h2><p>Here is what is happening at ${esc(b.name)} today.</p></div><button type="button" class="od-btn" data-tab="builder">${ic('edit',14)} Edit website</button></div>
   <div class="od-grid">${order.filter(k=>!state.dash.off[k]).map(k=>W[k]().html).join('')}</div></div></div></div>
 <aside class="dmini"><div class="pane-h"><h2>Your site, live</h2><span class="badge ok">Live</span></div><p class="muted" style="font-size:12.5px;margin-bottom:10px">Flip a control and watch it change here.</p><div class="miniframe" id="miniFrame"><div class="site" id="miniSite"></div></div></aside></div>`;
 paintSite($('#miniSite'),false);fitMini()}
function fitMini(){const f=$('#miniFrame'),s=$('#miniSite');if(!f||!s)return;s.style.zoom=Math.min(1,(f.clientWidth-2)/1100)}

/* ---------- plans ---------- */
function renderPlans(){const c=cartCalc(),annual=state.cart.annual,p=admin.pos,pr=processing();
 $('#v-plans').innerHTML=`<div class="plans"><div>
 <div class="plans-h"><h1>Choose a plan for ${esc(state.brand.name)}</h1><p>A one-time design fee, then a monthly plan for hosting, updates and support. Add POS and card processing if you sell in person. Change any time.</p>
  <div class="seg" style="max-width:320px"><button type="button" data-annual="0" class="${annual?'':'on'}">Monthly</button><button type="button" data-annual="1" class="${annual?'on':''}">Yearly · 2 months free</button></div></div>
 <div class="tiers">${admin.tiers.map(t=>{const on=state.cart.tier===t.id;return `<div class="tier${on?' on':''}" role="radio" aria-checked="${on}" tabindex="0" data-tier="${t.id}"><div class="between"><h3>${esc(t.name)}</h3>${admin.popular===t.id?'<span class="badge acc">Most popular</span>':''}</div><div class="tier-price"><b class="num">${money(annual?t.monthly*10:t.monthly)}</b><span>/${annual?'year':'month'}</span></div><div class="tier-setup num">+ ${money(t.setup)} one-time design</div><ul>${t.features.filter(Boolean).map(f=>`<li>${ic('check',15)}<span>${esc(f)}</span></li>`).join('')}</ul><span class="tier-cta">${on?'Selected':'Choose '+esc(t.name)}</span></div>`}).join('')}</div>
 <div class="custom-plan"><div class="cp-main"><div class="between"><h3>Custom</h3><span class="badge">Priced per job</span></div><p>For more elaborate designs: lots of pages, custom features, booking or ordering flows built around how you work, or a full rebrand. Tell us what you need and we'll send a quote.</p>
  <ul>${['Designed with you by our team','No section limit','Custom features and integrations','Hosting and support plan to fit'].map(f=>`<li>${ic('check',15)}<span>${f}</span></li>`).join('')}</ul></div>
  <button type="button" class="btn pri" data-quote>Request a quote</button></div>
 <div class="custom-plan store-plan"><div class="cp-main"><div class="between"><h3>${ic('clock',18)} Design storage</h3><span class="badge">${money(storagePrice())}/month</span></div><p>${state.keep?`Your designs are kept with ${esc(keepLabel())}, so nothing expires.`:`Not ready to choose a plan? Without one, designs are kept for ${holdHours()} from when you start them. Design storage keeps all your designs for ${money(storagePrice())}/month until you are ready. Cancel any time; it stops when you choose a plan.`}</p></div>
  ${state.keep?`<span class="badge ok">${ic('check',13)} Kept</span>`:`<button type="button" class="btn" data-storage>Keep my designs</button>`}</div>
 <div class="block"><div class="block-h"><div><h2>Add-ons</h2><p>Turn features on for this site. Included items come with your plan.</p></div></div>
  <div class="addons">${admin.addons.filter(a=>a.enabled).map(a=>{const inc=c.inc.has(a.id),on=state.cart.addons.includes(a.id);return `<label class="addon${on||inc?' on':''}${inc?' inc':''}"><input type="checkbox" id="ad-${a.id}" data-cartaddon="${a.id}" ${on||inc?'checked':''} ${inc?'disabled':''}><div><b>${esc(a.name)}</b><p>${esc(a.desc)}</p>${a.id==='logomaker'?`<button type="button" class="btn sm" data-logomaker style="justify-self:start;margin-top:4px">${ic('spark',13)} Try it</button>`:''}</div><span class="ad-price num">${inc?'Included':money(a.price)+(a.billing==='monthly'?'/mo':' once')}</span></label>`}).join('')}</div></div>
 <div class="block"><div class="block-h"><div><h2>Point of sale</h2><p>Ring up sales at the counter. Your menu, prices and stock sync with the website store, and online orders show up on the register.</p></div>${hasPOS()?`<button class="btn sm" data-posset="">Remove POS</button>`:''}</div>
  <div class="tiers">${p.plans.filter(x=>x.enabled).map(x=>{const on=state.cart.pos===x.id;return `<div class="tier${on?' on':''}" role="radio" aria-checked="${on}" tabindex="0" data-posset="${x.id}"><h3>${esc(x.name)}</h3><div class="tier-price"><b class="num">${money(x.price)}</b><span>/month</span></div><p class="muted" style="font-size:13px">${esc(x.desc)}</p><span class="tier-cta">${on?'Selected':'Add '+esc(x.name)}</span></div>`}).join('')}</div>
  <div class="sectitle" style="margin-top:18px">Hardware</div>
  <div class="pos-grid">${p.hardware.filter(h=>h.enabled).map(h=>{const q=state.cart.hw[h.id]||0;return `<div class="hw"><span class="hw-ic">${ic(h.icon||'card',24)}</span><div><b>${esc(h.name)}</b><p>${esc(h.desc)}</p><p class="num" style="color:var(--ink);font-weight:700;margin-top:4px">${money(h.price)}</p></div><div class="qty"><button type="button" class="iconbtn" data-hw="${h.id}|-1" ${q?'':'disabled'} aria-label="Fewer">${ic('down',14)}</button><span class="num">${q}</span><button type="button" class="iconbtn" data-hw="${h.id}|1" aria-label="More">${ic('up',14)}</button></div></div>`}).join('')}</div></div>
 <div class="block"><div class="block-h"><div><h2>Merchant services</h2><p>Card processing for the register, your website store and booking deposits. No monthly fee; you pay a rate per sale, taken out before deposit.</p></div>
  <label class="switch"><input type="checkbox" id="merch" data-merchant ${hasMerchant()?'checked':''} ${hasPOS()?'disabled':''}><i></i> ${hasPOS()?'Included with POS':'Accept cards'}</label></div>
  <div class="rates"><table><thead><tr><th>Payment type</th><th>Rate</th></tr></thead><tbody>${p.rates.map(r=>`<tr><td>${esc(r.name)}</td><td class="num"><b>${r.pct}% + ${Math.round(r.fixed*100)}¢</b></td></tr>`).join('')}</tbody></table>
  <div class="estim"><label class="fld" style="margin:0"><span>Monthly card sales · <b class="num">${money(+state.cart.volume)}</b></span><input type="range" id="vol" min="0" max="100000" step="500" value="${state.cart.volume}" data-bind="cart.volume" data-num data-rerender></label>
  <label class="fld" style="margin:0"><span>In person vs. online · <b class="num">${state.cart.inPerson}% in person</b></span><input type="range" id="inp" min="0" max="100" step="5" value="${state.cart.inPerson}" data-bind="cart.inPerson" data-num data-rerender></label>
  <div class="between"><span class="muted">Estimated processing</span><b class="num">${money(pr.fees,2)}/mo · ${pr.eff.toFixed(2)}%</b></div></div></div></div>
 </div>
 <aside class="summary"><h3>Your order</h3><div class="sum-lines">${c.lines.map(l=>`<div class="sum-line"><span>${esc(l.label)}</span><span class="num">${l.o!=null?money(l.o)+' once':money(annual?l.m*10:l.m)+(annual?'/yr':'/mo')}</span></div>`).join('')}</div>
  <div class="sum-tot"><div class="big"><span>Due today</span><b class="num">${money(c.setup+(annual?c.yearly:0))}</b></div><div class="sum-line"><span>Then</span><span class="num">${money(annual?c.yearly:c.monthly)}${annual?'/year':'/month'}</span></div>${c.proc?`<div class="sum-line"><span>Card processing (est.)</span><span class="num">${money(c.proc.fees,2)}/mo from sales</span></div>`:''}</div>
  ${state.sections.filter(s=>!s.hidden).length>c.t.maxSections?`<div class="limit-note">Your page has more sections than ${esc(c.t.name)} allows. Hide some or pick a bigger plan.</div>`:''}
  <button class="btn pri" data-checkout style="width:100%;padding:12px">Check out</button><p class="muted" style="font-size:12px">Your design is saved with the order and our team reviews it before launch.</p></aside></div>`}
function openCheckout(){if(!requireBiz())return;const c=cartCalc();
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><form class="modal" id="coForm" role="dialog" aria-label="Checkout"><div class="modal-h"><h2>Check out</h2><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <p class="demo-note">Prototype checkout. No card is charged; the order goes to your admin dashboard. Real payments would connect to Stripe or your processor here.</p>
 <div class="grid2f"><label class="fld"><span>Your name</span><input type="text" id="co-name" required value=""></label><label class="fld"><span>Business</span><input type="text" id="co-biz" required value="${esc(state.brand.name)}"></label>
 <label class="fld"><span>Email</span><input type="email" id="co-email" required></label><label class="fld"><span>Phone</span><input type="text" id="co-phone"></label></div>
 ${hasAddon('domain')?`<label class="fld"><span>Domain you would like</span><input type="text" id="co-domain" value="${slug(state.brand.name)}.com"></label>`:''}
 <div class="grid2f"><label class="fld"><span>Card number</span><input type="text" id="co-card" inputmode="numeric" placeholder="4242 4242 4242 4242"></label><label class="fld"><span>Expiry / CVC</span><input type="text" id="co-exp" placeholder="12/28 · 123"></label></div>
 <div class="sum-tot"><div class="big"><span>Due today</span><b class="num">${money(c.setup+(c.annual?c.yearly:0))}</b></div><div class="sum-line"><span>Then</span><span class="num">${money(c.annual?c.yearly:c.monthly)}${c.annual?'/year':'/month'}</span></div></div>
 <div class="row" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-closemodal>Back</button><button class="btn pri" type="submit">Place order</button></div></form></div>`;
 setTimeout(()=>$('#co-name')?.focus(),30)}
function openQuote(){const b=state.biz||{};
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><form class="modal" id="quoteForm" role="dialog" aria-label="Request a quote"><div class="modal-h"><div><h2>Request a custom quote</h2><p class="muted">Custom plans are priced per job. Tell us about the site you have in mind and we'll reply with a quote, usually within one business day.</p></div><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <div class="grid2f"><label class="fld"><span>Your name</span><input type="text" id="qt-name" required autocomplete="name"></label><label class="fld"><span>Business</span><input type="text" id="qt-biz" required value="${esc(b.name||state.brand.name||'')}" autocomplete="organization"></label>
 <label class="fld"><span>Email</span><input type="email" id="qt-email" required value="${esc(b.email||'')}" autocomplete="email"></label><label class="fld"><span>Phone</span><input type="text" inputmode="tel" id="qt-phone" value="${esc(b.phone||'')}" autocomplete="tel"></label></div>
 <label class="fld"><span>What do you need?</span><textarea id="qt-details" rows="4" required placeholder="Pages, features, examples of sites you like, anything we should know"></textarea></label>
 <div class="grid2f"><label class="fld"><span>Budget (optional)</span><select id="qt-budget"><option value="">Not sure yet</option><option>Under $2,500</option><option>$2,500 to $5,000</option><option>$5,000 to $10,000</option><option>Over $10,000</option></select></label>
 <label class="fld"><span>When do you need it? (optional)</span><select id="qt-when"><option value="">Flexible</option><option>Within 2 weeks</option><option>Within a month</option><option>1 to 3 months</option></select></label></div>
 <p class="muted" style="font-size:12px">Your current design is sent with the request so we can see where you're starting from.</p>
 <div class="row" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-closemodal>Cancel</button><button class="btn pri" type="submit">Send request</button></div></form></div>`;
 setTimeout(()=>$('#qt-name')?.focus(),30)}
function placeQuote(){const v=id=>$('#'+id).value.trim();const o={id:'TWP-'+(admin.nextOrder++),kind:'quote',at:Date.now(),business:v('qt-biz'),owner:v('qt-name'),email:v('qt-email'),phone:v('qt-phone'),plan:'custom',details:v('qt-details'),budget:v('qt-budget'),timeline:v('qt-when'),addons:[],pos:null,hw:{},setup:0,monthly:0,annual:false,status:'New',sections:state.sections.filter(s=>!s.hidden).map(s=>CATALOG[s.type].name),theme:THEMES[state.brand.theme]?.name};
 admin.orders.push(o);save();
 if(window.TWP)TWP.submitOrder(o,state);
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal" role="dialog" aria-label="Quote requested"><div class="modal-h"><h2>Quote request sent</h2><button class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div><p>Thanks, ${esc(o.owner.split(' ')[0]||'there')}. ${esc(admin.company)} will look over your request and email ${esc(o.email)} with a quote. Your request number is ${o.id}.</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-closemodal>Keep designing</button></div></div></div>`}
function placeOrder(){const c=cartCalc();const o={id:'TWP-'+(admin.nextOrder++),at:Date.now(),business:$('#co-biz').value.trim(),owner:$('#co-name').value.trim(),email:$('#co-email').value.trim(),phone:$('#co-phone').value.trim(),plan:c.t.id,addons:[...state.cart.addons],pos:state.cart.pos,hw:{...state.cart.hw},setup:c.setup+(c.annual?c.yearly:0),monthly:c.monthly,annual:c.annual,status:'New',sections:state.sections.filter(s=>!s.hidden).map(s=>CATALOG[s.type].name),theme:THEMES[state.brand.theme]?.name};
 admin.orders.push(o);admin.customers.push({id:uid(),business:o.business,owner:o.owner,plan:o.plan,addons:o.addons,pos:o.pos,vol:hasMerchant()?+state.cart.volume:0,status:'In build',mrr:c.monthly,since:Date.now()});state.keep={kind:'plan',order:o.id,at:Date.now()};save();
 if(window.TWP)TWP.submitOrder(o,state);
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal" role="dialog" aria-label="Order placed"><div class="modal-h"><h2>Order ${o.id} placed</h2><button class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div><p>Thanks, ${esc(o.owner.split(' ')[0]||'there')}. ${esc(admin.company)} has your design and will email ${esc(o.email)} with a launch date. Your designs are now kept with your plan, so they no longer expire.</p><p class="muted" style="margin-top:10px">This order now shows in the Admin tab, which is your side of the business.</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-closemodal>Keep designing</button><button class="btn pri" data-tab="admin" data-admintab="orders">See it in Admin</button></div></div></div>`}

/* ---------- admin ---------- */
const STATUS_CLS={'Live':'ok','In build':'acc','New':'gold','Past due':'bad','Cancelled':''};
function adminKpis(){const act=admin.customers.filter(c=>c.status!=='Cancelled');const mrr=act.reduce((n,c)=>n+(+c.mrr||0),0);const p=admin.pos;
 const margin=act.reduce((n,c)=>{const v=+c.vol||0;if(!v)return n;const tx=v/(p.avgTicket||20);const r=p.rates[0];return n+v*(r.pct-p.cost.pct)/100+tx*(r.fixed-p.cost.fixed)},0);
 const recent=admin.orders.filter(o=>o.at>Date.now()-30*864e5).reduce((n,o)=>n+(+o.setup||0),0);
 return{mrr,live:admin.customers.filter(c=>c.status==='Live').length,recent,newCount:admin.orders.filter(o=>o.status==='New').length,margin,vol:act.reduce((n,c)=>n+(+c.vol||0),0),posCount:act.filter(c=>c.pos).length}}
const planName=id=>id==='custom'?'Custom (quote)':id==='storage'?'Design storage':(admin.tiers.find(t=>t.id===id)||{name:id}).name;
const adName=ids=>(ids||[]).map(i=>(addonById(i)||{name:i}).name).join(', ')||'None';
function renderAdmin(){const t=state.adminTab,k=adminKpis();const tabs=[['overview','Overview'],['orders','Orders'],['customers','Customers'],['pricing','Plans & pricing'],['addons','Add-ons'],['pos','POS & payments'],['library','Themes & sections'],['settings','Settings']];
 let body='';
 if(t==='overview'){const series=[.12,.18,.24,.3,.36,.44,.5,.57,.64,.72,.85,1].map(f=>Math.round(f*k.mrr));const counts=admin.tiers.map(x=>admin.customers.filter(c=>c.plan===x.id&&c.status!=='Cancelled').length);const tot=counts.reduce((a,b)=>a+b,0)||1;const cols=['var(--ink)','var(--accent)','var(--gold)','var(--muted)'];
  body=`<div class="kpis"><div class="kpi"><span>Monthly recurring revenue</span><b>${money(k.mrr)}</b><small>Plans, add-ons and POS</small></div><div class="kpi"><span>Live sites</span><b>${k.live}</b><small>${admin.customers.length-k.live} in build or past due</small></div><div class="kpi"><span>Design fees, last 30 days</span><b>${money(k.recent)}</b><small>Includes hardware</small></div><div class="kpi"><span>Processing residuals</span><b>${money(k.margin)}</b><small>Est. on ${money(k.vol)} card volume/mo</small></div><div class="kpi"><span>New orders</span><b>${k.newCount}</b><small>Waiting for you to start</small></div></div>
  <div class="cards2"><div class="card"><h3>Recurring revenue <span class="badge ex">Example history</span></h3><div class="chart">${areaChart(series,640,200,'var(--accent)','color-mix(in srgb,var(--accent) 14%,transparent)',['Nov 2025','Oct 2026'])}</div></div>
  <div class="card"><h3>Plan mix</h3><div class="mix">${counts.map((n,i)=>n?`<span style="flex:${n};background:${cols[i%4]}"></span>`:'').join('')}</div><div class="legend">${admin.tiers.map((x,i)=>`<span><i style="background:${cols[i%4]}"></i>${esc(x.name)} · ${counts[i]}</span>`).join('')}</div>
   <h3 style="margin-top:18px">Point of sale</h3><p class="muted">${k.posCount} of ${admin.customers.length} customers run a Think Web Pros register.</p></div></div>
  <div class="card"><h3>Latest orders <button class="btn sm" data-admintab="orders">All orders</button></h3>${[...admin.orders].reverse().slice(0,4).map(o=>`<div class="sum-line" style="padding:8px 0;border-bottom:1px solid var(--line)"><span><b style="color:var(--ink)">${esc(o.business)}</b> · ${esc(planName(o.plan))}${o.pos?' + '+esc(posPlan(o.pos)?.name||'POS'):''} ${o.sample?'<span class="badge ex">Example</span>':''}</span><span class="num">${money(o.setup)} + ${money(o.monthly)}/mo <span class="badge ${STATUS_CLS[o.status]||''}">${esc(o.status)}</span></span></div>`).join('')}</div>`}
 else if(t==='orders'){body=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Business</th><th>Contact</th><th>Plan</th><th>Add-ons &amp; POS</th><th class="r">Due today</th><th class="r">Monthly</th><th>Status</th></tr></thead><tbody>${[...admin.orders].reverse().map(o=>{const i=admin.orders.indexOf(o);return `<tr class="${o.status==='New'&&!o.sample?'new':''}"><td><b>${o.id}</b>${o.sample?' <span class="badge ex">Example</span>':''}</td><td>${fmtDate(o.at)}</td><td>${esc(o.business)}</td><td>${esc(o.owner)}<br><span class="muted">${esc(o.email)}</span></td><td>${esc(planName(o.plan))}${o.kind==='quote'?`<br><span class="muted">${esc([o.budget,o.timeline].filter(Boolean).join(' · ')||'No budget given')}</span>${o.details?`<br><span class="muted">${esc(o.details.length>140?o.details.slice(0,140)+'…':o.details)}</span>`:''}`:''}</td><td>${esc(adName(o.addons))}${o.pos?'<br>'+esc(posPlan(o.pos)?.name||''):''}${Object.entries(o.hw||{}).filter(([,q])=>q).map(([h,q])=>'<br>'+q+' × '+esc((admin.pos.hardware.find(x=>x.id===h)||{name:h}).name)).join('')}</td><td class="r">${o.kind==='quote'?'Quote':money(o.setup)}${o.kind==='storage'?`<br><span class="muted">${o.designs||0} saved design${o.designs===1?'':'s'}</span>`:''}</td><td class="r">${o.kind==='quote'?'Quote':money(o.monthly)}</td><td><select class="inp sm" id="os-${i}" data-ostatus="${i}">${['New','In build','Live','Cancelled'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></td></tr>`}).join('')}</tbody></table></div>`}
 else if(t==='customers'){body=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Business</th><th>Owner</th><th>Plan</th><th>Add-ons</th><th>POS</th><th class="r">Card volume/mo</th><th class="r">MRR</th><th>Status</th><th>Since</th></tr></thead><tbody>${admin.customers.map(c=>`<tr><td><b>${esc(c.business)}</b>${c.sample?' <span class="badge ex">Example</span>':''}</td><td>${esc(c.owner)}</td><td>${esc(planName(c.plan))}</td><td>${esc(adName(c.addons))}</td><td>${c.pos?esc(posPlan(c.pos)?.name||''):'<span class="muted">None</span>'}</td><td class="r">${c.vol?money(c.vol):'<span class="muted">None</span>'}</td><td class="r">${money(c.mrr)}</td><td><span class="badge ${STATUS_CLS[c.status]||''}">${esc(c.status)}</span></td><td>${fmtDate(c.since)}</td></tr>`).join('')}</tbody></table></div>`}
 else if(t==='pricing'){body=`<p class="muted" style="margin-bottom:12px">Edits apply right away to the plans page, the section limits in the designer, and the order total.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Plan</th><th>Design fee</th><th>Monthly</th><th>Max sections</th><th>Includes</th><th>Features (one per line)</th><th>Popular</th></tr></thead><tbody>${admin.tiers.map((x,i)=>`<tr><td><input class="inp sm" id="t-n-${i}" data-abind="tiers.${i}.name" value="${esc(x.name)}"></td><td><input class="inp sm" type="number" id="t-s-${i}" data-abind="tiers.${i}.setup" data-num value="${x.setup}"></td><td><input class="inp sm" type="number" id="t-m-${i}" data-abind="tiers.${i}.monthly" data-num value="${x.monthly}"></td><td><input class="inp sm" type="number" id="t-x-${i}" data-abind="tiers.${i}.maxSections" data-num value="${x.maxSections}"></td><td style="min-width:170px">${admin.addons.filter(a=>a.billing==='monthly').map(a=>`<label style="display:flex;gap:6px;font-size:12px"><input type="checkbox" id="ti-${i}-${a.id}" data-tinc="${i}|${a.id}" ${x.includes.includes(a.id)?'checked':''}>${esc(a.name)}</label>`).join('')}</td><td><textarea class="inp sm" id="t-f-${i}" rows="5" data-alines="tiers.${i}.features" style="min-width:220px">${esc(x.features.join('\n'))}</textarea></td><td><input type="radio" name="popular" id="t-p-${i}" data-popular="${x.id}" ${admin.popular===x.id?'checked':''} aria-label="Most popular"></td></tr>`).join('')}</tbody></table></div>
 <div class="card" style="margin-top:14px"><h3>Design storage</h3><p class="muted" style="margin:4px 0 10px">Without a plan, customers' designs are kept for a set time. Design storage keeps them for a monthly fee without choosing a plan.</p><div class="grid2f" style="max-width:420px"><label class="fld"><span>Free hold (hours)</span><input class="inp sm" type="number" min="0.25" step="0.25" id="st-hours" data-abind="storage.hours" data-num value="${(admin.storage||{}).hours??1}"></label><label class="fld"><span>Design storage ($/month)</span><input class="inp sm" type="number" min="0" id="st-price" data-abind="storage.price" data-num value="${(admin.storage||{}).price??20}"></label></div></div>`}
 else if(t==='addons'){const lmA=addonById('logomaker');body=`<div class="card" style="margin-bottom:16px"><div class="between"><h3>AI logo maker</h3><span class="badge">${state.aiLog||0} AI requests in this demo</span></div><p class="muted" style="margin:6px 0 12px">Customers get a few free AI requests, then the ${esc(lmA?lmA.name:'AI logo package')} (${lmA?money(lmA.price):''} once, price set in the table below) unlocks unlimited requests.</p><div class="row" style="gap:16px;flex-wrap:wrap;align-items:end"><label class="fld" style="margin:0"><span>Free AI requests per customer</span><input class="inp sm" type="number" min="0" max="20" id="ai-free" data-abind="aiFree" data-num value="${admin.aiFree??3}" style="width:110px"></label><button class="btn sm" data-airesettries>Reset my free requests</button></div></div><div class="between" style="margin-bottom:12px"><p class="muted">Turn add-ons off to hide them from customers. One-time items are added to the design fee.</p><button class="btn pri sm" data-newaddon>${ic('plus',13)} New add-on</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>On</th><th>Name</th><th>Description</th><th>Price</th><th>Billing</th><th></th></tr></thead><tbody>${admin.addons.map((a,i)=>`<tr><td><label class="switch"><input type="checkbox" id="a-en-${i}" data-abind="addons.${i}.enabled" data-hardafter ${a.enabled?'checked':''}><i></i></label></td><td><input class="inp sm" id="a-n-${i}" data-abind="addons.${i}.name" value="${esc(a.name)}"></td><td><input class="inp sm" id="a-d-${i}" data-abind="addons.${i}.desc" value="${esc(a.desc)}" style="min-width:260px"></td><td><input class="inp sm" type="number" id="a-p-${i}" data-abind="addons.${i}.price" data-num value="${a.price}"></td><td><select class="inp sm" id="a-b-${i}" data-abind="addons.${i}.billing" data-hardafter><option value="monthly" ${a.billing==='monthly'?'selected':''}>Monthly</option><option value="once" ${a.billing==='once'?'selected':''}>One time</option></select></td><td><button class="btn sm danger" data-deladdon="${i}">Delete</button></td></tr>`).join('')}</tbody></table></div>`}
 else if(t==='pos'){const p=admin.pos;body=`<div class="cards2"><div class="card"><h3>POS plans</h3><div class="tbl-wrap"><table class="tbl" style="min-width:560px"><thead><tr><th>On</th><th>Name</th><th>Monthly</th><th>Description</th></tr></thead><tbody>${p.plans.map((x,i)=>`<tr><td><label class="switch"><input type="checkbox" id="pp-e-${i}" data-abind="pos.plans.${i}.enabled" data-hardafter ${x.enabled?'checked':''}><i></i></label></td><td><input class="inp sm" id="pp-n-${i}" data-abind="pos.plans.${i}.name" value="${esc(x.name)}"></td><td><input class="inp sm" type="number" id="pp-p-${i}" data-abind="pos.plans.${i}.price" data-num value="${x.price}"></td><td><textarea class="inp sm" id="pp-d-${i}" rows="2" data-abind="pos.plans.${i}.desc" style="min-width:220px">${esc(x.desc)}</textarea></td></tr>`).join('')}</tbody></table></div>
  <h3 style="margin-top:18px">Hardware</h3><div class="tbl-wrap"><table class="tbl" style="min-width:560px"><thead><tr><th>On</th><th>Item</th><th>Price</th><th>Description</th></tr></thead><tbody>${p.hardware.map((x,i)=>`<tr><td><label class="switch"><input type="checkbox" id="hw-e-${i}" data-abind="pos.hardware.${i}.enabled" data-hardafter ${x.enabled?'checked':''}><i></i></label></td><td><input class="inp sm" id="hw-n-${i}" data-abind="pos.hardware.${i}.name" value="${esc(x.name)}"></td><td><input class="inp sm" type="number" id="hw-p-${i}" data-abind="pos.hardware.${i}.price" data-num value="${x.price}"></td><td><input class="inp sm" id="hw-d-${i}" data-abind="pos.hardware.${i}.desc" value="${esc(x.desc)}" style="min-width:220px"></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Merchant rates</h3><p class="muted" style="margin-bottom:10px">What customers pay per sale. Your cost sets the residual estimate on the overview.</p>${p.rates.map((r,i)=>`<div class="fld"><span>${esc(r.name)}</span><div class="row"><input class="inp sm" type="number" step="0.05" id="r-p-${i}" data-abind="pos.rates.${i}.pct" data-num value="${r.pct}" style="width:90px" aria-label="Percent"> % +<input class="inp sm" type="number" step="0.01" id="r-f-${i}" data-abind="pos.rates.${i}.fixed" data-num value="${r.fixed}" style="width:90px" aria-label="Fixed fee"> $</div></div>`).join('')}
  <div class="fld"><span>Your cost (interchange + processor)</span><div class="row"><input class="inp sm" type="number" step="0.05" id="cost-p" data-abind="pos.cost.pct" data-num value="${p.cost.pct}" style="width:90px" aria-label="Cost percent"> % +<input class="inp sm" type="number" step="0.01" id="cost-f" data-abind="pos.cost.fixed" data-num value="${p.cost.fixed}" style="width:90px" aria-label="Cost fixed"> $</div></div>
  <label class="fld"><span>Monthly merchant account fee</span><input class="inp sm" type="number" id="m-fee" data-abind="pos.merchantMonthly" data-num value="${p.merchantMonthly}" style="width:120px"></label>
  <label class="fld"><span>Average ticket used for estimates</span><input class="inp sm" type="number" id="avg-t" data-abind="pos.avgTicket" data-num value="${p.avgTicket}" style="width:120px"></label>
  <div class="demo-note">Residuals at current settings: ${money(k.margin)}/mo on ${money(k.vol)} of customer card volume (example customers).</div></div></div>`}
 else if(t==='library'){body=`<div class="cards2"><div class="card"><h3>Themes customers can pick</h3>${Object.entries(THEMES).map(([kk,x])=>`<div class="sum-line" style="padding:8px 0;border-bottom:1px solid var(--line);align-items:center"><span class="row"><span style="display:flex;width:60px;height:18px;border-radius:5px;overflow:hidden">${['p','a','sf'].map(c=>`<span style="flex:1;background:${x.colors[c]}"></span>`).join('')}</span><b style="color:var(--ink)">${x.name}</b></span><label class="switch"><input type="checkbox" id="th-${kk}" data-abind="themes.${kk}" data-hardafter ${admin.themes[kk]!==false?'checked':''}><i></i></label></div>`).join('')}</div>
  <div class="card"><h3>Section library</h3><p class="muted" style="margin-bottom:8px">Turn sections off, or make any section a paid add-on.</p>${Object.entries(CATALOG).map(([kk,c])=>`<div class="sum-line" style="padding:7px 0;border-bottom:1px solid var(--line);align-items:center"><span class="row" style="color:var(--ink)">${thumb(kk)}<b>${c.name}</b></span><span class="row"><select class="inp sm" id="sr-a-${kk}" data-abind="sections.${kk}.addon" data-hardafter aria-label="Requires add-on" style="width:150px"><option value="">Free</option>${admin.addons.map(a=>`<option value="${a.id}" ${rule(kk).addon===a.id?'selected':''}>Needs ${esc(a.name)}</option>`).join('')}</select><label class="switch"><input type="checkbox" id="sr-e-${kk}" data-abind="sections.${kk}.enabled" data-hardafter ${rule(kk).enabled?'checked':''}><i></i></label></span></div>`).join('')}</div></div>`}
 else{body=`<div class="card" style="max-width:560px"><h3>Business settings</h3><label class="fld"><span>Company name (shown on customer sites)</span><input type="text" id="s-co" data-abind="company" value="${esc(admin.company)}"></label><label class="fld"><span>Free site address domain</span><input type="text" id="s-dom" data-abind="domain" value="${esc(admin.domain)}"></label>
  <h3 style="margin-top:20px">Demo data</h3><p class="muted" style="margin-bottom:10px">Clears the design, orders and pricing in this browser and restores the sample setup.</p><button class="btn danger" data-reset>Reset demo</button></div>`}
 $('#v-admin').innerHTML=`<div class="admin"><div class="admin-h"><div><h1>${esc(admin.company)} admin</h1><p class="muted">Your side of the business: orders, customers, pricing and what customers can use.</p></div><span class="badge">Only you see this</span></div><nav class="subnav">${tabs.map(([kk,l])=>`<button type="button" data-admintab="${kk}" class="${t===kk?'on':''}">${l}</button>`).join('')}</nav>${body}</div>`}

/* ---------- events ---------- */
function setTab(t){state.tab=t;closeModal();hard();$('#v-'+t).scrollTop=0}
document.addEventListener('click',e=>{const T=e.target;const q=s=>T.closest(s);let el;
 if(!q('.ac-wrap'))acClose();
 if(el=q('[data-closemodal]')){closeModal();return}
 if(T.matches('[data-modalbg]')){closeModal();return}
 if(el=q('[data-admintab]')){state.adminTab=el.dataset.admintab;if(el.dataset.tab)state.tab=el.dataset.tab;closeModal();hard();return}
 if(el=q('[data-tab]')){setTab(el.dataset.tab);return}
 if(el=q('[data-toggle]')){const p=el.dataset.toggle;if(p==='lib'?state.libOpen:state.inspOpen){if(p==='lib')state.libOpen=false;else state.inspOpen=false;openPanel('none')}else openPanel(p);save();return}
 if(el=q('[data-coachoff]')){state.coach=false;$('#coach').hidden=true;save();return}
 if(el=q('[data-startover]')){OB=obDefaults(true);Object.assign(OB.f,{name:state.brand.name,phone:phoneOf()||'',email:(firstOf('contact')||{data:{}}).data.email||''});state.onboarded=false;hard();return}
 if(el=q('[data-obgoal]')){OB.f.goal=el.dataset.obgoal;OB.f.goalTouched=true;$$('[data-obgoal]').forEach(b=>{b.classList.toggle('on',b===el);b.setAttribute('aria-pressed',b===el)});return}
 if(el=q('[data-obskip]')){state.onboarded=true;state.coach=true;OB=null;hard();return}
 if(el=q('[data-obcancel]')){state.onboarded=true;OB=null;hard();return}
 if(el=q('[data-obback]')){OB.step=1;renderStart();return}
 if(el=q('[data-obstyle]')){OB.style=el.dataset.obstyle;$$('[data-obstyle]').forEach(c=>{const on=c===el;c.classList.toggle('on',on);c.setAttribute('aria-checked',on);const bd=c.querySelector('.badge');if(bd)bd.remove();if(on)c.querySelector('.between').insertAdjacentHTML('beforeend',`<span class="badge acc">${ic('check',12)} Selected</span>`)});return}
 if(el=q('[data-obbuild]')){obBuild();return}
 if(el=q('#deviceSeg [data-device]')){state.device=el.dataset.device;$('#device').dataset.device=state.device;$$('#deviceSeg button').forEach(b=>b.classList.toggle('on',b.dataset.device===state.device));save();fitDevice();if(state.rightTab==='brand')renderInspector();return}
 if(el=q('#undoBtn')){undo();return}
 if(el=q('#redoBtn')){redo();return}
 if(el=q('#saveBtn')){saveDesign();return}
 if(el=q('[data-rt]')){state.rightTab=el.dataset.rt;renderInspector();return}
 if(el=q('[data-add]')){if(isNarrow())state.libOpen=false;insertSection(el.dataset.add);return}
 if(el=q('[data-select]')){selectSection(el.dataset.select);return}
 if(el=q('[data-sact]')){sectionAct(el.closest('[data-id]').dataset.id,el.dataset.sact);return}
 if(el=q('[data-sact2]')){sectionAct(state.selected,el.dataset.sact2);return}
 if(el=q('[data-variant]')){const s=sec(state.selected);if(s){snap();s.variant=el.dataset.variant;hard()}return}
 if(el=q('[data-theme-pick]')){const k=el.dataset.themePick,t=THEMES[k],pal=themePal(k),m=state.brand.mode||'light';snap();Object.assign(state.brand,{theme:k,pal,colors:{...pal[m]},font:t.font,radius:t.radius,btn:t.btn});hard();return}
 if(el=q('[data-stylepick]')){applyStyle(el.dataset.stylepick);return}
 if(el=q('[data-mode]')){setMode(el.dataset.mode==='toggle'?(state.brand.mode==='dark'?'light':'dark'):el.dataset.mode);return}
 if(el=q('[data-psave]')){savePreset();return}
 if(el=q('[data-pload]')){loadPreset(el.dataset.pload);return}
 if(el=q('[data-pdel]')){state.presets=state.presets.filter(x=>x.id!==el.dataset.pdel);save();renderInspector();toast('Style removed');return}
 if(el=q('[data-pover]')){savePreset(el.dataset.pover);return}
 if(el=q('button[data-bgx]')){snap();const[tg,k]=el.dataset.bgx.split('|');setBgx(tg,k,el.dataset.v);renderInspector();return}
 if(el=q('[data-bgxall]')){const src=bgOf(el.dataset.bgxall);if(src){snap();state.sections.forEach(x=>{x.bg=JSON.parse(JSON.stringify(src))});save();hard();toast('Background copied to every section')}return}
 if(el=q('[data-bgxreset]')){snap();const tg=el.dataset.bgxreset;if(tg==='page')delete state.brand.bg;else{const x=sec(tg.slice(4));if(x)delete x.bg}save();hard();return}
 if(el=q('[data-start]')){startWith(el.dataset.start);return}
 if(el=q('[data-addsugg]')){const t=nextSuggested();if(t){insertSection(t);hard();setTimeout(()=>{const n=document.querySelector(`#site [data-sec="${state.selected}"]`);if(n)n.scrollIntoView({block:'start',behavior:'smooth'})},80)}return}
 if(el=q('[data-browse]')){openPanel('lib');save();return}
 if(el=q('[data-bizwrite]')){bizWrite();return}
 if(el=q('[data-sheetsize]')){SHEET_TALL=!SHEET_TALL;sheetState();return}
 if(el=q('[data-gonext]')){if(requireBiz()){state.tab='plans';hard();window.scrollTo(0,0)}return}
 if(el=q('[data-acpick]')){const inp=el.closest('.ac-wrap').querySelector('[data-addr]');acPick(inp,el.dataset.acpick);return}
 if(el=q('[data-resetcolors]')){snap();state.brand.colors={...THEMES[state.brand.theme].colors};hard();return}
 if(el=q('[data-brandset]')){const[k,v]=el.dataset.brandset.split('|');snap();state.brand[k]=v;hard();return}
 if(el=q('[data-pick]')){pickTarget=el.dataset.pick;$('#filePick').click();return}
 if(el=q('[data-imgclear]')){setImage(el.dataset.imgclear,null);return}
 if(el=q('[data-gdel]')){const[id,path,i]=el.dataset.gdel.split('|');const s=sec(id);snap();getPath(s.data,path).splice(+i,1);hard();return}
 if(el=q('[data-liadd]')){const[id,path]=el.dataset.liadd.split('|');const s=sec(id);snap();const arr=getPath(s.data,path);const blank=(path==='items'?ITEM_BLANK[s.type]:LIST_BLANK[path])||clone(arr[arr.length-1]||{});arr.push(clone(blank));hard();return}
 if(el=q('[data-lidel]')){const[id,path,i]=el.dataset.lidel.split('|');snap();getPath(sec(id).data,path).splice(+i,1);hard();return}
 if(el=q('[data-limove]')){const[id,path,i,d]=el.dataset.limove.split('|');const arr=getPath(sec(id).data,path);const a=+i,b=a+(+d);if(b<0||b>=arr.length)return;snap();[arr[a],arr[b]]=[arr[b],arr[a]];hard();return}
 if(el=q('[data-settier]')){state.cart.tier=el.dataset.settier;toast(`Switched to ${tierById(state.cart.tier).name}`);hard();return}
 if(el=q('[data-cartadd]')){const id=el.dataset.cartadd;if(!state.cart.addons.includes(id))state.cart.addons.push(id);toast(`${addonById(id)?.name||'Add-on'} added to your plan`);hard();return}
 if(el=q('[data-merchanton]')){state.cart.merchant=true;toast('Card payments turned on');hard();return}
 if(el=q('[data-logomaker]')){e.preventDefault();openLogoMaker();return}
 if(el=q('[data-lmset]')){const[k,v]=el.dataset.lmset.split('|');LM[k]=v;renderLogoMaker();return}
 if(el=q('[data-lmshuffle]')){lmIdeas=Array.from({length:3},lmRandom);renderLogoMaker();return}
 if(el=q('[data-lmsugg]')){lmAsk(el.dataset.lmsugg);return}
 if(el=q('[data-lmbuy]')){lmBuy();return}
 if(el=q('[data-airesettries]')){state.aiTries=0;state.cart.addons=state.cart.addons.filter(x=>x!=='logomaker');save();toast('Free AI requests reset and the AI logo package removed from your order');return}
 if(el=q('[data-lmidea]')){LM={...lmIdeas[+el.dataset.lmidea]};renderLogoMaker();return}
 if(el=q('[data-lmuse]')){lmUse();return}
 if(el=q('[data-tier]')){state.cart.tier=el.dataset.tier;hard();return}
 if(el=q('[data-posset]')){state.cart.pos=el.dataset.posset||null;if(state.cart.pos){state.cart.merchant=true;toast(`${posPlan(state.cart.pos).name} added. Card processing is included.`)}hard();return}
 if(el=q('[data-hw]')){const[id,d]=el.dataset.hw.split('|');state.cart.hw[id]=Math.max(0,(state.cart.hw[id]||0)+(+d));hard();return}
 if(el=q('[data-annual]')){state.cart.annual=el.dataset.annual==='1';hard();return}
 if(el=q('[data-checkout]')){openCheckout();return}
 if(el=q('[data-quote]')){openQuote();return}
 if(el=q('[data-wmove]')){const[k,d]=el.dataset.wmove.split('|');const o=state.dash.order,i=o.indexOf(k),j=i+(+d);if(j<0||j>=o.length)return;[o[i],o[j]]=[o[j],o[i]];hard();return}
 if(el=q('[data-leadread]')){const l=state.leads.find(x=>x.id===el.dataset.leadread);if(l)l.read=true;hard();return}
 if(el=q('[data-newaddon]')){admin.addons.push({id:'custom-'+uid(),name:'New add-on',desc:'Describe what the customer gets.',price:10,billing:'monthly',enabled:true});hard();return}
 if(el=q('[data-deladdon]')){if(!el.classList.contains('confirm-on')){el.classList.add('confirm-on');el.textContent='Click to confirm';setTimeout(()=>{if(el.isConnected){el.classList.remove('confirm-on');el.textContent='Delete'}},3000);return}
  const a=admin.addons.splice(+el.dataset.deladdon,1)[0];Object.values(admin.sections).forEach(r=>{if(r.addon===a.id)r.addon=null});admin.tiers.forEach(t=>t.includes=t.includes.filter(x=>x!==a.id));state.cart.addons=state.cart.addons.filter(x=>x!==a.id);toast(`${a.name} deleted`);hard();return}
 if(el=q('[data-reset]')){if(!el.classList.contains('confirm-on')){el.classList.add('confirm-on');el.textContent='Click again to reset everything';return}
  try{localStorage.removeItem(KEY)}catch(err){}state=defaultState();admin=defaultAdmin();hist.length=0;toast('Demo reset');state.tab='admin';state.adminTab='settings';hard();return}
 /* inside customer site previews */
 if(el=q('[data-ss-go]')){const b=el.closest('[data-ss]');b._tap=Date.now();ssGo(b,(ssIdx[b.dataset.ss]||0)+(+el.dataset.ssGo));return}
 if(el=q('[data-ss-to]')){const b=el.closest('[data-ss]');ssGo(b,+el.dataset.ssTo);return}
 if(el=q('[data-ss-li]')){const b=el.closest('section').querySelector('[data-ss]');ssGo(b,+el.dataset.ssLi);return}
 if(el=q('[data-slot]')){$$('[data-slot]',el.parentElement).forEach(x=>x.classList.toggle('on',x===el));return}
 if(el=q('[data-shopadd]')){toast(`Added ${el.dataset.shopadd} to the cart (demo store)`);return}
 if(el=q('[data-act]')){const host=el.closest('[data-sec]');if(el.dataset.act==='addaddon'){const id=el.dataset.addon;if(!state.cart.addons.includes(id))state.cart.addons.push(id);toast(`${addonById(id).name} added to your plan`);hard();return}
  if(host)sectionAct(host.dataset.sec,el.dataset.act);return}
 if(q('#site')){const im=q('[data-img]');if(im&&!q('.sec-tools')&&!q('[data-edit],[data-editb]')){pickTarget=im.dataset.img;$('#filePick').click();const s=q('[data-sec]');if(s)selectSection(s.dataset.sec);return}
  const s=q('[data-sec]');if(s&&!s.classList.contains('sec-hidden'))selectSection(s.dataset.sec);else if(q('.hdr'))state.rightTab='brand',renderInspector()}
});
document.addEventListener('keydown',e=>{if(e.target.dataset&&e.target.dataset.addr!==undefined&&$('.ac-list')){const t=e.target;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();acMove(t,e.key==='ArrowDown'?1:-1);return}
  if(e.key==='Enter'&&acIdx>=0){e.preventDefault();const it=$$('.ac-list [data-acpick]',t.parentElement)[acIdx];if(it)acPick(t,it.dataset.acpick);return}
  if(e.key==='Escape'){acClose();return}}
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=radio][data-tier],[role=radio][data-posset],[role=radio][data-obstyle]')){e.preventDefault();e.target.click()}
 if(e.key==='Enter'&&!e.shiftKey&&e.target.matches&&e.target.matches('[data-edit],[data-editb]')&&!e.target.hasAttribute('data-ml')){e.preventDefault();e.target.blur()}
 if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='lm-ask'){e.preventDefault();lmAsk(e.target.value);return}
 if(e.key==='Escape'&&$('#modalRoot').innerHTML){if(lmAbort)lmAbort.abort();closeModal()}
 if((e.metaKey||e.ctrlKey)&&e.key==='z'&&!e.target.matches('input,textarea')&&state.tab==='builder'){e.preventDefault();undo()}});
const valOf=t=>t.type==='checkbox'?t.checked:(t.hasAttribute('data-num')?(t.value===''?0:Number(t.value)):t.value);
let snapped=null;
document.addEventListener('focusin',e=>{const t=e.target;if(t.dataset&&t.dataset.biz)showBizTarget(t.dataset.biz);if(t.dataset&&(t.dataset.sf||t.dataset.bind||t.dataset.edit||t.dataset.editb||t.dataset.biz||t.dataset.bgx)&&snapped!==t){snapped=t;snap()}});
document.addEventListener('paste',e=>{const t=e.target&&e.target.closest&&e.target.closest('[data-edit],[data-editb]');if(!t||CE==='plaintext-only')return;e.preventDefault();const txt=(e.clipboardData||window.clipboardData).getData('text/plain');if(!document.execCommand||!document.execCommand('insertText',false,txt))t.textContent+=txt;t.dispatchEvent(new Event('input',{bubbles:true}))});
document.addEventListener('focusout',e=>{const t=e.target;if(t.dataset&&t.dataset.addr!==undefined)setTimeout(()=>{const ae=document.activeElement;if(!(ae&&ae.closest&&ae.closest('.ac-wrap'))&&!document.querySelector('.ac-list:hover'))acClose()},180);if(!(t.dataset&&(t.dataset.edit||t.dataset.editb)))return;const n=e.relatedTarget;if(n&&n.closest&&n.closest('#site [data-edit],#site [data-editb]'))return;setTimeout(()=>{const a=document.activeElement;if(!(a&&a.closest&&a.closest('#site [data-edit],#site [data-editb]'))&&state.tab==='builder'){paintSite($('#site'),true);renderUrl();renderList()}},0)});
document.addEventListener('input',e=>{const t=e.target;
 if(t.dataset&&(t.dataset.edit||t.dataset.editb)){const v=t.innerText.replace(/\n+$/,'');if(t.dataset.edit){const[id,path]=t.dataset.edit.split('|');const s=sec(id);if(s)setPath(s.data,path,v);const f=document.querySelector(`#inspector [data-sf="${CSS.escape(t.dataset.edit)}"]`);if(f)f.value=v}else{setPath(state,t.dataset.editb,v);const f=document.querySelector(`#inspector [data-bind="${t.dataset.editb}"]`);if(f)f.value=v;if(t.dataset.editb==='brand.name')renderUrl()}save();return}
 if(t.dataset&&t.dataset.bgx&&t.type!=='checkbox'){const[tg,k]=t.dataset.bgx.split('|');setBgx(tg,k,t.value,t.type==='range'||t.type==='color');return}
 if(t.dataset&&t.dataset.addr!==undefined)acShow(t);
 if(t.dataset&&t.dataset.ob){OB.f[t.dataset.ob]=t.value;return}
 if(t.dataset&&t.dataset.biz&&t.tagName!=='SELECT'){setBiz(t.dataset.biz,t.value);refreshBiz(t.dataset.biz);if(t.dataset.biz==='name'&&state.tab==='builder')renderUrl();soft();return}
 if(t.dataset&&t.dataset.pname){const p=(state.presets||[]).find(x=>x.id===t.dataset.pname);if(p){p.name=t.value.slice(0,40);save()}return}
 if(t.type==='checkbox'||t.tagName==='SELECT'||t.type==='radio')return;
 if(t.dataset.bind){setPath(state,t.dataset.bind,valOf(t));const rr=t.hasAttribute('data-rerender');if(t.type==='range'){const s=t.closest('.fld')?.querySelector('span .num');if(s)s.textContent=t.dataset.bind==='cart.volume'?money(+t.value):t.dataset.bind==='cart.inPerson'?`${t.value}% in person`:t.value+'px'}
  if(rr){renderCartPill();save();const est=t.closest('.estim')?.querySelector('.between .num');if(est){const pr=processing();est.textContent=`${money(pr.fees,2)}/mo · ${pr.eff.toFixed(2)}%`}return}
  if(t.dataset.bind==='brand.name'&&state.tab==='builder')renderUrl();soft();return}
 if(t.dataset.sf){const[id,path]=t.dataset.sf.split('|');const s=sec(id);if(s){setPath(s.data,path,valOf(t));if(s.type==='slideshow'&&path==='interval'){soft();return}}soft();return}
 if(t.dataset.abind){setPath(admin,t.dataset.abind,valOf(t));renderCartPill();save();return}
 if(t.dataset.alines){setPath(admin,t.dataset.alines,t.value.split('\n'));save();return}
 if(t.dataset.lm){LM[t.dataset.lm]=t.dataset.lm==='upper'?!!t.value:t.value;lmPaint();return}});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.bgx&&t.type==='checkbox'){snap();const[tg,k]=t.dataset.bgx.split('|');setBgx(tg,k,t.checked);renderInspector();return}
 if(t.dataset.biz==='industry'){state.biz.industry=t.value;save();const w=$('[data-bizwrite]');if(w)w.disabled=!t.value;return}
 if(t.dataset.bizshow){const k=t.dataset.bizshow;state.biz.show[k]=t.checked;const sw=t.closest('.mini-sw');if(sw){sw.classList.toggle('off',!t.checked);sw.querySelector('span').textContent=t.checked?'On page':'Hidden'}save();soft();toast(t.checked?'Showing it on your page again':'Hidden from your page. We still keep it for your account.');return}
 if(t.id==='filePick'){const f=t.files[0];t.value='';if(f&&pickTarget)loadInto(pickTarget,f);return}
 if(t.dataset.gadd){const[id,path]=t.dataset.gadd.split('|');const files=[...t.files];t.value='';(async()=>{const s=sec(id);snap();for(const f of files){try{getPath(s.data,path).push(await readImage(f))}catch(err){toast(err.message)}}hard();toast(files.length+' photo'+(files.length>1?'s':'')+' added')})();return}
 if(t.dataset.ob==='industry'){OB.f.industry=t.value;OB.style=kitLayouts(t.value)[kitFirst(t.value)].style;if(!OB.f.goalTouched)OB.f.goal=(INDUSTRIES[t.value]||{}).goal||'call';renderStart();const n=$('#ob-ind');if(n)n.focus();return}
 if(t.dataset.lm&&t.tagName==='SELECT'){LM[t.dataset.lm]=t.dataset.lm==='upper'?!!t.value:t.value;lmPaint();return}
 if(t.dataset.rerender){const id=t.id;hard();const n=document.getElementById(id);if(n)n.focus();return}
 if(t.dataset.bind&&(t.type==='checkbox'||t.tagName==='SELECT')){snap();setPath(state,t.dataset.bind,valOf(t));hard();return}
 if(t.dataset.vis){const s=sec(t.dataset.vis);snap();s.hidden=!t.checked;hard();return}
 if(t.dataset.rev){const[id,i]=t.dataset.rev.split('|');const it=sec(id).data.items[+i];it.hidden=!t.checked;hard();return}
 if(t.dataset.wtoggle){state.dash.off[t.dataset.wtoggle]=!t.checked;hard();return}
 if(t.dataset.cartaddon){const id=t.dataset.cartaddon;state.cart.addons=t.checked?[...new Set([...state.cart.addons,id])]:state.cart.addons.filter(x=>x!==id);hard();return}
 if(t.dataset.merchant!=null&&t.type==='checkbox'){state.cart.merchant=t.checked;hard();return}
 if(t.dataset.abind&&(t.type==='checkbox'||t.tagName==='SELECT')){setPath(admin,t.dataset.abind,t.tagName==='SELECT'&&t.value===''?null:valOf(t));hard();return}
 if(t.dataset.tinc){const[i,id]=t.dataset.tinc.split('|');const inc=admin.tiers[+i].includes;admin.tiers[+i].includes=t.checked?[...new Set([...inc,id])]:inc.filter(x=>x!==id);hard();return}
 if(t.dataset.popular){admin.popular=t.dataset.popular;save();return}
 if(t.dataset.ostatus){const o=admin.orders[+t.dataset.ostatus];o.status=t.value;const c=admin.customers.find(c=>c.business===o.business);if(c&&t.value!=='New')c.status=t.value==='Cancelled'?'Cancelled':t.value;hard();return}});
document.addEventListener('submit',e=>{const f=e.target;e.preventDefault();
 if(f.id==='coForm'){placeOrder();return}
 if(f.id==='quoteForm'){placeQuote();return}
 if(f.matches('[data-lmform]')){lmAsk($('#lm-ask').value);return}
 if(f.id==='obForm'){OB.step=2;renderStart();$('#v-start').scrollTop=0;return}
 if(f.matches('[data-contact]')){const d=new FormData(f);state.leads.push({id:uid(),name:d.get('name'),email:d.get('email'),msg:d.get('msg'),at:Date.now(),read:false});f.reset();save();toast('Message sent. It is in the owner dashboard inbox.',{label:'Open dashboard',fn:()=>setTab('dashboard')});return}
 if(f.matches('[data-booking]')){const d=new FormData(f);const slot=f.querySelector('.slot.on');const svc=String(d.get('service')||'');state.bookings.push({id:uid(),name:d.get('name'),service:svc.replace(/ \(.*\)$/,''),date:d.get('date'),time:slot?slot.textContent:'',sample:false});f.reset();save();toast('Booking requested. It shows in the owner dashboard.',{label:'Open dashboard',fn:()=>setTab('dashboard')});return}});

/* drag and drop: sections, library, dashboard widgets, image files */
let drag=null;let dropLine=null;
document.addEventListener('dragstart',e=>{const t=e.target;if(!(t instanceof Element))return;
 const lib=t.closest('[data-new]'),li=t.closest('.secitem'),ds=t.closest('[data-dragsec]'),w=t.closest('[data-wid]');
 if(lib)drag={kind:'new',type:lib.dataset.new};else if(ds)drag={kind:'move',id:ds.dataset.dragsec};else if(li)drag={kind:'move',id:li.dataset.id};else if(w)drag={kind:'widget',id:w.dataset.wid};else return;
 e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',drag.type||drag.id)}catch(err){}});
document.addEventListener('dragend',()=>{drag=null;clearDrop()});
function clearDrop(){$$('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));$$('.over').forEach(x=>x.classList.remove('over'));if(dropLine){dropLine.remove();dropLine=null}}
function listIndex(container,sel,y){const items=$$(sel,container);for(let i=0;i<items.length;i++){const r=items[i].getBoundingClientRect();if(y<r.top+r.height/2)return{i,el:items[i],before:true}}return{i:items.length,el:items[items.length-1],before:false}}
function siteIndex(y,skip){const secs=$$('#site .smain > [data-sec]');for(let i=0;i<secs.length;i++){const r=secs[i].getBoundingClientRect();if(y<r.top+r.height/2)return{i,el:secs[i],top:r.top}}const last=secs[secs.length-1];return{i:secs.length,el:last,top:last?last.getBoundingClientRect().bottom:0}}
const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
document.addEventListener('dragover',e=>{
 if(hasFiles(e)){const z=e.target.closest&&e.target.closest('#site [data-img],[data-drop-img]');if(z){e.preventDefault();clearDrop();z.classList.add('over')}return}
 if(!drag)return;
 if(drag.kind==='widget'){const wl=e.target.closest&&e.target.closest('#wlist');if(!wl)return;e.preventDefault();clearDrop();const r=listIndex(wl,'.witem',e.clientY);if(r.el)r.el.classList.add(r.before?'drop-before':'drop-after');return}
 const list=e.target.closest&&e.target.closest('#secList');
 if(list){e.preventDefault();clearDrop();const r=listIndex(list,'.secitem',e.clientY);if(r.el)r.el.classList.add(r.before?'drop-before':'drop-after');return}
 const cv=e.target.closest&&e.target.closest('#canvas');
 if(cv){e.preventDefault();showSiteDrop(e.clientY)}});
function showSiteDrop(y){const cv=$('#canvas');clearDrop();const r=siteIndex(y);const dev=$('#device').getBoundingClientRect(),cr=cv.getBoundingClientRect();dropLine=document.createElement('div');dropLine.className='drop-line';const z=devZ();dropLine.style.top=((r.top-cr.top)/z+cv.scrollTop-2)+'px';dropLine.style.left=((dev.left-cr.left)/z+8)+'px';dropLine.style.right='auto';dropLine.style.width=(dev.width/z-16)+'px';cv.appendChild(dropLine);return r}
document.addEventListener('dragleave',e=>{if(e.target.classList&&e.target.classList.contains('over'))e.target.classList.remove('over')});
document.addEventListener('drop',e=>{
 if(hasFiles(e)){const z=e.target.closest&&e.target.closest('#site [data-img],[data-drop-img]');if(z){e.preventDefault();clearDrop();const f=e.dataTransfer.files[0];loadInto(z.dataset.img||z.dataset.dropImg,f)}return}
 if(!drag)return;const d=drag;drag=null;
 if(d.kind==='widget'){const wl=e.target.closest('#wlist');if(!wl)return;e.preventDefault();const r=listIndex(wl,'.witem',e.clientY);clearDrop();const o=state.dash.order;const from=o.indexOf(d.id);let to=r.i;o.splice(from,1);if(to>from)to--;o.splice(to,0,d.id);hard();return}
 const list=e.target.closest('#secList'),cv=e.target.closest('#canvas');if(!list&&!cv)return;e.preventDefault();
 const idx=list?listIndex(list,'.secitem',e.clientY).i:siteIndex(e.clientY).i;clearDrop();
 if(d.kind==='new')insertSection(d.type,idx);else moveSection(d.id,idx)});


/* ---------- start form (onboarding) ---------- */
const GENERIC_REVIEWS=[['Friendly, fast and they did exactly what they promised.','Chris P.','Google review'],['Easy to work with and great value. We will be back.','Dana & Lee','Repeat customers'],['I recommend {name} to everyone I know.','Morgan T.','Customer']];
const GENERIC_FAQ=[['How do I get started?','Call us or send a message through the form below and we will get back to you within one business day.'],['What areas do you serve?','{city} and nearby towns. Ask if you are not sure.'],['What forms of payment do you accept?','All major cards, Apple Pay and Google Pay.']];
const INDUSTRIES={
 bakery:{label:'Bakery or café',goal:'order',tagline:'Fresh bread, pastries and coffee in {city}',eyebrow:'Bakery & café · {city}',hero:'Baked fresh every morning',sub:'{name} makes bread, pastries and cakes from scratch every day. Stop by the counter or order ahead for pickup.',aboutH:'Made from scratch, every day',about:'{name} started with a simple idea: real ingredients, baked fresh and sold the same day. Our small team is in before sunrise so your morning starts right.',stats:[['Daily','Fresh bakes'],['100%','Made in house'],['5★','Average review']],servicesH:'What we make',intro:'Order ahead for pickup or visit the counter.',services:[['Fresh bread','Naturally leavened loaves baked daily.','From $8'],['Pastries','Croissants, muffins and seasonal treats.','From $4'],['Custom cakes','Birthdays, weddings and office parties.','From $55'],['Catering','Breakfast boxes for groups of 10 or more.','From $90']],slidesH:'Fresh from the oven',slides:['Out of the oven every morning','Seasonal specials','Cakes for every occasion'],gallery:'Inside {name}',reviews:[['Best croissants in {city}. I stop in every Saturday.','Jamie L.','Regular'],['They made our wedding cake and everyone asked where it came from.','Chris & Dana P.','Wedding customer'],['Friendly staff, great coffee and the bread is always fresh.','Morgan T.','Google review']],faq:[['Do you take custom orders?','Yes. Custom cakes need about a week of notice.'],['Do you have gluten-free options?','We bake a few gluten-free items each week. Ask at the counter for today’s selection.'],['Can I order ahead?','Yes, by phone or online, and pick up at the counter.']]},
 restaurant:{label:'Restaurant or food truck',goal:'order',tagline:'Good food and friendly service in {city}',eyebrow:'Now serving {city}',hero:'Come hungry, leave happy',sub:'{name} serves made-to-order dishes with local ingredients. Dine in, take out or let us cater your next event.',aboutH:'A neighborhood table',about:'{name} is a family-run kitchen built around recipes we grew up with and the people we cook for. Pull up a chair.',stats:[['Fresh','Local ingredients'],['7','Days a week'],['5★','Average review']],servicesH:'On the menu',intro:'A few favorites. Ask about today’s specials.',services:[['Lunch plates','Served with two sides.','$14'],['Dinner entrées','Seasonal selections from the chef.','From $19'],['Family meals','Feeds four, ready for pickup.','$48'],['Catering','Trays for offices and parties.','From $120']],slidesH:'From our kitchen',slides:['Plates made to order','Our dining room','Private events'],gallery:'Food and friends',reviews:[['Every dish tastes homemade and the service is always warm.','Alex R.','Google review'],['We had them cater our office party and the trays disappeared.','Pat S.','Catering customer'],['Our go-to spot for Friday dinner.','The Nguyen family','Regulars']],faq:[['Do you take reservations?','Yes, for parties of 6 or more.'],['Do you offer takeout?','Everything on the menu is available for pickup.'],['Can you handle dietary needs?','Tell us and the kitchen will adjust most dishes.']]},
 salon:{label:'Salon, spa or barber',goal:'book',tagline:'Cuts, color and care in {city}',eyebrow:'Salon · {city}',hero:'Look good, feel better',sub:'{name} offers cuts, color and treatments by experienced stylists in a relaxed space.',aboutH:'Your time to unwind',about:'At {name} every appointment starts with a conversation about what you want. Our stylists keep up with the latest techniques so you leave feeling like yourself, only better.',stats:[['10+','Years of experience'],['1:1','Consultations'],['5★','Average review']],servicesH:'Services',intro:'Prices vary by length and stylist.',services:[['Haircut & style','Wash, cut and blowout.','From $45'],['Color','Single process, highlights or balayage.','From $95'],['Treatments','Deep conditioning and scalp care.','From $35'],['Special occasions','Updos for weddings and events.','From $85']],slidesH:'Recent work',slides:['Fresh cuts','Color that lasts','Our studio'],gallery:'Our work',reviews:[['Best haircut I have had in years, and they actually listened.','Taylor B.','Client'],['My color has never looked this good.','Jordan K.','Google review'],['Relaxing, friendly and always on time.','Sam W.','Regular']],faq:[['Do you take walk-ins?','When we have openings. Booking ahead gets you your preferred time.'],['What is your cancellation policy?','Please give us 24 hours notice.'],['Do you sell products?','Yes, we carry the products we use in the salon.']]},
 home:{label:'Home services (roofing, plumbing, cleaning)',goal:'quote',tagline:'Licensed, insured and local to {city}',eyebrow:'Serving {city} and nearby',hero:'Done right the first time',sub:'{name} handles repairs, installs and maintenance with upfront pricing and work we stand behind.',aboutH:'Local, licensed and insured',about:'{name} is a local crew that shows up on time, explains the job in plain language and cleans up after. Every job is backed by our workmanship guarantee.',stats:[['15+','Years in business'],['1,200+','Jobs completed'],['100%','Satisfaction guarantee']],servicesH:'What we do',intro:'Free estimates on every job.',services:[['Repairs','Fast fixes for leaks, damage and breakdowns.','Free estimate'],['Installation','New systems installed to code.','Free estimate'],['Maintenance','Seasonal checkups that prevent costly repairs.','From $99'],['Emergency service','Same-day help when it cannot wait.','Call us']],gallery:'Recent projects',reviews:[['They came out the same day and fixed it for less than the other quote.','Linda M.','Homeowner'],['On time, clean and professional.','Greg H.','Google review'],['Clear pricing and great communication from start to finish.','Rachel D.','Repeat customer']],faq:[['Are you licensed and insured?','Yes. We carry full liability insurance and all required licenses.'],['Do you charge for estimates?','No. Estimates are free with no obligation.'],['What areas do you serve?','{city} and surrounding towns.']]},
 fitness:{label:'Fitness, yoga or studio',goal:'book',tagline:'Classes and coaching in {city}',eyebrow:'Studio · {city}',hero:'Stronger every week',sub:'{name} offers classes and coaching for every level, from your first session to your next personal best.',aboutH:'A community that shows up',about:'{name} is built around small classes, real coaching and people who cheer each other on. New here? Your first class is on us.',stats:[['30+','Classes a week'],['All','Levels welcome'],['1st','Class free']],servicesH:'Classes & coaching',intro:'Drop in or save with a membership.',services:[['Group classes','Strength, cardio and mobility.','$20 drop-in'],['Unlimited membership','Every class, every week.','$129/mo'],['Personal training','One-on-one coaching.','From $65'],['Intro offer','Two weeks unlimited for new members.','$39']],slidesH:'Inside the studio',slides:['Morning classes','Coaching that fits you','Our space'],reviews:[['The coaches know my name and push me just the right amount.','Ava P.','Member'],['I have tried a lot of gyms. This is the one I stuck with.','Marcus J.','Google review'],['Welcoming for beginners, challenging for everyone.','Erin S.','Member']],faq:[['I am a beginner. Is that okay?','Absolutely. Every class has options for every level.'],['What should I bring?','Water, comfortable clothes and a towel.'],['Can I pause my membership?','Yes, up to two months a year.']]},
 professional:{label:'Professional services (law, tax, consulting)',goal:'call',tagline:'Trusted advice for {city} families and businesses',eyebrow:'{city}',hero:'Clear advice when it matters',sub:'{name} helps individuals and small businesses with straightforward guidance and responsive service.',aboutH:'Experience you can count on',about:'At {name} you work directly with an experienced professional who takes time to understand your situation and explains your options in plain language.',stats:[['20+','Years of experience'],['500+','Clients served'],['24 hr','Response time']],servicesH:'How we help',intro:'Every engagement starts with a free consultation.',services:[['Consultations','A focused conversation about your situation.','Free'],['Individual services','Personal planning and filings.','From $150'],['Business services','Ongoing support for small businesses.','From $250/mo'],['Reviews','A second look before you sign or file.','From $200']],reviews:[['Responsive, thorough and easy to work with.','Daniel F.','Client'],['They explained everything and saved us real money.','Monica & Lee','Business owners'],['I recommend them to everyone I know.','Karen B.','Google review']],faq:[['How do I get started?','Book a free consultation by phone or through the form below.'],['Do you offer virtual meetings?','Yes, by video or phone.'],['How are fees set?','We quote a flat fee upfront whenever we can.']]},
 retail:{label:'Retail shop or boutique',goal:'order',tagline:'Curated goods in {city}',eyebrow:'Shop local · {city}',hero:'Find something you love',sub:'{name} carries hand-picked goods from makers we know and trust. Shop in store or online.',aboutH:'Small shop, big heart',about:'{name} is an independent shop stocked with things we are excited to share. We love helping you find the perfect gift.',stats:[['200+','Local makers'],['Free','Gift wrapping'],['5★','Average review']],servicesH:'Shop by category',intro:'New arrivals every week.',services:[['Home goods','Candles, ceramics and decor.','From $12'],['Gifts','Ready-to-give picks for every budget.','From $10'],['Apparel','Soft basics and local designs.','From $24'],['Gift cards','Let them choose.','From $25']],slidesH:'This week in the shop',slides:['New arrivals','Gifts for every occasion','Visit the shop'],gallery:'Around the shop',reviews:[['My favorite place to find gifts. Something new every visit.','Hannah C.','Regular'],['Beautiful shop and the owners are lovely.','Isaac M.','Google review'],['My online order arrived fast and wrapped perfectly.','Priya R.','Online customer']],faq:[['Do you ship?','Yes, anywhere in the US. Local pickup is free.'],['What is your return policy?','Returns within 30 days with a receipt.'],['Do you offer gift wrapping?','Always, and it is free.']]},
 pet:{label:'Pet care (grooming, boarding)',goal:'book',tagline:'Grooming and care your pets will love',eyebrow:'Pet care · {city}',hero:'Happy pets, happy owners',sub:'{name} provides gentle grooming and care from people who treat your pets like family.',aboutH:'Gentle hands, patient care',about:'At {name} every pet gets one-on-one attention in a calm space. We take our time so visits are stress-free for pets and their people.',stats:[['5,000+','Pets pampered'],['Certified','Groomers'],['5★','Average review']],servicesH:'Services',intro:'Prices depend on size and coat.',services:[['Full groom','Bath, haircut, nails and ears.','From $55'],['Bath & tidy','Bath, brush and a quick trim.','From $35'],['Nail trim','Walk-ins welcome.','$15'],['Daycare','Supervised play while you work.','$30/day']],slidesH:'Recent visitors',slides:['Fresh from the tub','Our play area','Before and after'],gallery:'Our happy clients',reviews:[['My nervous pup actually gets excited to come here.','Becky L.','Dog owner'],['Great groom, fair price, easy booking.','Tom W.','Google review'],['They send photos during daycare, which I love.','Nina G.','Daycare client']],faq:[['Do you need vaccination records?','Yes, please bring current rabies and bordetella records.'],['How long does a groom take?','Usually 2 to 3 hours depending on size and coat.'],['Do you groom cats?','Yes, on weekday mornings.']]},
 other:{label:'Something else',goal:'call',tagline:'Proudly serving {city}',eyebrow:'{city}',hero:'Welcome to {name}',sub:'{name} is here to help. Learn what we do and get in touch today.',aboutH:'About {name}',about:'Tell your story here: how you started, what you care about and why customers choose you.',stats:[['10+','Years in business'],['100s','Happy customers'],['5★','Average review']],servicesH:'What we offer',intro:'Here is how we can help.',services:[['Service one','Describe what customers get.',''],['Service two','Describe what customers get.',''],['Service three','Describe what customers get.','']],gallery:'Gallery',reviews:GENERIC_REVIEWS,faq:GENERIC_FAQ}
};
const GOALS={call:{label:'Call us',cta:F=>F.phone?'Call '+F.phone:'Call us today'},book:{label:'Book an appointment',cta:()=>'Book now',section:'booking'},order:{label:'Order online',cta:()=>'Order online',section:'shop'},quote:{label:'Request a quote',cta:()=>'Get a free quote'},visit:{label:'Visit in person',cta:()=>'Get directions'}};
const STYLES={
 classic:{name:'Classic',desc:'Clean and trusted. Photo beside the headline.',theme:'harbor',look:'standard',header:'left',v:{hero:'split',slideshow:'framed',about:'left',services:'grid',testimonials:'cards',gallery:'mosaic',faq:'list',map:'side',contact:'split'}},
 magazine:{name:'Magazine',desc:'Editorial layout with huge headlines and numbered sections.',theme:'paper',look:'editorial',header:'center',v:{hero:'poster',slideshow:'full',about:'stacked',services:'grid',testimonials:'spotlight',gallery:'mosaic',faq:'two',map:'wide',contact:'split'},order:['hero','about','services','gallery','slideshow','testimonials','booking','shop','faq','map','contact']},
 loud:{name:'Loud',desc:'Thick outlines, hard shadows and a scrolling ticker.',theme:'loud',look:'brutal',header:'left',v:{hero:'marquee',slideshow:'framed',about:'right',services:'cards',testimonials:'cards',gallery:'grid',faq:'two',map:'side',contact:'centered'},order:['hero','services','shop','booking','about','testimonials','gallery','slideshow','faq','map','contact']},
 luxe:{name:'Luxe',desc:'Quiet, centered and airy, with arched photos.',theme:'luxe',look:'luxe',header:'center',v:{hero:'arch',slideshow:'framed',about:'left',services:'menu',testimonials:'spotlight',gallery:'grid',faq:'list',map:'side',contact:'centered'}},
 playful:{name:'Playful',desc:'Rounded, bouncy and colorful, with blob shapes.',theme:'candy',look:'playful',header:'left',v:{hero:'bubble',slideshow:'split',about:'right',services:'cards',testimonials:'carousel',gallery:'mosaic',faq:'list',map:'side',contact:'split'}},
 tech:{name:'Glass',desc:'Glowing glass tiles on a grid. Made for dark mode.',theme:'neon',look:'glass',header:'left',v:{hero:'bento',slideshow:'full',about:'left',services:'cards',testimonials:'cards',gallery:'mosaic',faq:'two',map:'wide',contact:'split'},order:['hero','services','booking','shop','testimonials','about','slideshow','gallery','faq','map','contact']},
 portfolio:{name:'Portfolio',desc:'Side menu with full-bleed photos up front.',theme:'folio',look:'sidebar',header:'left',v:{hero:'overlay',slideshow:'full',about:'stacked',services:'grid',testimonials:'spotlight',gallery:'mosaic',faq:'list',map:'wide',contact:'centered'},order:['hero','gallery','about','services','slideshow','testimonials','booking','shop','faq','map','contact']},
 retro:{name:'Retro',desc:'Diner signage, emblem badge and checkered trim.',theme:'diner',look:'retro',header:'left',v:{hero:'badge',slideshow:'framed',about:'left',services:'menu',testimonials:'cards',gallery:'grid',faq:'list',map:'side',contact:'split'}}
};
/* ---------- styles: structure, theme and section layouts in one pick ---------- */
function orderBy(secs,order){if(!order)return secs;const hero=secs.filter(x=>x.type==='hero'),rest=secs.filter(x=>x.type!=='hero');let last=-1;const rk=new Map();rest.forEach((x,i)=>{const j=order.indexOf(x.type);if(j>=0)last=j;rk.set(x,(j>=0?j:last+.5)+i/1000)});rest.sort((x,y)=>rk.get(x)-rk.get(y));return[...hero,...rest]}
function styleOf(b,sections,sk){const st=STYLES[sk]||STYLES.classic,th=THEMES[st.theme],mode=b.mode||'light',pal=themePal(st.theme);
 const brand={...b,style:sk,look:st.look,theme:st.theme,mode,pal,colors:{...pal[mode]},font:th.font,radius:th.radius,btn:th.btn,header:b.header==='call'?'call':st.header};
 const secs=sections.map(x=>({...x,variant:st.v[x.type]&&CATALOG[x.type].variants[st.v[x.type]]?st.v[x.type]:x.variant}));
 return{brand,sections:orderBy(secs,st.order)}}
function applyStyle(sk){snap();const r=styleOf(state.brand,state.sections,sk);syncPage();state.pages.forEach(p=>{if(p.id!==state.pageId)p.sections=styleOf(state.brand,p.sections||[],sk).sections});state.brand=r.brand;state.sections=r.sections;hard();toast(`${STYLES[sk].name} style applied. Your words and photos stayed put.`)}
function miniOf(brand,sections,n){const saved=state;state={...state,brand,sections,pages:null};EDIT=false;let h='';try{const hero=sections.find(x=>x.type==='hero'&&!x.hidden);const body=n?sections.filter(x=>!x.hidden&&R[x.type]).slice(0,n).map(x=>bgApply(R[x.type](x),x)).join(''):hero?R.hero(hero):'';h=`<div class="sframe">${headerHtml()}<div class="smain">${body}</div></div>`}finally{state=saved}
 return `<div class="site${texLayer(brand.bg)?' bgx-t':''}${brand.bg&&brand.bg.photo?' bgx-p':''}" data-look="${brand.look||'standard'}" style="${esc(siteVars(brand)+';'+bgStyle(brand.bg))}">${h}</div>`}
function styleCards(){return `<div class="st-grid">${Object.keys(STYLES).filter(k=>admin.themes[STYLES[k].theme]!==false).map(k=>{const r=styleOf(state.brand,state.sections,k);const on=(state.brand.style||'classic')===k;return `<div role="button" tabindex="0" class="st-card${on?' on':''}" data-stylepick="${k}" aria-pressed="${on}" title="${esc(STYLES[k].desc)}"><div class="st-mini">${miniOf(r.brand,r.sections)}</div><b>${esc(STYLES[k].name)}</b></div>`}).join('')}</div>`}
/* ---------- light and dark: two versions of one design, each edited and kept on its own ---------- */
function setMode(m){const B=state.brand;if(!B.pal)B.pal=themePal(B.theme);if(m===B.mode)return;B.pal[B.mode||'light']={...B.colors};B.mode=m;B.colors={...B.pal[m]};save();hard()}
function modeSwitch(){const m=state.brand.mode||'light';return `<div class="mode-sw" role="group" aria-label="Light or dark version"><button type="button" data-mode="light" class="${m==='light'?'on':''}" aria-pressed="${m==='light'}">${ic('sun',15)} Light</button><button type="button" data-mode="dark" class="${m==='dark'?'on':''}" aria-pressed="${m==='dark'}">${ic('moon',15)} Dark</button></div>`}
/* ---------- saved designs (presets): style, layouts and both color versions; never your words or photos ---------- */
function presetSnap(){const B=state.brand;const pal={...(B.pal||themePal(B.theme)),[B.mode||'light']:{...B.colors}};const variants={};state.sections.forEach(x=>{if(!(x.type in variants))variants[x.type]=x.variant});
 return{brand:{style:B.style||'classic',look:B.look||'standard',theme:B.theme,mode:B.mode||'light',pal:JSON.parse(JSON.stringify(pal)),font:B.font,radius:B.radius,btn:B.btn,header:B.header,logoSize:B.logoSize,bg:B.bg?JSON.parse(JSON.stringify(B.bg)):null},bgs:Object.fromEntries(state.sections.filter(x=>x.bg).map(x=>[x.type,JSON.parse(JSON.stringify(x.bg))])),variants,order:[...new Set(state.sections.map(x=>x.type))]}}
function savePreset(overId){const snapd=presetSnap();state.presets=state.presets||[];
 if(overId){const p=state.presets.find(x=>x.id===overId);if(p){Object.assign(p,snapd,{at:Date.now()});save();renderInspector();toast(`Updated “${p.name}”`);return}}
 if(state.presets.length>=8){toast('You can keep 8 saved styles. Delete one to save another.');return}
 const base=(STYLES[snapd.brand.style]||STYLES.classic).name;let n=1;while(state.presets.some(x=>x.name===`${base} ${n}`))n++;
 state.presets.unshift({id:uid(),name:`${base} ${n}`,at:Date.now(),...snapd});save();renderInspector();toast('Style saved with its light and dark versions')}
function presetApply(p,brand,sections){const b={...brand,...p.brand,colors:{...p.brand.pal[p.brand.mode]}};const secs=sections.map(x=>({...x,bg:p.bgs?(p.bgs[x.type]?JSON.parse(JSON.stringify(p.bgs[x.type])):undefined):x.bg,variant:p.variants[x.type]&&CATALOG[x.type].variants[p.variants[x.type]]?p.variants[x.type]:x.variant}));
 const ix=t=>{const i=p.order.indexOf(t);return i<0?99:i};const hero=secs.filter(x=>x.type==='hero'),rest=secs.filter(x=>x.type!=='hero').sort((x,y)=>ix(x.type)-ix(y.type));return{brand:b,sections:[...hero,...rest]}}
function loadPreset(id){const p=(state.presets||[]).find(x=>x.id===id);if(!p)return;snap();const r=presetApply(p,state.brand,state.sections);state.brand=r.brand;state.sections=r.sections;hard();toast(`Loaded “${p.name}”`)}
function presetsHtml(){const ps=state.presets||[];
 return `<div class="sectitle">Saved styles</div><p class="hint">Save the look, layouts and both color versions to reuse. Your words and photos never change when you load one. To keep the whole site, use Designs at the top.</p>
 <button type="button" class="btn sm" data-psave style="width:100%;margin-bottom:10px">${ic('save',14)} Save this style</button>
 ${ps.length?`<div class="pre-list">${ps.map(p=>{const r=presetApply(p,state.brand,state.sections);const sw=m=>['p','a','bg'].map(k=>`<i style="background:${p.brand.pal[m][k]}"></i>`).join('');
  return `<div class="pre"><div class="st-mini">${miniOf(r.brand,r.sections)}</div><div class="pre-b"><input class="pre-n" id="pn-${p.id}" data-pname="${p.id}" value="${esc(p.name)}" aria-label="Design name"><div class="pre-sw"><span title="Light version">${ic('sun',12)}${sw('light')}</span><span title="Dark version">${ic('moon',12)}${sw('dark')}</span></div>
  <div class="pre-act"><button type="button" class="btn sm pri" data-pload="${p.id}">Load</button><button type="button" class="btn sm" data-pover="${p.id}" title="Replace with what's on the page now">Update</button><button type="button" class="iconbtn sm" data-pdel="${p.id}" aria-label="Delete ${esc(p.name)}">${ic('trash',14)}</button></div></div></div>`}).join('')}</div>`:''}`}
function styleTop(){return `<div class="sectitle" style="margin-top:0">Site style</div>${modeSwitch()}<p class="hint">Light and dark each keep their own colors. Edit one, flip to the other, and both are remembered.</p>${styleCards()}${presetsHtml()}<div class="sectitle">Pages and menu</div><button type="button" class="btn sm" data-pagesmgr style="width:100%">${ic('menu',14)} Manage pages</button>${menuPickers()}<div class="sectitle">Page background</div>${bgPanel('page','Gradient, texture and color',false)}<div class="sectitle">Colors and fonts</div>${logoColorsBlock()}`}
/* ---------- blank start and suggested sections ---------- */
const SUGGEST_ORDER=['hero','about','services','testimonials','contact','gallery','map','faq','slideshow','social','cta'];
function nextSuggested_v1(){const have=new Set(state.sections.filter(x=>!x.hidden).map(x=>x.type));return SUGGEST_ORDER.find(t=>!have.has(t)&&rule(t).enabled&&!(rule(t).addon&&!hasAddon(rule(t).addon)))}
function bizForm(){const b=state.biz||{};const ind=b.industry||'bakery';return{name:b.name||state.brand.name,industry:ind,city:(String(b.address||'').split(',')[1]||'').trim(),phone:b.phone||'',email:b.email||'',address:b.address||'',desc:b.about||'',goal:(INDUSTRIES[ind]||{}).goal||'call',logo:state.brand.logo,goalTouched:false}}
function smartSection_v1(type){const st=STYLES[state.brand.style||'classic']||STYLES.classic;let s=null;
 try{const r=buildFromForm({...bizForm(),address:(state.biz&&state.biz.address)||'Your street address'},state.brand.style||'classic');const f=r.sections.find(x=>x.type===type);if(f)s={...f,id:uid()}}catch(e){}
 if(!s)s=mk(type,st.v[type]);
 const cur=state.sections.find(x=>x.type===type);if(cur)s.variant=cur.variant;return s}
function startWith_v1(mode){snap();state.started=true;
 if(mode==='suggested'){const r=buildFromForm(bizForm(),state.brand.style||'classic');state.sections=r.sections;if(!state.biz.name)state.brand.tagline=r.brand.tagline;toast('Here’s a full page to start from. Click anything to change it.')}
 else toast('Blank page. Add sections whenever you’re ready.');hard()}
/* ---------- business info: required before checkout, but each item can be hidden from the page ---------- */
const BIZ_REQ=[['name','Business name'],['phone','Phone'],['email','Email'],['address','Address'],['about','About your business']];
let BIZ_TRIED=false;
function bizOk(k){const v=String((state.biz||{})[k]||'').trim();if(k==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);if(k==='phone')return v.replace(/\D/g,'').length>=10;if(k==='address')return v.length>=8&&/\d/.test(v);if(k==='about')return v.length>=20;return v.length>=2}
function bizMissing(){return BIZ_REQ.filter(([k])=>!bizOk(k))}
const BIZ_ERR={name:'Add your business name.',phone:'Add a phone number with area code.',email:'Add a valid email address.',address:'Add a street address with a number.',about:'Write at least a sentence about your business.'};
function setBiz(k,v){const b=state.biz;b[k]=v;const all=t=>state.sections.filter(x=>x.type===t);
 if(k==='name'&&v.trim())state.brand.name=v.trim();
 if(k==='phone')all('contact').concat(all('map')).forEach(x=>x.data.phone=v);
 if(k==='email')all('contact').forEach(x=>x.data.email=v);
 if(k==='address'){all('map').forEach(x=>x.data.address=v);all('contact').forEach(x=>x.data.address=v)}
 if(k==='about'){const a=all('about')[0];if(a&&v.trim())a.data.body=v}
 save()}
function bizProg(){const miss=bizMissing(),n=BIZ_REQ.length,done=n-miss.length;return `<div class="biz-prog${miss.length?'':' done'}" id="bizProg"><div class="ring" style="--v:${Math.round(done/n*100)}"><span>${done}/${n}</span></div><div><b>${miss.length?'Your business info':'All set'}</b><p>${miss.length?'Needed before checkout. Your page updates as you type.':'Everything we need is here. Continue to plans whenever you’re ready.'}</p></div></div>`}
function bizField(k,label,input,show){const ok=bizOk(k),err=BIZ_TRIED&&!ok,on=state.biz.show[k]!==false;return `<div class="bf${ok?' ok':''}${err?' err':''}" data-bf="${k}"><div class="bf-l"><label for="biz-${k}">${label} <i aria-hidden="true">*</i></label><span class="bf-ok" aria-hidden="true">${ic('check',12)}</span>${show?`<label class="mini-sw${on?'':' off'}" title="Show this on my page"><input type="checkbox" id="bs-${k}" data-bizshow="${k}" ${on?'checked':''}><i></i><span>${on?'On page':'Hidden'}</span></label>`:''}</div>${input}<p class="bf-err">${BIZ_ERR[k]}</p></div>`}
function renderInfo(){const b=state.biz;const v=k=>esc(b[k]||'');
 return `${bizProg()}
 <div class="biz-note">${ic('eyeOff',15)}<span>Rather not show your phone, email or address? Switch it to <b>Hidden</b>. We still need it to set up your account. You can also delete the contact or map section.</span></div>
 ${bizField('name','Business name',`<input type="text" id="biz-name" data-biz="name" value="${v('name')}" placeholder="${esc(state.brand.name)}" autocomplete="organization">`)}
 <div class="bf"><div class="bf-l"><label for="biz-industry">Type of business</label></div><div class="bf-row"><select id="biz-industry" data-biz="industry">${['<option value="">Choose one</option>',...Object.entries(INDUSTRIES).map(([k,x])=>`<option value="${k}" ${b.industry===k?'selected':''}>${esc(x.label)}</option>`)].join('')}</select><button type="button" class="btn sm" data-bizwrite ${b.industry?'':'disabled'} title="Replace the sample words with text written for this type of business">${ic('spark',13)} Write my page</button></div><p class="bf-kit">${ic('layout',13)}<button type="button" data-kitopen>See layouts made for ${esc(b.industry&&b.industry!=='other'?kitOf(b.industry).short.toLowerCase():'your business')}</button></p></div>
 ${bizField('phone','Phone',`<input type="tel" id="biz-phone" data-biz="phone" value="${v('phone')}" placeholder="(207) 555-0142" autocomplete="tel" inputmode="tel">`,true)}
 ${bizField('email','Email',`<input type="email" id="biz-email" data-biz="email" value="${v('email')}" placeholder="hello@yourbusiness.com" autocomplete="email" inputmode="email">`,true)}
 ${bizField('address','Street address',`<div class="ac-wrap"><input type="text" id="biz-address" data-biz="address" data-addr value="${v('address')}" placeholder="Start typing, like 214 Commercial St" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-biz-address"></div>`,true)}
 ${bizField('about','About your business',`<textarea id="biz-about" data-biz="about" rows="4" placeholder="Who you are, what you do and what makes you different. This fills your About section.">${v('about')}</textarea>`)}
 <div class="bf"><div class="bf-l"><label>Logo <small>recommended</small></label></div>${imgField('brand:logo',state.brand.logo,true)}${logoColorsBlock()}</div>
 <button type="button" class="btn pri" data-gonext style="width:100%;margin-top:6px">Continue to plans ${ic('r',15)}</button>`}
function showBizTarget(k){const map={phone:['contact','map'],email:['contact'],address:['map','contact'],about:['about'],industry:['hero'],name:['hero']};const site=$('#site');if(!site)return;
 let el=null;for(const t of map[k]||[]){const s=state.sections.find(x=>x.type===t&&!x.hidden);if(s){el=site.querySelector(`[data-sec="${s.id}"]`);if(el)break}}
 if(k==='name')el=site.querySelector('.hdr')||el;if(!el)return;const pref={about:'.about-copy',phone:'.ct-info,.ct-box,.map-info',email:'.ct-info,.ct-box',address:'.map-info,.ct-info'}[k];const tgt=(pref&&el.querySelector(pref))||el;const cv=$('#canvas');const top=tgt.getBoundingClientRect().top-cv.getBoundingClientRect().top+cv.scrollTop-8;
 setTimeout(()=>{cv.scrollTo({top,behavior:'smooth'});el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')},isNarrow()?350:0)}
function refreshBiz(k){const f=$(`[data-bf="${k}"]`);if(f){const ok=bizOk(k);f.classList.toggle('ok',ok);f.classList.toggle('err',BIZ_TRIED&&!ok)}const p=$('#bizProg');if(p)p.outerHTML=bizProg();bizDot()}
function bizDot(){const t=$('#rtSeg [data-rt="info"]');if(t)t.classList.toggle('need',bizMissing().length>0)}
function requireBiz(){const miss=bizMissing();if(!miss.length)return true;BIZ_TRIED=true;state.tab='builder';state.rightTab='info';if(isNarrow())state.libOpen=false;state.inspOpen=true;hard();
 const nm={name:'business name',phone:'phone',email:'email',address:'address',about:'a short description'};const L=miss.map(x=>nm[x[0]]);toast(`To continue, add your ${L.length>1?L.slice(0,-1).join(', ')+' and '+L[L.length-1]:L[0]}. You can hide any of it from your page.`);
 setTimeout(()=>{const f=$(`#biz-${miss[0][0]}`);if(f){f.scrollIntoView({block:'center',behavior:'smooth'});if(!isNarrow())f.focus({preventScroll:true})}},80);return false}
function bizWrite_v1(){const b=state.biz;if(!b.industry)return;snap();const ind=INDUSTRIES[b.industry];
 const city=(String(b.address).split(',')[1]||'').trim();
 const r=buildFromForm({name:b.name||state.brand.name,industry:b.industry,city,phone:b.phone,email:b.email,address:b.address,desc:'',goal:ind.goal||'call',logo:state.brand.logo,goalTouched:false},state.brand.style||'classic');
 const keep={};state.sections.forEach(x=>{if(x.data.image&&!keep[x.type])keep[x.type]=x.data.image});
 r.sections.forEach(x=>{if(keep[x.type])x.data.image=keep[x.type]});
 const vars={};state.sections.forEach(x=>{if(!(x.type in vars))vars[x.type]=x.variant});r.sections.forEach(x=>{if(vars[x.type])x.variant=vars[x.type]});
 state.sections=r.sections;state.brand.tagline=r.brand.tagline;if(b.about&&b.about.trim()){const a=state.sections.find(x=>x.type==='about');if(a)a.data.body=b.about}
 hard();toast(`Your page now reads like a ${ind.label.toLowerCase()}. Undo brings the old words back.`)}
/* ---------- address suggestions (demo list; the live product would use a maps address service) ---------- */
const AC_CITIES=['Portland, ME 04101','Austin, TX 78701','Denver, CO 80202','Nashville, TN 37203','Seattle, WA 98101','Portland, OR 97204','Phoenix, AZ 85004','Atlanta, GA 30303','Chicago, IL 60601','Dallas, TX 75201','Houston, TX 77002','San Antonio, TX 78205','San Diego, CA 92101','Los Angeles, CA 90012','Sacramento, CA 95814','Boise, ID 83702','Salt Lake City, UT 84101','Las Vegas, NV 89101','Albuquerque, NM 87102','Oklahoma City, OK 73102','Tulsa, OK 74103','Kansas City, MO 64106','St. Louis, MO 63101','Omaha, NE 68102','Minneapolis, MN 55401','Milwaukee, WI 53202','Detroit, MI 48226','Grand Rapids, MI 49503','Columbus, OH 43215','Cleveland, OH 44113','Cincinnati, OH 45202','Indianapolis, IN 46204','Louisville, KY 40202','Lexington, KY 40507','Charlotte, NC 28202','Raleigh, NC 27601','Asheville, NC 28801','Charleston, SC 29401','Greenville, SC 29601','Savannah, GA 31401','Jacksonville, FL 32202','Orlando, FL 32801','Tampa, FL 33602','Miami, FL 33130','Birmingham, AL 35203','New Orleans, LA 70112','Memphis, TN 38103','Knoxville, TN 37902','Chattanooga, TN 37402','Richmond, VA 23219','Virginia Beach, VA 23451','Baltimore, MD 21202','Philadelphia, PA 19106','Pittsburgh, PA 15222','Boston, MA 02108','Providence, RI 02903','Hartford, CT 06103','Burlington, VT 05401','Manchester, NH 03101','Buffalo, NY 14202','Albany, NY 12207','Brooklyn, NY 11201','Newark, NJ 07102','Spokane, WA 99201','Tucson, AZ 85701','Fresno, CA 93721','Reno, NV 89501','Billings, MT 59101','Fargo, ND 58102','Sioux Falls, SD 57104','Des Moines, IA 50309','Little Rock, AR 72201','Jackson, MS 39201','Madison, WI 53703','Anchorage, AK 99501','Honolulu, HI 96813'];
const AC_SUF=[['St','street'],['Ave','avenue'],['Rd','road'],['Blvd','boulevard'],['Dr','drive'],['Ln','lane'],['Way','way'],['Ct','court'],['Pl','place'],['Pkwy','parkway'],['Hwy','highway']];
const tcase=x=>x.toLowerCase().replace(/(^|\s)([a-z])/g,(m,a,c)=>a+c.toUpperCase());
function acSuggest(raw){const t=raw.trim().replace(/\s+/g,' ');if(t.length<3)return[];const parts=t.split(',');const st=parts[0].trim(),cityQ=parts.slice(1).join(',').trim().toLowerCase();
 const fromCity=q=>AC_CITIES.filter(c=>c.toLowerCase().startsWith(q));
 const m=st.match(/^(\d+[a-z]?)\s+(.+)$/i);
 if(!m)return /^\d+$/.test(t)?[]:fromCity(t.toLowerCase()).slice(0,5);
 const num=m[1],words=m[2].split(' '),last=words[words.length-1].toLowerCase().replace(/\.$/,'');
 const exact=AC_SUF.find(([a,b])=>a.toLowerCase()===last||b===last);let streets;
 if(exact&&words.length>1)streets=[tcase(words.slice(0,-1).join(' '))+' '+exact[0]];
 else{const pre=words.length>1?AC_SUF.filter(([a,b])=>b.startsWith(last)):[];
  streets=pre.length?pre.slice(0,3).map(([a])=>tcase(words.slice(0,-1).join(' '))+' '+a):['St','Ave','Rd'].map(a=>tcase(words.join(' '))+' '+a)}
 if(cityQ){const cs=fromCity(cityQ);if(!cs.length)return streets.map(x=>`${num} ${x}, ${tcase(cityQ)}`).slice(0,5);const out=[];streets.slice(0,2).forEach(x=>cs.slice(0,5).forEach(c=>out.push(`${num} ${x}, ${c}`)));return out.slice(0,5)}
 const near=[...new Set([String(state.biz.address||'').split(',').slice(1).join(',').trim()].filter(x=>AC_CITIES.includes(x)).concat(AC_CITIES.slice(0,2)))];
 const out=[];streets.forEach(x=>near.slice(0,2).forEach(c=>out.push(`${num} ${x}, ${c}`)));return out.slice(0,5)}
let acIdx=-1;
function acClose(){$$('.ac-list').forEach(l=>{const inp=l.parentElement.querySelector('[data-addr]');if(inp)inp.setAttribute('aria-expanded','false');l.remove()});acIdx=-1}
function acShow(inp){const list=acSuggest(inp.value);let l=inp.parentElement.querySelector('.ac-list');if(!list.length){acClose();return}
 if(!l){l=document.createElement('ul');l.className='ac-list';l.setAttribute('role','listbox');l.id='ac-'+inp.id;inp.parentElement.appendChild(l)}
 acIdx=-1;inp.setAttribute('aria-expanded','true');
 l.innerHTML=list.map((x,i)=>{const[a,...r]=x.split(', ');return `<li role="option" id="${l.id}-${i}" data-acpick="${esc(x)}">${ic('pin',14)}<span><b>${esc(a)}</b>${r.length?`<small>${esc(r.join(', '))}</small>`:''}</span></li>`}).join('')+`<li class="ac-foot" aria-hidden="true">Suggestions · keep typing for more</li>`}
function acMove(inp,d){const items=$$('.ac-list [data-acpick]',inp.parentElement);if(!items.length)return;acIdx=(acIdx+d+items.length)%items.length;items.forEach((x,i)=>x.classList.toggle('on',i===acIdx));inp.setAttribute('aria-activedescendant',items[acIdx].id)}
function acPick(inp,val){inp.value=val;acClose();inp.dispatchEvent(new Event('input',{bubbles:true}));inp.focus()}

let OB=null;
function obDefaults(fromEditor){return{step:1,style:'classic',fromEditor:!!fromEditor,f:{name:'',industry:'bakery',city:'',phone:'',email:'',address:'',desc:'',goal:'order',logo:null,goalTouched:false}}}
const fillT=(t,F)=>String(t||'').replace(/\{name\}/g,F.name).replace(/\{city\}/g,F.city||'your area');
function buildFromForm_v1(f,sk){
 const ind=INDUSTRIES[f.industry]||INDUSTRIES.other,st=STYLES[sk]||STYLES.classic,th=THEMES[st.theme],goal=GOALS[f.goal]||GOALS.call;
 const F={...f,name:f.name.trim()||'Your Business',city:f.city.trim()};
 const mode=state.brand.mode||'light',pal=themePal(st.theme);const brand={...state.brand,name:F.name,tagline:fillT(ind.tagline,F),logo:f.logo,showName:true,logoSize:f.logo?48:44,style:sk,look:st.look,theme:st.theme,mode,pal,colors:{...pal[mode]},font:th.font,radius:th.radius,btn:th.btn,header:f.goal==='call'&&f.phone?'call':st.header};
 const S=(type,data)=>({id:uid(),type,variant:st.v[type]||Object.keys(CATALOG[type].variants)[0],hidden:false,data});
 const secs=[S('hero',{eyebrow:fillT(ind.eyebrow,F),heading:fillT(ind.hero,F),sub:f.desc.trim()||fillT(ind.sub,F),cta:goal.cta(F),cta2:'See what we offer',image:null})];
 if(ind.slides)secs.push(S('slideshow',{heading:fillT(ind.slidesH,F),interval:4,slides:ind.slides.map(c=>({image:null,caption:fillT(c,F)}))}));
 secs.push(S('about',{eyebrow:'About us',heading:fillT(ind.aboutH,F),body:fillT(ind.about,F),image:null,stats:ind.stats.map(([value,label])=>({value,label}))}));
 secs.push(S('services',{heading:ind.servicesH,intro:fillT(ind.intro,F),items:ind.services.map(([title,desc,price])=>({title,desc,price}))}));
 if(goal.section&&rule(goal.section).enabled)secs.push(S(goal.section,goal.section==='booking'?{heading:'Book an appointment',sub:'Pick a service and a time that works for you.',services:ind.services.slice(0,3).map(x=>({title:x[0],duration:'45 min'}))}:{heading:'Order online',items:ind.services.slice(0,4).map(x=>({name:x[0],price:(x[2].match(/\$[\d,.]+/)||['$20'])[0],image:null,stock:10}))}));
 secs.push(S('testimonials',{heading:'What customers say',items:ind.reviews.map(([q,n,r])=>({quote:fillT(q,F),name:n,role:r,stars:5}))}));
 if(ind.gallery)secs.push(S('gallery',{heading:fillT(ind.gallery,F),images:[null,null,null,null,null,null]}));
 secs.push(S('faq',{heading:'Questions we hear a lot',items:ind.faq.map(([q,a])=>({q:fillT(q,F),a:fillT(a,F)}))}));
 if(f.address.trim()||f.goal==='visit')secs.push(S('map',{heading:'Find us',address:f.address.trim()||'Your street address\n'+(F.city||'City, State'),phone:f.phone}));
 const quote=f.goal==='quote';
 secs.push(S('contact',{heading:quote?'Request a free quote':'Get in touch',sub:quote?'Tell us about the job and we will get back to you within one business day.':'Questions or special requests? Send us a note and we will reply within one business day.',phone:f.phone,email:f.email,address:f.address.replace(/\n/g,', '),button:quote?'Request my quote':'Send message'}));
 if(st.order){const ix=t=>{const i=st.order.indexOf(t);return i<0?99:i};const hero=secs.shift();secs.sort((x,y)=>ix(x.type)-ix(y.type));secs.unshift(hero)}
 return{brand,sections:secs,announce:{on:false,text:`Now open in ${F.city||'town'}. Say hello!`}};
}
function miniFor(sk){const b=buildFromForm(OB.f,sk);const saved=state;state={...state,...b};EDIT=false;let h='';try{h=`<div class="sframe">${headerHtml()}<div class="smain">${R.hero(b.sections[0])}</div></div>`}finally{state=saved}return{h,vars:siteVars(b.brand),look:b.brand.look}}
function obStyles(){return Object.keys(STYLES).filter(k=>admin.themes[STYLES[k].theme]!==false)}
function renderStart(){OB=OB||obDefaults();const f=OB.f,v=$('#v-start');
 const steps=`<div class="ob-steps"><span class="${OB.step===1?'on':'done'}">1 · Your business</span><span class="${OB.step===2?'on':''}">2 · Pick a style</span><span>3 · Fine-tune</span></div>`;
 if(OB.step===1){
  v.innerHTML=`<div class="ob"><form class="ob-card" id="obForm">${steps}<div><h1>Let’s build your website</h1><p class="ob-lead">Tell us a little about your business. We’ll draft a full site from your answers, then you can change anything you like.</p></div>
  <div class="ob-grid"><label class="fld"><span>Business name *</span><input type="text" id="ob-name" data-ob="name" required value="${esc(f.name)}" placeholder="Harbor & Pine Bakery" autocomplete="organization"></label>
  <label class="fld"><span>Type of business</span><select id="ob-ind" data-ob="industry">${Object.entries(INDUSTRIES).map(([k,x])=>`<option value="${k}" ${f.industry===k?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label>
  <label class="fld"><span>City or area you serve</span><input type="text" id="ob-city" data-ob="city" value="${esc(f.city)}" placeholder="Portland, ME"></label>
  <label class="fld"><span>Phone</span><input type="text" id="ob-phone" data-ob="phone" value="${esc(f.phone)}" placeholder="(207) 555-0148" autocomplete="tel"></label>
  <label class="fld"><span>Email</span><input type="email" id="ob-email" data-ob="email" value="${esc(f.email)}" placeholder="hello@yourbusiness.com" autocomplete="email"></label>
  <label class="fld"><span>Street address (optional, adds a map)</span><div class="ac-wrap"><input type="text" id="ob-addr" data-ob="address" data-addr value="${esc(f.address)}" placeholder="Start typing, like 214 Commercial St" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-ob-addr"></div></label></div>
  <label class="fld"><span>In a sentence or two, what do you do? (optional)</span><textarea id="ob-desc" data-ob="desc" rows="2" placeholder="We bake sourdough and pastries from scratch every morning on the waterfront.">${esc(f.desc)}</textarea></label>
  <div class="fld"><span>What should visitors do first?</span><div class="ob-goals">${Object.entries(GOALS).map(([k,g])=>`<button type="button" data-obgoal="${k}" class="${f.goal===k?'on':''}" aria-pressed="${f.goal===k}">${esc(g.label)}</button>`).join('')}</div></div>
  <div class="fld"><span>Logo (optional, you can make one later)</span>${imgField('ob:logo',f.logo,true)}</div>
  <div class="ob-actions">${OB.fromEditor?`<button type="button" class="btn" data-obcancel>Back to my design</button>`:`<button type="button" class="btn" data-obskip>Skip and explore the sample bakery</button>`}<button class="btn pri" type="submit">Next: pick a style ${ic('r',15)}</button></div>
  ${OB.fromEditor?'<p class="muted" style="font-size:12.5px">Building from the form replaces your current page. You can undo afterwards.</p>':''}</form></div>`;return}
 const rec=kitOf(f.industry).styles||[];const ks=obStyles().sort((x,y)=>(rec.includes(x)?rec.indexOf(x):9)-(rec.includes(y)?rec.indexOf(y):9));if(!ks.includes(OB.style))OB.style=ks[0];
 v.innerHTML=`<div class="ob"><div class="ob-card wide">${steps}<div><h1>Pick a style to start with</h1><p class="ob-lead">Each one is a starting point for ${esc(f.name||'your business')}. You can change colors, fonts and layouts after.</p></div>
 <div class="ob-styles" role="radiogroup" aria-label="Starting style">${ks.map(k=>{const m=miniFor(k);const on=OB.style===k;return `<div class="ob-style${on?' on':''}" role="radio" aria-checked="${on}" tabindex="0" data-obstyle="${k}"><div class="ob-mini"><div class="site" data-look="${m.look}" style="${m.vars}">${m.h}</div></div><div class="between"><span><b>${esc(STYLES[k].name)}</b><br><span class="muted" style="font-size:12.5px">${esc(STYLES[k].desc)}</span></span>${on?`<span class="badge acc">${ic('check',12)} Selected</span>`:rec.includes(k)?`<span class="badge">Good fit</span>`:''}</div></div>`}).join('')}</div>
 <div class="ob-actions"><button type="button" class="btn" data-obback>${ic('l',15)} Back</button><button type="button" class="btn pri" data-obbuild>Build my site ${ic('r',15)}</button></div></div></div>`;
 requestAnimationFrame(fitObMinis)}
function fitObMinis(){$$('.ob-mini,.st-mini').forEach(m=>{const s=m.firstElementChild;if(s)s.style.zoom=Math.max(.15,(m.clientWidth)/1100)})}
function obBuild(){const b=buildFromForm(OB.f,OB.style);if(OB.fromEditor)snap();Object.assign(state,b);state.started=true;state.selected=null;state.onboarded=true;state.coach=true;state.rightTab='info';
 Object.assign(state.biz,{name:OB.f.name.trim(),industry:OB.f.industry,phone:OB.f.phone,email:OB.f.email,address:OB.f.address.trim(),about:OB.f.desc.trim()||state.biz.about||''});
 const wide=!matchMedia('(max-width:1020px)').matches;state.inspOpen=wide;state.libOpen=false;
 kitCart(state.pages);ANN_CLOSED=false;
 OB=null;state.tab='builder';hard();toast('Your first draft is ready. Click anything on the page to change it.')}

/* ---------- browser storage for videos and saved designs (IndexedDB, with a fallback) ---------- */
const IDB=(()=>{let dbp=null;
 const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('twp-studio',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('media'))d.createObjectStore('media');if(!d.objectStoreNames.contains('designs'))d.createObjectStore('designs',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
 const tx=(st,mode,fn)=>open().then(d=>new Promise((res,rej)=>{const t=d.transaction(st,mode);const q=fn(t.objectStore(st));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)}));
 return{get:(st,k)=>tx(st,'readonly',s=>s.get(k)),put:(st,v,k)=>tx(st,'readwrite',s=>k===undefined?s.put(v):s.put(v,k)),del:(st,k)=>tx(st,'readwrite',s=>s.delete(k)),all:st=>tx(st,'readonly',s=>s.getAll())}})();
const MEDIA={},mediaAsked={};
function mediaUrl(v){if(v.startsWith('data:'))return v;const id=v.slice(4);if(MEDIA[id])return MEDIA[id];
 if(!mediaAsked[id]){mediaAsked[id]=1;IDB.get('media',id).then(b=>{if(b){MEDIA[id]=URL.createObjectURL(b);soft();if(state.tab==='designs')renderDesigns()}}).catch(()=>{})}return''}
async function mediaPut(file){const id=uid();MEDIA[id]=URL.createObjectURL(file);try{await IDB.put('media',file,id)}catch(e){toast('This browser can show the video now but cannot keep it after you close the page.')}return id}

/* ---------- slide editor shown under every image rotator while designing ---------- */
function ssTray(s,sl,i,ind,dur){
 return `<div class="ss-tray" data-sstray="${s.id}"><div class="ss-strip">${sl.map((x,k)=>`<div class="ss-th${k===i?' on':''}"><button type="button" class="ss-thb" data-ssshow="${k}" aria-label="Show slide ${k+1}">${x.image?mediaHtml(x.image,true):`<span class="th-ph">${ic('camera',16)}</span>`}<em>${k+1}</em></button><button type="button" class="ss-thx" data-ssdel="${s.id}|${k}" aria-label="Remove slide ${k+1}">${ic('x',12)}</button></div>`).join('')}<button type="button" class="ss-addt" data-ssadd="${s.id}"><b>+</b><span>Photo or video</span></button></div>
 <div class="ss-ctl"><div class="ss-dur" role="group" aria-label="Seconds per slide"><span>Each slide</span><button type="button" data-ssdur="${s.id}|-1" aria-label="Shorter" ${dur<=2?'disabled':''}>−</button><b>${dur}s</b><button type="button" data-ssdur="${s.id}|1" aria-label="Longer" ${dur>=15?'disabled':''}>+</button></div>
 <label class="ss-indsel"><span>Indicator</span><select data-ssind="${s.id}" aria-label="Slide indicator">${Object.entries(SS_IND).map(([k,l])=>`<option value="${k}"${k===ind?' selected':''}>${esc(l)}</option>`).join('')}</select></label>
 <span class="ss-tip">Click a caption on the photo to edit it</span></div></div>`}
function setAccept(video){const f=$('#filePick');if(f)f.accept=video?'image/*,video/*':'image/*'}
document.addEventListener('click',e=>{const T=e.target;if(!(T instanceof Element))return;const q=s=>T.closest(s);let el;
 if(el=q('[data-img],[data-pick],[data-drop-img]')){const t=el.dataset.img||el.dataset.pick||el.dataset.dropImg||'';setAccept(!/logo$/.test(t)&&!t.startsWith('bgx:'))}
 const tr=q('.ss-tray');if(!tr)return;e.stopPropagation();
 const id=tr.dataset.sstray,s=sec(id);if(!s)return;
 if(state.selected!==id){state.selected=id;state.rightTab='section'}
 if(el=q('[data-ssshow]')){const b=tr.closest('section').querySelector('[data-ss]');if(b){b._tap=Date.now();ssGo(b,+el.dataset.ssshow)}return}
 if(el=q('[data-ssadd]')){pickTarget=`${id}:+slides`;setAccept(true);$('#filePick').click();return}
 if(el=q('[data-ssdel]')){const k=+el.dataset.ssdel.split('|')[1];snap();s.data.slides.splice(k,1);ssIdx[id]=Math.max(0,Math.min(ssIdx[id]||0,s.data.slides.length-1));hard();toast('Slide removed',{label:'Undo',fn:undo});return}
 if(el=q('[data-ssdur]')){const d=+el.dataset.ssdur.split('|')[1];snap();s.data.interval=Math.max(2,Math.min(15,ssDur(s.data)+d));hard();return}
},true);
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.ssind){const s=sec(t.dataset.ssind);if(s){snap();s.data.ind=t.value;hard()}}});

/* ---------- drag sections around the page by their grab handle (mouse and touch) ---------- */
let GD=null;
document.addEventListener('pointerdown',e=>{const h=e.target.closest&&e.target.closest('[data-grab]');if(!h||e.button>0)return;e.preventDefault();
 GD={id:h.dataset.grab,el:h.closest('[data-sec]'),x0:e.clientX,y0:e.clientY,y:e.clientY,moved:false};try{h.setPointerCapture(e.pointerId)}catch(err){}},true);
document.addEventListener('pointermove',e=>{if(!GD)return;GD.y=e.clientY;
 if(!GD.moved){if(Math.hypot(e.clientX-GD.x0,e.clientY-GD.y0)<5)return;GD.moved=true;grabStart()}
 e.preventDefault();GD.ghost.style.transform=`translate(${e.clientX+14}px,${e.clientY-18}px)`;showSiteDrop(e.clientY)},{passive:false});
function grabStart(){const s=sec(GD.id);GD.el.classList.add('grabbing');document.body.classList.add('grab-on');
 const g=document.createElement('div');g.className='grab-ghost';g.innerHTML=`${ic('grip',14)} ${esc(CATALOG[s.type].name)}`;document.body.appendChild(g);GD.ghost=g;
 const cv=$('#canvas');const tick=()=>{if(!GD)return;const r=cv.getBoundingClientRect();const top=Math.max(r.top,0),bot=Math.min(r.bottom,innerHeight);const edge=70;let d=0;
  if(GD.y<top+edge)d=-Math.ceil((top+edge-GD.y)/6);else if(GD.y>bot-edge)d=Math.ceil((GD.y-(bot-edge))/6);
  if(d){if(cv.scrollHeight>cv.clientHeight+2)cv.scrollTop+=d;else window.scrollBy(0,d);showSiteDrop(GD.y)}GD.raf=requestAnimationFrame(tick)};GD.raf=requestAnimationFrame(tick)}
function grabEnd(drop){const g=GD;GD=null;if(!g||!g.moved)return;cancelAnimationFrame(g.raf);g.ghost.remove();document.body.classList.remove('grab-on');if(g.el)g.el.classList.remove('grabbing');
 const idx=drop?siteIndex(g.y).i:-1;clearDrop();if(idx<0)return;const from=state.sections.findIndex(x=>x.id===g.id);
 if(idx===from||idx===from+1)return;moveSection(g.id,idx);flashSection(g.id)}
document.addEventListener('pointerup',()=>grabEnd(true));document.addEventListener('pointercancel',()=>grabEnd(false));
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-grab]')){e.stopPropagation();e.preventDefault()}},true);
document.addEventListener('keydown',e=>{const h=e.target.closest&&e.target.closest('[data-grab]');if(!h||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;e.preventDefault();const id=h.dataset.grab;
 sectionAct(id,e.key==='ArrowUp'?'up':'down');requestAnimationFrame(()=>{const n=$(`#site [data-grab="${id}"]`);if(n)n.focus();flashSection(id)})});
function flashSection(id){requestAnimationFrame(()=>{const n=$(`#site [data-sec="${id}"]`);if(!n)return;n.classList.remove('just-moved');void n.offsetWidth;n.classList.add('just-moved');const cv=$('#canvas'),r=n.getBoundingClientRect(),cr=cv.getBoundingClientRect();if(r.top<cr.top||r.top>cr.bottom-80)n.scrollIntoView({block:'nearest',behavior:'smooth'})})}

/* ---------- My designs: save whole designs, start over, start new, reopen later ---------- */
let DESIGNS=[],designsReady=false,idbDesigns=true;const DKEY='twp-designs-v1';
function designsLoad(){IDB.all('designs').then(a=>{DESIGNS=(a||[]).sort((x,y)=>y.at-x.at);designsReady=true;if(state.tab==='designs')renderDesigns()})
 .catch(()=>{idbDesigns=false;try{DESIGNS=JSON.parse(localStorage.getItem(DKEY)||'[]')}catch(e){DESIGNS=[]}designsReady=true;if(state.tab==='designs')renderDesigns()})}
function designStore(d){if(idbDesigns)return IDB.put('designs',d);localStorage.setItem(DKEY,JSON.stringify(DESIGNS));return Promise.resolve()}
function designDrop(id){if(idbDesigns)return IDB.del('designs',id).catch(()=>{});try{localStorage.setItem(DKEY,JSON.stringify(DESIGNS))}catch(e){}return Promise.resolve()}
const designData=()=>JSON.parse(JSON.stringify({pages:syncPage(),pageId:state.pageId,brand:state.brand,sections:state.sections,biz:state.biz,started:state.started,announce:state.announce}));
const curDesign=()=>DESIGNS.find(x=>x.id===state.designId);
function isDirty(){const d=curDesign();if(!d)return state.sections.length>0;return JSON.stringify(d.data)!==JSON.stringify(designData())}
function designAutoName(){const base=(state.biz.name||state.brand.name||'My site').trim(),st=(STYLES[state.brand.style]||STYLES.classic).name;let n=`${base} · ${st}`,k=2;while(DESIGNS.some(x=>x.name===n))n=`${base} · ${st} ${k++}`;return n}
async function saveDesign(o={}){let d=o.asNew?null:curDesign();const now=Date.now();
 if(!d){const src=curDesign();d={id:uid(),name:state.designName&&state.designName!=='Untitled design'&&!o.asNew?state.designName:designAutoName(),created:now,hold:(src&&holdOf(src))||state.draftAt||now};DESIGNS.unshift(d)}
 d.at=now;d.data=designData();state.designId=d.id;state.designName=d.name;DESIGNS.sort((x,y)=>y.at-x.at);
 try{await designStore(d)}catch(e){toast('Could not save. Browser storage is full. Delete an old design or use smaller photos.');return false}
 save();dsMenuClose();if(state.tab==='designs')renderDesigns();if(!o.quiet)toast(state.keep?`Saved “${d.name}” to My designs`:`Saved “${d.name}”. Without a plan it is kept until ${holdClock(holdOf(d))}.`,{label:'View',fn:()=>setTab('designs')});return true}
function freshDesign(keepId){snap();const B=state.brand,def=defaultState().brand;
 state.brand={...def,name:state.biz.name||B.name,tagline:B.tagline,logo:B.logo,logoSize:B.logoSize,showName:B.showName};
 state.sections=[];state.pages=null;state.pageId='home';state.started=false;state.selected=null;Object.keys(ssIdx).forEach(k=>delete ssIdx[k]);
 state.draftAt=keepId&&curDesign()?holdOf(curDesign()):null;
 if(!keepId){state.designId=null;state.designName='Untitled design';state.draftAt=null}
 state.tab='builder';closeModal();dsMenuClose();hard();$('#canvas')&&($('#canvas').scrollTop=0)}
function openDesign(id){const d=DESIGNS.find(x=>x.id===id);if(!d)return;snap();const x=JSON.parse(JSON.stringify(d.data));
 Object.assign(state,{pages:x.pages||null,pageId:x.pageId||'home',brand:x.brand,sections:x.sections,biz:x.biz||state.biz,started:x.started!==false,announce:x.announce||state.announce,designId:d.id,designName:d.name,draftAt:holdOf(d),selected:null,tab:'builder'});
 Object.keys(ssIdx).forEach(k=>delete ssIdx[k]);closeModal();hard();toast(`Opened “${d.name}”`)}
/* small confirm dialog: buttons are [label, class, fn] */
let ASK=[];
function ask(o){ASK=o.btns.map(b=>b[2]);dsMenuClose();
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal ask" role="alertdialog" aria-modal="true" aria-labelledby="askT" aria-describedby="askB"><span class="ask-ic ${o.tone||''}">${ic(o.icon||'spark',22)}</span><h2 id="askT">${esc(o.title)}</h2><p class="muted" id="askB">${o.body}</p><div class="ask-btns">${o.btns.map((b,i)=>`<button type="button" class="btn ${b[1]||''}" data-ask="${i}">${esc(b[0])}</button>`).join('')}</div></div></div>`;
 const p=$('#modalRoot .ask-btns .btn.pri,#modalRoot .ask-btns .btn.warn');(p||$('#modalRoot [data-ask]')).focus()}
function askNew(){const nm=esc(state.designName);
 if(isDirty())ask({icon:'save',title:'Save before starting a new design?',body:`You have changes to <b>${nm}</b> that aren’t saved. Save them to My designs so you can come back to it?`,btns:[['Cancel',''],['Don’t save','',()=>freshDesign()],['Save, then start new','pri',async()=>{if(await saveDesign({quiet:true})){freshDesign();toast('Saved. Here is your new blank design.')}}]]});
 else ask({icon:'filePlus',title:'Start a new design?',body:state.designId?`<b>${nm}</b> is saved in My designs, so you can reopen it any time. Your business info stays filled in.`:'You’ll get a fresh blank page. Your business info stays filled in.',btns:[['Cancel',''],['Start new design','pri',()=>freshDesign()]]})}
function askStartOver(){ask({icon:'restart',tone:'warn',title:'Start over?',body:`This removes every section from <b>${esc(state.designName)}</b> and resets its style. Your business info and logo stay.${state.designId?' The copy in My designs only changes if you save again.':''} You can undo right after.`,btns:[['Cancel',''],['Yes, start over','warn',()=>{freshDesign(true);toast('Blank page ready',{label:'Undo',fn:undo})}]]})}
function askOpen(id){const d=DESIGNS.find(x=>x.id===id);if(!d)return;if(id===state.designId&&!isDirty()){setTab('builder');return}
 if(!isDirty()){openDesign(id);return}
 ask({icon:'folder',title:`Open “${d.name}”?`,body:id===state.designId?'This goes back to the last saved version. Your newer changes will be lost.':`You have changes to <b>${esc(state.designName)}</b> that aren’t saved. Save them first?`,btns:id===state.designId?[['Cancel',''],['Go back to saved','warn',()=>openDesign(id)]]:[['Cancel',''],['Don’t save','',()=>openDesign(id)],['Save, then open','pri',async()=>{if(await saveDesign({quiet:true}))openDesign(id)}]]})}
function askDelete(id){const d=DESIGNS.find(x=>x.id===id);if(!d)return;ask({icon:'trash',tone:'warn',title:`Delete “${d.name}”?`,body:'This removes the saved design for good.'+(id===state.designId?' The page open in the designer stays as it is.':''),btns:[['Cancel',''],['Delete design','warn',()=>{DESIGNS=DESIGNS.filter(x=>x.id!==id);designDrop(id);if(state.designId===id)state.designId=null;save();renderDesigns();toast('Design deleted')}]]})}
async function dupDesign(id){const d=DESIGNS.find(x=>x.id===id);if(!d)return;let n=d.name+' copy',k=2;while(DESIGNS.some(x=>x.name===n))n=`${d.name} copy ${k++}`;
 const c={id:uid(),name:n,created:Date.now(),hold:holdOf(d),at:Date.now(),data:JSON.parse(JSON.stringify(d.data))};DESIGNS.unshift(c);try{await designStore(c)}catch(e){DESIGNS.shift();toast('Could not copy. Browser storage is full.');return}renderDesigns();toast(`Made “${n}”`)}
/* the Designs menu in the preview bar */
function dsMenuClose(){const m=$('#dsMenu');if(m)m.remove();const b=$('#dsBtn');if(b)b.setAttribute('aria-expanded','false')}
function dsMenu(){if($('#dsMenu')){dsMenuClose();return}const b=$('#dsBtn');const dirty=isDirty(),saved=!!curDesign();
 const m=document.createElement('div');m.id='dsMenu';m.className='ds-menu';m.setAttribute('role','menu');
 m.innerHTML=`<div class="ds-head"><label class="ds-name"><span>Design name</span><input id="dsName" value="${esc(state.designName)}" autocomplete="off"></label><small class="ds-state ${dirty?'warn':'ok'}">${saved?(dirty?'Unsaved changes':'All changes saved'):(state.sections.length?'Not saved yet':'Blank page')}</small>${(()=>{const l=holdLeft();return state.keep?`<small class="ds-hold">Kept with ${esc(keepLabel())}</small>`:isFinite(l)?`<button type="button" class="ds-hold" data-holdinfo>${ic('clock',12)} Without a plan, kept until ${holdClock(holdStart())}. Keep it longer</button>`:`<small class="ds-hold">Without a plan, designs are kept ${holdHours()}</small>`})()}</div>
 <button type="button" role="menuitem" data-dsact="save">${ic('save',16)}<span><b>${saved?'Save changes':'Save to My designs'}</b><small>${saved?'Updates the saved copy':'Keep it to reopen later'}</small></span><kbd>${/Mac|iP/.test(navigator.platform)?'⌘':'Ctrl'} S</kbd></button>
 ${saved?`<button type="button" role="menuitem" data-dsact="copy">${ic('copy',16)}<span><b>Save as a new copy</b><small>Leaves the saved version as it is</small></span></button>`:''}
 <button type="button" role="menuitem" data-dsact="new">${ic('filePlus',16)}<span><b>New design</b><small>Start another blank page</small></span></button>
 <button type="button" role="menuitem" data-dsact="over">${ic('restart',16)}<span><b>Start over</b><small>Clear this page and its style</small></span></button>
 <button type="button" role="menuitem" data-dsact="quick">${ic('spark',16)}<span><b>Quick start form</b><small>Answer a few questions to build a page</small></span></button>
 <div class="ds-sep"></div><button type="button" role="menuitem" data-dsact="all">${ic('folder',16)}<span><b>My designs</b><small>${DESIGNS.length} saved</small></span>${ic('r',14)}</button>`;
 document.body.appendChild(m);const r=b.getBoundingClientRect();
 if(innerWidth<=560){m.classList.add('sheet')}else{m.style.top=(r.bottom+6)+'px';m.style.left=Math.max(8,Math.min(r.left,innerWidth-m.offsetWidth-8))+'px'}
 b.setAttribute('aria-expanded','true');(m.querySelector('[data-dsact]')).focus()}
function renderDesigns(){const v=$('#v-designs');if(!v)return;const cur=state.designId,dirty=isDirty();
 const card=(d,live)=>{const data=live?designData():d.data;const n=(data.sections||[]).filter(x=>!x.hidden).length;
  return `<article class="dsc${live?' live':''}${!live&&d.id===cur?' on':''}"><div role="button" tabindex="0" class="dsc-pv" ${live?'data-tab="builder"':`data-dsopen="${d.id}"`} aria-label="Open ${esc(live?state.designName:d.name)}"><div class="st-mini">${miniOf(data.brand,data.sections||[],3)}</div>${n?'':'<span class="dsc-blank">Blank page</span>'}${live?'<span class="dsc-tag">Open now</span>':d.id===cur?`<span class="dsc-tag">${dirty?'Open now · edited':'Open now'}</span>`:''}</div>
  <div class="dsc-b">${live?`<b class="dsc-n">${esc(state.designName)}</b>`:`<input class="dsc-n" id="dn-${d.id}" data-dsren="${d.id}" value="${esc(d.name)}" aria-label="Design name">`}
  <small>${n} section${n===1?'':'s'} · ${esc((STYLES[data.brand.style]||STYLES.classic).name)} style · ${live?'not saved yet':'saved '+ago(d.at)}</small>${(()=>{const st=live?state.draftAt:holdOf(d),l=holdLeftOf(st);return isFinite(l)?`<small class="dsc-hold${l<6e5?' low':''}">${ic('clock',12)} ${l>0?`Kept until ${holdClock(st)} (${holdLeftText(l)} left)`:'Free hour is up'}</small>`:''})()}
  <div class="dsc-act">${live?`<button type="button" class="btn sm pri" data-dsact="save">${ic('save',14)} Save it</button><button type="button" class="btn sm" data-tab="builder">Keep editing</button>`:`<button type="button" class="btn sm pri" data-dsopen="${d.id}">${d.id===cur?'Keep editing':'Open'}</button><button type="button" class="btn sm" data-dsdup="${d.id}">${ic('copy',14)} Copy</button><button type="button" class="iconbtn" data-dsdel="${d.id}" aria-label="Delete ${esc(d.name)}">${ic('trash',15)}</button>`}</div></div></article>`};
 const liveCard=!curDesign()&&state.sections.length?card(null,true):'';
 v.innerHTML=`<div class="dsp"><div class="dsp-h"><div><h1>${ic('folder',26)} My designs</h1><p class="muted">Every design you save is kept here. Open one to pick up where you left off, or copy it to try something new.</p>${state.keep?`<p class="hold-note ok">${ic('check',14)} Kept with ${esc(keepLabel())}. Your designs do not expire.</p>`:`<p class="hold-note">${ic('clock',14)}<span>Without a plan, designs are kept for <b>${holdHours()}</b> from when you start them, then removed. <button type="button" class="linkbtn" data-storage>Keep them for ${money(storagePrice())}/month</button> or <button type="button" class="linkbtn" data-tab="plans">choose a plan</button>.</span></p>`}</div><button type="button" class="btn pri" data-dsact="new">${ic('plus',15)} New design</button></div>
 ${!designsReady?'<p class="muted">Loading your designs…</p>':`<div class="dsp-grid">${liveCard}${DESIGNS.map(d=>card(d)).join('')}<button type="button" class="dsc dsc-new" data-dsact="new"><span>${ic('plus',26)}</span><b>New design</b><small>Start from a blank page</small></button></div>
 ${!DESIGNS.length?`<div class="dsp-empty">${ic('save',20)}<p><b>No saved designs yet.</b> In the designer, open <b>Designs</b> and choose <b>Save to My designs</b>. Each design keeps its pages, style, photos and both light and dark versions.</p></div>`:''}`}</div>`;
 requestAnimationFrame(fitObMinis)}
document.addEventListener('click',e=>{const T=e.target;if(!(T instanceof Element))return;const q=s=>T.closest(s);let el;
 if(el=q('[data-ask]')){const f=ASK[+el.dataset.ask];closeModal();if(f)f();return}
 if(q('[data-dsmenu]')){e.stopPropagation();dsMenu();return}
 if(el=q('[data-dsact]')){e.stopPropagation();const a=el.dataset.dsact;dsMenuClose();
  if(a==='save')saveDesign();else if(a==='copy')saveDesign({asNew:true});else if(a==='new')askNew();else if(a==='over')askStartOver();else if(a==='all')setTab('designs');
  else if(a==='quick'){const b=$('[data-startover]');if(b)b.click()}return}
 if(el=q('[data-dsopen]')){e.stopPropagation();askOpen(el.dataset.dsopen);return}
 if(el=q('[data-dsdup]')){e.stopPropagation();dupDesign(el.dataset.dsdup);return}
 if(el=q('[data-dsdel]')){e.stopPropagation();askDelete(el.dataset.dsdel);return}
 if($('#dsMenu')&&!q('#dsMenu'))dsMenuClose()},true);
document.addEventListener('input',e=>{const t=e.target;if(t.id==='dsName'){state.designName=t.value.trim()||'Untitled design';const d=curDesign();if(d){d.name=state.designName;designStore(d).catch(()=>{})}save()}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.dsren){const d=DESIGNS.find(x=>x.id===t.dataset.dsren);if(d){d.name=t.value.trim()||d.name;t.value=d.name;if(d.id===state.designId){state.designName=d.name;save()}designStore(d).catch(()=>{});toast('Name saved')}}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='s'&&state.tab==='builder'&&state.onboarded){e.preventDefault();saveDesign();return}
 if(e.key==='Escape'&&$('#dsMenu')){dsMenuClose();$('#dsBtn').focus();return}
 if(e.key==='Enter'&&e.target.id==='dsName'){e.preventDefault();saveDesign();return}
 if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('dsc-pv')){e.preventDefault();e.target.click()}});
window.addEventListener('resize',()=>{dsMenuClose();if(state.tab==='designs')fitObMinis()});

/* ---------- keep the section being edited in view, above the editing panel on phones ---------- */
function focusSection(id,force){requestAnimationFrame(()=>requestAnimationFrame(()=>{const n=$(`#site [data-sec="${id}"]`),cv=$('#canvas');if(!n||!cv)return;
 const cr=cv.getBoundingClientRect(),r=n.getBoundingClientRect();let bot=Math.min(cr.bottom,innerHeight);
 if(isNarrow())['#fInsp','#fLib'].forEach(s=>{const f=$(s);if(f&&!f.hidden){const t=f.getBoundingClientRect().top;if(t>cr.top+80)bot=Math.min(bot,t)}});
 let top=Math.max(cr.top,0);const fr=$('.dv-shell.framed');if(fr){const sb=fr.querySelector('.dv-sb'),ch=fr.querySelector('.device .chrome'),nb=fr.querySelector('.dv-nb');[sb,ch].forEach(x=>{if(x&&x.offsetHeight)top=Math.max(top,x.getBoundingClientRect().bottom)});if(nb&&nb.offsetHeight)bot=Math.min(bot,nb.getBoundingClientRect().top)}
 const room=bot-top,pad=10;
 if(!force&&r.top>=top-4&&r.top<bot-Math.min(160,room*.4))return;
 const delta=r.height+pad*2<=room?(r.top-top)-(room-r.height)/2:(r.top-top)-pad;
 FS={id,until:Date.now()+900};cv.scrollTo({top:Math.max(0,cv.scrollTop+delta/devZ()),behavior:'smooth'})}))}
let FS=null;
{const _sa=sectionAct;sectionAct=function(id,act){_sa(id,act);if(act==='edit'||act==='layout')focusSection(id,act==='edit')};
 const _ss=selectSection;selectSection=function(id){_ss(id);focusSection(id,false)}}

/* ---------- pages: the open page's sections live in state.sections, the rest in state.pages ---------- */
const PAGE_TPL={blank:{name:'Blank page',desc:'Start empty and add sections',types:[],icon:'filePlus'},
 about:{name:'About',desc:'Your story, photos and reviews',types:['hero','about','testimonials'],icon:'info'},
 services:{name:'Services',desc:'What you offer and common questions',types:['hero','services','faq','cta'],icon:'grid4'},
 gallery:{name:'Gallery',desc:'Photo gallery and a slideshow',types:['hero','gallery','slideshow'],icon:'image'},
 contact:{name:'Contact',desc:'Contact form and map',types:['contact','map'],icon:'phoneCall'},
 faq:{name:'FAQ',desc:'Answers to common questions',types:['faq','contact'],icon:'help'},
 shop:{name:'Shop',desc:'Products people can order',types:['hero','shop'],icon:'bag'},
 booking:{name:'Book',desc:'Appointments and services',types:['booking','services'],icon:'calendar'}};
function pagesInit(){if(!Array.isArray(state.pages)||!state.pages.length){state.pages=[{id:'home',name:'Home',nav:true,icon:'home',sections:state.sections}];state.pageId='home'}
 if(!state.pages.some(p=>p.id===state.pageId))state.pageId=state.pages[0].id}
const curPage=()=>{pagesInit();return state.pages.find(p=>p.id===state.pageId)};
function syncPage(){pagesInit();curPage().sections=state.sections;return state.pages}
const pagesCopy=()=>JSON.parse(JSON.stringify(syncPage()));
const pageSlug=p=>p.id===state.pages[0].id?'':slug(p.name);
function gotoPage(id,secId){syncPage();const t=state.pages.find(p=>p.id===id);if(!t)return;closeBtnPop();MOPEN=false;
 if(id!==state.pageId){state.sections=t.sections||[];state.pageId=id;state.selected=null;Object.keys(ssIdx).forEach(k=>delete ssIdx[k]);hard()}else soft();
 requestAnimationFrame(()=>{if(secId)scrollToSec(secId);else{const cv=$('#canvas');if(cv&&state.tab==='builder')cv.scrollTop=0;const m=$('#miniSite');if(m&&state.tab==='dashboard')m.scrollTop=0}})}
function scrollToSec(id,root){const r=root||(state.tab==='builder'?$('#site'):$('#miniSite'))||document;const n=r.querySelector(`[data-sec="${id}"]`)||r.querySelector(`[data-secid="${id}"]`);if(n)n.scrollIntoView({block:'start',behavior:'smooth'})}
function addPage(name,tpl){syncPage();snap();const T=PAGE_TPL[tpl]||PAGE_TPL.blank;name=(name||'').trim()||(tpl==='blank'?'New page':T.name);
 let n=name,k=2;while(state.pages.some(p=>p.name.toLowerCase()===n.toLowerCase()))n=`${name} ${k++}`;
 const secs=T.types.filter(t=>CATALOG[t]&&rule(t).enabled).map(t=>{const s=smartSection(t);if(t==='hero'){s.variant='centered';s.data.heading=n;s.data.eyebrow=state.brand.name;s.data.sub=T.desc+'.';s.data.cta2=''}return s});
 const p={id:uid(),name:n,nav:true,icon:T.icon,sections:secs};state.pages.push(p);state.started=true;closeModal();gotoPage(p.id);toast(`${n} page added to your menu`,{label:'Undo',fn:undo})}
function delPage(id){const p=state.pages.find(x=>x.id===id);if(!p||id===state.pages[0].id)return;
 ask({icon:'trash',tone:'warn',title:`Delete the ${p.name} page?`,body:`Its ${(p.id===state.pageId?state.sections:p.sections||[]).length} sections go with it, and any buttons that point to it will stop working. You can undo right after.`,btns:[['Cancel',''],['Delete page','warn',()=>{syncPage();snap();if(state.pageId===id){state.pageId=state.pages[0].id;state.sections=state.pages[0].sections}state.pages=state.pages.filter(x=>x.id!==id);hard();toast('Page deleted',{label:'Undo',fn:undo});if($('#pgMgr'))pagesMgr()}]]})}
function dupPage(id){syncPage();snap();const p=state.pages.find(x=>x.id===id);if(!p)return;let n=p.name+' copy',k=2;while(state.pages.some(x=>x.name===n))n=`${p.name} copy ${k++}`;
 const c=JSON.parse(JSON.stringify(p));c.id=uid();c.name=n;c.sections.forEach(s=>s.id=uid());state.pages.splice(state.pages.indexOf(p)+1,0,c);hard();pagesMgr();toast(`Made “${n}”`)}
function movePage(id,d){syncPage();const i=state.pages.findIndex(p=>p.id===id),j=i+d;if(i<1||j<1||j>=state.pages.length)return;snap();[state.pages[i],state.pages[j]]=[state.pages[j],state.pages[i]];hard();pagesMgr()}
function renderPagebar(){const el=$('#pagebar');if(!el)return;syncPage();
 el.innerHTML=`<span class="pb-lab">${ic('filePlus',14)}<span>Pages</span></span><div class="pb-list" role="tablist" aria-label="Pages">${state.pages.map((p,i)=>`<button type="button" role="tab" aria-selected="${p.id===state.pageId}" class="pb-tab${p.id===state.pageId?' on':''}" data-gopage="${p.id}">${i===0?ic('home',13):''}${esc(p.name)}${p.nav===false?`<i title="Not in the menu">${ic('eyeOff',12)}</i>`:''}</button>`).join('')}</div>
 <button type="button" class="pb-add" data-pageadd>${ic('plus',14)}<span>Add page</span></button><button type="button" class="pb-mgr" data-pagesmgr aria-label="Manage pages and menu">${ic('menu',15)}<span>Pages &amp; menu</span></button><div class="pb-mode" role="group" aria-label="Light or dark version of your site">${['light','dark'].map(m=>{const on=(state.brand.mode||'light')===m;return `<button type="button" data-mode="${m}" class="${on?'on':''}" aria-pressed="${on}" title="Show the ${m} version">${ic(m==='light'?'sun':'moon',14)}<span>${m==='light'?'Light':'Dark'}</span></button>`}).join('')}</div>`;
 const on=el.querySelector('.pb-tab.on');if(on)on.scrollIntoView({block:'nearest',inline:'nearest'})}
function addPageModal(){ask0();let tpl='about';
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><form class="modal pg-add" id="pgAddForm" role="dialog" aria-labelledby="pgAddT"><div class="modal-h"><h2 id="pgAddT">Add a page</h2><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <label class="fld"><span>Page name</span><input id="pgName" placeholder="About" autocomplete="off" maxlength="40"></label>
 <div class="fld"><span>Start with</span><div class="pg-tpls" role="radiogroup" aria-label="Page template">${Object.entries(PAGE_TPL).map(([k,t])=>`<button type="button" role="radio" aria-checked="${k===tpl}" class="pg-tpl${k===tpl?' on':''}" data-pgtpl="${k}">${ic(t.icon,18)}<b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div></div>
 <p class="hint">New pages are added to your menu. You can rename, reorder or hide them under Pages &amp; menu.</p>
 <div class="row" style="justify-content:flex-end;gap:8px;margin-top:6px"><button type="button" class="btn" data-closemodal>Cancel</button><button class="btn pri" type="submit">${ic('plus',14)} Add page</button></div></form></div>`;
 const f=$('#pgName');if(!isNarrow())f.focus()}
function ask0(){closeBtnPop();if(typeof dsMenuClose==='function')dsMenuClose()}
function pagesMgr(){ask0();syncPage();const P=state.pages;
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal wide pg-mgr" id="pgMgr" role="dialog" aria-labelledby="pgMgrT"><div class="modal-h"><h2 id="pgMgrT">Pages &amp; menu</h2><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <div class="sectitle" style="margin-top:0">Pages</div><ol class="pg-list">${P.map((p,i)=>`<li class="pg-row${p.id===state.pageId?' on':''}"><span class="pg-ic">${ic(i===0?'home':p.icon||'info',16)}</span><input class="pg-n" id="pgn-${p.id}" data-pgren="${p.id}" value="${esc(p.name)}" aria-label="Page name"><small class="pg-url">/${esc(i===0?'':slug(p.name))}</small>
  <label class="mini-sw" title="Show in the menu"><input type="checkbox" data-pgnav="${p.id}" ${p.nav!==false?'checked':''} aria-label="Show ${esc(p.name)} in the menu"><i></i><span>${p.nav!==false?'In menu':'Hidden'}</span></label>
  <span class="pg-act"><button type="button" class="iconbtn" data-pgmove="${p.id}|-1" ${i<2?'disabled':''} aria-label="Move up">${ic('up',14)}</button><button type="button" class="iconbtn" data-pgmove="${p.id}|1" ${i===0||i===P.length-1?'disabled':''} aria-label="Move down">${ic('down',14)}</button><button type="button" class="iconbtn" data-pgdup="${p.id}" aria-label="Copy page">${ic('copy',14)}</button><button type="button" class="iconbtn" data-pgdel="${p.id}" ${i===0?'disabled title="The home page stays"':''} aria-label="Delete page">${ic('trash',14)}</button></span>
  <button type="button" class="btn sm" data-gopage="${p.id}" data-closeafter>${p.id===state.pageId?'Editing':'Edit'}</button></li>`).join('')}</ol>
 <button type="button" class="btn sm" data-pageadd>${ic('plus',14)} Add page</button>
 ${menuPickers()}
 <div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn pri" data-closemodal>Done</button></div></div></div>`}

/* ---------- menu styles ---------- */
const MENU_D={links:'Simple links',underline:'Underline',pills:'Pills',boxed:'Outlined',tabs:'Tab bar',button:'Menu button'};
const MENU_M={burger:'Drop-down',drawer:'Side drawer',full:'Full screen',tabbar:'Bottom tabs',scroll:'Swipe row'};
let MOPEN=false;
const menuD=()=>MENU_D[state.brand.menuD]?state.brand.menuD:'links',menuM=()=>MENU_M[state.brand.menuM]?state.brand.menuM:'burger';
function navItems(){const P=state.pages;if(P&&P.length>1)return P.filter(p=>p.nav!==false).map((p,i)=>({l:p.name,page:p.id,on:p.id===state.pageId,icon:p===P[0]?'home':p.icon||'info'}));
 const T={about:['About','info'],services:['Services','grid4'],testimonials:['Reviews','star'],gallery:['Gallery','image'],shop:['Shop','bag'],booking:['Book','calendar'],map:['Visit','map'],contact:['Contact','phoneCall']};const seen=new Set();
 return state.sections.filter(s=>!s.hidden&&T[s.type]&&!seen.has(T[s.type][0])&&seen.add(T[s.type][0])).slice(0,6).map(s=>({l:T[s.type][0],sec:s.id,icon:T[s.type][1]}))}
const navA=i=>`<a role="link" tabindex="0" ${i.page?`data-gopage="${i.page}"`:`data-gosec="${i.sec}"`}${i.on?' class="on" aria-current="page"':''}>${esc(i.l)}</a>`;
function menuTabbar(){if(menuM()!=='tabbar')return'';const it=navItems().slice(0,5);if(!it.length)return'';return `<nav class="mtab" aria-label="Menu">${it.map(i=>`<a role="link" tabindex="0" ${i.page?`data-gopage="${i.page}"`:`data-gosec="${i.sec}"`}${i.on?' class="on"':''}>${ic(i.icon,19)}<span>${esc(i.l)}</span></a>`).join('')}</nav>`}
function menuIllus(kind,k){const bar='<i class="mi-logo"></i>';
 if(kind==='d'){const links=[0,1,2].map(n=>`<i class="mi-l${n===0?' on':''}"></i>`).join('');return `<span class="mi mi-d mi-${k}">${bar}${k==='button'?'<i class="mi-burg"></i>':`<span class="mi-links">${links}</span>`}</span>`}
 return `<span class="mi mi-m mi-${k}">${bar}${k==='tabbar'||k==='scroll'?'':'<i class="mi-burg"></i>'}${k==='scroll'?'<span class="mi-row"><i></i><i></i><i></i></span>':''}${k==='tabbar'?'<span class="mi-tabs"><i></i><i></i><i></i><i></i></span>':''}${k==='drawer'?'<span class="mi-drawer"><i></i><i></i><i></i></span>':''}${k==='full'?'<span class="mi-full"><i></i><i></i><i></i></span>':''}${k==='burger'?'<span class="mi-drop"><i></i><i></i><i></i></span>':''}</span>`}
function menuPickers_v1(){const d=menuD(),m=menuM(),hc=state.brand.ctaLabel!=='';
 return `<div class="sectitle">Menu on computers</div><div class="mpick" role="radiogroup" aria-label="Menu style on computers">${Object.entries(MENU_D).map(([k,l])=>`<button type="button" role="radio" aria-checked="${k===d}" class="mp${k===d?' on':''}" data-menud="${k}">${menuIllus('d',k)}<small>${l}</small></button>`).join('')}</div>
 <div class="sectitle">Menu on phones</div><div class="mpick" role="radiogroup" aria-label="Menu style on phones">${Object.entries(MENU_M).map(([k,l])=>`<button type="button" role="radio" aria-checked="${k===m}" class="mp${k===m?' on':''}" data-menum="${k}">${menuIllus('m',k)}<small>${l}</small></button>`).join('')}</div>
 <label class="bgx-sw" style="margin-top:10px"><input type="checkbox" data-hdrcta ${hc?'checked':''}><i></i><span>Show a button in the menu</span></label>
 <p class="hint">Switch the preview to Phone to see the phone menu. On the page, click any menu button to change its words and where it goes.</p>`}

/* ---------- buttons: custom label and link for every button ---------- */
const LINK_T={page:'Go to a page',sec:'Jump to a section',tel:'Call your phone',sms:'Text your phone',mail:'Email you',map:'Get directions to you',url:'Open a website',none:'Do nothing'};
function btnHtml(scope,key,label,cls){return `<span class="sbtn${cls?' '+cls:''}" role="button" tabindex="0" data-btn="${scope}|${key}"${EDIT?' title="Click to change the words and the link"':''}>${esc(label)}</span>`}
function fixedFn(scope,key){const s=scope!=='hdr'&&sec(scope);if(!s)return'';if(s.type==='contact'&&key==='button')return'Sends the contact form to your email';if(s.type==='booking'&&key==='button')return'Sends the booking request to your dashboard';if(s.type==='shop'&&key==='addLabel')return'Adds the item to the cart';return''}
function btnLabel(scope,key){if(scope==='hdr'){const b=state.brand;if(b.ctaLabel)return b.ctaLabel;const ph=phoneOf();return b.header==='call'&&ph?`Call ${ph}`:(firstOf('booking')?'Book now':firstOf('shop')?'Order online':'Contact us')}
 const s=sec(scope);if(!s)return'';const d=s.data;if(s.type==='contact'&&key==='button')return d.button||'Send message';if(s.type==='booking'&&key==='button')return d.button||'Request this time';if(s.type==='shop'&&key==='addLabel')return d.addLabel||'Add to cart';if(s.type==='pricing'&&/^p\d+$/.test(key))return d[key]||d.button||'Choose this';return d[key]||''}
function defLink(s,key){const pick=(...ts)=>{for(const t of ts){const x=firstOf(t);if(x&&(!s||x.id!==s.id))return{t:'sec',v:x.id}}return null};
 if(s==='hdr')return state.brand.header==='call'&&phoneOf()?{t:'tel'}:pick('booking','shop','contact')||{t:'none'};
 if(s&&s.type==='hero'&&key==='cta2')return pick('services','about','gallery')||{t:'none'};
 return pick('booking','shop','contact','map')||(phoneOf()?{t:'tel'}:{t:'none'})}
function linkOf(scope,key){if(scope==='ann')return(state.announce&&state.announce.link)||{t:'none'};if(scope==='hdr')return state.brand.ctaLink||defLink('hdr',key);const s=sec(scope);return(s&&s.data.links&&s.data.links[key])||defLink(s,key)}
function setLink(scope,key,L){if(scope==='ann'){state.announce.link=L;save();soft();return}if(scope==='hdr'){state.brand.ctaLink=L}else{const s=sec(scope);if(!s)return;s.data.links=s.data.links||{};s.data.links[key]=L}save()}
function setLabel(scope,key,v){if(scope==='hdr')state.brand.ctaLabel=v;else{const s=sec(scope);if(s)s.data[key]=v}
 $$(`[data-btn="${scope}|${key}"]`).forEach(b=>b.textContent=v||'Button');save()}
const normUrl=u=>{u=String(u||'').trim();if(!u)return'';return /^[a-z]+:/i.test(u)?u:'https://'+u};
function findSecAny(id){syncPage();for(const p of state.pages){const s=(p.sections||[]).find(x=>x.id===id);if(s)return{p,s}}return null}
const secTitle=s=>`${CATALOG[s.type]?CATALOG[s.type].name:s.type}${s.data&&s.data.heading?': '+String(s.data.heading).slice(0,32):''}`;
function linkText(L){const b=state.biz||{};switch(L.t){case'page':{const p=(state.pages||[]).find(x=>x.id===L.v);return p?`Goes to the ${p.name} page`:'Pick a page'}
 case'sec':{const f=findSecAny(L.v);return f?`Jumps to ${secTitle(f.s)}${state.pages.length>1?` on the ${f.p.name} page`:''}`:'Pick a section'}
 case'tel':return b.phone?`Calls ${b.phone}`:'Add your phone number in the Business tab';case'sms':return b.phone?`Opens a text to ${b.phone}`:'Add your phone number in the Business tab';
 case'mail':return b.email?`Opens an email to ${b.email}`:'Add your email in the Business tab';case'map':return b.address?`Opens directions to ${b.address}`:'Add your address in the Business tab';
 case'url':return L.v?`Opens ${normUrl(L.v).replace(/^https?:\/\//,'')}${L.nw?' in a new tab':''}`:'Type a web address';default:return'Does nothing when clicked'}}
function linkUrl(L){const b=state.biz||{};if(L.t==='tel'&&b.phone)return'tel:'+b.phone.replace(/[^\d+]/g,'');if(L.t==='sms'&&b.phone)return'sms:'+b.phone.replace(/[^\d+]/g,'');if(L.t==='mail'&&b.email)return'mailto:'+b.email;if(L.t==='map'&&b.address)return'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(b.address);if(L.t==='url')return normUrl(L.v);return''}
function followLink(L,root){if(L.t==='page'){gotoPage(L.v);return}if(L.t==='sec'){const f=findSecAny(L.v);if(f&&f.p.id!==state.pageId)gotoPage(f.p.id,L.v);else scrollToSec(L.v,root);return}
 const u=linkUrl(L);if(!u){toast(linkText(L));return}if(L.t==='url'||L.t==='map'){try{window.open(u,'_blank','noopener')}catch(e){}toast(linkText(L))}else toast(`On your live site this ${linkText(L).replace(/^Opens/,'opens').replace(/^Calls/,'calls')}`)}
/* the small editor that opens when a button is clicked while designing */
let BP=null;
function closeBtnPop(){const p=$('#btnPop');if(p)p.remove();if(BP&&BP.dirty){BP=null;soft()}BP=null}
function bpMore(L){syncPage();if(L.t==='page')return `<label class="fld"><span>Page</span><select id="bp-page">${state.pages.map(p=>`<option value="${p.id}"${p.id===L.v?' selected':''}>${esc(p.name)}</option>`).join('')}</select></label>${state.pages.length<2?`<p class="hint">You only have one page. <button type="button" class="linkbtn" data-pageadd>Add a page</button></p>`:''}`;
 if(L.t==='sec')return `<label class="fld"><span>Section</span><select id="bp-sec">${state.pages.map(p=>`<optgroup label="${esc(p.name)} page">${(p.sections||[]).filter(s=>!s.hidden).map(s=>`<option value="${s.id}"${s.id===L.v?' selected':''}>${esc(secTitle(s))}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
 if(L.t==='url')return `<label class="fld"><span>Web address</span><input id="bp-url" type="url" inputmode="url" placeholder="www.example.com" value="${esc(L.v||'')}" autocomplete="off"></label><label class="bgx-sw"><input type="checkbox" id="bp-new" ${L.nw?'checked':''}><i></i><span>Open in a new tab</span></label>`;
 return''}
function bpDefault(t){syncPage();if(t==='page'){const p=state.pages.find(x=>x.id!==state.pageId)||state.pages[0];return{t,v:p.id}}if(t==='sec'){const s=state.sections.find(x=>!x.hidden)||((state.pages.find(p=>(p.sections||[]).length)||{}).sections||[])[0];return{t,v:s?s.id:''}}if(t==='url')return{t,v:'',nw:true};return{t}}
function openBtnPop(scope,key,anchor){ask0();const fx=fixedFn(scope,key),L=linkOf(scope,key),lab=btnLabel(scope,key);snap();BP={scope,key,dirty:false};
 const canRemove=!fx;const el=document.createElement('div');el.id='btnPop';el.className='bp';el.setAttribute('role','dialog');el.setAttribute('aria-label','Edit button');
 el.innerHTML=`<div class="bp-h"><b>${ic('edit',14)} Button</b><button type="button" class="iconbtn" data-bpclose aria-label="Close">${ic('x',16)}</button></div>
 <label class="fld"><span>Button words</span><input id="bp-label" value="${esc(lab)}" maxlength="40" autocomplete="off"></label>
 ${fx?`<p class="bp-fixed">${ic('check',14)} ${esc(fx)}</p>`:`<label class="fld"><span>When someone clicks it</span><select id="bp-type">${Object.entries(LINK_T).map(([k,l])=>`<option value="${k}"${k===L.t?' selected':''}>${l}</option>`).join('')}</select></label><div id="bp-more">${bpMore(L)}</div><p class="bp-sum" id="bp-sum">${ic('link',13)}<span>${esc(linkText(L))}</span></p>`}
 <div class="bp-act">${canRemove?`<button type="button" class="btn sm" data-bpremove>Remove button</button>`:''}${fx?'':`<button type="button" class="btn sm" data-bptest>Try it</button>`}<button type="button" class="btn sm pri" data-bpclose>Done</button></div>`;
 document.body.appendChild(el);
 if(innerWidth<=560||!anchor)el.classList.add('sheet');else{const r=anchor.getBoundingClientRect();const h=el.offsetHeight,w=el.offsetWidth;let top=r.bottom+8;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-8);el.style.top=top+'px';el.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px'}
 const i=$('#bp-label');if(!isNarrow()){i.focus();i.select()}}
function bpUpdate(){if(!BP)return;const L=linkOf(BP.scope,BP.key);const s=$('#bp-sum span');if(s)s.textContent=linkText(L)}
function btnsPanel(s){const keys=[];const d=s.data;if(s.type==='hero'){if(d.cta)keys.push('cta');if(d.cta2)keys.push('cta2')}else if(s.type==='cta'&&d.button)keys.push('button');else if(s.type==='contact'||s.type==='booking')keys.push('button');else if(s.type==='shop')keys.push('addLabel');else if(s.type==='pricing')(d.plans||[]).forEach((x,i)=>keys.push('p'+i));
 if(!keys.length)return'';return `<div class="sectitle">Buttons</div><div class="btn-list">${keys.map(k=>{const fx=fixedFn(s.id,k);return `<button type="button" class="btn-row" data-btnedit="${s.id}|${k}"><span class="sbtn-mini">${esc(btnLabel(s.id,k))}</span><small>${esc(fx||linkText(linkOf(s.id,k)))}</small>${ic('edit',14)}</button>`}).join('')}</div>`}

/* ---------- events for pages, menus and buttons ---------- */
document.addEventListener('click',e=>{const T=e.target;if(!(T instanceof Element))return;const q=s=>T.closest(s);let el;
 const pop=$('#btnPop');if(pop&&!q('#btnPop')&&!q('[data-btn]')&&!q('[data-btnedit]'))closeBtnPop();
 if(el=q('[data-btn]')){const site=el.closest('.site');if(!site)return;e.preventDefault();e.stopPropagation();const[scope,key]=el.dataset.btn.split('|');
  if(site.classList.contains('edit')){openBtnPop(scope,key,el);const s=el.closest('[data-sec]');if(s&&state.selected!==s.dataset.sec){state.selected=s.dataset.sec;state.rightTab='section';renderInspector();$$('#site .sec').forEach(x=>x.classList.toggle('sel',x.dataset.sec===state.selected))}}
  else if(!fixedFn(scope,key))followLink(linkOf(scope,key),site);else if(el.matches('[data-shopadd]'))toast(`Added ${el.dataset.shopadd} to the cart (demo store)`);else toast('Thanks! The form is sent (demo)');return}
 if(el=q('[data-btnedit]')){e.stopPropagation();const[scope,key]=el.dataset.btnedit.split('|');const b=$(`#site [data-btn="${el.dataset.btnedit}"]`);openBtnPop(scope,key,isNarrow()?null:el);if(b)b.scrollIntoView({block:'nearest'});return}
 if(q('[data-bpclose]')){closeBtnPop();soft();renderInspector();return}
 if(q('[data-bptest]')&&BP){const b=BP;closeBtnPop();followLink(linkOf(b.scope,b.key));return}
 if(q('[data-bpremove]')&&BP){const b=BP;setLabel(b.scope,b.key,'');closeBtnPop();hard();toast('Button removed',{label:'Undo',fn:undo});return}
 if(el=q('[data-gopage]')){e.preventDefault();e.stopPropagation();const close=el.hasAttribute('data-closeafter');gotoPage(el.dataset.gopage);if(close)closeModal();return}
 if(el=q('[data-gosec]')){e.preventDefault();e.stopPropagation();MOPEN=false;const site=el.closest('.site');soft();requestAnimationFrame(()=>scrollToSec(el.dataset.gosec,site&&site.id==='site'?$('#site'):site));return}
 if(q('[data-mtoggle]')){e.preventDefault();e.stopPropagation();MOPEN=!MOPEN;soft();return}
 if(q('[data-pageadd]')){e.stopPropagation();addPageModal();return}
 if(q('[data-pagesmgr]')){e.stopPropagation();pagesMgr();return}
 if(el=q('[data-pgtpl]')){e.stopPropagation();$$('[data-pgtpl]').forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});const n=$('#pgName');if(n&&!n.dataset.typed)n.placeholder=el.dataset.pgtpl==='blank'?'New page':PAGE_TPL[el.dataset.pgtpl].name;return}
 if(el=q('[data-pgmove]')){e.stopPropagation();const[id,d]=el.dataset.pgmove.split('|');movePage(id,+d);return}
 if(el=q('[data-pgdup]')){e.stopPropagation();dupPage(el.dataset.pgdup);return}
 if(el=q('[data-pgdel]')){e.stopPropagation();delPage(el.dataset.pgdel);return}
 if(el=q('[data-menud]')){e.stopPropagation();snap();state.brand.menuD=el.dataset.menud;hard();refreshMenuPickers();return}
 if(el=q('[data-menum]')){e.stopPropagation();snap();state.brand.menuM=el.dataset.menum;MOPEN=el.dataset.menum!=='tabbar'&&el.dataset.menum!=='scroll'&&state.device==='phone';hard();refreshMenuPickers();if(state.device!=='phone'&&!$('#pgMgr'))toast('Switch the preview to Phone to see it',{label:'Show me',fn:()=>{state.device='phone';MOPEN=true;hard()}});return}
},true);
function refreshMenuPickers(){$$('.mpick').forEach(m=>{const w=m.closest('#pgMgr,#inspector');if(w&&w.id==='pgMgr')pagesMgr()});if(state.rightTab==='brand')renderInspector()}
document.addEventListener('submit',e=>{if(e.target.id==='pgAddForm'){e.preventDefault();const t=($('[data-pgtpl].on')||{}).dataset;addPage($('#pgName').value,t?t.pgtpl:'blank')}},true);
document.addEventListener('input',e=>{const t=e.target;
 if(t.id==='pgName')t.dataset.typed=1;
 if(t.id==='bp-label'&&BP){setLabel(BP.scope,BP.key,t.value);BP.dirty=true;return}
 if(t.id==='bp-url'&&BP){const L=linkOf(BP.scope,BP.key);setLink(BP.scope,BP.key,{...L,t:'url',v:t.value});BP.dirty=true;bpUpdate()}});
document.addEventListener('change',e=>{const t=e.target;
 if(t.id==='bp-type'&&BP){const L=bpDefault(t.value);setLink(BP.scope,BP.key,L);$('#bp-more').innerHTML=bpMore(L);BP.dirty=true;bpUpdate();return}
 if((t.id==='bp-page'||t.id==='bp-sec')&&BP){setLink(BP.scope,BP.key,{t:t.id==='bp-page'?'page':'sec',v:t.value});BP.dirty=true;bpUpdate();return}
 if(t.id==='bp-new'&&BP){const L=linkOf(BP.scope,BP.key);setLink(BP.scope,BP.key,{...L,nw:t.checked});bpUpdate();return}
 if(t.dataset&&t.dataset.pgren){syncPage();const p=state.pages.find(x=>x.id===t.dataset.pgren);if(p){const v=t.value.trim();if(v&&v!==p.name){snap();p.name=v;hard();toast('Page renamed')}else t.value=p.name}return}
 if(t.dataset&&t.dataset.pgnav){syncPage();const p=state.pages.find(x=>x.id===t.dataset.pgnav);if(p){snap();p.nav=t.checked;hard();pagesMgr()}return}
 if(t.dataset&&t.dataset.hdrcta!==undefined){snap();state.brand.ctaLabel=t.checked?null:'';hard();return}});
document.addEventListener('keydown',e=>{const t=e.target;if(!t.matches)return;
 if((e.key==='Enter'||e.key===' ')&&t.matches('[data-btn],[data-gopage][role=link],[data-gosec]')){e.preventDefault();t.click();return}
 if(e.key==='Escape'&&$('#btnPop')){closeBtnPop();return}
 if(e.key==='Enter'&&t.id==='bp-label'){e.preventDefault();closeBtnPop();soft();renderInspector()}});

/* ---------- top banner editor (reuses the button link picker) ---------- */
const ANN_IDEAS=['Free local delivery this weekend','Now booking holiday orders','New hours: open Sundays 8 to 2','10% off your first order with code HELLO'];
function annSeg(k,opts,cur){return `<div class="seg sm bgx-seg">${Object.entries(opts).map(([v,l])=>`<button type="button" data-annset="${k}|${v}" class="${cur===v?'on':''}">${l}</button>`).join('')}</div>`}
function openAnnPop(anchor){ask0();const A=state.announce;snap();if(!A.on||!A.text){A.on=true;if(!A.text)A.text=ANN_IDEAS[0];A.style=A.style||'bar';hard()}
 BP={scope:'ann',key:'bar',dirty:false};const L=linkOf('ann','bar');const c=state.brand.colors;
 const el=document.createElement('div');el.id='btnPop';el.className='bp ann-pop';el.setAttribute('role','dialog');el.setAttribute('aria-label','Edit top banner');
 el.innerHTML=`<div class="bp-h"><b>${ic('spark',14)} Top banner</b><button type="button" class="iconbtn" data-bpclose aria-label="Close">${ic('x',16)}</button></div>
 <label class="fld"><span>Message</span><input id="ann-text" value="${esc(A.text)}" maxlength="90" autocomplete="off"></label>
 <div class="ann-ideas">${ANN_IDEAS.map(t=>`<button type="button" data-annidea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
 <div class="fld"><span>Style</span>${annSeg('style',{bar:'Still bar',ticker:'Scrolling ticker'},A.style||'bar')}</div>
 ${A.style==='ticker'?`<div class="fld"><span>Scroll speed</span>${annSeg('speed',{slow:'Slow',normal:'Normal',fast:'Fast'},A.speed||'normal')}</div>`:''}
 <div class="bgx-cols"><label class="bgx-c"><input type="color" id="ann-bg" value="${isHex(A.bg)?A.bg:c.a}"><span>Background</span></label><label class="bgx-c"><input type="color" id="ann-tx" value="${isHex(A.tx)?A.tx:onColor(isHex(A.bg)?A.bg:c.a)}"><span>Text</span></label><button type="button" class="linkbtn" data-annset="colors|reset" style="margin-left:auto;font-size:12px">Use my site colors</button></div>
 <div class="fld"><span>Text size</span>${annSeg('size',{sm:'Small',md:'Medium',lg:'Large'},A.size||'md')}</div>
 <div class="fld"><span>Show on</span>${annSeg('where',{all:'Every page',home:'Home page only'},A.where||'all')}</div>
 <label class="bgx-sw"><input type="checkbox" id="ann-close" ${A.close?'checked':''}><i></i><span>Visitors can close it</span></label>
 <label class="fld"><span>When someone clicks it</span><select id="bp-type">${Object.entries(LINK_T).map(([k,l])=>`<option value="${k}"${k===L.t?' selected':''}>${l}</option>`).join('')}</select></label><div id="bp-more">${bpMore(L)}</div><p class="bp-sum" id="bp-sum">${ic('link',13)}<span>${esc(linkText(L))}</span></p>
 <div class="bp-act"><button type="button" class="btn sm" data-annoff>Remove banner</button><button type="button" class="btn sm pri" data-bpclose>Done</button></div>`;
 document.body.appendChild(el);
 if(innerWidth<=560||!anchor)el.classList.add('sheet');else{const r=anchor.getBoundingClientRect();el.style.top=Math.min(r.bottom+8,Math.max(8,innerHeight-el.offsetHeight-8))+'px';el.style.left=Math.max(8,Math.min(r.left+r.width/2-el.offsetWidth/2,innerWidth-el.offsetWidth-8))+'px'}
 if(!isNarrow()){const i=$('#ann-text');i.focus();i.select()}}
function annRefresh(){const keep=$('#btnPop');const ae=document.activeElement&&document.activeElement.id;soft();if(keep){const t=$('#bp-sum span');if(t)t.textContent=linkText(linkOf('ann','bar'))}}
document.addEventListener('click',e=>{const T=e.target;if(!(T instanceof Element))return;const q=s=>T.closest(s);let el;
 if(q('[data-annadd]')||q('[data-annedit]')||q('[data-annopen]')){e.preventDefault();e.stopPropagation();const a=q('[data-annadd],[data-annedit]');openAnnPop(isNarrow()?null:a||null);return}
 if(el=q('[data-annidea]')){e.stopPropagation();state.announce.text=el.dataset.annidea;$('#ann-text').value=state.announce.text;save();annRefresh();return}
 if(el=q('[data-annset]')){e.stopPropagation();const[k,v]=el.dataset.annset.split('|');const A=state.announce;if(k==='colors'){delete A.bg;delete A.tx}else A[k]=v;save();soft();const anchor=$('#site .announce');closeBtnPop();openAnnPop(isNarrow()?null:anchor);return}
 if(q('[data-annoff]')){e.stopPropagation();state.announce.on=false;closeBtnPop();hard();toast('Banner removed',{label:'Undo',fn:undo});return}
 if(q('[data-annclose]')){e.preventDefault();e.stopPropagation();const site=T.closest('.site');if(site&&site.classList.contains('edit')){openAnnPop(null);return}ANN_CLOSED=true;soft();return}
 if(el=q('[data-annlink]')){e.stopPropagation();followLink(linkOf('ann','bar'),el.closest('.site'));return}
 if(el=q('[data-soc]')){const site=el.closest('.site');if(site&&site.classList.contains('edit'))return;e.preventDefault();e.stopPropagation();const u=el.dataset.soc;if(u){try{window.open(u,'_blank','noopener')}catch(err){}toast('Opens '+u.replace(/^https?:\/\//,''))}else toast('Add your page name in the Social media section');return}
},true);
document.addEventListener('input',e=>{const t=e.target;const A=state.announce;
 if(t.id==='ann-text'){A.text=t.value;A.on=true;save();$$('#site .ann-t').forEach(x=>x.textContent=t.value||' ');$$('#site .ann-track span').forEach(x=>x.textContent=t.value);clearTimeout(t._t);t._t=setTimeout(soft,500);return}
 if(t.id==='ann-bg'||t.id==='ann-tx'){A[t.id==='ann-bg'?'bg':'tx']=t.value;save();$$('#site .announce').forEach(x=>x.style.setProperty(t.id==='ann-bg'?'--ann-bg':'--ann-tx',t.value));return}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='ann-close'){state.announce.close=t.checked;save();soft();return}
 if(t.id==='ann-bg'||t.id==='ann-tx'){soft();return}});

/* ---------- business types: words for the new industries ---------- */
Object.assign(INDUSTRIES,{
 photographer:{label:'Photographer or videographer',goal:'quote',tagline:'Wedding, portrait and family photography in {city}',eyebrow:'Photography · {city}',hero:'Photos you will want to keep forever',sub:'{name} captures weddings, portraits and family moments with a natural, unposed style. Now booking the coming season.',aboutH:'Hi, I’m glad you’re here',about:'{name} is a small studio built around one idea: real moments look better than perfect poses. I keep sessions relaxed, so you can forget the camera and just be yourselves.',stats:[['300+','Sessions shot'],['10 yrs','Behind the lens'],['2 wks','Gallery delivery']],servicesH:'Sessions',intro:'Every session includes an online gallery and a print release.',services:[['Weddings','Full-day coverage from getting ready to the last dance.','From $3,200'],['Portraits','Headshots, seniors and couples.','From $350'],['Families','Relaxed sessions at home or outdoors.','From $450'],['Events','Parties, launches and corporate events.','From $600']],gallery:'Recent work',slidesH:'Recent sessions',slides:['Golden hour engagement','Backyard wedding','Family on the beach'],reviews:[['We cried looking at our wedding gallery. Every moment we forgot was there.','Ana & Theo R.','Wedding, 2026'],['So easy to work with. Our kids actually had fun.','The Patel family','Family session'],['My headshots got more compliments than my résumé.','Jordan K.','Portrait client']],faq:[['How far ahead should we book?','Weddings book 9 to 12 months out. Portrait sessions usually have openings within a month.'],['When do we get our photos?','Sneak peeks within 48 hours and your full gallery in about two weeks.'],['Do you travel?','Yes. Travel within an hour of {city} is included, and destination sessions are welcome.']]},
 health:{label:'Health & wellness (dental, chiropractic, therapy)',goal:'call',tagline:'Gentle, modern care in {city}',eyebrow:'Now welcoming new patients',hero:'Care that puts you at ease',sub:'{name} offers friendly, unhurried care for the whole family, with same-week appointments and most insurance accepted.',aboutH:'A practice that listens',about:'At {name} we take time to understand what you need before we recommend anything. Our team explains every step so there are no surprises.',stats:[['15+','Years caring for {city}'],['Same week','Appointments'],['Most','Insurance accepted']],servicesH:'How we can help',intro:'Not sure what you need? Call and we will help you choose.',services:[['New patient visit','A full exam and a plan made for you.','Most insurance'],['Cleanings & checkups','Routine care twice a year.',''],['Treatment plans','Clear options and pricing before we start.',''],['Emergency visits','Same-day help when something hurts.','']],gallery:'Our office',reviews:[['Everyone was kind and nothing was rushed. I finally found my place.','Megan S.','Patient since 2023'],['They got me in the same day and explained everything.','Carlos D.','Google review'],['My kids actually look forward to their visits.','Lauren P.','Parent']],faq:[['Do you take my insurance?','We accept most major plans and will check your benefits before your visit.'],['Are you accepting new patients?','Yes. Call or send a message and we will find a time this week.'],['What should I bring to my first visit?','A photo ID, your insurance card and a list of any medications.']]},
 realestate:{label:'Real estate agent or property manager',goal:'call',tagline:'Helping {city} buy, sell and rent with confidence',eyebrow:'Real estate · {city}',hero:'Find the place that fits your life',sub:'{name} helps buyers, sellers and renters around {city} with honest advice, sharp pricing and a plan for every step.',aboutH:'Local and on your side',about:'{name} has helped hundreds of families move in and move on. We know the neighborhoods, the schools and the numbers, and we pick up the phone.',stats:[['$120M+','Homes sold'],['350+','Families helped'],['18 days','Average time to offer']],servicesH:'How we help',intro:'Every move starts with a free, no-pressure conversation.',services:[['Buying a home','Search, tours, offers and closing, start to finish.',''],['Selling your home','Pricing, staging, photos and marketing that sells.',''],['Rentals & leasing','Find tenants or your next rental.',''],['Free home value','Know what your home is worth today.','']],gallery:'Recently sold',reviews:[['They sold our house in a week for over asking. Calm the whole way.','The Moreno family','Sellers'],['As first-time buyers we had a hundred questions. They answered all of them.','Priya & Sam','Buyers'],['Responsive, honest and they know {city} inside and out.','Derek L.','Zillow review']],faq:[['How much is my home worth?','Request a free home value and we will send a detailed report within a day.'],['Do I need to be pre-approved to tour?','It helps. We can connect you with trusted local lenders.'],['What do you charge?','Buyers usually pay nothing directly. For sellers we offer clear, competitive rates.']]},
 events:{label:'Weddings & events (planner, florist, DJ, venue)',goal:'quote',tagline:'Weddings and celebrations in {city}',eyebrow:'Weddings & events · {city}',hero:'Celebrations that feel like you',sub:'{name} plans and styles weddings, showers and parties so you can enjoy the day instead of running it.',aboutH:'Every detail, handled',about:'{name} started with a love of bringing people together. We keep the timeline, the vendors and the little details on track, and we stay calm when things change.',stats:[['200+','Events planned'],['50+','Trusted vendors'],['5★','Average review']],servicesH:'What we do',intro:'Packages are a starting point. Every event is planned around you.',services:[['Wedding planning','Full or partial planning with a custom timeline.','From $3,500'],['Day-of coordination','We run the day so you can be in it.','From $1,200'],['Florals & styling','Bouquets, centerpieces and installs.','From $900'],['Private parties','Showers, birthdays and corporate events.','From $800']],gallery:'Real celebrations',slidesH:'Recent celebrations',slides:['Garden ceremony','Candlelit reception','Rehearsal dinner'],reviews:[['We did not lift a finger on the day and it was more beautiful than we imagined.','Grace & Emeka','Wedding, 2026'],['They turned a rented hall into a garden. Guests are still talking about it.','Hannah W.','Bridal shower'],['Organized, creative and so kind to our families.','Luis & Mara','Wedding']],faq:[['How far ahead should we book?','Twelve months for full planning, three months for day-of coordination.'],['Do you travel?','Yes. Events within 60 miles of {city} have no travel fee.'],['Can we customize a package?','Always. Packages are a starting point.']]},
 auto:{label:'Auto repair or detailing',goal:'call',tagline:'Honest auto repair and detailing in {city}',eyebrow:'Auto care · {city}',hero:'Honest repairs, done on time',sub:'{name} fixes cars right the first time with upfront quotes, certified techs and a warranty on every job.',aboutH:'The shop your neighbors trust',about:'{name} is a family-owned shop that explains the problem, shows you the old part and never does work you did not approve.',stats:[['25+','Years in business'],['ASE','Certified techs'],['12 mo','Warranty on repairs']],servicesH:'Services',intro:'Call for a quote or drop by. Most repairs are done the same day.',services:[['Oil & maintenance','Oil changes, filters and factory service.','From $59'],['Brakes','Pads, rotors and a free brake check.','From $149'],['Check engine','Diagnostics and a clear repair quote.','$89'],['Detailing','Interior and exterior detailing.','From $129']],gallery:'In the shop',reviews:[['They told me I did not need the repair the dealer quoted. Customer for life.','Kevin R.','Google review'],['Fast, fair and they texted photos of the problem.','Alicia M.','Customer'],['My car has never looked this clean.','Tom B.','Detailing customer']],faq:[['Do I need an appointment?','Appointments are best, but we take walk-ins for small jobs.'],['Do you offer a warranty?','Every repair comes with a 12 month, 12,000 mile warranty.'],['Can I wait while you work?','Yes. We have Wi-Fi, coffee and a comfy waiting room.']]},
 landscape:{label:'Landscaping, lawn care or pools',goal:'quote',tagline:'Lawns, landscapes and outdoor living in {city}',eyebrow:'Serving {city} and nearby',hero:'A yard you will love coming home to',sub:'{name} designs, builds and maintains lawns, gardens and patios with reliable crews and free estimates.',aboutH:'Local crews who care',about:'{name} is a local team that shows up when we say we will, keeps your property tidy and treats your yard like our own.',stats:[['12+','Years in business'],['800+','Yards cared for'],['Free','Estimates']],servicesH:'What we do',intro:'Weekly service or one-time projects. Free estimates on every job.',services:[['Lawn care','Mowing, edging, fertilizing and weed control.','From $45/visit'],['Landscape design','Plans and planting that fit your space.','Free estimate'],['Patios & walkways','Pavers, stone and outdoor living.','Free estimate'],['Seasonal cleanup','Spring and fall cleanups.','From $299']],gallery:'Recent projects',reviews:[['Our backyard went from mud to the best room in the house.','Nina & Rob','Patio project'],['Always on time and the lawn has never looked better.','George H.','Weekly customer'],['Fair quote, great crew and they cleaned up every leaf.','Sandra K.','Google review']],faq:[['Do you offer free estimates?','Yes. We visit, measure and send a written quote within two days.'],['Are you licensed and insured?','Yes, fully licensed and insured.'],['Do I need to be home?','No. We send a text when we arrive and when we finish.']]},
 lessons:{label:'Lessons, tutoring or childcare',goal:'call',tagline:'Lessons and learning for {city} kids and adults',eyebrow:'Now enrolling · {city}',hero:'Where learning feels like fun',sub:'{name} offers small-group and one-on-one lessons for every age, with caring teachers and flexible schedules.',aboutH:'Small classes, big progress',about:'{name} was started by teachers who believe every student can thrive with the right support. We keep classes small and send families updates after every session.',stats:[['500+','Students taught'],['1:6','Teacher to student'],['1st','Lesson free']],servicesH:'Programs',intro:'Not sure where to start? Book a free first lesson.',services:[['Private lessons','One-on-one sessions at your pace.','$45/lesson'],['Small groups','Up to six students per class.','$30/class'],['After-school program','Homework help and enrichment.','$160/month'],['Summer camps','Week-long themed camps.','$299/week']],gallery:'Life at {name}',reviews:[['My daughter went from dreading math to asking for extra practice.','Rachel T.','Parent'],['Flexible, kind and my son loves his teacher.','Marcus J.','Parent'],['I started guitar at 45. Best decision I made this year.','Ellen F.','Adult student']],faq:[['What ages do you teach?','Ages 4 through adult. We place students by level, not just age.'],['Can we try a lesson first?','Yes. Your first lesson is free.'],['What if we miss a class?','Reschedule anytime with 24 hours notice.']]}
});
INDUSTRIES.home.label='Home services (contractor, plumbing, cleaning)';
INDUSTRIES.salon.label='Salon, spa or barber';
/* keep "Something else" last in every list */
(()=>{const o=INDUSTRIES.other;delete INDUSTRIES.other;INDUSTRIES.other=o})();

/* ---------- industry color themes ---------- */
Object.assign(THEMES,{
 darkroom:{name:'Darkroom',colors:{p:'#F2EFE9',a:'#C9A66B',bg:'#111111',sf:'#1C1C1C',tx:'#F2EFE9'},font:'cormorant',radius:0,btn:'square'},
 bistro:{name:'Bistro',colors:{p:'#7A1E2C',a:'#D9A441',bg:'#FBF6EE',sf:'#F2E6D6',tx:'#2A1A14'},font:'playfair',radius:6,btn:'rounded'},
 clinic:{name:'Clinic',colors:{p:'#0F6E6E',a:'#F2A65A',bg:'#FFFFFF',sf:'#EEF6F6',tx:'#17323A'},font:'sora',radius:14,btn:'pill'},
 estate:{name:'Estate',colors:{p:'#1F2A44',a:'#B89B5E',bg:'#FFFFFF',sf:'#F3F1EC',tx:'#1F2A44'},font:'dmserif',radius:4,btn:'square'},
 bloom:{name:'Bloom',colors:{p:'#7B5E7B',a:'#D98E96',bg:'#FFFBF8',sf:'#F7ECEA',tx:'#3A2E3A'},font:'cormorant',radius:20,btn:'pill'},
 motor:{name:'Motor',colors:{p:'#16161A',a:'#E63946',bg:'#FFFFFF',sf:'#EFEFF1',tx:'#16161A'},font:'archivo',radius:4,btn:'square'},
 garden:{name:'Garden',colors:{p:'#2D6A4F',a:'#E9C46A',bg:'#FAFCF8',sf:'#E9F2EA',tx:'#1B3326'},font:'bitter',radius:12,btn:'rounded'},
 chalk:{name:'Chalkboard',colors:{p:'#3A5BA0',a:'#F4A259',bg:'#FFFDF7',sf:'#EEF2FB',tx:'#1F2A44'},font:'fredoka',radius:18,btn:'pill'},
 trades:{name:'Trades',colors:{p:'#0B3954',a:'#FF7F11',bg:'#FFFFFF',sf:'#EEF3F7',tx:'#0B2233'},font:'sora',radius:8,btn:'rounded'}
});

/* ---------- kits: what each kind of business needs, as layouts with pages ---------- */
const G3=['Featured','Recent','Behind the scenes'];
const KITS={
 photographer:{short:'Photographer',icon:'camera',sample:'Golden Hour Studio',theme:'darkroom',styles:['portfolio','luxe','magazine'],cta:'Check my date',cta2:'See my work',
  contactH:'Tell me about your day',contactSub:'Share your date, location and what you are dreaming of. I reply within one business day.',contactBtn:'Check availability',
  pfH:'Portfolio',pfSub:'Pick a collection to see more.',pf:{Weddings:['First look by the lake','Golden hour portraits','Reception sparklers','Vows in the garden'],Portraits:['Studio headshot','Senior session downtown','Couple at sunset'],Families:['Morning at home','Beach day','New baby'],Events:['Product launch','Milestone birthday']},
  plansH:'Packages',plansSub:'Every package includes an online gallery and a print release.',planBtn:'Book this package',plans:[['Mini session','$350','','30 minutes\nOne location\n15 edited photos\nOnline gallery'],['Portrait','$650','','2 hours\nTwo locations\n50 edited photos\nPrint release',1],['Wedding','From $3,200','','8 hours of coverage\nSecond shooter\n400+ edited photos\nEngagement session included']],
  ctaSec:{heading:'Booking the coming season now',sub:'Dates go fast. Send your date and I will hold it for 48 hours while we talk.',button:'Check my date'},
  layouts:{
   showcase:{name:'Portfolio first',desc:'A full-screen photo, then your best work sorted into collections.',style:'portfolio',home:['hero:overlay','portfolio:filter','about','testimonials','pricing','contact'],pages:[['Portfolio','image',['hero','portfolio:albums']],['Packages','card',['hero','pricing','faq','cta']],['About','info',['hero','about','testimonials']],['Contact','phoneCall',['contact','faq']]]},
   albums:{name:'Client albums',desc:'An album cover for each kind of shoot, with packages close by.',style:'luxe',home:['hero:arch','portfolio:albums','pricing','testimonials','faq','contact'],pages:[['Galleries','image',['hero','portfolio:masonry']],['Packages','card',['hero','pricing','faq']],['Contact','phoneCall',['contact']]]},
   story:{name:'Story and packages',desc:'Lead with who you are, then a photo wall and clear pricing.',style:'magazine',home:['hero:poster','about','portfolio:masonry','pricing','testimonials','cta','contact'],pages:[['Work','image',['hero','portfolio:filter']],['Contact','phoneCall',['contact','faq']]]}}},
 restaurant:{short:'Restaurant',icon:'fork',sample:'Juniper Table',theme:'bistro',styles:['retro','classic','luxe'],cta:'Order online',cta2:'See the menu',
  menuH:'Our menu',menuIntro:'Made to order with local ingredients. Ask about today’s specials.',menuNote:'V vegetarian · GF gluten-free. Please tell your server about any allergies.',
  menu:[['Starters','Crispy brussels sprouts','Honey, chili and lime.','$11','V, GF'],['Starters','Soup of the day','Ask your server.','$8',''],['Starters','Smoked wings','Dry rub, house ranch.','$14','Spicy'],['Mains','Wood-fired chicken','Half chicken, salsa verde, potatoes.','$24','GF'],['Mains','Table burger','Two smash patties, cheddar, pickles.','$18',''],['Mains','Seasonal pasta','Fresh pasta, market vegetables.','$21','V'],['Mains','Fish of the day','Simply grilled with lemon.','Market',''],['Desserts','Chocolate pot de crème','Whipped cream, sea salt.','$9','V, GF'],['Drinks','House lemonade','Fresh squeezed.','$5','V'],['Drinks','Local draft','Ask about the rotating tap.','$7','']],
  ctaSec:{heading:'Hosting a party?',sub:'Private dining for up to 40 and catering trays for any size.',button:'Plan an event'},
  layouts:{
   menu:{name:'Menu first',desc:'Your menu right under the photo, then hours and directions.',style:'retro',home:['hero:overlay','menu:tabs','about','testimonials','map','contact'],pages:[['Menu','fork',['hero','menu:classic']],['Catering','calendar',['hero','services:cards','cta','contact']],['Visit','pin',['map','faq','contact']]]},
   order:{name:'Order ahead',desc:'Online ordering up top, with photo menu cards and pickup details.',style:'classic',home:['hero:split','shop','menu:photos','map','testimonials','faq'],pages:[['Menu','fork',['hero','menu:classic']],['Visit','pin',['map','contact']]]},
   dinner:{name:'Dinner and events',desc:'A quiet, elegant page with a chalkboard menu and private events.',style:'luxe',home:['hero:arch','about','menu:board','gallery','testimonials','cta','map'],pages:[['Menu','fork',['hero','menu:classic']],['Private events','calendar',['hero','services','gallery','contact']]]}}},
 bakery:{short:'Bakery or café',icon:'cake',sample:'Harbor & Pine Bakery',styles:['classic','retro','playful'],cta:'Order for pickup',cta2:'See the menu',
  menuH:'On the counter today',menuIntro:'Baked every morning. Order ahead to make sure we save you one.',menuNote:'V vegetarian · GF gluten-free',
  menu:[['Bread','Country sourdough','36-hour ferment, crackling crust.','$9','V'],['Bread','Baguette','Baked three times a day.','$5','V'],['Bread','Seeded rye','Sunflower, flax and caraway.','$10','V'],['Pastries','Butter croissant','Laminated by hand.','$4.50','V'],['Pastries','Cardamom bun','Our most loved pastry.','$5','V'],['Pastries','Seasonal danish','Fruit from local farms.','$5.50','V'],['Coffee','Drip coffee','Local roaster, refills free.','$3','V, GF'],['Coffee','Latte','Oat milk at no charge.','$5','V, GF']],
  ctaSec:{heading:'Planning a party or office breakfast?',sub:'Tell us the date and headcount and we will build a box that fits.',button:'Start a catering order'},
  layouts:{
   counter:{name:'Counter favorites',desc:'A warm welcome, today’s menu with photos, and how to find you.',style:'classic',home:['hero:split','menu:photos','about','testimonials','map','contact'],pages:[['Menu','cake',['hero','menu:classic']],['Custom cakes','calendar',['hero','services:cards','gallery','contact']]]},
   order:{name:'Order ahead',desc:'Online ordering front and center for pickup.',style:'playful',home:['hero:bubble','shop','menu:classic','faq','map'],pages:[['Menu','cake',['hero','menu:classic']],['Visit','pin',['map','contact']]]},
   story:{name:'Our story',desc:'Retro signage, a rotating photo strip and a chalkboard menu.',style:'retro',home:['hero:badge','about','slideshow','menu:board','testimonials','map'],pages:[['Menu','cake',['hero','menu:classic']],['Contact','phoneCall',['contact','faq']]]}}},
 salon:{short:'Salon or spa',icon:'scissors',sample:'Willow & Shear',theme:'blush',styles:['luxe','playful','portfolio'],cta:'Book now',cta2:'See services',
  team:[['Ava Morales','Owner & color specialist','15 years of color, from soft balayage to bold vivids.'],['Jordan Lee','Senior stylist','Precision cuts and curly hair care.'],['Sam Patel','Barber','Fades, beard trims and hot towel shaves.']],
  pfH:'Lookbook',pfSub:'Recent work from our chairs.',pf:{Cuts:['Textured bob','Classic fade','Long layers'],Color:['Honey balayage','Copper refresh','Platinum'],Bridal:['Soft updo','Boho waves']},
  plansH:'Memberships',plansSub:'Save on regular visits.',planBtn:'Join',plans:[['Blowout club','$99','/mo','Two blowouts a month\n10% off products'],['Color club','$149','/mo','Root touch-up every 6 weeks\nGloss included\nPriority booking',1],['Barber club','$59','/mo','Two cuts a month\nBeard trims included']],
  layouts:{
   book:{name:'Book first',desc:'Services and prices up top, then your team and online booking.',style:'luxe',home:['hero:arch','services:menu','booking','team','testimonials','map'],pages:[['Services','scissors',['hero','services:menu','pricing','faq']],['Team','info',['hero','team','testimonials']],['Book','calendar',['booking','map']]]},
   look:{name:'Lookbook',desc:'A photo-led page with your work sorted by style.',style:'portfolio',home:['hero:overlay','portfolio:filter','services:menu','team:round','contact'],pages:[['Lookbook','image',['hero','portfolio:masonry']],['Book','calendar',['booking','map']]]}}},
 home:{short:'Home services',icon:'wrench',sample:'Summit Home Services',theme:'trades',styles:['classic','loud','tech'],cta:'Get a free quote',cta2:'See our work',
  baH:'Before and after',baSub:'Drag the line to see the difference.',pairs:['Kitchen remodel','Roof replacement','Bathroom refresh'],
  ctaSec:{heading:'Need it fixed this week?',sub:'Call now for same-week service across {city}.',button:'Call for service'},
  layouts:{
   quote:{name:'Free quote',desc:'Clear services, proof of your work and a quote form.',style:'classic',home:['hero:split','services:cards','beforeafter','testimonials','faq','contact'],pages:[['Services','wrench',['hero','services','faq','cta']],['Our work','image',['hero','beforeafter','gallery']],['Reviews','star',['hero','testimonials','cta']],['Contact','phoneCall',['contact','map']]]},
   proof:{name:'Show the work',desc:'Bold headline, before and after up front, then a fast quote form.',style:'loud',home:['hero:marquee','beforeafter','services:grid','about','testimonials','contact'],pages:[['Services','wrench',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]}}},
 fitness:{short:'Gym or studio',icon:'dumbbell',sample:'Ironwood Fitness',styles:['loud','tech','playful'],cta:'Claim a free class',cta2:'See classes',
  team:[['Tess Rivera','Head coach','Strength and conditioning, 12 years coaching.'],['Andre Kim','Strength coach','Former college athlete, loves a good deadlift.'],['Mia Lopez','Yoga & mobility','Calm, clear cues for every level.']],
  plansH:'Memberships',plansSub:'No contracts. Pause or cancel anytime.',planBtn:'Start today',plans:[['Drop-in','$20','/class','Any group class\nNo commitment'],['Unlimited','$129','/mo','Every class, every week\nFree intro session\nMember events',1],['10-class pack','$170','','Use within 3 months\nShare with a friend']],
  baH:'Real results',baSub:'Twelve weeks of coaching.',pairs:['Maria, 12 weeks','Dev, 16 weeks'],
  layouts:{
   classes:{name:'Classes and memberships',desc:'Your classes, prices and coaches, with a free class offer.',style:'loud',home:['hero:marquee','services:cards','pricing','team','testimonials','faq','contact'],pages:[['Classes','calendar',['hero','services:cards','booking']],['Memberships','card',['hero','pricing','faq']],['Coaches','info',['hero','team','testimonials']]]},
   coach:{name:'Personal trainer',desc:'All about you, your results and your packages.',style:'tech',home:['hero:bento','about','pricing','beforeafter','testimonials','contact'],pages:[['Results','star',['hero','beforeafter','testimonials']],['Contact','phoneCall',['contact','faq']]]}}},
 professional:{short:'Professional services',icon:'briefcase',sample:'Brooks Tax & Advisory',styles:['classic','magazine','luxe'],cta:'Book a free consultation',cta2:'How we help',
  team:[['Dana Brooks, CPA','Founder','20 years helping families and small businesses.'],['Raj Mehta, EA','Tax advisor','IRS-enrolled agent and audit specialist.'],['Lena Ortiz','Client services','Your first call and friendly follow-up.']],
  plansH:'Simple pricing',plansSub:'Know the cost before we start.',planBtn:'Get started',plans:[['Individual','$250','','Federal and state return\nE-file included'],['Small business','$750','','Business return\nQuarterly check-ins\nYear-round questions',1],['Bookkeeping','$300','/mo','Monthly reconciliations\nReports you can read']],
  layouts:{
   trust:{name:'Trusted advisor',desc:'What you do, who you are and an easy way to book a call.',style:'classic',home:['hero:split','services:grid','about','team','testimonials','faq','contact'],pages:[['Services','briefcase',['hero','services','pricing','faq']],['About','info',['hero','about','team']],['Contact','phoneCall',['contact','map']]]},
   expert:{name:'Expert profile',desc:'Editorial headline and your story first, then services and reviews.',style:'magazine',home:['hero:poster','about','services:cards','testimonials:spotlight','cta','contact'],pages:[['Services','briefcase',['hero','services','faq']],['Contact','phoneCall',['contact']]]}}},
 retail:{short:'Shop or boutique',icon:'store',sample:'Paper Moon Goods',styles:['playful','magazine','portfolio'],cta:'Shop now',cta2:'Visit the shop',
  pfH:'New arrivals',pfSub:'Fresh on the shelves this week.',pf:{'New arrivals':['Stoneware mugs','Linen throw','Hand-poured candle'],Home:['Woven basket','Brass lamp'],Gifts:['Gift box','Local honey set']},
  layouts:{
   shop:{name:'Shop online',desc:'Products first, then your story, photos and a feed.',style:'playful',home:['hero:bubble','shop','about','gallery','social:feed','map'],pages:[['Shop','bag',['hero','shop']],['Visit','pin',['map','contact']]]},
   boutique:{name:'Visit the boutique',desc:'An editorial lookbook and directions to your door.',style:'magazine',home:['hero:poster','portfolio:filter','about','social:feed','map','contact'],pages:[['Lookbook','image',['hero','portfolio:masonry']],['Visit','pin',['map','contact']]]}}},
 pet:{short:'Pet care',icon:'paw',sample:'Happy Tails Grooming',theme:'candy',styles:['playful','classic','retro'],cta:'Book a groom',cta2:'See services',
  team:[['Becca Hall','Lead groomer','Certified groomer and doodle whisperer.'],['Omar Diaz','Daycare lead','Runs playgroups and keeps everyone happy.']],
  plansH:'Packages',plansSub:'Prices depend on size and coat.',planBtn:'Book this',plans:[['Bath & tidy','$45','','Bath and blow dry\nNails and ears'],['Full groom','$75','','Everything in Bath & tidy\nHaircut and styling\nBandana or bow',1],['Puppy package','$120','','Three gentle intro visits\nFor pups under 6 months']],
  layouts:{
   groom:{name:'Book a groom',desc:'Services, prices and happy pet photos with a booking button.',style:'playful',home:['hero:bubble','services:cards','pricing','gallery','testimonials','faq','contact'],pages:[['Services','paw',['hero','services','pricing','faq']],['Gallery','image',['hero','gallery']],['Contact','phoneCall',['contact','map']]]},
   care:{name:'Boarding and daycare',desc:'Your team, your space and how a stay works.',style:'classic',home:['hero:split','services:grid','about','team','testimonials','map'],pages:[['Services','paw',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]}}},
 health:{short:'Health & wellness',icon:'heartPulse',sample:'Clearview Family Dental',theme:'clinic',styles:['classic','luxe','tech'],cta:'Request an appointment',cta2:'Our services',
  team:[['Dr. Maya Chen','Lead dentist','Gentle care for nervous patients, 15 years in practice.'],['Erin Walsh, RDH','Hygienist','Makes cleanings quick and comfortable.'],['Marcus Reed','Patient coordinator','Checks your insurance and finds you a time.']],
  plansH:'No insurance? No problem.',plansSub:'Our in-house plans cover the basics for one yearly price.',planBtn:'Join the plan',plans:[['Single visit','$95','','Exam and x-rays\nPersonal care plan'],['Wellness plan','$29','/mo','Two cleanings a year\nExams and x-rays\n15% off treatment',1],['Family plan','$79','/mo','Covers up to four people\nEverything in Wellness']],
  layouts:{
   practice:{name:'Book a visit',desc:'Services, your team and new patient answers, with a clear call button.',style:'classic',home:['hero:split','services:grid','team','testimonials','faq','map','contact'],pages:[['Services','heartPulse',['hero','services','pricing']],['Our team','info',['hero','team','about']],['New patients','help',['hero','faq','contact']]]},
   calm:{name:'Calm and personal',desc:'An airy, reassuring page for spas, therapy and wellness.',style:'luxe',home:['hero:arch','about','services:menu','pricing','testimonials','contact'],pages:[['Services','heartPulse',['hero','services:menu','faq']],['Contact','phoneCall',['contact','map']]]}}},
 realestate:{short:'Real estate',icon:'house',sample:'Grant Realty Group',theme:'estate',styles:['luxe','classic','magazine'],cta:'Get my home value',cta2:'See listings',
  team:[['Taylor Grant','Broker & owner','Top 1% in {city}, 18 years selling homes.'],['Chris Nolan','Buyer’s agent','First-time buyer specialist.']],
  listH:'Featured listings',listSub:'Call or text to schedule a showing.',listings:[['14 Maple Ct','$549,000','3 bd · 2 ba · 1,850 sq ft','sale'],['88 Orchard Ln','$725,000','4 bd · 3 ba · 2,600 sq ft','new'],['220 Harbor St #4','$2,400/mo','2 bd · 1 ba · 980 sq ft','rent'],['5 Birch Rd','$410,000','3 bd · 1.5 ba · 1,400 sq ft','pending']],
  ctaSec:{heading:'Thinking of selling?',sub:'Get a free, no-pressure home value report within one day.',button:'Get my home value'},
  layouts:{
   listings:{name:'Featured listings',desc:'Homes up front, then your story and an easy contact form.',style:'luxe',home:['hero:overlay','listings','about','testimonials','cta','contact'],pages:[['Listings','house',['hero','listings:rows']],['Buyers','pin',['hero','services','faq']],['Sellers','card',['hero','services:cards','cta','contact']],['About','info',['hero','about','team']]]},
   local:{name:'Local expert',desc:'Lead with you and your neighborhood know-how.',style:'classic',home:['hero:split','about','services:cards','listings','testimonials','faq','contact'],pages:[['Listings','house',['hero','listings']],['Contact','phoneCall',['contact']]]}}},
 events:{short:'Weddings & events',icon:'flower',sample:'Peony & Pearl Events',theme:'bloom',styles:['luxe','portfolio','magazine'],cta:'Check our availability',cta2:'See real weddings',
  contactH:'Tell us about your celebration',contactSub:'Share your date, guest count and venue and we will be in touch within a day.',contactBtn:'Send inquiry',
  pfH:'Real celebrations',pfSub:'Pick an album to see more.',pf:{Weddings:['Garden ceremony','Barn reception','City hall elopement'],Showers:['Tea party shower','Backyard baby shower'],Corporate:['Holiday party','Product launch']},
  plansH:'Packages',plansSub:'Every package includes a planning portal and vendor list.',planBtn:'Ask about this',plans:[['Day-of coordination','$1,200','','Final month planning\n10 hours on the day\nVendor wrangling'],['Partial planning','$3,500','','Six months of planning\nDesign board\nDay-of team of two',1],['Full planning','From $6,500','','Venue search to send-off\nBudget and guest tools\nUnlimited meetings']],
  layouts:{
   portfolio:{name:'Real weddings',desc:'Album covers for each kind of event, packages and an inquiry form.',style:'luxe',home:['hero:arch','portfolio:albums','about','pricing','testimonials','faq','contact'],pages:[['Gallery','image',['hero','portfolio:masonry']],['Packages','card',['hero','pricing','faq']],['Contact','phoneCall',['contact']]]},
   venue:{name:'Venue tour',desc:'A big photo, a rotating tour of the space and how to visit.',style:'portfolio',home:['hero:overlay','slideshow:full','about','pricing','map','contact'],pages:[['Gallery','image',['hero','portfolio:filter']],['Contact','phoneCall',['contact','map']]]}}},
 auto:{short:'Auto repair',icon:'car',sample:'Northside Auto Care',theme:'motor',styles:['classic','loud','tech'],cta:'Call for a quote',cta2:'Our services',
  baH:'Before and after',baSub:'Drag the line to compare.',pairs:['Interior detail','Paint correction','Headlight restore'],
  plansH:'Detailing packages',plansSub:'Cars, trucks and SUVs. Oversize vehicles add $20.',planBtn:'Book this',plans:[['Express','$49','','Hand wash\nWheels and tires\nInterior vacuum'],['Full detail','$199','','Deep interior clean\nClay bar and wax\nOdor treatment',1],['Ceramic','From $899','','Paint correction\n5-year ceramic coating']],
  layouts:{
   shop:{name:'Book a repair',desc:'Services, trust and directions with a big call button.',style:'classic',home:['hero:split','services:grid','about','testimonials','map','contact'],pages:[['Services','wrench',['hero','services','faq']],['Reviews','star',['hero','testimonials']],['Visit','pin',['map','contact']]]},
   detail:{name:'Detailing packages',desc:'Bold before and after with packages and prices.',style:'loud',home:['hero:marquee','beforeafter','pricing','gallery','testimonials','contact'],pages:[['Packages','card',['hero','pricing','faq']],['Contact','phoneCall',['contact','map']]]}}},
 landscape:{short:'Landscaping',icon:'leaf',sample:'Greenline Landscaping',theme:'garden',styles:['classic','portfolio','loud'],cta:'Get a free estimate',cta2:'See our projects',
  baH:'Before and after',baSub:'Drag the line to see the change.',pairs:['Backyard patio','Front lawn renovation','Garden beds'],
  pfH:'Projects',pfSub:'Sorted by the kind of work.',pf:{Lawns:['Spring renovation','Weekly mowing route'],Patios:['Paver patio with fire pit','Flagstone walkway'],Planting:['Pollinator garden','Front bed refresh']},
  plansH:'Seasonal plans',plansSub:'Set it and forget it.',planBtn:'Start my plan',plans:[['Mowing','$45','/visit','Mow, edge and blow\nWeekly or every two weeks'],['Full season','$189','/mo','Mowing\nFertilizer and weed control\nSpring and fall cleanup',1],['Cleanup','From $299','','Leaves, beds and trimming\nOne-time visit']],
  layouts:{
   quote:{name:'Free estimate',desc:'Services, before and after, and an estimate form.',style:'classic',home:['hero:split','services:cards','beforeafter','testimonials','faq','contact'],pages:[['Services','leaf',['hero','services','pricing']],['Our work','image',['hero','portfolio:filter']],['Contact','phoneCall',['contact','map']]]},
   plans:{name:'Seasonal plans',desc:'Photo-led page with plans customers can sign up for.',style:'portfolio',home:['hero:overlay','pricing','portfolio:filter','about','contact'],pages:[['Projects','image',['hero','beforeafter','portfolio:masonry']],['Contact','phoneCall',['contact']]]}}},
 lessons:{short:'Lessons & tutoring',icon:'book',sample:'Bright Minds Learning',theme:'chalk',styles:['playful','classic','retro'],cta:'Book a free lesson',cta2:'See programs',
  team:[['Priya Shah','Director','Former teacher with 15 years in the classroom.'],['Ben Carter','Math & science tutor','Makes fractions make sense.'],['Ana Silva','Music teacher','Piano, guitar and voice for every age.']],
  plansH:'Tuition',plansSub:'Sibling discounts available.',planBtn:'Enroll',plans:[['Single lesson','$45','','One-on-one, 45 minutes\nNo commitment'],['Monthly','$160','/mo','Four weekly lessons\nProgress report each month',1],['Summer camp','$299','/week','Monday to Friday, 9 to 3\nSnacks included']],
  layouts:{
   enroll:{name:'Enroll now',desc:'Programs, tuition and teachers, with a free first lesson.',style:'playful',home:['hero:bubble','services:cards','pricing','team','testimonials','faq','contact'],pages:[['Programs','book',['hero','services','pricing']],['Teachers','info',['hero','team','testimonials']],['Contact','phoneCall',['contact','map','faq']]]},
   tutor:{name:'Private tutor',desc:'A personal page about you, your approach and your rates.',style:'classic',home:['hero:split','about','services:grid','pricing','testimonials','contact'],pages:[['Contact','phoneCall',['contact','faq']]]}}},
 other:{short:'Something else',icon:'dots',sample:'',styles:['classic','magazine','playful'],
  layouts:{
   simple:{name:'Simple and clear',desc:'Who you are, what you offer and how to reach you.',style:'classic',home:['hero','about','services','testimonials','faq','contact'],pages:[['Services','grid4',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]},
   visual:{name:'Photo forward',desc:'A big photo and gallery for businesses that are best seen.',style:'portfolio',home:['hero:overlay','gallery','about','services','contact'],pages:[['Gallery','image',['hero','portfolio:filter']],['Contact','phoneCall',['contact']]]}}}
};

/* ---------- more popular layouts: each pairs a style with its own color theme ---------- */
Object.assign(THEMES,{
 ink:{name:'Ink',colors:{p:'#E8E4DC',a:'#D4AF37',bg:'#0E0E10',sf:'#1A1A1E',tx:'#E8E4DC'},font:'syne',radius:2,btn:'square'},
 espresso:{name:'Espresso',colors:{p:'#5B3A29',a:'#D9A066',bg:'#FAF6F0',sf:'#EFE4D6',tx:'#2E1F17'},font:'fraunces',radius:10,btn:'rounded'},
 sage:{name:'Sage',colors:{p:'#5F7A61',a:'#C9A37A',bg:'#FAFAF6',sf:'#EBF0E8',tx:'#2C3A2D'},font:'cormorant',radius:18,btn:'pill'},
 citrus:{name:'Citrus',colors:{p:'#D9480F',a:'#2B8A3E',bg:'#FFFCF5',sf:'#FFF0D6',tx:'#2D1E0F'},font:'fredoka',radius:20,btn:'pill'},
 ocean:{name:'Ocean',colors:{p:'#0B6E99',a:'#2EC4B6',bg:'#FFFFFF',sf:'#EAF5FA',tx:'#0E2A3A'},font:'sora',radius:16,btn:'pill'},
 slate:{name:'Slate',colors:{p:'#93C5FD',a:'#F59E0B',bg:'#111827',sf:'#1F2937',tx:'#E5E7EB'},font:'dmserif',radius:8,btn:'rounded'},
 forest:{name:'Forest',colors:{p:'#1B4332',a:'#D4A373',bg:'#FBFAF5',sf:'#E8EFE6',tx:'#1B2A22'},font:'bitter',radius:6,btn:'rounded'}
});
const MORE_LAYOUTS={
 photographer:{
  minimal:{name:'Clean and minimal',desc:'White space, a photo wall and a short contact form.',style:'classic',theme:'folio',home:['hero:centered','portfolio:masonry','about:right','pricing:list','contact:centered'],pages:[['Work','image',['hero','portfolio:filter']],['Contact','phoneCall',['contact','faq']]]},
  moody:{name:'Dark and moody',desc:'A dark gallery with a rotating slideshow and gold details.',style:'portfolio',theme:'ink',home:['hero:overlay','slideshow:full','portfolio:albums','testimonials:spotlight','contact'],pages:[['Galleries','image',['hero','portfolio:filter']],['Packages','card',['hero','pricing','faq']]]},
  bold:{name:'Bold and modern',desc:'Big type, a scrolling ticker and packages front and center.',style:'loud',theme:'studio',home:['hero:marquee','portfolio:filter','pricing:cards','testimonials:carousel','cta','contact'],pages:[['Work','image',['hero','portfolio:masonry']],['Contact','phoneCall',['contact']]]}},
 restaurant:{
  diner:{name:'Neighborhood diner',desc:'Retro signage, a chalkboard menu and reviews from regulars.',style:'retro',theme:'diner',home:['hero:badge','menu:board','testimonials:carousel','map:wide','social:icons'],pages:[['Menu','fork',['hero','menu:classic']],['Visit','pin',['map','contact']]]},
  brunch:{name:'Café and brunch',desc:'Bright and friendly with a photo menu and an Instagram feed.',style:'playful',theme:'citrus',home:['hero:bubble','menu:photos','gallery:mosaic','social:feed','map'],pages:[['Menu','fork',['hero','menu:tabs']],['Visit','pin',['map','faq','contact']]]},
  night:{name:'Bar and night spot',desc:'Dark glass tiles, menu tabs and table reservations.',style:'tech',theme:'neon',home:['hero:bento','menu:tabs','slideshow:full','booking','map:wide'],pages:[['Menu','fork',['hero','menu:classic']],['Events','calendar',['hero','gallery','cta','contact']]]},
  truck:{name:'Food truck',desc:'Loud and fun, with where to find you this week.',style:'loud',theme:'loud',home:['hero:marquee','menu:board','social:feed','map:wide','faq'],pages:[['Catering','calendar',['hero','services:cards','contact']]]}},
 bakery:{
  coffee:{name:'Coffee house',desc:'Editorial headline, menu tabs and a cozy photo grid.',style:'magazine',theme:'espresso',home:['hero:poster','menu:tabs','about:stacked','gallery','social:feed','map'],pages:[['Menu','cake',['hero','menu:classic']],['Visit','pin',['map','contact']]]},
  cakes:{name:'Custom cakes',desc:'Soft colors, a cake gallery and an order request form.',style:'luxe',theme:'blush',home:['hero:arch','gallery:grid','services:menu','testimonials:spotlight','contact:centered'],pages:[['Cakes','cake',['hero','gallery','services:menu']],['Order','calendar',['contact','faq']]]},
  market:{name:'Market stand',desc:'Simple and fresh, with this week’s menu and where to find you.',style:'classic',theme:'meadow',home:['hero:split','menu:classic','about:left','social:icons','map:side'],pages:[['Contact','phoneCall',['contact','faq']]]}},
 salon:{
  barber:{name:'Barbershop',desc:'Bold and sharp, with a price list, your barbers and booking.',style:'loud',theme:'studio',home:['hero:marquee','services:menu','team:grid','booking','map'],pages:[['Barbers','info',['hero','team','testimonials']],['Book','calendar',['booking','map']]]},
  spa:{name:'Day spa',desc:'Calm greens, treatments, memberships and online booking.',style:'luxe',theme:'sage',home:['hero:arch','services:menu','pricing:cards','slideshow:framed','testimonials:spotlight','booking'],pages:[['Treatments','heartPulse',['hero','services:menu','faq']],['Book','calendar',['booking','map']]]},
  nails:{name:'Nail and lash bar',desc:'Playful and colorful, with a lookbook and your feed.',style:'playful',theme:'candy',home:['hero:bubble','portfolio:filter','services:cards','pricing:list','social:feed','booking'],pages:[['Services','scissors',['hero','services:menu','pricing']],['Book','calendar',['booking','map']]]}},
 home:{
  urgent:{name:'Fast response',desc:'A call-now banner right under the headline, then services and reviews.',style:'classic',theme:'harbor',home:['hero:split','cta:band','services:grid','testimonials:carousel','map:wide','contact'],pages:[['Services','wrench',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]},
  family:{name:'Family owned',desc:'Warm and local, leading with your story and the people behind it.',style:'classic',theme:'workshop',home:['hero:split','about:right','services:cards','testimonials:spotlight','faq:two','contact'],pages:[['Our work','image',['hero','beforeafter','gallery']],['Contact','phoneCall',['contact','map']]]},
  remodel:{name:'Premium remodels',desc:'Elegant before and after photos for high-end projects.',style:'luxe',theme:'estate',home:['hero:arch','beforeafter:side','gallery:mosaic','about','testimonials:spotlight','contact:centered'],pages:[['Projects','image',['hero','beforeafter','gallery']],['Contact','phoneCall',['contact']]]},
  clean:{name:'Cleaning service',desc:'Fresh and friendly with services, answers and a quick quote.',style:'playful',theme:'ocean',home:['hero:bubble','services:cards','testimonials:carousel','faq','contact'],pages:[['Services','wrench',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]}},
 fitness:{
  yoga:{name:'Yoga studio',desc:'Quiet and calm, with a class schedule and your teachers.',style:'luxe',theme:'sage',home:['hero:arch','services:menu','booking','team:round','pricing:list','testimonials'],pages:[['Schedule','calendar',['hero','booking']],['Pricing','card',['hero','pricing','faq']]]},
  intense:{name:'Dark and intense',desc:'Glowing tiles, results and memberships for serious training.',style:'tech',theme:'neon',home:['hero:bento','pricing:cards','beforeafter','team','contact'],pages:[['Results','star',['hero','beforeafter','testimonials']],['Coaches','info',['hero','team']]]},
  boutique:{name:'Boutique classes',desc:'Bright and upbeat with a rotating class strip and your feed.',style:'playful',theme:'citrus',home:['hero:bubble','slideshow:split','services:cards','pricing','social:feed'],pages:[['Classes','calendar',['hero','services:cards','booking']],['Contact','phoneCall',['contact','faq']]]}},
 professional:{
  modern:{name:'Modern firm',desc:'Dark, confident tiles with services and clear pricing.',style:'tech',theme:'slate',home:['hero:bento','services:cards','pricing:cards','testimonials','contact'],pages:[['Services','briefcase',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]},
  law:{name:'Law office',desc:'Classic and formal, with practice areas and your attorneys.',style:'luxe',theme:'estate',home:['hero:arch','services:menu','team:round','faq:two','contact:centered'],pages:[['Practice areas','briefcase',['hero','services','faq']],['Attorneys','info',['hero','team','about']]]},
  onepage:{name:'One-page consultant',desc:'Everything on one page: who you are, what you do, and a call button.',style:'classic',theme:'ocean',home:['hero:centered','about:left','services:grid','cta:band','contact:split'],pages:[]}},
 retail:{
  showcase:{name:'Product showcase',desc:'Full-bleed photos, your store and a photo wall.',style:'portfolio',theme:'folio',home:['hero:overlay','shop','portfolio:masonry','social:feed'],pages:[['Shop','bag',['hero','shop']],['Visit','pin',['map','contact']]]},
  vintage:{name:'Vintage shop',desc:'Retro badge, collections and how to find you.',style:'retro',theme:'diner',home:['hero:badge','portfolio:filter','about','map','social:icons'],pages:[['Shop','bag',['hero','shop']],['Visit','pin',['map','contact']]]},
  gift:{name:'Gift shop',desc:'Soft and pretty, with gifts, photos and reviews.',style:'luxe',theme:'blush',home:['hero:arch','shop','gallery','testimonials','map'],pages:[['Shop','bag',['hero','shop']],['Contact','phoneCall',['contact','faq']]]}},
 pet:{
  mobile:{name:'Mobile groomer',desc:'Big and bright with packages and the areas you cover.',style:'loud',theme:'citrus',home:['hero:marquee','services:cards','pricing:cards','map:wide','contact'],pages:[['Packages','card',['hero','pricing','faq']]]},
  trainer:{name:'Dog trainer',desc:'Your approach, training plans and booking a first session.',style:'classic',theme:'meadow',home:['hero:split','about','services:grid','pricing:list','testimonials:spotlight','booking'],pages:[['Training','paw',['hero','services','pricing','faq']],['Contact','phoneCall',['contact','map']]]},
  boutique:{name:'Pet boutique',desc:'Editorial headline, treats and toys for sale, and your feed.',style:'magazine',theme:'paper',home:['hero:poster','shop','gallery','social:feed'],pages:[['Shop','bag',['hero','shop']],['Visit','pin',['map','contact']]]}},
 health:{
  clinic:{name:'Modern clinic',desc:'Friendly and clear, with services, booking and your team.',style:'playful',theme:'ocean',home:['hero:bubble','services:cards','booking','team:round','faq'],pages:[['Services','heartPulse',['hero','services','pricing']],['Book','calendar',['booking','map']]]},
  therapy:{name:'Counseling practice',desc:'A gentle, story-first page with your approach and answers.',style:'magazine',theme:'sage',home:['hero:poster','about:stacked','services:menu','faq:two','contact'],pages:[['Approach','info',['hero','about','team']],['Contact','phoneCall',['contact','faq']]]},
  medspa:{name:'Med spa',desc:'Soft and polished, with treatments, plans and a photo gallery.',style:'luxe',theme:'blush',home:['hero:arch','services:menu','pricing:cards','gallery','testimonials:spotlight','booking'],pages:[['Treatments','heartPulse',['hero','services:menu','faq']],['Book','calendar',['booking','map']]]}},
 realestate:{
  luxury:{name:'Luxury homes',desc:'Dark and dramatic, with homes in rows and a slideshow tour.',style:'portfolio',theme:'ink',home:['hero:overlay','listings:rows','slideshow:full','about','contact'],pages:[['Listings','house',['hero','listings']],['About','info',['hero','about','team']]]},
  rentals:{name:'Property management',desc:'Services for owners, available rentals and tenant answers.',style:'classic',theme:'harbor',home:['hero:split','services:grid','listings:cards','faq:two','contact'],pages:[['Rentals','house',['hero','listings:rows']],['Owners','card',['hero','services:cards','cta','contact']]]},
  team:{name:'Team brokerage',desc:'Editorial headline, your agents and featured homes.',style:'magazine',theme:'paper',home:['hero:poster','team:grid','listings','testimonials:spotlight','cta','contact'],pages:[['Agents','info',['hero','team','testimonials']],['Listings','house',['hero','listings:rows']]]}},
 events:{
  party:{name:'Party rentals',desc:'Colorful and fun, with what you rent, photos and prices.',style:'playful',theme:'candy',home:['hero:bubble','services:cards','gallery:mosaic','pricing:list','faq','contact'],pages:[['Rentals','card',['hero','services','pricing']],['Contact','phoneCall',['contact','map']]]},
  planner:{name:'Modern planner',desc:'Editorial headline, collections and your story.',style:'magazine',theme:'paper',home:['hero:poster','portfolio:filter','about:stacked','testimonials:spotlight','contact'],pages:[['Gallery','image',['hero','portfolio:albums']],['Packages','card',['hero','pricing','faq']]]},
  dj:{name:'DJ and entertainment',desc:'Dark glowing tiles, a slideshow and packages to book.',style:'tech',theme:'neon',home:['hero:bento','slideshow:full','pricing:cards','testimonials:carousel','booking'],pages:[['Packages','card',['hero','pricing','faq']],['Contact','phoneCall',['contact']]]}},
 auto:{
  quick:{name:'Quick service',desc:'Tires, oil and brakes with a call-now banner and directions.',style:'classic',theme:'trades',home:['hero:split','cta:band','services:cards','map:wide','testimonials'],pages:[['Services','wrench',['hero','services','faq']],['Visit','pin',['map','contact']]]},
  custom:{name:'Custom shop',desc:'Dark glass tiles to show off builds and before and afters.',style:'tech',theme:'neon',home:['hero:bento','gallery:mosaic','beforeafter','services:grid','contact'],pages:[['Builds','image',['hero','gallery','beforeafter']],['Contact','phoneCall',['contact','map']]]},
  mobile:{name:'Mobile detailing',desc:'Clean and friendly, with packages and we-come-to-you answers.',style:'playful',theme:'ocean',home:['hero:bubble','pricing:cards','beforeafter:slider','faq','contact'],pages:[['Packages','card',['hero','pricing','faq']]]}},
 landscape:{
  lawn:{name:'Lawn care',desc:'Friendly and bright, with seasonal plans up top.',style:'playful',theme:'meadow',home:['hero:bubble','pricing:cards','services:cards','testimonials:carousel','contact'],pages:[['Services','leaf',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]},
  hardscape:{name:'Design and hardscape',desc:'Editorial headline, project albums and side-by-side results.',style:'magazine',theme:'workshop',home:['hero:poster','portfolio:albums','beforeafter:side','about','contact'],pages:[['Projects','image',['hero','portfolio:filter']],['Contact','phoneCall',['contact']]]},
  tree:{name:'Tree service',desc:'Deep greens, a big photo and a call-now banner.',style:'classic',theme:'forest',home:['hero:overlay','services:grid','cta:band','beforeafter','contact'],pages:[['Services','leaf',['hero','services','faq']],['Contact','phoneCall',['contact','map']]]}},
 lessons:{
  music:{name:'Music school',desc:'Editorial headline, lessons, teachers and booking.',style:'magazine',theme:'paper',home:['hero:poster','services:cards','team:round','pricing:list','booking'],pages:[['Teachers','info',['hero','team','testimonials']],['Contact','phoneCall',['contact','faq']]]},
  camp:{name:'Kids camps',desc:'Bright and playful, with camp weeks, photos and answers for parents.',style:'playful',theme:'citrus',home:['hero:bubble','pricing:cards','gallery:mosaic','faq:two','contact'],pages:[['Camps','calendar',['hero','services','pricing']],['Contact','phoneCall',['contact','map']]]},
  online:{name:'Online courses',desc:'Dark glass tiles, course list and pricing.',style:'tech',theme:'midnight',home:['hero:bento','services:grid','pricing:cards','testimonials:carousel','faq'],pages:[['Courses','book',['hero','services','pricing']]]}},
 other:{
  bold:{name:'Bold and modern',desc:'Big type, a scrolling ticker and a strong call to action.',style:'loud',theme:'studio',home:['hero:marquee','services:cards','testimonials:carousel','cta:band','contact'],pages:[['Contact','phoneCall',['contact','map']]]},
  elegant:{name:'Elegant and calm',desc:'Centered, airy and refined.',style:'luxe',theme:'luxe',home:['hero:arch','about','services:menu','testimonials:spotlight','contact:centered'],pages:[['Services','grid4',['hero','services','faq']]]},
  dark:{name:'Dark and sleek',desc:'Glowing glass tiles made for dark mode.',style:'tech',theme:'midnight',home:['hero:bento','services:cards','gallery','faq:two','contact'],pages:[['Contact','phoneCall',['contact','map']]]},
  retro:{name:'Retro and fun',desc:'Diner signage, an emblem badge and checkered trim.',style:'retro',theme:'diner',home:['hero:badge','about','services:menu','testimonials','map'],pages:[['Contact','phoneCall',['contact','faq']]]}}
};
Object.entries(MORE_LAYOUTS).forEach(([k,ls])=>{if(KITS[k])Object.assign(KITS[k].layouts,ls)});

/* ---------- industry sections: menu, portfolio, team, packages, before and after, listings ---------- */
Object.assign(P,{
 cake:'<path d="M4 21h16M5 21v-8h14v8M5 16.5c2.3 1.2 4.7 1.2 7 0s4.7-1.2 7 0M12 13V9.5M12 7c-.9-.8-.9-2 0-3.2.9 1.2.9 2.4 0 3.2z"/>',
 fork:'<path d="M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 3c-2 2-3 5-3 8h3v10"/>',
 scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
 wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
 dumbbell:'<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
 briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
 store:'<path d="M4 9l1.5-5h13L20 9M4 9h16v1.5a3 3 0 0 1-5.3 1.9 3 3 0 0 1-5.4 0A3 3 0 0 1 4 10.5zM5 13v8h14v-8M10 21v-5h4v5"/>',
 paw:'<path d="M12 13c-3 0-5.5 3-5.5 5a2 2 0 0 0 2 2c1.2 0 2.2-.8 3.5-.8s2.3.8 3.5.8a2 2 0 0 0 2-2c0-2-2.5-5-5.5-5zM4 10a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0M8 6a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0M13 6a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0M17 10a1.5 2 0 1 0 3 0a1.5 2 0 1 0-3 0"/>',
 heartPulse:'<path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 5.4 8.8 11 8.8 11s8.8-5.6 8.8-11z"/><path d="M3.5 12h4l2-3 3 6 2-3h5.5"/>',
 house:'<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6"/>',
 flower:'<path d="M12 21v-9M8 4l2 3 2-3 2 3 2-3v4a4 4 0 0 1-8 0zM12 18c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.5 4.5 3.5zm0 0c2.5 0 4-1.5 4.5-3.5-2.5 0-4 1.5-4.5 3.5z"/>',
 car:'<path d="M5 16v-4l2-5h10l2 5v4M3 16h18v3h-3v-1.5H6V19H3zM5 12h14"/><circle cx="7.5" cy="14" r=".6"/><circle cx="16.5" cy="14" r=".6"/>',
 leaf:'<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l8-8"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7"/>',
 dots:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
 upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
 cover:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'
});
(()=>{const add={
 menu:{name:'Food menu',desc:'Dishes and drinks by category, with prices',variants:{classic:'Classic',tabs:'Category tabs',board:'Chalkboard',photos:'With photos'}},
 portfolio:{name:'Portfolio',desc:'Photo collections visitors can filter',variants:{filter:'Filter by collection',albums:'Album covers',masonry:'Photo wall'}},
 pricing:{name:'Packages',desc:'Packages or plans side by side',variants:{cards:'Cards',list:'Simple list'}},
 team:{name:'Team',desc:'The people behind the business',variants:{grid:'Grid',round:'Round photos'}},
 beforeafter:{name:'Before & after',desc:'Drag to compare photos of your work',variants:{slider:'Slider',side:'Side by side'}},
 listings:{name:'Listings',desc:'Homes, rentals or vehicles with details',variants:{cards:'Cards',rows:'Rows'}}};
 const order=['hero','slideshow','about','services','menu','portfolio','pricing','team','testimonials','gallery','beforeafter','listings','faq','cta','social','map','contact','booking','shop'];
 const all={...CATALOG,...add};Object.keys(CATALOG).forEach(k=>delete CATALOG[k]);order.concat(Object.keys(all)).forEach(k=>{if(!CATALOG[k]&&all[k])CATALOG[k]=all[k]})})();
Object.assign(TH,{
 menu:'<rect x="5" y="4" width="34" height="24" rx="2" opacity=".2"/><rect x="9" y="8" width="10" height="2.5" rx="1"/><rect x="9" y="14" width="14" height="2" rx="1" opacity=".55"/><rect x="31" y="14" width="4" height="2" rx="1"/><rect x="9" y="19" width="12" height="2" rx="1" opacity=".55"/><rect x="31" y="19" width="4" height="2" rx="1"/><rect x="9" y="24" width="15" height="2" rx="1" opacity=".55"/>',
 portfolio:'<rect x="3" y="3" width="9" height="4" rx="2"/><rect x="14" y="3" width="9" height="4" rx="2" opacity=".4"/><rect x="3" y="10" width="12" height="18" rx="1.5" opacity=".35"/><rect x="17" y="10" width="11" height="8" rx="1.5" opacity=".35"/><rect x="30" y="10" width="11" height="18" rx="1.5" opacity=".35"/><rect x="17" y="20" width="11" height="8" rx="1.5" opacity=".35"/>',
 pricing:'<rect x="3" y="7" width="11" height="19" rx="2" opacity=".3"/><rect x="16.5" y="4" width="11" height="24" rx="2"/><rect x="30" y="7" width="11" height="19" rx="2" opacity=".3"/>',
 team:'<circle cx="9" cy="12" r="4.5" opacity=".4"/><circle cx="22" cy="12" r="4.5" opacity=".4"/><circle cx="35" cy="12" r="4.5" opacity=".4"/><rect x="4" y="20" width="10" height="2" rx="1"/><rect x="17" y="20" width="10" height="2" rx="1"/><rect x="30" y="20" width="10" height="2" rx="1"/>',
 beforeafter:'<rect x="3" y="4" width="38" height="24" rx="2" opacity=".2"/><rect x="22" y="4" width="19" height="24" rx="2" opacity=".35"/><rect x="21" y="2" width="2" height="28" rx="1"/><circle cx="22" cy="16" r="3.5"/>',
 listings:'<rect x="3" y="4" width="17" height="12" rx="1.5" opacity=".35"/><rect x="3" y="18" width="12" height="2.5" rx="1"/><rect x="3" y="23" width="9" height="2" rx="1" opacity=".5"/><rect x="24" y="4" width="17" height="12" rx="1.5" opacity=".35"/><rect x="24" y="18" width="12" height="2.5" rx="1"/><rect x="24" y="23" width="9" height="2" rx="1" opacity=".5"/>'
});
Object.assign(DEFAULTS,{
 menu:{heading:'Our menu',intro:'Made to order. Ask about today’s specials.',note:'V vegetarian · GF gluten-free',items:[{cat:'Starters',name:'House salad',desc:'Greens, herbs and vinaigrette.',price:'$9',tags:'V, GF',image:null},{cat:'Mains',name:'Chef’s special',desc:'Ask your server.',price:'$22',tags:'',image:null},{cat:'Desserts',name:'Seasonal pie',desc:'With whipped cream.',price:'$8',tags:'V',image:null}]},
 portfolio:{heading:'Our work',sub:'Pick a collection to see more.',cats:['Featured','Recent'],photos:[{image:null,cat:'Featured',caption:''},{image:null,cat:'Featured',caption:''},{image:null,cat:'Featured',caption:''},{image:null,cat:'Recent',caption:''},{image:null,cat:'Recent',caption:''},{image:null,cat:'Recent',caption:''}]},
 pricing:{heading:'Packages',sub:'Pick the one that fits. We can always adjust.',button:'Choose this',plans:[{name:'Basic',price:'$99',per:'',features:'The essentials\nEmail support',featured:'no'},{name:'Standard',price:'$199',per:'',features:'Everything in Basic\nPriority scheduling\nFollow-up visit',featured:'yes'},{name:'Premium',price:'$349',per:'',features:'Everything in Standard\nDedicated contact\nSatisfaction guarantee',featured:'no'}]},
 team:{heading:'Meet the team',sub:'Friendly faces who will take care of you.',members:[{image:null,name:'Alex Rivera',role:'Owner',bio:'Started the business in 2012.'},{image:null,name:'Jamie Chen',role:'Manager',bio:'Keeps everything running smoothly.'},{image:null,name:'Sam Okafor',role:'Specialist',bio:'Ten years of experience.'}]},
 beforeafter:{heading:'Before and after',sub:'Drag the line to compare.',pairs:[{before:null,after:null,caption:'Recent project'},{before:null,after:null,caption:'Another favorite'}]},
 listings:{heading:'Featured listings',sub:'Call or text to schedule a showing.',items:[{image:null,title:'14 Maple Ct',price:'$549,000',details:'3 bd · 2 ba · 1,850 sq ft',status:'sale'},{image:null,title:'88 Orchard Ln',price:'$725,000',details:'4 bd · 3 ba · 2,600 sq ft',status:'new'},{image:null,title:'220 Harbor St #4',price:'$2,400/mo',details:'2 bd · 1 ba · 980 sq ft',status:'rent'}]}
});
const LIST_ST={sale:'For sale',new:'Just listed',pending:'Pending',sold:'Sold',rent:'For rent'};
Object.assign(FIELDS,{
 menu:[['heading','Heading','text'],['intro','Intro','textarea'],['note','Small print','text'],['items','Dishes','list',[['cat','Category','text'],['name','Name','text'],['desc','Description','text'],['price','Price','text'],['tags','Labels (V, GF, Spicy)','text'],['image','Photo','image']]]],
 portfolio:[['heading','Heading','text'],['sub','Supporting text','text'],['photos','Photos','portfolio']],
 pricing:[['heading','Heading','text'],['sub','Supporting text','text'],['plans','Packages','list',[['name','Name','text'],['price','Price','text'],['per','Per (like /mo)','text'],['features','What’s included (one per line)','textarea'],['featured','Highlight','select',{no:'No',yes:'Yes, most popular'}]]]],
 team:[['heading','Heading','text'],['sub','Supporting text','text'],['members','People','list',[['image','Photo','image'],['name','Name','text'],['role','Role','text'],['bio','Short bio','textarea']]]],
 beforeafter:[['heading','Heading','text'],['sub','Supporting text','text'],['pairs','Comparisons','list',[['before','Before photo','image'],['after','After photo','image'],['caption','Caption','text']]]],
 listings:[['heading','Heading','text'],['sub','Supporting text','text'],['items','Listings','list',[['image','Photo','image'],['title','Address or name','text'],['price','Price','text'],['details','Details','text'],['status','Status','select',LIST_ST]]]]
});
Object.assign(LIST_BLANK,{members:{image:null,name:'New person',role:'Role',bio:''},pairs:{before:null,after:null,caption:'New comparison'},plans:{name:'New package',price:'$0',per:'',features:'What’s included',featured:'no'}});
Object.assign(ITEM_BLANK,{menu:{cat:'',name:'New dish',desc:'',price:'$0',tags:'',image:null},listings:{image:null,title:'New listing',price:'$0',details:'3 bd · 2 ba',status:'sale'}});

/* menu: items carry a category; categories show in the order they first appear */
const MTAB={};
function menuCats(d){const c=[];(d.items||[]).forEach(x=>{const k=x.cat||'Menu';if(!c.includes(k))c.push(k)});return c}
const tagsHtml=t=>String(t||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>`<i class="mn-tag">${esc(x)}</i>`).join('');
R.menu=s=>{const d=s.data,v=s.variant,cats=menuCats(d);const items=(d.items||[]).map((x,i)=>({...x,_i:i}));
 const head=`<div class="sec-head${v==='board'?' center':''}"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.intro?`<p${T(s,'intro')}>${esc(d.intro)}</p>`:''}</div>`;
 const row=x=>`<div class="mn-row"${MNI(s,x)}>${MNC(s,x)}<div class="mn-l"><h3><span${T(s,`items.${x._i}.name`)}>${esc(x.name)}</span>${tagsHtml(x.tags)}</h3>${x.desc||EDIT?`<p${T(s,`items.${x._i}.desc`)}>${esc(x.desc)}</p>`:''}</div><span class="dots"></span><b${T(s,`items.${x._i}.price`)}>${esc(x.price)}</b></div>`;
 const addB=c=>EDIT?`<button type="button" class="mn-add" data-mnadd="${s.id}|${esc(c)}">+ Add a dish</button>`:'';
 const catH=c=>`<h4 class="mn-cat"${EDIT?` contenteditable="${CE}" spellcheck="false" data-mncat="${s.id}|${esc(c)}"`:''}>${esc(c)}</h4>`;
 const group=c=>`<div class="mn-grp"${EDIT?` data-mngrp="${s.id}|${esc(c)}"`:''}>${catH(c)}${items.filter(x=>(x.cat||'Menu')===c).map(row).join('')}${addB(c)}</div>`;
 const note=d.note||EDIT?`<p class="mn-note"${T(s,'note')}>${esc(d.note)}</p>`:'';
 const addCat=EDIT?`<button type="button" class="mn-add mn-addcat" data-mnaddcat="${s.id}">+ Add a category</button>`:'';
 if(v==='tabs'){const cur=cats.includes(MTAB[s.id])?MTAB[s.id]:cats[0];
  return `<section class="mn-sec mn-tabs"><div class="wrap">${head}<div class="mn-chips" role="tablist">${cats.map(c=>`<button type="button" role="tab" aria-selected="${c===cur}" class="${c===cur?'on':''}" data-mntab="${s.id}|${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="mn-one">${cur?group(cur):''}</div>${addCat}${note}</div></section>`}
 if(v==='photos')return `<section class="mn-sec mn-photos"><div class="wrap">${head}${cats.map(c=>`<div class="mn-grp"${EDIT?` data-mngrp="${s.id}|${esc(c)}"`:''}>${catH(c)}<div class="mn-cards">${items.filter(x=>(x.cat||'Menu')===c).map(x=>`<div class="prod mn-card"${MNI(s,x)}>${MNC(s,x)}${pic(x.image,IP(s,`items.${x._i}.image`),60+x._i*40,'Dish photo')}<div class="prod-row"><h3${T(s,`items.${x._i}.name`)}>${esc(x.name)}</h3><b${T(s,`items.${x._i}.price`)}>${esc(x.price)}</b></div>${x.desc||EDIT?`<p class="muted"${T(s,`items.${x._i}.desc`)}>${esc(x.desc)}</p>`:''}${x.tags?`<span>${tagsHtml(x.tags)}</span>`:''}</div>`).join('')}</div>${addB(c)}</div>`).join('')}${addCat}${note}</div></section>`;
 return `<section class="mn-sec mn-${v==='board'?'board':'classic'}"><div class="wrap">${v==='board'?`<div class="mn-chalk">${head}<div class="mn-cols">${cats.map(group).join('')}</div>${addCat}${note}</div>`:`${head}<div class="mn-cols">${cats.map(group).join('')}</div>${addCat}${note}`}</div></section>`};

/* portfolio: photos sorted into collections; images live in browser storage so big galleries fit */
const PF={};
const pfSrc=v=>v?(String(v).startsWith('idb:')?mediaUrl(v):v):'';
function pfCats(d){const c=[...(d.cats||[])];(d.photos||[]).forEach(p=>{if(p.cat&&!c.includes(p.cat))c.push(p.cat)});return c}
R.portfolio=s=>{const d=s.data,v=s.variant,cats=pfCats(d);const ph=(d.photos||[]).map((p,i)=>({...p,_i:i}));let cur=PF[s.id]||'all';if(cur!=='all'&&!cats.includes(cur))cur='all';
 const head=`<div class="sec-head${v==='albums'?' center':''}"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div>`;
 const tile=(p,k)=>`<figure class="pf-it" data-pfopen="${s.id}|${p._i}">${pic(p.image,IP(s,`photos.${p._i}.image`),100+p._i*29,'Photo')}${p.caption?`<figcaption>${esc(p.caption)}</figcaption>`:''}</figure>`;
 const addT=EDIT?`<button type="button" class="pf-addt" data-pfadd="${s.id}|${cur==='all'?esc(cats[0]||'Featured'):esc(cur)}">${ic('upload',20)}<b>Add photos</b><small>${cur==='all'?'Pick several at once':'to '+esc(cur)}</small></button>`:'';
 const chips=`<div class="pf-chips" role="tablist">${['all',...cats].map(c=>`<button type="button" role="tab" aria-selected="${c===cur}" class="${c===cur?'on':''}" data-pfcat="${s.id}|${esc(c)}">${c==='all'?'All':esc(c)}<small>${c==='all'?ph.length:ph.filter(p=>p.cat===c).length}</small></button>`).join('')}</div>`;
 const shown=ph.filter(p=>cur==='all'||p.cat===cur);
 if(v==='albums'){if(cur==='all')return `<section class="pf-sec pf-albums" data-pfdrop="${s.id}"><div class="wrap">${head}<div class="pf-covers">${cats.map((c,k)=>{const list=ph.filter(p=>p.cat===c);const cv=list.find(p=>p.cover)||list.find(p=>p.image)||list[0];return `<button type="button" class="pf-cover" data-pfcat="${s.id}|${esc(c)}"><span class="pic${cv&&cv.image?'':' ph'}" style="--ang:${120+k*40}deg">${cv&&cv.image?mediaHtml(cv.image,true):`<span>${ic('image',24)}</span>`}</span><b>${esc(c)}</b><small>${list.length} photo${list.length===1?'':'s'}</small></button>`}).join('')}</div>${EDIT?`<p class="pf-hint">Click an album to open it and add photos.</p>`:''}</div></section>`;
  return `<section class="pf-sec pf-albums" data-pfdrop="${s.id}"><div class="wrap">${head}<div class="pf-back"><button type="button" class="slnk" data-pfcat="${s.id}|all">${ic('l',15)} All albums</button><h3>${esc(cur)}</h3></div><div class="pf-grid">${shown.map(tile).join('')}${addT}</div></div></section>`}
 return `<section class="pf-sec pf-${v==='masonry'?'masonry':'filter'}" data-pfdrop="${s.id}"><div class="wrap">${head}${cats.length>1?chips:''}<div class="${v==='masonry'?'pf-wall':'pf-grid'}">${shown.map(tile).join('')}${addT}</div></div></section>`};

R.pricing=s=>{const d=s.data,v=s.variant;const head=`<div class="sec-head center"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div>`;
 const feats=x=>String(x.features||'').split('\n').map(t=>t.trim()).filter(Boolean);
 if(v==='list')return `<section class="pr-sec pr-list"><div class="wrap">${head}<div class="pr-rows">${(d.plans||[]).map((x,i)=>`<div class="pr-row${x.featured==='yes'?' feat':''}"><div><h3><span${T(s,`plans.${i}.name`)}>${esc(x.name)}</span>${x.featured==='yes'?'<i class="pr-pop">Most popular</i>':''}</h3><p class="muted">${feats(x).map(esc).join(' · ')}</p></div><b class="pr-price"><span${T(s,`plans.${i}.price`)}>${esc(x.price)}</span><small>${esc(x.per||'')}</small></b>${btnHtml(s.id,'p'+i,btnLabel(s.id,'p'+i),'sm'+(x.featured==='yes'?'':' ghost'))}</div>`).join('')}</div></div></section>`;
 return `<section class="pr-sec pr-cards"><div class="wrap">${head}<div class="pr-grid">${(d.plans||[]).map((x,i)=>`<div class="svc pr-card${x.featured==='yes'?' feat':''}">${x.featured==='yes'?'<i class="pr-pop">Most popular</i>':''}<h3${T(s,`plans.${i}.name`)}>${esc(x.name)}</h3><b class="pr-price"><span${T(s,`plans.${i}.price`)}>${esc(x.price)}</span><small>${esc(x.per||'')}</small></b><ul>${feats(x).map(t=>`<li>${ic('check',15)}<span>${esc(t)}</span></li>`).join('')}</ul>${btnHtml(s.id,'p'+i,btnLabel(s.id,'p'+i),x.featured==='yes'?'':'ghost')}</div>`).join('')}</div></div></section>`};

R.team=s=>{const d=s.data;return `<section class="tm-sec tm-${s.variant}"><div class="wrap"><div class="sec-head${s.variant==='round'?' center':''}"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div><div class="tm-grid">${(d.members||[]).map((m,i)=>`<div class="svc tm-card">${pic(m.image,IP(s,`members.${i}.image`),150+i*45,'Photo')}<h3${T(s,`members.${i}.name`)}>${esc(m.name)}</h3><span class="tm-role"${T(s,`members.${i}.role`)}>${esc(m.role)}</span>${m.bio||EDIT?`<p${T(s,`members.${i}.bio`)}>${esc(m.bio)}</p>`:''}</div>`).join('')}</div></div></section>`};

const BA={};
R.beforeafter=s=>{const d=s.data;return `<section class="ba-sec ba-${s.variant}"><div class="wrap"><div class="sec-head center"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div><div class="ba-list">${(d.pairs||[]).map((x,i)=>{const pos=BA[s.id+i]??50;
  const cap=`<figcaption${T(s,`pairs.${i}.caption`)}>${esc(x.caption)}</figcaption>`;
  if(s.variant==='side')return `<figure class="ba-side"><div class="ba-two"><div class="ba-half">${pic(x.before,IP(s,`pairs.${i}.before`),200,'Before photo')}<i class="ba-lab">Before</i></div><div class="ba-half">${pic(x.after,IP(s,`pairs.${i}.after`),120,'After photo')}<i class="ba-lab r">After</i></div></div>${cap}</figure>`;
  return `<figure class="ba-fig"><div class="ba" style="--ba:${pos}%" data-ba="${s.id}|${i}"><div class="ba-b">${pic(x.before,IP(s,`pairs.${i}.before`),200,'Before photo')}</div><div class="ba-a">${pic(x.after,IP(s,`pairs.${i}.after`),120,'After photo')}</div><i class="ba-lab">Before</i><i class="ba-lab r">After</i><span class="ba-line"></span><button type="button" class="ba-knob" data-baknob aria-label="Drag to compare before and after" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pos}">${ic('l',14)}${ic('r',14)}</button></div>${cap}</figure>`}).join('')}</div></div></section>`};

R.listings=s=>{const d=s.data,v=s.variant;return `<section class="ls-sec ls-${v}"><div class="wrap"><div class="sec-head"><h2${T(s,'heading')}>${esc(d.heading)}</h2>${d.sub?`<p${T(s,'sub')}>${esc(d.sub)}</p>`:''}</div><div class="ls-grid">${(d.items||[]).map((x,i)=>`<div class="prod ls-card">${pic(x.image,IP(s,`items.${i}.image`),180+i*30,'Listing photo')}<i class="ls-st ls-${esc(x.status||'sale')}">${esc(LIST_ST[x.status]||'For sale')}</i><div class="ls-b"><b class="ls-price"${T(s,`items.${i}.price`)}>${esc(x.price)}</b><h3${T(s,`items.${i}.title`)}>${esc(x.title)}</h3><p class="muted"${T(s,`items.${i}.details`)}>${esc(x.details)}</p></div></div>`).join('')}</div></div></section>`};

/* ---------- kit builder: an industry layout becomes pages of filled-in sections ---------- */
const kitOf=k=>KITS[k]||KITS.other;
const kitLayouts=k=>kitOf(k).layouts;
const kitFirst=k=>Object.keys(kitLayouts(k))[0];
const kitName=k=>(INDUSTRIES[k]&&k!=='other')?kitOf(k).short:'your business';
function fillF(f){const K=kitOf(f.industry);const nm=String(f.name||'').trim();const samples=Object.values(KITS).map(x=>x.sample).filter(Boolean);const name=!state.biz.name&&(!nm||samples.includes(nm))?(K.sample||'Your Business'):nm;return{...f,name,city:String(f.city||'').trim(),phone:f.phone||'',email:f.email||'',address:String(f.address||''),desc:String(f.desc||'')}}
function genData(type,F){const K=kitOf(F.industry),ind=INDUSTRIES[F.industry]||INDUSTRIES.other,goal=GOALS[F.goal]||GOALS[ind.goal]||GOALS.call,t=x=>fillT(x,F);const cta=t(K.cta||goal.cta(F));
 switch(type){
  case'hero':return{eyebrow:t(ind.eyebrow),heading:t(ind.hero),sub:F.desc.trim()||t(ind.sub),cta,cta2:K.cta2||'See what we offer',image:null};
  case'slideshow':return{heading:t(ind.slidesH||'A closer look'),interval:4,ind:'dots',slides:(ind.slides||['Our work','Our space','Our team']).map(c=>({image:null,caption:t(c)}))};
  case'about':return{eyebrow:'About us',heading:t(ind.aboutH),body:t(ind.about),image:null,stats:ind.stats.map(([value,label])=>({value:t(value),label:t(label)}))};
  case'services':return{heading:ind.servicesH,intro:t(ind.intro),items:ind.services.map(([title,desc,price])=>({title,desc,price}))};
  case'testimonials':return{heading:'What customers say',items:ind.reviews.map(([q,n,r])=>({quote:t(q),name:n,role:r,stars:5}))};
  case'gallery':return{heading:t(ind.gallery||'Gallery'),images:[null,null,null,null,null,null]};
  case'faq':return{heading:'Questions we hear a lot',items:ind.faq.map(([q,a])=>({q:t(q),a:t(a)}))};
  case'map':return{heading:'Find us',address:F.address.trim()||'Your street address\n'+(F.city||'City, State'),phone:F.phone};
  case'contact':{const q=F.goal==='quote';return{heading:K.contactH||(q?'Request a free quote':'Get in touch'),sub:K.contactSub||(q?'Tell us about the job and we will get back to you within one business day.':'Questions or special requests? Send us a note and we will reply within one business day.'),phone:F.phone,email:F.email,address:F.address.replace(/\n/g,', '),button:K.contactBtn||(q?'Request my quote':'Send message')}}
  case'booking':return{heading:K.bookH||'Book an appointment',sub:'Pick a service and a time that works for you.',services:ind.services.slice(0,3).map(x=>({title:x[0],duration:'45 min'}))};
  case'shop':return{heading:K.shopH||'Order online',items:ind.services.slice(0,4).map(x=>({name:x[0],price:(String(x[2]).match(/\$[\d,.]+/)||['$20'])[0],image:null,stock:10}))};
  case'cta':{const c=K.ctaSec||{heading:'Ready when you are',sub:'Reach out today and we will get back to you within one business day.',button:cta};return{heading:t(c.heading),sub:t(c.sub),button:t(c.button)}}
  case'social':return{...clone(DEFAULTS.social),sub:`News, photos and behind the scenes from ${F.name}.`};
  case'menu':return K.menu?{heading:K.menuH||'Our menu',intro:K.menuIntro||'',note:K.menuNote||'',items:K.menu.map(([cat,name,desc,price,tags])=>({cat,name,desc,price,tags:tags||'',image:null}))}:null;
  case'portfolio':return K.pf?{heading:K.pfH||'Our work',sub:K.pfSub||'',cats:Object.keys(K.pf),photos:Object.entries(K.pf).flatMap(([c,caps])=>caps.map(caption=>({image:null,cat:c,caption})))}:null;
  case'pricing':return K.plans?{heading:K.plansH||'Packages',sub:K.plansSub||'',button:K.planBtn||'Choose this',plans:K.plans.map(([name,price,per,features,feat])=>({name,price,per,features,featured:feat?'yes':'no'}))}:null;
  case'team':return K.team?{heading:'Meet the team',sub:'',members:K.team.map(([name,role,bio])=>({image:null,name,role:t(role),bio:t(bio)}))}:null;
  case'beforeafter':return K.pairs?{heading:K.baH||'Before and after',sub:K.baSub||'Drag the line to compare.',pairs:K.pairs.map(caption=>({before:null,after:null,caption}))}:null;
  case'listings':return K.listings?{heading:K.listH||'Featured listings',sub:K.listSub||'',items:K.listings.map(([title,price,details,status])=>({image:null,title,price,details,status}))}:null}
 return null}
function kitSection(type,F,sk,variant){const st=STYLES[sk]||STYLES.classic;const vs=CATALOG[type].variants;
 const v=variant&&vs[variant]?variant:st.v[type]&&vs[st.v[type]]?st.v[type]:Object.keys(vs)[0];
 return{id:uid(),type,variant:v,hidden:false,data:genData(type,F)||clone(DEFAULTS[type])}}
function subHero(name,F,sk){const s=kitSection('hero',F,sk,'centered');Object.assign(s.data,{eyebrow:F.name,heading:name,cta:'',cta2:''});s.data.sub='';return s}
function buildFromForm(f,sk,lk,opt){opt=opt||{};const F=fillF(f);const K=kitOf(F.industry),L=K.layouts[lk]||K.layouts[kitFirst(F.industry)];sk=STYLES[sk]?sk:L.style;
 const st=STYLES[sk],tk=opt.theme&&(L.theme||K.theme)&&admin.themes[L.theme||K.theme]!==false?(L.theme||K.theme):st.theme,th=THEMES[tk];
 const ind=INDUSTRIES[F.industry]||INDUSTRIES.other;const goal=F.goal||ind.goal;
 const mode=opt.theme&&tk!==st.theme?(lum(THEMES[tk].colors.bg)<.25?'dark':'light'):(state.brand.mode||'light'),pal=opt.cols?kitColorPal(themePal(tk)):themePal(tk);
 const brand={...state.brand,name:F.name,tagline:fillT(ind.tagline,F),logo:f.logo,showName:true,logoSize:f.logo?48:44,style:sk,look:st.look,theme:tk,mode,pal,colors:{...pal[mode]},font:th.font,radius:th.radius,btn:th.btn,header:goal==='call'&&F.phone?'call':st.header,ctaLabel:'',ctaLink:null,bg:null};
 const mkS=spec=>{const[t,v]=spec.split(':');return CATALOG[t]&&rule(t).enabled?kitSection(t,{...F,goal},sk,v):null};
 const home=L.home.map(mkS).filter(Boolean);
 const pages=[{id:'home',name:'Home',nav:true,icon:'home',sections:home}].concat((L.pages||[]).map(([name,icon,specs])=>({id:uid(),name,nav:true,icon,sections:specs.map(x=>x==='hero'?subHero(name,F,sk):mkS(x)).filter(Boolean)})));
 return{brand,sections:home,pages,pageId:'home',announce:{on:false,text:'',v:2,style:'bar',speed:'normal',size:'md',where:'all',close:false}}}
function kitAddonsOf(pages){const need=[];pages.forEach(p=>(p.sections||[]).forEach(s=>{const r=rule(s.type);if(r.addon&&!hasAddon(r.addon)&&!need.includes(r.addon)){const a=addonById(r.addon);if(a&&a.enabled)need.push(r.addon)}}));return need}
function kitCart(pages){kitAddonsOf(pages).forEach(id=>{if(!state.cart.addons.includes(id))state.cart.addons.push(id)})}
function smartSection(type){const st=state.brand.style||'classic';const F=fillF({...bizForm(),address:(state.biz&&state.biz.address)||'Your street address'});const s=kitSection(type,{...F,goal:(INDUSTRIES[F.industry]||{}).goal},st);
 const cur=state.sections.find(x=>x.type===type);if(cur)s.variant=cur.variant;return s}
function nextSuggested(){const have=new Set(state.sections.filter(x=>!x.hidden).map(x=>x.type));const k=state.biz&&state.biz.industry;
 const order=k&&KITS[k]?[...new Set(kitLayouts(k)[kitFirst(k)].home.map(x=>x.split(':')[0]).concat(SUGGEST_ORDER))]:SUGGEST_ORDER;
 return order.find(t=>CATALOG[t]&&!have.has(t)&&rule(t).enabled&&!(rule(t).addon&&!hasAddon(rule(t).addon)))}
function applyKit(ind,lk){const L=kitLayouts(ind)[lk]||kitLayouts(ind)[kitFirst(ind)];snap();state.biz.industry=ind;
 const r=buildFromForm({...bizForm(),industry:ind,goal:(INDUSTRIES[ind]||INDUSTRIES.other).goal},L.style,lk,{theme:true,cols:true});
 if(!state.biz.name)r.brand.name=r.brand.name||state.brand.name;
 state.brand=r.brand;state.pages=r.pages;state.pageId='home';state.sections=r.pages[0].sections;state.started=true;state.selected=null;state.announce=r.announce;ANN_CLOSED=false;MOPEN=false;
 Object.keys(ssIdx).forEach(k=>delete ssIdx[k]);Object.keys(PF).forEach(k=>delete PF[k]);
 const adds=kitAddonsOf(state.pages);kitCart(state.pages);KPICK=null;closeModal();state.tab='builder';hard();const cv=$('#canvas');if(cv)cv.scrollTop=0;
 const extra=adds.length?` ${adds.map(a=>addonById(a).name).join(' and ')} added to your plan.`:'';
 toast(`${L.name} layout ready with ${state.pages.length} page${state.pages.length>1?'s':''}.${extra}`,{label:'Undo',fn:undo})}
function startWith(mode){if(mode==='suggested'){applyKit(state.biz.industry||'other');return}
 snap();state.started=true;toast('Blank page. Add sections whenever you’re ready.');hard()}

/* "Write my page" keeps photos, layouts and links, and rewrites the words on every page */
function carryMedia(o,n){if(Array.isArray(o)&&Array.isArray(n)){o.forEach((x,i)=>{if(i>=n.length)return;if(isMediaV(x))n[i]=x;else if(x&&typeof x==='object'&&n[i]&&typeof n[i]==='object')carryMedia(x,n[i])});return}
 if(o&&n&&typeof o==='object'){Object.keys(o).forEach(k=>{const x=o[k];if(isMediaV(x)&&(k in n||k==='image'))n[k]=x;else if(x&&typeof x==='object'&&n[k]&&typeof n[k]==='object')carryMedia(x,n[k])})}}
const isMediaV=x=>typeof x==='string'&&/^(data:|idb:|https?:)/.test(x);
function bizWrite(){const b=state.biz;if(!b.industry)return;snap();syncPage();const F=fillF(bizForm());const sk=state.brand.style||'classic';const ind=INDUSTRIES[b.industry]||INDUSTRIES.other;
 state.pages.forEach((p,pi)=>(p.sections||[]).forEach((s,si)=>{if(s.type==='hero'&&pi>0)return;const nd=genData(s.type,{...F,goal:ind.goal});if(!nd)return;
  const od=s.data;if(s.type==='portfolio'&&(od.photos||[]).some(x=>x.image)){od.heading=nd.heading;od.sub=nd.sub;return}
  carryMedia(od,nd);if(od.links)nd.links=od.links;if(od.interval)nd.interval=od.interval;if(od.ind)nd.ind=od.ind;s.data=nd}));
 state.sections=curPage().sections;state.brand.tagline=fillT(ind.tagline,F);if(b.about&&b.about.trim())state.pages.forEach(p=>(p.sections||[]).forEach(s=>{if(s.type==='about')s.data.body=b.about}));
 hard();toast(`Your pages now read like a ${ind.label.toLowerCase()}. Undo brings the old words back.`)}

/* ---------- business type picker and layout cards ---------- */
let KPICK=null;
function kitTiles(cur){return `<div class="kt-grid" role="list">${Object.keys(INDUSTRIES).map(k=>{const K=kitOf(k);return `<button type="button" role="listitem" class="kt${cur===k?' on':''}" data-kitpick="${k}" title="${esc(INDUSTRIES[k].label)}">${ic(K.icon,22)}<b>${esc(K.short)}</b></button>`}).join('')}</div>`}
function kitPreview(ind,lk){const L=kitLayouts(ind)[lk];const e=EDIT;const r=buildFromForm({...bizForm(),industry:ind},L.style,lk,{theme:true,cols:true});const h=miniOf(r.brand,r.sections,3);EDIT=e;return h}
const kitTitle=k=>k&&k!=='other'&&KITS[k]?`${KITS[k].short} layouts`:'Starter layouts';
const kitBlank=()=>`<div class="kl kl-blank"><button type="button" class="kl-pv" data-start="blank" aria-label="Start with a blank page"><span class="es-ill blank"><i></i></span></button><div class="kl-b"><b>Blank page</b><p>Add each section yourself, with suggestions when you want them.</p><button type="button" class="btn sm" data-start="blank">Start blank</button></div></div>`;
const kitOr=()=>`<h4 class="kl-or">OR CHOOSE FROM THESE POPULAR LAYOUTS</h4>`;
function kitLook(ind,L){const tk=L.theme||kitOf(ind).theme||(STYLES[L.style]||STYLES.classic).theme,t=THEMES[tk]||THEMES.harbor,kc=kitCols();
 return `<p class="kl-look"><span class="sw">${(kc?[kc.p,kc.a]:['p','a','sf'].map(c=>t.colors[c])).map(h=>`<i style="background:${h}"></i>`).join('')}</span>${esc((STYLES[L.style]||STYLES.classic).name)} style · ${kc?'Your colors':esc(t.name)+' colors'}</p>`}
/* the customer's own business colors, previewed on every layout */
const COLOR_COMBOS=[['Navy & orange','#1D3557','#E76F51'],['Forest & gold','#1B4332','#D4A373'],['Black & gold','#141414','#C9A227'],['Red & charcoal','#C1121F','#2B2D42'],['Teal & coral','#0F766E','#F97362'],['Royal blue & yellow','#1D4ED8','#FACC15'],['Purple & pink','#6D28D9','#EC4899'],['Burgundy & gold','#7A1E2C','#D9A441'],['Brown & tan','#5B3A29','#D9A066'],['Plum & blush','#7B2D55','#E9A5B4'],['Sky & sun','#0284C7','#F59E0B'],['Charcoal & lime','#2F3437','#84CC16']];
function kitCols(){const c=state.kitCols;return c&&isHex(c.p)&&isHex(c.a)?c:null}
function kitColorPal(pal){const c=kitCols();if(!c)return pal;const drop=h=>lum(h)>.45?hexMix(h,'#000000',.38):h,lift=h=>lum(h)<.18?hexMix(h,'#FFFFFF',.5):h;
 const L={...pal.light,p:drop(c.p),a:c.a};L.sf=hexMix(L.p,L.bg,.9);const D={...pal.dark,p:lift(c.p),a:lift(c.a)};return{light:L,dark:D}}
function kitLogoCombo(){const cols=state.brand.logoColors||[];if(!cols.length)return null;const sc=logoSchemes(cols)[0];return['From your logo',sc.c.p,sc.c.a]}
let KCMORE=false;
function kitColorBar(inModal){const kc=kitCols(),cur=kc||{p:'#1D3557',a:'#E76F51'},lg=kitLogoCombo();const same=x=>kc&&kc.p.toUpperCase()===x[1].toUpperCase()&&kc.a.toUpperCase()===x[2].toUpperCase();const all=KCMORE||COLOR_COMBOS.slice(5).some(same);
 const chip=x=>`<button type="button" class="kc-chip${same(x)?' on':''}" data-kitcols="${x[1]}|${x[2]}" aria-pressed="${!!same(x)}"><span class="sw"><i style="background:${x[1]}"></i><i style="background:${x[2]}"></i></span>${esc(x[0])}</button>`;
 return `<div class="kc-bar"${inModal?' data-kcmodal':''}><div class="kc-top"><b>What colors does your business use?</b><span class="kc-mine"><label class="kc-in"><input type="color" data-kitcol="p" value="${cur.p.toLowerCase()}" aria-label="Primary color"><span>Primary</span></label><label class="kc-in"><input type="color" data-kitcol="a" value="${cur.a.toLowerCase()}" aria-label="Secondary color"><span>Secondary</span></label></span></div>
 <p class="kc-hint">Pick your two colors or try a popular pair. Every layout below shows them.</p>
 <div class="kc-chips"><button type="button" class="kc-chip${kc?'':' on'}" data-kitcols="" aria-pressed="${!kc}">${ic('layout',13)} Layout colors</button>${lg?chip(lg):''}${(all?COLOR_COMBOS:COLOR_COMBOS.slice(0,5)).map(chip).join('')}${all?'':`<button type="button" class="kc-chip kc-more" data-kcmore>${ic('plus',13)} ${COLOR_COMBOS.length-5} more pairs</button>`}</div></div>`}
function setKitCols(c){state.kitCols=c;save();if($('.kc-bar[data-kcmodal]')){const ind=$('#modalRoot .kit-modal').dataset.ind;const sc=$('#modalRoot .modal').scrollTop;kitModal(ind);const m=$('#modalRoot .modal');if(m)m.scrollTop=sc}else{renderCurrent();requestAnimationFrame(fitObMinis)}}
document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('[data-kcmore]')){e.stopPropagation();KCMORE=true;setKitCols(kitCols());return}const t=e.target instanceof Element&&e.target.closest('[data-kitcols]');if(!t)return;e.stopPropagation();const v=t.dataset.kitcols;setKitCols(v?{p:v.split('|')[0],a:v.split('|')[1]}:null)},true);
document.addEventListener('change',e=>{const t=e.target;if(!(t instanceof Element)||!t.matches('[data-kitcol]'))return;const kc=kitCols()||{p:'#1D3557',a:'#E76F51'};setKitCols({...kc,[t.dataset.kitcol]:t.value.toUpperCase()})});
function kitCards(ind,inModal){const ls=kitLayouts(ind);
 return `${inModal?'':kitBlank()+kitOr()}${kitColorBar(inModal)}<div class="kl-grid">${Object.entries(ls).map(([lk,L])=>{const adds=(()=>{const r=[];[L.home,...(L.pages||[]).map(p=>p[2])].flat().forEach(x=>{const t=x.split(':')[0];const ru=rule(t);if(ru.addon&&!hasAddon(ru.addon)&&!r.includes(ru.addon))r.push(ru.addon)});return r.map(addonById).filter(a=>a&&a.enabled)})();
  return `<div class="kl"><div class="kl-pv" role="button" tabindex="0" data-kituse="${ind}|${lk}" aria-label="Use the ${esc(L.name)} layout"><div class="st-mini">${kitPreview(ind,lk)}</div></div><div class="kl-b"><b>${esc(L.name)}</b><p>${esc(L.desc)}</p>${kitLook(ind,L)}<div class="kl-pages">${['Home',...(L.pages||[]).map(p=>p[0])].map(n=>`<span>${esc(n)}</span>`).join('')}</div>${adds.length?`<p class="kl-add">${ic('lock',12)} Includes ${adds.map(a=>`${esc(a.name)} (${money(a.price)}${a.billing==='monthly'?'/mo':''})`).join(', ')}</p>`:''}<button type="button" class="btn sm pri" data-kituse="${ind}|${lk}">Use this layout</button></div></div>`}).join('')}
  </div>`}
function kitStart(){const cur=KPICK||state.biz.industry||'';
 if(!cur)return `<div class="es"><div class="es-card wide kit-start">${kitBlank()}<h4 class="kl-or">OR PICK YOUR TYPE OF BUSINESS FOR POPULAR LAYOUTS</h4><p>We’ll suggest layouts, pages and colors that fit. You can change everything later.</p>${kitTiles('')}</div></div>`;
 return `<div class="es"><div class="es-card wide kit-start"><div class="kit-top"><span class="kit-ic">${ic(kitOf(cur).icon,20)}</span><div><h3>${esc(kitTitle(cur))}</h3><p>Each one comes with pages, a menu and words written for you. Pick one to start.</p></div><button type="button" class="btn sm" data-kitchange>Change type</button></div>${kitCards(cur,false)}</div></div>`}
function kitModal(ind){ask0();ind=ind||state.biz.industry||'other';
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal kit-modal" data-ind="${ind}" role="dialog" aria-modal="true" aria-labelledby="kitT"><div class="modal-h"><h2 id="kitT">${ic(kitOf(ind).icon,20)} ${esc(kitTitle(ind))}</h2><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <p class="muted">Using a layout replaces your pages with new ones, with words written for this kind of business. Undo brings your current pages back.</p>
 <details class="kit-types"><summary>Different type of business?</summary>${kitTiles(ind).replace(/data-kitpick=/g,'data-kitmodal=')}</details>
 ${kitCards(ind,true)}</div></div>`;requestAnimationFrame(fitObMinis)}
function askKit(ind,lk){const has=syncPage().some(p=>(p.sections||[]).length);const L=kitLayouts(ind)[lk];
 if(!has){applyKit(ind,lk);return}
 ask({icon:'layout',title:`Use the ${L.name} layout?`,body:`This replaces your pages with ${1+(L.pages||[]).length} new ones, with words written for this kind of business. Your business info and logo stay. You can undo right after${state.designId?', and the copy in My designs only changes if you save':''}.`,btns:[['Cancel',''],['Use this layout','pri',()=>applyKit(ind,lk)]]})}

/* section library: what this kind of business usually needs, first */
function libItem(t){const c=CATALOG[t],ad=rule(t).addon,a=ad&&addonById(ad);const owned=ad&&hasAddon(ad);
 return `<div class="libitem" draggable="true" data-new="${t}">${thumb(t)}<span class="libtxt"><b>${esc(c.name)}</b><small>${esc(t==='shop'&&hasPOS()?'Synced with your POS register':c.desc)}</small>${a?`<span class="badge ${owned?'ok':'gold'}">${owned?'In your plan':'Add-on '+money(a.price)+(a.billing==='monthly'?'/mo':'')}</span>`:''}</span><button type="button" class="iconbtn" data-add="${t}" aria-label="Add ${esc(c.name)}">${ic('plus',18)}</button></div>`}
function renderLibrary(){const k=state.biz&&state.biz.industry;const all=Object.keys(CATALOG).filter(t=>rule(t).enabled);
 if(!k||!KITS[k]||k==='other'){$('#library').innerHTML=all.map(libItem).join('');return}
 const ls=Object.values(kitLayouts(k));const rec=[...new Set(ls.flatMap(L=>L.home.concat(...(L.pages||[]).map(p=>p[2]))).map(x=>x.split(':')[0]).filter(t=>t!=='hero'&&all.includes(t)))].slice(0,6);
 $('#library').innerHTML=`<div class="lib-grp">${ic(kitOf(k).icon,14)} Popular on ${esc(kitOf(k).short)} sites</div>${rec.map(libItem).join('')}<div class="lib-grp">All sections</div>${all.filter(t=>!rec.includes(t)).map(libItem).join('')}`}

/* ---------- portfolio editor: collections, bulk upload, drag to reorder ---------- */
function readImageBlob(file,max=2000){return new Promise((res,rej)=>{if(!file||!/^image\//.test(file.type)){rej(new Error('That file is not an image.'));return}const u=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const w=img.naturalWidth||800,h=img.naturalHeight||600,k=Math.min(1,max/Math.max(w,h));const c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>b?res(b):rej(new Error('That image could not be read.')),'image/jpeg',.86)};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('That image format is not supported here.'))};img.src=u})}
async function imgPut(file){const b=await readImageBlob(file);const id='im'+uid();MEDIA[id]=URL.createObjectURL(b);try{await IDB.put('media',b,id)}catch(e){toast('This browser can show these photos now but may not keep them after you close the page.')}return 'idb:'+id}
let PFE={};/* per section: which collection the editor shows and which photo is open */
async function pfAddFiles(id,cat,files){const s=sec(id)||(findSecAny(id)||{}).s;if(!s)return;files=[...files].filter(f=>/^image\//.test(f.type));if(!files.length){toast('Pick JPG, PNG or WebP photos.');return}
 snap();const d=s.data;d.photos=d.photos||[];d.cats=pfCats(d);if(cat&&cat!=='all'&&!d.cats.includes(cat))d.cats.push(cat);const c=cat&&cat!=='all'?cat:(d.cats[0]||'Featured');if(!d.cats.includes(c))d.cats.push(c);
 toast(`Adding ${files.length} photo${files.length>1?'s':''}…`);let n=0;
 for(const f of files){try{const v=await imgPut(f);const empty=d.photos.findIndex(p=>p.cat===c&&!p.image);if(empty>=0)d.photos[empty].image=v;else d.photos.push({image:v,cat:c,caption:''});n++}catch(e){toast(e.message)}}
 hard();toast(`${n} photo${n===1?'':'s'} added to ${c}`)}
function pfEditor(s){const d=s.data,cats=pfCats(d),E=PFE[s.id]||(PFE[s.id]={cat:'all',open:-1});if(E.cat!=='all'&&!cats.includes(E.cat))E.cat='all';
 const ph=(d.photos||[]).map((p,i)=>({...p,_i:i})).filter(p=>E.cat==='all'||p.cat===E.cat);const op=d.photos&&d.photos[E.open];
 return `<div class="fld pfe" data-pfdrop="${s.id}"><span>Collections</span><div class="pfe-cats">${cats.map((c,k)=>`<span class="pfe-cat"><input value="${esc(c)}" data-pfren="${s.id}|${k}" aria-label="Collection name" size="${Math.max(4,c.length)}"><button type="button" data-pfdelcat="${s.id}|${k}" aria-label="Delete ${esc(c)}">${ic('x',12)}</button></span>`).join('')}<button type="button" class="btn sm" data-pfnewcat="${s.id}">${ic('plus',13)} Collection</button></div>
 <span>Photos</span><div class="seg sm pfe-seg">${['all',...cats].map(c=>`<button type="button" class="${E.cat===c?'on':''}" data-pfeshow="${s.id}|${esc(c)}">${c==='all'?'All':esc(c)} <small>${c==='all'?(d.photos||[]).length:(d.photos||[]).filter(p=>p.cat===c).length}</small></button>`).join('')}</div>
 <label class="pfe-drop">${ic('upload',18)}<span><b>Add photos${E.cat==='all'?'':' to '+esc(E.cat)}</b><small>Pick or drop as many as you like</small></span><input type="file" accept="image/*" multiple hidden data-pfpick="${s.id}|${esc(E.cat==='all'?(cats[0]||'Featured'):E.cat)}"></label>
 <div class="pfe-grid" data-pfgrid="${s.id}">${ph.map(p=>`<button type="button" class="pfe-th${E.open===p._i?' on':''}${p.image?'':' empty'}" data-pfth="${s.id}|${p._i}" title="${esc(p.caption||p.cat)}">${p.image?`<img src="${esc(pfSrc(p.image))}" alt="" draggable="false">`:ic('camera',16)}${p.cover?`<i class="pfe-cv">${ic('cover',10)}</i>`:''}</button>`).join('')||'<p class="hint">No photos here yet.</p>'}</div>
 <p class="hint">Drag photos to reorder. Click one to caption it or move it to another collection.</p>
 ${op?`<div class="pfe-one"><div class="pfe-prev">${op.image?`<img src="${esc(pfSrc(op.image))}" alt="">`:`<button type="button" class="btn sm" data-pick="${s.id}:photos.${E.open}.image">${ic('camera',13)} Add photo</button>`}</div><label class="fld"><span>Caption</span><input type="text" data-sf="${s.id}|photos.${E.open}.caption" value="${esc(op.caption||'')}" id="pfcap-${s.id}"></label><label class="fld"><span>Collection</span><select data-pfmove="${s.id}|${E.open}">${cats.map(c=>`<option${c===op.cat?' selected':''}>${esc(c)}</option>`).join('')}</select></label><div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" class="btn sm" data-pfcover="${s.id}|${E.open}">${ic('cover',13)} ${op.cover?'Album cover':'Make album cover'}</button><button type="button" class="btn sm" data-pick="${s.id}:photos.${E.open}.image">${ic('camera',13)} Replace</button><button type="button" class="btn sm" data-pfdel="${s.id}|${E.open}">${ic('trash',13)} Remove</button></div></div>`:''}</div>`}

/* drag to reorder thumbnails (mouse and touch) */
let PFD=null;
document.addEventListener('pointerdown',e=>{const th=e.target instanceof Element&&e.target.closest('[data-pfth]');if(!th||e.button>0)return;const[id,i]=th.dataset.pfth.split('|');PFD={id,i:+i,el:th,x:e.clientX,y:e.clientY,on:false,to:null}},true);
document.addEventListener('pointermove',e=>{if(!PFD)return;if(!PFD.on){if(Math.hypot(e.clientX-PFD.x,e.clientY-PFD.y)<7)return;PFD.on=true;PFD.el.classList.add('drag');document.body.classList.add('pf-dragging')}
 e.preventDefault();const t=document.elementFromPoint(e.clientX,e.clientY);const o=t&&t.closest('[data-pfth]');$$('.pfe-th.drop-b,.pfe-th.drop-a').forEach(x=>x.classList.remove('drop-b','drop-a'));
 if(o&&o!==PFD.el&&o.dataset.pfth.split('|')[0]===PFD.id){const r=o.getBoundingClientRect();const after=e.clientX>r.left+r.width/2;o.classList.add(after?'drop-a':'drop-b');PFD.to={i:+o.dataset.pfth.split('|')[1],after}}else PFD.to=null},{passive:false});
document.addEventListener('pointerup',()=>{if(!PFD)return;const D=PFD;PFD=null;document.body.classList.remove('pf-dragging');if(!D.on)return;D.el.classList.remove('drag');$$('.pfe-th.drop-b,.pfe-th.drop-a').forEach(x=>x.classList.remove('drop-b','drop-a'));
 PF_SKIPCLICK=true;setTimeout(()=>PF_SKIPCLICK=false,60);if(!D.to)return;const s=sec(D.id);if(!s)return;snap();const a=s.data.photos;const[m]=a.splice(D.i,1);let to=D.to.i+(D.to.after?1:0);if(D.i<to)to--;a.splice(to,0,m);const E=PFE[D.id];if(E&&E.open===D.i)E.open=to;hard()});
let PF_SKIPCLICK=false;

/* lightbox for visitors */
function pfLight(id,i){const r=findSecAny(id);if(!r)return;const ph=(r.s.data.photos||[]);const cur=PF[id]||'all';const list=ph.map((p,k)=>({...p,k})).filter(p=>p.image&&(cur==='all'||p.cat===cur));if(!list.length)return;let at=Math.max(0,list.findIndex(p=>p.k===i));
 const el=document.createElement('div');el.className='pf-lb';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Photo viewer');document.body.appendChild(el);
 const draw=()=>{const p=list[at];el.innerHTML=`<button type="button" class="pf-lbx" data-lbx aria-label="Close">${ic('x',22)}</button>${list.length>1?`<button type="button" class="pf-lbn l" data-lbn="-1" aria-label="Previous">${ic('l',26)}</button><button type="button" class="pf-lbn r" data-lbn="1" aria-label="Next">${ic('r',26)}</button>`:''}<figure>${mediaHtml(p.image)}<figcaption>${esc(p.caption||'')}<small>${at+1} of ${list.length}${p.cat?' · '+esc(p.cat):''}</small></figcaption></figure>`};
 const close=()=>{el.remove();document.removeEventListener('keydown',key,true)};const key=e=>{if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='ArrowRight'){at=(at+1)%list.length;draw()}else if(e.key==='ArrowLeft'){at=(at-1+list.length)%list.length;draw()}};
 el.addEventListener('click',e=>{const b=e.target.closest('[data-lbn]');if(b){at=(at+ +b.dataset.lbn+list.length)%list.length;draw();return}if(e.target.closest('[data-lbx]')||e.target===el)close()});document.addEventListener('keydown',key,true);draw();el.querySelector('[data-lbx]').focus()}

/* before and after: drag the knob or the line */
let BAD=null;
function baSet(box,x){const r=box.getBoundingClientRect();const p=Math.max(2,Math.min(98,(x-r.left)/r.width*100));box.style.setProperty('--ba',p+'%');const[id,i]=box.dataset.ba.split('|');BA[id+i]=Math.round(p);const k=box.querySelector('.ba-knob');if(k)k.setAttribute('aria-valuenow',Math.round(p))}
document.addEventListener('pointerdown',e=>{if(!(e.target instanceof Element))return;const box=e.target.closest('[data-ba]');if(!box)return;const knob=e.target.closest('[data-baknob]');const edit=box.closest('.site.edit');
 if(edit&&!knob)return;e.preventDefault();e.stopPropagation();BAD=box;try{(knob||box).setPointerCapture(e.pointerId)}catch(err){}baSet(box,e.clientX)},true);
document.addEventListener('pointermove',e=>{if(BAD){e.preventDefault();baSet(BAD,e.clientX)}},{passive:false});
document.addEventListener('pointerup',()=>{BAD=null});
document.addEventListener('keydown',e=>{const k=e.target instanceof Element&&e.target.closest('[data-baknob]');if(!k||!/Arrow(Left|Right)/.test(e.key))return;e.preventDefault();const box=k.closest('[data-ba]');const r=box.getBoundingClientRect();const cur=parseFloat(box.style.getPropertyValue('--ba'))||50;baSet(box,r.left+r.width*(cur+(e.key==='ArrowRight'?5:-5))/100)});

/* ---------- events ---------- */
document.addEventListener('click',e=>{const T0=e.target;if(!(T0 instanceof Element))return;const q=s=>T0.closest(s);let el;
 if(el=q('[data-kitpick]')){e.stopPropagation();const k=el.dataset.kitpick;KPICK=k;state.biz.industry=k;save();renderLibrary();soft();if(state.rightTab==='info')renderInspector();return}
 if(q('[data-kitchange]')){e.stopPropagation();KPICK='';state.biz.industry='';save();soft();if(state.rightTab==='info')renderInspector();return}
 if(el=q('[data-kitmodal]')){e.stopPropagation();kitModal(el.dataset.kitmodal);return}
 if(el=q('[data-kituse]')){e.stopPropagation();const[ind,lk]=el.dataset.kituse.split('|');askKit(ind,lk);return}
 if(q('[data-kitopen]')){e.stopPropagation();kitModal(state.biz.industry||'other');return}
 if(el=q('[data-mntab]')){e.stopPropagation();e.preventDefault();const[id,c]=el.dataset.mntab.split('|');MTAB[id]=c;soft();return}
 if(el=q('[data-mnadd]')){e.stopPropagation();const[id,c]=el.dataset.mnadd.split('|');const s=sec(id);if(!s)return;snap();const it=s.data.items;let at=-1;it.forEach((x,i)=>{if((x.cat||'Menu')===c)at=i});it.splice(at+1,0,{cat:c,name:'New dish',desc:'',price:'$0',tags:'',image:null});hard();return}
 if(el=q('[data-mnaddcat]')){e.stopPropagation();const s=sec(el.dataset.mnaddcat);if(!s)return;snap();const cs=menuCats(s.data);let n='New category',k=2;while(cs.includes(n))n='New category '+k++;s.data.items.push({cat:n,name:'New dish',desc:'',price:'$0',tags:'',image:null});MTAB[s.id]=n;hard();return}
 if(el=q('[data-pfcat]')){e.stopPropagation();e.preventDefault();const[id,c]=el.dataset.pfcat.split('|');PF[id]=c;PFE[id]={cat:c,open:-1};soft();if(state.selected===id&&state.rightTab==='section')renderInspector();return}
 if(el=q('[data-pfadd]')){e.stopPropagation();e.preventDefault();const[id,c]=el.dataset.pfadd.split('|');const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.onchange=()=>pfAddFiles(id,c,inp.files);inp.click();return}
 if(el=q('[data-pfopen]')){const site=el.closest('.site');if(!site||site.classList.contains('edit'))return;e.preventDefault();e.stopPropagation();const[id,i]=el.dataset.pfopen.split('|');pfLight(id,+i);return}
 if(el=q('[data-pfeshow]')){e.stopPropagation();const[id,c]=el.dataset.pfeshow.split('|');PFE[id]={cat:c,open:-1};PF[id]=c;soft();renderInspector();return}
 if(el=q('[data-pfth]')){e.stopPropagation();if(PF_SKIPCLICK)return;const[id,i]=el.dataset.pfth.split('|');const E=PFE[id]||(PFE[id]={cat:'all',open:-1});E.open=E.open===+i?-1:+i;renderInspector();return}
 if(el=q('[data-pfnewcat]')){e.stopPropagation();const s=sec(el.dataset.pfnewcat);snap();const cs=pfCats(s.data);let n='New collection',k=2;while(cs.includes(n))n='New collection '+k++;s.data.cats=[...cs,n];PFE[s.id]={cat:n,open:-1};PF[s.id]=n;hard();setTimeout(()=>{const i=$$(`[data-pfren^="${s.id}|"]`).pop();if(i){i.focus();i.select()}},60);return}
 if(el=q('[data-pfdelcat]')){e.stopPropagation();const[id,k]=el.dataset.pfdelcat.split('|');const s=sec(id);const cs=pfCats(s.data);const c=cs[+k];const n=(s.data.photos||[]).filter(p=>p.cat===c).length;
  const go=()=>{snap();const rest=cs.filter(x=>x!==c);s.data.cats=rest;const to=rest[0];if(to)s.data.photos.forEach(p=>{if(p.cat===c)p.cat=to});else s.data.photos=s.data.photos.filter(p=>p.cat!==c);PF[id]='all';PFE[id]={cat:'all',open:-1};hard();toast(`${c} removed${n&&to?`. Its photos moved to ${to}`:''}`,{label:'Undo',fn:undo})};
  if(n&&cs.length<2)ask({icon:'trash',tone:'warn',title:`Delete ${c}?`,body:`This is your only collection, so its ${n} photo${n>1?'s':''} will be removed too.`,btns:[['Cancel',''],['Delete','warn',go]]});else go();return}
 if(el=q('[data-pfcover]')){e.stopPropagation();const[id,i]=el.dataset.pfcover.split('|');const s=sec(id);const p=s.data.photos[+i];snap();s.data.photos.forEach(x=>{if(x.cat===p.cat)delete x.cover});p.cover=true;hard();toast(`Album cover set for ${p.cat}`);return}
 if(el=q('[data-pfdel]')){e.stopPropagation();const[id,i]=el.dataset.pfdel.split('|');const s=sec(id);snap();s.data.photos.splice(+i,1);PFE[id].open=-1;hard();toast('Photo removed',{label:'Undo',fn:undo});return}
},true);
document.addEventListener('change',e=>{const t=e.target;if(!(t instanceof Element))return;
 if(t.dataset.pfpick){const[id,c]=t.dataset.pfpick.split('|');const f=[...t.files];t.value='';pfAddFiles(id,c,f);return}
 if(t.dataset.pfmove){const[id,i]=t.dataset.pfmove.split('|');const s=sec(id);snap();const p=s.data.photos[+i];p.cat=t.value;delete p.cover;hard();toast(`Moved to ${t.value}`);return}
 if(t.dataset.pfren){const[id,k]=t.dataset.pfren.split('|');const s=sec(id);const cs=pfCats(s.data);const old=cs[+k],nv=t.value.trim();if(!nv||nv===old){t.value=old;return}if(cs.includes(nv)){toast('You already have a collection with that name');t.value=old;return}snap();cs[+k]=nv;s.data.cats=cs;s.data.photos.forEach(p=>{if(p.cat===old)p.cat=nv});if(PF[id]===old)PF[id]=nv;if(PFE[id]&&PFE[id].cat===old)PFE[id].cat=nv;hard();return}
 if(t.id==='biz-industry'){state.biz.industry=t.value;save();KPICK=t.value||null;renderLibrary();soft();renderInspector();return}
},true);
document.addEventListener('keydown',e=>{const t=e.target;if(t instanceof Element&&t.dataset.pfren&&e.key==='Enter'){e.preventDefault();t.blur()}if(t instanceof Element&&t.matches('div.kl-pv[data-kituse]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click()}});
document.addEventListener('focusout',e=>{const t=e.target;if(!(t instanceof Element))return;
 if(t.dataset.mncat){const[id,old]=t.dataset.mncat.split('|');const s=sec(id);const nv=t.textContent.trim();if(!s||!nv||nv===old){if(!nv)t.textContent=old;return}snap();s.data.items.forEach(x=>{if((x.cat||'Menu')===old)x.cat=nv});if(MTAB[id]===old)MTAB[id]=nv;soft();renderInspector();return}
 if(t.dataset.pfren){t.dispatchEvent(new Event('change',{bubbles:true}))}});
document.addEventListener('keydown',e=>{const t=e.target;if(t instanceof Element&&t.dataset.mncat&&e.key==='Enter'){e.preventDefault();t.blur()}},true);
/* drop photo files on a portfolio section or its editor to add them all */
document.addEventListener('dragover',e=>{const z=e.target instanceof Element&&e.target.closest('[data-pfdrop]');if(!z||!e.dataTransfer||![...e.dataTransfer.types].includes('Files'))return;if(e.target.closest('[data-img],[data-drop-img]'))return;e.preventDefault();z.classList.add('pf-over')},true);
document.addEventListener('dragleave',e=>{const z=e.target instanceof Element&&e.target.closest('[data-pfdrop]');if(z&&!z.contains(e.relatedTarget))z.classList.remove('pf-over')},true);
document.addEventListener('drop',e=>{const z=e.target instanceof Element&&e.target.closest('[data-pfdrop]');if(!z||!e.dataTransfer||!e.dataTransfer.files.length)return;if(e.target.closest('[data-img],[data-drop-img]'))return;e.preventDefault();e.stopPropagation();z.classList.remove('pf-over');const id=z.dataset.pfdrop;const E=PFE[id];const c=(E&&E.cat!=='all'&&E.cat)||(PF[id]&&PF[id]!=='all'&&PF[id])||'';pfAddFiles(id,c,e.dataTransfer.files)},true);

/* ---------- logo and menu placement for computers and phones ---------- */
const LOGO_D={left:'Logo left',center:'Logo centered'},LOGO_M={left:'Logo left',center:'Logo centered'};
const logoD=()=>state.brand.header==='center'?'center':'left';
const logoM=()=>state.brand.logoM==='center'?'center':'left';
function logoIllus(kind,k){return kind==='d'?`<span class="mi mi-d lo-${k}"><i class="mi-logo"></i><span class="mi-links"><i class="mi-l on"></i><i class="mi-l"></i><i class="mi-l"></i></span></span>`:`<span class="mi mi-m lo-${k}"><i class="mi-logo"></i><i class="mi-burg"></i></span>`}
function logoPick(kind){const isD=kind==='d',L=isD?LOGO_D:LOGO_M,cur=isD?logoD():logoM();
 return `<div class="mpick lpick" role="radiogroup" aria-label="Logo position on ${isD?'computers':'phones'}">${Object.entries(L).map(([k,l])=>`<button type="button" role="radio" aria-checked="${k===cur}" class="mp${k===cur?' on':''}" data-logo${kind}="${k}">${logoIllus(kind,k)}<small>${l}</small></button>`).join('')}</div>`}
function menuPick(kind){const isD=kind==='d',M=isD?MENU_D:MENU_M,cm=isD?menuD():menuM();
 return `<div class="mpick" role="radiogroup" aria-label="Menu style on ${isD?'computers':'phones'}">${Object.entries(M).map(([k,l])=>`<button type="button" role="radio" aria-checked="${k===cm}" class="mp${k===cm?' on':''}" data-menu${kind}="${k}">${menuIllus(kind,k)}<small>${l}</small></button>`).join('')}</div>`}
function devPicks(kind){return `<div class="sectitle">Logo</div>${logoPick(kind)}<div class="sectitle">Menu</div>${menuPick(kind)}`}
function ctaSwitch(){const hc=state.brand.ctaLabel!=='';return `<label class="bgx-sw" style="margin-top:10px"><input type="checkbox" data-hdrcta ${hc?'checked':''}><i></i><span>Show a button in the menu</span></label>`}
function menuPickers(){const ph=state.device==='phone';
 return `<div class="hp-dev${ph?'':' cur'}"><div class="hp-h">${ic('desktop',15)}<b>On computers</b>${ph?`<button type="button" class="linkbtn" data-hdrdev="desktop">Preview</button>`:'<span class="hp-now">Showing</span>'}</div>${devPicks('d')}</div>
 <div class="hp-dev${ph?' cur':''}"><div class="hp-h">${ic('phone',15)}<b>On phones</b>${ph?'<span class="hp-now">Showing</span>':`<button type="button" class="linkbtn" data-hdrdev="phone">Preview</button>`}</div>${devPicks('m')}</div>
 ${ctaSwitch()}<p class="hint">Tip: click <b>Logo &amp; menu</b> on the page header to change these while you look at it.</p>`}

/* header pane on the page: pick a device, see it, change it. Laid out as slides like the other bottom panes */
function hdrPopHtml(){const ph=state.device==='phone',k=ph?'m':'d',hc=state.brand.ctaLabel!=='';
 const slide=(cls,icon,title,body)=>`<section class="hp-slide ${cls}" aria-label="${title}"><h4>${ic(icon,14)}${title}</h4>${body}</section>`;
 return `<div class="bp-h hp-top"><b>${ic('layout',14)} Logo &amp; menu</b>
 <div class="seg hp-seg" role="tablist" aria-label="Device"><button type="button" role="tab" aria-selected="${!ph}" class="${ph?'':'on'}" data-hdrdev="desktop">${ic('desktop',15)} Computer</button><button type="button" role="tab" aria-selected="${ph}" class="${ph?'on':''}" data-hdrdev="phone">${ic('phone',15)} Phone</button></div>
 <small class="hp-note">Computers and phones each keep their own layout.</small>
 <button type="button" class="btn sm pri hp-done" data-bpclose>Done</button><button type="button" class="iconbtn" data-bpclose aria-label="Close">${ic('x',16)}</button></div>
 <div class="hp-jump dk-chips" role="tablist" aria-label="Jump to">${[['hp-logo','Logo'],['hp-menu','Menu'],['hp-cta','Menu button']].map(([c,l],i)=>`<button type="button" role="tab" data-hpgo="${c}" class="${i?'':'on'}" aria-selected="${!i}">${l}</button>`).join('')}</div>
 <div class="hp-track" role="group" aria-label="Logo and menu settings for ${ph?'phones':'computers'}">
 ${slide('hp-logo','image','Logo',logoPick(k))}
 ${slide('hp-menu','menu',ph?'Menu on phones':'Menu on computers',menuPick(k))}
 ${slide('hp-cta','link','Menu button',`${ctaSwitch()}<p class="hint">${hc?'Click the button on the page to change its words and where it goes.':'Add a button like “Call us” or “Book now” beside your menu.'}</p>`)}
 </div>`}
function openHdrPop(){ask0();const el=document.createElement('div');el.id='btnPop';el.className='bp hdr-pop';el.setAttribute('role','dialog');el.setAttribute('aria-label','Logo and menu');el.innerHTML=hdrPopHtml();document.body.appendChild(el);hpTrack(el);placeHdrPop()}
/* narrow bottom pane: the chips show which slide you're on and jump between them */
function hpTrack(el){const tr=el.querySelector('.hp-track');if(!tr)return;const mark=()=>{const on=el.querySelector('[data-hpgo].on'),best=dkNear(tr,on&&tr.querySelector('.'+on.dataset.hpgo));if(!best)return;el.querySelectorAll('[data-hpgo]').forEach(b=>{const on=best.classList.contains(b.dataset.hpgo);b.classList.toggle('on',on);b.setAttribute('aria-selected',on)})};
 tr.addEventListener('scroll',()=>{clearTimeout(tr._t);tr._t=setTimeout(mark,60)},{passive:true});mark()}
function placeHdrPop(){const el=$('#btnPop.hdr-pop');if(!el)return;if(innerWidth<=560){el.classList.add('sheet');return}const pb=$('#pagebar');const top=pb?pb.getBoundingClientRect().bottom+10:120;el.style.top=Math.max(8,Math.min(top,innerHeight-el.offsetHeight-8))+'px';el.style.left=Math.max(8,innerWidth-el.offsetWidth-16)+'px'}
function refreshHdrPop(){const el=$('#btnPop.hdr-pop');if(el){const tr=el.querySelector('.hp-track'),x=tr?tr.scrollLeft:0,y=tr?tr.scrollTop:0;el.innerHTML=hdrPopHtml();const t2=el.querySelector('.hp-track');if(t2){t2.scrollLeft=x;t2.scrollTop=y}hpTrack(el);placeHdrPop()}if(state.rightTab==='brand')renderInspector()}
function setDevice(d){state.device=d;MOPEN=false;$('#device').dataset.device=d;$$('#deviceSeg button').forEach(b=>b.classList.toggle('on',b.dataset.device===d));save();hard();fitDevice()}

/* ---------- device models: real screen sizes and frames for each kind of computer, tablet and phone ---------- */
const DEVS={
 desktop:[{k:'fit',n:'Fit my window',s:'Any computer',os:'any'},{k:'win',n:'Windows laptop',s:'1366 wide · Chrome or Edge',os:'win',w:1366},{k:'winhd',n:'Windows desktop',s:'1920 wide · Chrome or Edge',os:'win',w:1920},{k:'mba',n:'MacBook Air',s:'1470 wide · Safari',os:'mac',w:1470},{k:'mbp',n:'MacBook Pro 16"',s:'1728 wide · Safari',os:'mac',w:1728}],
 tablet:[{k:'ipad',n:'iPad',s:'820 × 1180 · Safari',os:'ipados',w:820,h:1180},{k:'ipadmini',n:'iPad mini',s:'744 × 1133 · Safari',os:'ipados',w:744,h:1133},{k:'ipadpro',n:'iPad Pro 13"',s:'1032 × 1376 · Safari',os:'ipados',w:1032,h:1376},{k:'tabs9',n:'Samsung Galaxy Tab S9',s:'800 × 1280 · Chrome',os:'android',w:800,h:1280,nav:'keys'},{k:'fire',n:'Amazon Fire HD 10',s:'800 × 1280 · Silk',os:'android',w:800,h:1280,nav:'keys'}],
 phone:[{k:'iphone',n:'iPhone 16',s:'393 × 852 · Safari',os:'ios',w:393,h:852,cut:'island'},{k:'iphonemax',n:'iPhone 16 Pro Max',s:'440 × 956 · Safari',os:'ios',w:440,h:956,cut:'island'},{k:'iphonese',n:'iPhone SE',s:'375 × 667 · Safari',os:'ios',w:375,h:667,cut:'home'},{k:'s24',n:'Samsung Galaxy S24',s:'360 × 780 · Chrome',os:'android',w:360,h:780,cut:'hole',nav:'keys'},{k:'a15',n:'Samsung Galaxy A15',s:'384 × 832 · Chrome',os:'android',w:384,h:832,cut:'drop',nav:'keys'},{k:'pixel',n:'Google Pixel 9',s:'412 × 923 · Chrome',os:'android',w:412,h:923,cut:'hole',nav:'swipe'}]};
const devModel=t=>{t=t||state.device;const l=DEVS[t]||DEVS.desktop,k=(state.models||{})[t];return l.find(m=>m.k===k)||l[0]};
/* tablet and phone previews on a screen with room to spare show the whole device, scrolling inside its screen */
const devFramed=()=>state.tab==='builder'&&state.device!=='desktop'&&innerWidth>700;
const SB_IC=`<span class="dv-ic"><svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg><svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true"><path d="M7.5 10.5 5 7.8a3.6 3.6 0 0 1 5 0zM2.6 5.4a7 7 0 0 1 9.8 0l-1.3 1.3a5.2 5.2 0 0 0-7.2 0zM.2 3a10.4 10.4 0 0 1 14.6 0l-1.3 1.3a8.6 8.6 0 0 0-12 0z"/></svg><svg width="24" height="11" viewBox="0 0 24 11" aria-hidden="true"><rect x=".5" y=".5" width="20" height="10" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="15" height="7" rx="1.8"/><path d="M22 3.8v3.4a1.8 1.8 0 0 0 0-3.4z" opacity=".45"/></svg></span>`;
function devShell(){const cv=$('#canvas');if(!cv)return null;let sh=cv.parentElement;if(sh.classList.contains('dv-shell'))return sh;sh=document.createElement('div');sh.className='dv-shell';cv.before(sh);sh.appendChild(cv);
 const sb=document.createElement('div');sb.className='dv-sb';sb.setAttribute('aria-hidden','true');cv.insertBefore(sb,cv.firstChild);
 const nb=document.createElement('div');nb.className='dv-nb';nb.setAttribute('aria-hidden','true');cv.appendChild(nb);
 const ch=$('#device .chrome');if(ch&&!ch.querySelector('.dv-win'))ch.insertAdjacentHTML('beforeend','<span class="dv-win" aria-hidden="true"><i>&#8211;</i><i>&#9633;</i><i>&#10005;</i></span>');return sh}
function devFrame(){const sh=devShell(),d=$('#device');if(!sh||!d)return;const m=devModel(),on=devFramed();
 sh.classList.toggle('framed',on);d.dataset.os=m.os;sh.dataset.os=m.os;sh.dataset.cut=m.cut||'';sh.dataset.nav=m.nav||'';sh.dataset.dev=state.device;sh.dataset.model=m.k;
 if(!on){sh.style.zoom='';sh.style.removeProperty('--sw');sh.style.removeProperty('--sh');return}
 sh.style.setProperty('--sw',m.w+'px');sh.style.setProperty('--sh',m.h+'px');
 const sb=sh.querySelector('.dv-sb'),nb=sh.querySelector('.dv-nb'),ipad=m.os==='ipados';
 sb.innerHTML=`<b>9:41</b>${ipad?'<span class="dv-date">Tue Oct 21</span>':''}<span class="dv-cut"></span>${SB_IC}`;
 const url=($('#urlbar')||{}).textContent||'';
 nb.innerHTML=m.os==='ios'?`<span class="dv-url">${ic('lock',11)}${esc(url.replace(/^https?:\/\//,''))}</span>${m.cut==='home'?'':'<i class="dv-home"></i>'}`:m.nav==='keys'?'<span class="dv-keys"><i class="k-r"></i><i class="k-h"></i><i class="k-b"></i></span>':'<i class="dv-home"></i>'}
/* fit the whole device in the space left between the Sections list and the edit pane */
function devZoom(){const sh=$('.dv-shell');if(!sh||!sh.classList.contains('framed'))return;sh.style.zoom='';sh.style.translate='';const pv=sh.parentElement;if(!pv)return;
 const vis=x=>x&&!x.hidden&&x.offsetWidth>0;const ins=$('#fInsp'),lib=$('#fLib'),dm=$('.dock-modal'),bp=$('#btnPop');
 const pr=vis(dm)?dm.offsetWidth:vis(bp)&&document.body.classList.contains('one-bar')?bp.offsetWidth:vis(ins)&&ins.classList.contains('dock')?ins.offsetWidth:0;
 const pl=vis(lib)&&innerWidth>1020?lib.getBoundingClientRect().right+12:0;
 let aw=pv.clientWidth-pl-pr-32,ah=pv.clientHeight-32;[...pv.children].forEach(c=>{if(c!==sh&&getComputedStyle(c).position!=='absolute'&&getComputedStyle(c).position!=='fixed')ah-=c.offsetHeight});
 let z=Math.min(1,aw/sh.offsetWidth,ah/sh.offsetHeight);if(!(z>0))z=1;if(z<1)sh.style.zoom=z.toFixed(4);
 const shift=(pl-pr)/2/z;if(shift)sh.style.translate=shift.toFixed(1)+'px 0'}
const devZ=()=>{const sh=$('.dv-shell.framed');return sh&&+sh.style.zoom||1};
/* a computer or tablet preview on a small screen: show the real wide layout, shrunk to fit */
function fitDevice(){const d=$('#device'),cv=$('#canvas');if(!d||!cv)return;devFrame();d.style.zoom='';d.style.width='';d.style.maxWidth='';d.classList.remove('fitted');if(state.tab!=='builder')return;
 if(devFramed()){devZoom();return}
 const m=devModel();if(state.device==='phone'){d.style.maxWidth=m.w+'px';return}const w=m.w;if(!w)return;
 const cs=getComputedStyle(cv);const avail=cv.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);if(avail<=0)return;
 d.style.width=w+'px';d.style.maxWidth='none';if(avail>=w)return;d.style.zoom=(avail/w).toFixed(4);d.classList.add('fitted')}
/* the model picker: a small arrow beside Computer, Tablet and Phone, and an item in the More menu on smaller screens */
function dvMenuHtml(){return [['desktop','Computer'],['tablet','Tablet'],['phone','Phone']].map(([t,l])=>`<div class="obm-h">${l}</div>`+DEVS[t].map(m=>obItem(`data-dvmodel="${t}|${m.k}"`,t,esc(m.n),esc(m.s),state.device===t&&devModel(t).k===m.k)).join('')).join('')}
renderBuilder=(o=>function(){o.apply(this,arguments);const sg=$('#deviceSeg');if(sg&&!sg.querySelector('[data-dvpick]')){const m=devModel();sg.insertAdjacentHTML('beforeend',`<button type="button" class="dv-pick" data-dvpick aria-haspopup="menu" aria-label="Pick a device: ${esc(m.n)}" title="Pick a device to preview: ${esc(m.n)}">${ic('chev',13)}</button>`)}})(renderBuilder);
moreMenuHtml=(o=>function(){let h=o.apply(this,arguments);if(OBW()<=900){const m=devModel();h=h.replace('<div class="obm-h">Design</div>',obItem('data-dvpick',state.device,'Pick a device',esc(m.n))+'<div class="obm-h">Design</div>')}return h})(moreMenuHtml);
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element))return;let el;
 if(el=t.closest('[data-dvpick]')){e.stopPropagation();const inMenu=!!el.closest('.ob-menu'),btn=inMenu?$('#obMore'):el;if(!inMenu&&OBM&&OBM.btn===el)return;setTimeout(()=>obMenu(btn,dvMenuHtml()),30);return}
 if(el=t.closest('[data-dvmodel]')){e.stopPropagation();const[d,k]=el.dataset.dvmodel.split('|');state.models={...(state.models||{}),[d]:k};const sg=$('#deviceSeg [data-dvpick]');if(sg)sg.remove();setDevice(d);dockSync();return}},true);
addEventListener('resize',()=>{clearTimeout(fitDevice._t);fitDevice._t=setTimeout(fitDevice,120)});

document.addEventListener('click',e=>{const T0=e.target;if(!(T0 instanceof Element))return;const q=s=>T0.closest(s);let el;
 if(q('[data-hdredit]')){e.preventDefault();e.stopPropagation();openHdrPop();return}
 if(el=q('[data-hpgo]')){e.stopPropagation();const p=el.closest('#btnPop'),tr=p&&p.querySelector('.hp-track'),s=tr&&tr.querySelector('.'+el.dataset.hpgo);if(s){dkTo(tr,s,true);p.querySelectorAll('[data-hpgo]').forEach(b=>{b.classList.toggle('on',b===el);b.setAttribute('aria-selected',b===el)})}return}
 if(el=q('[data-hdrdev]')){e.stopPropagation();setDevice(el.dataset.hdrdev);refreshHdrPop();return}
 if(el=q('[data-logod]')){e.stopPropagation();snap();const v=el.dataset.logod;state.brand.header=v==='center'?'center':(state.brand.header==='call'?'call':'left');hard();refreshHdrPop();return}
 if(el=q('[data-logom]')){e.stopPropagation();snap();state.brand.logoM=el.dataset.logom;hard();refreshHdrPop();return}
 if(q('[data-menud],[data-menum]')&&$('#btnPop.hdr-pop')){setTimeout(refreshHdrPop,0);return}
 if($('#btnPop.hdr-pop')&&!q('#btnPop')&&!q('#toasts')){closeBtnPop()}
},true);
document.addEventListener('change',e=>{if(e.target instanceof Element&&e.target.matches('[data-hdrcta]')&&$('#btnPop.hdr-pop'))setTimeout(refreshHdrPop,0)},true);

/* ---------- colors from the logo: detect, suggest schemes, keep them in every color picker ---------- */
const toHex=(r,g,b)=>'#'+[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('').toUpperCase();
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const cDist=(a,b)=>{const x=hexRgb(a),y=hexRgb(b);return Math.hypot(x[0]-y[0],(x[1]-y[1])*1.2,x[2]-y[2])};
const sat=h=>{const[r,g,b]=hexRgb(h).map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx===0?0:(mx-mn)/mx};
function logoColorsOf(src){return new Promise(res=>{if(!src||!/^(data:|blob:|https?:)/.test(src)){res([]);return}const img=new Image();img.onload=()=>{try{const n=72,c=document.createElement('canvas');c.width=n;c.height=n;const x=c.getContext('2d',{willReadFrequently:true});const k=Math.min(n/img.naturalWidth,n/img.naturalHeight)||1;x.drawImage(img,0,0,img.naturalWidth*k,img.naturalHeight*k);
  const d=x.getImageData(0,0,n,n).data,box={};
  for(let i=0;i<d.length;i+=4){if(d[i+3]<160)continue;const key=(d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4);const b=box[key]||(box[key]={n:0,r:0,g:0,b:0});b.n++;b.r+=d[i];b.g+=d[i+1];b.b+=d[i+2]}
  const all=Object.values(box).map(b=>({n:b.n,h:toHex(b.r/b.n,b.g/b.n,b.b/b.n)})).sort((a,b)=>b.n-a.n);const tot=all.reduce((s,b)=>s+b.n,0)||1;
  const out=[];for(const b of all){if(b.n/tot<.004)break;const l=lum(b.h);const plain=l>.88||(l<.012&&out.some(x=>lum(x)<.03));if(plain&&out.length)continue;if(out.every(x=>cDist(x,b.h)>56))out.push(b.h);if(out.length>=6)break}
  /* colorful ones first, then the darks and lights */
  out.sort((a,b)=>(sat(b)>.25)-(sat(a)>.25));res(out)}catch(e){res([])}};img.onerror=()=>res([]);img.src=src})}
function logoSchemes(cols){const ch=cols.filter(h=>sat(h)>.25&&lum(h)>.02&&lum(h)<.85);const dk=cols.find(h=>lum(h)<.05);
 const p=ch[0]||dk||'#1D3557',a=ch.find(h=>cDist(h,p)>90)||(ch[1])||hexMix(p,'#FFFFFF',.45);
 const deep=h=>{let x=h,t=0;while(lum(x)>.28&&t<12){x=hexMix(h,'#000000',(++t)*.06)}return x},ink=dk||hexMix(p,'#000000',.82);
 return[
  {id:'classic',name:'Clean',c:{p:deep(p),a,bg:'#FFFFFF',sf:hexMix(p,'#FFFFFF',.93),tx:ink}},
  {id:'bold',name:'Bold',c:{p:deep(a),a:p,bg:'#FFFFFF',sf:hexMix(a,'#FFFFFF',.9),tx:ink}},
  {id:'soft',name:'Soft',c:{p:deep(p),a,bg:hexMix(a,'#FFFFFF',.95),sf:hexMix(p,'#FFFFFF',.86),tx:hexMix(ink,p,.15)}},
  {id:'deep',name:'Deep',c:{p:deep(p),a,bg:'#FFFFFF',sf:hexMix(ink,'#FFFFFF',.94),tx:ink},hero:true}]}
let LOGO_ASK=false;
async function detectLogoColors(ask){const B=state.brand;const src=B.logo;const cols=await logoColorsOf(src);if(state.brand.logo!==src)return;B.logoColors=cols;save();if(state.rightTab==='brand'||state.rightTab==='info')renderInspector();if(ask&&cols.length)logoColorModal()}
function schemeBrand(sc){const pal={light:{...sc.c},dark:darkOf(sc.c)};return{...state.brand,pal,colors:{...pal[state.brand.mode||'light']}}}
function applyScheme(id){const sc=logoSchemes(state.brand.logoColors||[]).find(x=>x.id===id);if(!sc)return;snap();const nb=schemeBrand(sc);state.brand.pal=nb.pal;state.brand.colors=nb.colors;closeModal();hard();toast(`${sc.name} colors from your logo applied to the light and dark versions`,{label:'Undo',fn:undo})}
function swatchRow(cols,big){return `<span class="lc-row${big?' big':''}">${cols.map(h=>`<i style="background:${h}" title="${h}"></i>`).join('')}</span>`}
function schemeCards(){const cols=state.brand.logoColors||[];return `<div class="lc-grid">${logoSchemes(cols).map(sc=>{const b=schemeBrand(sc);return `<div class="lc-card"><div class="kl-pv lc-pv" role="button" tabindex="0" data-lcuse="${sc.id}" aria-label="Use the ${sc.name} colors"><div class="st-mini">${(()=>{const e=EDIT;const h=miniOf(b,state.sections.length?state.sections:[mk('hero')],2);EDIT=e;return h})()}</div></div><div class="lc-b"><b>${sc.name}</b>${swatchRow(['p','a','bg','sf','tx'].map(k=>sc.c[k]))}<button type="button" class="btn sm" data-lcuse="${sc.id}">Use these</button></div></div>`}).join('')}</div>`}
function logoColorModal(){ask0();const cols=state.brand.logoColors||[];
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal lc-modal" role="dialog" aria-modal="true" aria-labelledby="lcT"><div class="modal-h"><h2 id="lcT">Colors from your logo</h2><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <div class="lc-found">${state.brand.logo?`<img src="${state.brand.logo}" alt="Your logo">`:''}<div><p class="muted" style="margin:0 0 6px">We found these colors. They are saved in every color picker so you can reuse them anywhere.</p>${swatchRow(cols,true)}</div></div>
 <div class="sectitle">Suggested color schemes</div>${schemeCards()}
 <div class="ask-btns" style="margin-top:12px"><button type="button" class="btn" data-closemodal>Keep my current colors</button></div></div></div>`;requestAnimationFrame(fitObMinis)}
function logoColorsBlock(){const cols=state.brand.logoColors||[];if(!state.brand.logo)return '';if(!cols.length)return `<p class="hint">${ic('spark',13)} Reading the colors in your logo…</p>`;
 return `<div class="lc-block"><div class="between"><b>${ic('spark',14)} Colors from your logo</b><button type="button" class="linkbtn" data-lcopen>Color schemes</button></div>${swatchRow(cols,true)}<p class="hint" style="margin:6px 0 0">These show up in every color picker on your site.</p></div>`}

/* one color picker for every color box: logo colors, site colors, recent picks, then any color */
let CPOP=null;
function colorPop(inp){closeColorPop();const B=state.brand,logo=B.logoColors||[],site=[...new Set(['p','a','bg','sf','tx'].map(k=>B.colors[k]).filter(isHex).map(x=>x.toUpperCase()))],rec=(state.recentColors||[]).filter(h=>!logo.includes(h)&&!site.includes(h)).slice(0,8);
 const grp=(t,cols)=>cols.length?`<div class="cp-g"><small>${t}</small><div class="cp-sw">${cols.map(h=>`<button type="button" data-cpick="${h}" style="background:${h}" title="${h}" aria-label="${h}"${h.toUpperCase()===String(inp.value).toUpperCase()?' class="on"':''}></button>`).join('')}</div></div>`:'';
 const el=document.createElement('div');el.className='cpop';el.setAttribute('role','dialog');el.setAttribute('aria-label','Pick a color');
 el.innerHTML=`${logo.length?grp('Your logo colors',logo):B.logo?'':`<p class="cp-tip">${ic('spark',13)} Upload your logo and its colors show up here.</p>`}${grp('Site colors',site)}${grp('Recent',rec)}<button type="button" class="btn sm cp-more" data-cpmore>${ic('plus',13)} Any color…</button>`;
 document.body.appendChild(el);CPOP={el,inp};const r=inp.getBoundingClientRect();
 if(innerWidth<=560){el.classList.add('sheet')}else{el.style.top=Math.min(r.bottom+6,innerHeight-el.offsetHeight-8)+'px';el.style.left=Math.max(8,Math.min(r.left,innerWidth-el.offsetWidth-8))+'px'}}
function closeColorPop(){if(CPOP){CPOP.el.remove();CPOP=null}}
function setColorInput(inp,h){inp.value=h.toLowerCase();inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));rememberColor(h)}
function rememberColor(h){h=String(h).toUpperCase();if(!isHex(h))return;const r=(state.recentColors||[]).filter(x=>x!==h);r.unshift(h);state.recentColors=r.slice(0,10);save()}
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element))return;
 if(t.matches('input[type=color]')&&!t.dataset.native){e.preventDefault();colorPop(t);return}
 const pk=t.closest('[data-cpick]');if(pk&&CPOP){e.stopPropagation();const inp=CPOP.inp;closeColorPop();setColorInput(inp,pk.dataset.cpick);return}
 if(t.closest('[data-cpmore]')&&CPOP){e.stopPropagation();const inp=CPOP.inp;closeColorPop();inp.dataset.native='1';try{inp.showPicker()}catch(err){inp.click()}setTimeout(()=>{delete inp.dataset.native},400);return}
 if(CPOP&&!t.closest('.cpop'))closeColorPop();
 const lu=t.closest('[data-lcuse]');if(lu){e.stopPropagation();applyScheme(lu.dataset.lcuse);return}
 if(t.closest('[data-lcopen]')){e.stopPropagation();logoColorModal();return}},true);
document.addEventListener('change',e=>{const t=e.target;if(t instanceof Element&&t.matches('input[type=color]'))rememberColor(t.value)},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&CPOP)closeColorPop();const t=e.target;if(t instanceof Element&&t.matches('div[data-lcuse]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click()}});
/* read the colors of any logo we have not read yet, including ones from the logo maker */
setInterval(()=>{const B=state.brand;if(B&&B.logo&&B._lcSrc!==B.logo.length+':'+B.logo.slice(-40)){B._lcSrc=B.logo.length+':'+B.logo.slice(-40);detectLogoColors(LOGO_ASK);LOGO_ASK=false}},700);

/* ---------- undo, redo, save; whole-section vs inside editing; text color ---------- */
function histBtns(){const u=$('#undoBtn'),r=$('#redoBtn'),s=$('#saveBtn');if(u)u.disabled=!hist.length;if(r)r.disabled=!fut.length;if(s){s.classList.toggle('dirty',DIRTY);s.title=DIRTY?'Save this design (you have changes that are not saved yet)':'Saved to My designs'}}
saveDesign=(o=>async function(x){const r=await o(x);if(r!==false){DIRTY=false;histBtns()}return r})(saveDesign);
/* autosave: once a design is in My designs, keep its saved copy current every minute and when the page is left; brand-new designs wait for a first Save */
const AUTO_MS=60000;let autoBusy=false,autoFailed=false,autoTipT=null;
async function autoSave(){if(autoBusy||!designsReady||!curDesign()||!isDirty())return;autoBusy=true;const d=curDesign(),prev={at:d.at,data:d.data};
 try{d.at=Date.now();d.data=designData();await designStore(d);autoFailed=false;DIRTY=false;histBtns();autoTip();if(state.tab==='designs')renderDesigns();const st=$('#dsMenu .ds-state');if(st){st.className='ds-state ok';st.textContent='All changes saved'}}
 catch(e){Object.assign(d,prev);if(!autoFailed){autoFailed=true;toast('Autosave could not keep your changes. Browser storage is full. Delete an old design or use smaller photos.')}}
 finally{autoBusy=false}}
function autoTip(){const b=$('#saveBtn');if(!b)return;let t=b.querySelector('.as-tip');if(!t){t=document.createElement('span');t.className='as-tip';t.setAttribute('role','status');b.appendChild(t)}
 t.textContent='Autosaved';b.title='Autosaved to My designs at '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});t.classList.add('on');clearTimeout(autoTipT);autoTipT=setTimeout(()=>t.classList.remove('on'),2500)}
setInterval(autoSave,AUTO_MS);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autoSave()});
addEventListener('pagehide',autoSave);

/* a click inside the page either selects the whole section (controls open) or an item inside it (controls fold away) */
const INNER='[data-edit],[data-editb],[data-img],a,button,input,select,textarea,label,[data-ss],[role=button],.btn';
let SITECLICK=false;
function markSel(){$$('#site .sec').forEach(e=>{const on=e.dataset.sec===state.selected;e.classList.toggle('sel',on);e.classList.toggle('sub',on&&SUB)});const h=$('#site .hdr');if(h){h.classList.toggle('hsel',HSEL);h.classList.toggle('hsub',HSEL&&HSUB)}}
selectSection=(o=>function(id){if(!SITECLICK)SUB=false;HSEL=false;o(id);markSel()})(selectSection);
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element)||!t.closest('#site.edit'))return;SITECLICK=true;setTimeout(()=>{SITECLICK=false},0);
 const w=t.closest('[data-secwhole]');if(w){e.preventDefault();e.stopPropagation();const a=document.activeElement;if(a&&a.blur)a.blur();SUB=false;SITECLICK=true;selectSection(w.dataset.secwhole);return}
 if(t.closest('[data-hdrwhole]')){e.preventDefault();e.stopPropagation();HSEL=true;HSUB=false;state.selected=null;SUB=false;markSel();state.rightTab='brand';renderInspector();return}
 const s=t.closest('.sec');if(s&&!t.closest('.sec-tools,.sec-grab,.sec-pill')){SUB=!!t.closest(INNER);HSEL=false;markSel()}
 else if(s){SUB=false}
 const h=t.closest('.hdr');if(h&&!t.closest('[data-hdredit]')){HSEL=true;HSUB=!!t.closest(INNER);state.selected=null;SUB=false;markSel()}
},true);
document.addEventListener('focusin',e=>{const t=e.target;if(!(t instanceof Element)||!t.closest('#site.edit'))return;if(!t.matches('[data-edit],[data-editb]'))return;
 const s=t.closest('.sec');if(s&&s.dataset.sec===state.selected){SUB=true;markSel()}const h=t.closest('.hdr');if(h&&HSEL){HSUB=true;markSel()}
 showTxtBar(t)});

/* text color bar for whatever text is being edited */
let TXT=null;
function tcKey(el){if(el.dataset.edit){const i=el.dataset.edit.indexOf('|');return{id:el.dataset.edit.slice(0,i),path:el.dataset.edit.slice(i+1)}}return{id:null,path:el.dataset.editb}}
function tcHost(k,make){if(k.id){const s=sec(k.id);if(!s)return null;return s.data}return state.brand}
function tcGet(k){const h=tcHost(k);const m=h&&h._tc&&h._tc[state.brand.mode||'light'];return m&&isHex(m[k.path])?m[k.path]:''}
function tcSet(k,v){const h=tcHost(k);if(!h)return;snap();const md=state.brand.mode||'light';h._tc=h._tc||{};const m=h._tc[md]=h._tc[md]||{};if(v)m[k.path]=v.toUpperCase();else delete m[k.path];save()}
function txtEl(){if(!TXT)return null;const sel=TXT.k.id?`#site [data-edit="${TXT.k.id}|${TXT.k.path}"]`:`#site [data-editb="${TXT.k.path}"]`;try{return document.querySelector(sel)}catch(e){return null}}
function showTxtBar(el){TXT={k:tcKey(el)};let b=$('#txtbar');if(!b){b=document.createElement('div');b.id='txtbar';b.setAttribute('role','toolbar');b.setAttribute('aria-label','Text options');document.body.appendChild(b)}paintTxtBar();placeTxtBar()}
function paintTxtBar(){const b=$('#txtbar');if(!b||!TXT)return;const c=tcGet(TXT.k),el=txtEl(),cur=c||(el?rgbHex(getComputedStyle(el).color):'#000000');
 b.innerHTML=`<button type="button" class="tb-col" data-tcopen title="Text color" aria-label="Text color"><span class="tb-a" style="border-color:${cur}">A</span><span class="tb-l">Text color</span>${ic('down',12)}</button>${c?`<button type="button" class="tb-reset" data-tcreset title="Back to the style's color">${ic('x',12)}<span class="tb-l"> Reset</span></button>`:''}<input type="color" id="tcInp" value="${cur.toLowerCase()}" tabindex="-1" aria-hidden="true">`}
function rgbHex(s){const m=String(s).match(/\d+(\.\d+)?/g);return m&&m.length>=3?toHex(+m[0],+m[1],+m[2]):'#000000'}
function placeTxtBar(){const b=$('#txtbar'),el=txtEl();if(!b)return;if(!el||!el.getClientRects().length){b.hidden=true;return}b.hidden=false;const r=el.getBoundingClientRect(),cv=$('#canvas').getBoundingClientRect();
 if(r.bottom<cv.top||r.top>cv.bottom){b.hidden=true;return}
 const pill=el.closest('.sec,.hdr');const pr=pill&&pill.querySelector(':scope>.sec-pill,.hdr-pill');const pb=pr&&pr.offsetParent?pr.getBoundingClientRect():null;
 let top=r.top-b.offsetHeight-8,left=Math.max(8,Math.min(r.left,innerWidth-b.offsetWidth-8));const hit=pb&&top<pb.bottom&&top+b.offsetHeight>pb.top&&left<pb.right&&left+b.offsetWidth>pb.left;
 if(top<cv.top+4||hit)top=Math.min(r.bottom+8,innerHeight-b.offsetHeight-8);b.style.top=top+'px';b.style.left=left+'px'}
function hideTxtBar(){const b=$('#txtbar');if(b)b.remove();TXT=null}
document.addEventListener('focusout',e=>{if(!TXT)return;setTimeout(()=>{const a=document.activeElement;if(a&&a.closest&&(a.closest('#txtbar,.cpop')||a.matches('#site [data-edit],#site [data-editb]')))return;if(CPOP&&CPOP.inp.id==='tcInp')return;hideTxtBar()},120)});
/* keep the text focused while using the bar or the color popover */
document.addEventListener('mousedown',e=>{const t=e.target;if(t instanceof Element&&TXT&&t.closest('#txtbar,.cpop'))e.preventDefault()},true);
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element)||!TXT)return;
 if(t.closest('[data-tcopen]')){e.stopPropagation();const i=$('#tcInp');if(CPOP&&CPOP.inp===i){closeColorPop();return}const bb=t.closest('[data-tcopen]').getBoundingClientRect();i.style.left=bb.left+'px';i.style.top=(bb.bottom-2)+'px';colorPop(i);return}
 if(t.closest('[data-tcreset]')){e.stopPropagation();tcSet(TXT.k,'');const el=txtEl();if(el)el.style.color='';paintTxtBar();return}
 if(!t.closest('#txtbar,.cpop')&&!t.closest('#site [data-edit],#site [data-editb]'))setTimeout(()=>{const a=document.activeElement;if(!(a&&a.matches&&a.matches('#site [data-edit],#site [data-editb]')))hideTxtBar()},0)},true);
document.addEventListener('input',e=>{const t=e.target;if(t instanceof Element&&t.id==='tcInp'&&TXT){const el=txtEl();tcSet(TXT.k,t.value);if(el)el.style.color=t.value;const a=$('#txtbar .tb-a');if(a)a.style.borderColor=t.value;if(!$('#txtbar .tb-reset'))paintTxtBar()}},true);
addEventListener('scroll',()=>{if(TXT)placeTxtBar()},true);addEventListener('resize',()=>{if(TXT)placeTxtBar()});
document.addEventListener('keydown',e=>{if(state.tab!=='builder'||!(e.metaKey||e.ctrlKey))return;const k=e.key.toLowerCase();
 if((k==='y'||(k==='z'&&e.shiftKey))&&!e.target.matches('input,textarea')){e.preventDefault();e.stopImmediatePropagation();redo()}
 else if(k==='s'){e.preventDefault();e.stopImmediatePropagation();saveDesign()}},true);
document.addEventListener('keydown',e=>{const t=e.target;if(t instanceof Element&&t.matches('div.st-card[role=button]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click()}});

/* ---------- section editing dock: a short pane across the bottom with slides you swipe through ---------- */
let DKKEY=null,DK_LOCK=false;
let dockOn=()=>state.tab==='builder'&&state.inspOpen&&state.rightTab==='section'&&!!sec(state.selected);
function dockSync(){const on=dockOn(),p=$('#fInsp');if(!p)return;const was=p.classList.contains('dock');p.classList.toggle('dock',on);document.body.classList.toggle('dock-on',on);dockSide();if(!on){const n=$('#fInsp .dk-nav');if(n)n.remove()}if(on&&!was)requestAnimationFrame(dockReveal)}
/* tablet and phone previews are tall, so on a wide screen the edit panes sit on the right instead of across the bottom */
let DK_SIDE=null;
function dockSide(){const b=document.body,cv=$('#canvas'),side=devFramed();b.classList.toggle('dock-side',side);
 if(side&&cv){let t=0;[$('.prevbar'),$('#pagebar')].forEach(x=>{if(x&&x.offsetParent)t=Math.max(t,x.getBoundingClientRect().bottom)});b.style.setProperty('--dktop',Math.max(0,Math.round(t))+'px')}
 const k=[side,b.classList.contains('dock-on'),state.libOpen,!!$('.dock-modal'),!!$('#btnPop')].join('|');if(k!==DK_SIDE){DK_SIDE=k;requestAnimationFrame(()=>fitDevice())}}
function dkSlide(key,title,nodes,icon){const s=document.createElement('section');s.className='dk-slide';s.dataset.dk=key;s.setAttribute('aria-label',title);s.innerHTML=`<h4>${icon?ic(icon,14):''}${esc(title)}</h4>`;nodes.forEach(n=>s.appendChild(n));return s}
function dockify(){const ins=$('#inspector');if(!ins||ins.querySelector(':scope>.dk-track'))return;const kids=[...ins.children];if(!kids.length)return;
 const slides=[];let words=[],wn=0,last=null;const used={};const key=k=>{used[k]=(used[k]||0)+1;return used[k]>1?k+used[k]:k};
 const flush=()=>{if(!words.length)return;for(let i=0;i<words.length;i+=3){wn++;slides.push(last=dkSlide(key('words'),wn>1?`Words ${wn}`:'Words',words.slice(i,i+3),'edit'))}words=[]};
 for(let i=0;i<kids.length;i++){const k=kids[i];
  if(k.matches('.insp-head')){flush();slides.push(last=dkSlide('layout','Layout',[k],'layout'));continue}
  if(k.matches('.sectitle')){flush();const t=k.textContent.trim(),g=[];while(kids[i+1]&&!kids[i+1].matches('.sectitle,.insp-head,details.bgx,label.fld,div.fld'))g.push(kids[++i]);slides.push(last=dkSlide(key(t.toLowerCase().replace(/\W+/g,'')||'more'),t,g,'edit'));continue}
  if(k.matches('details.bgx')){flush();k.open=true;slides.push(last=dkSlide('bg','Background',[k],'image'));continue}
  if(k.matches('label.fld')){words.push(k);continue}
  if(k.matches('div.fld')){flush();const lis=[...k.querySelectorAll(':scope>.li')];const head=k.querySelector(':scope>span,:scope>label,:scope>.fld-h');const t=head?head.textContent.trim():'More';
   if(lis.length){lis.forEach((li,j)=>{const b=li.querySelector('.li-h b');slides.push(last=dkSlide(key('li'+j),b?b.textContent.trim():`${t} ${j+1}`,[li],'menu'))});const rest=[...k.children].filter(x=>x!==head&&!x.classList.contains('li'));if(rest.length)slides.push(last=dkSlide('liadd',`Add to ${t}`,rest,'plus'))}
   if(head&&lis.length)head.remove();if(lis.length&&!k.children.length)k.remove();
   else slides.push(last=dkSlide(key(t.toLowerCase().replace(/\W+/g,'')||'more'),t,[k],/photo|image|logo/i.test(t)?'image':'edit'));continue}
  flush();if(last)last.appendChild(k);else slides.push(last=dkSlide('more','More',[k]))}
 flush();if(!slides.length)return;
 const tr=document.createElement('div');tr.className='dk-track';tr.setAttribute('role','group');tr.setAttribute('aria-label','Section settings, swipe for more');slides.forEach(s=>tr.appendChild(s));ins.appendChild(tr);
 /* nav: chips for each slide + arrows, in the panel header */
 const hd=$('#fInsp .insp-tabs');let nav=hd.querySelector('.dk-nav');if(!nav){nav=document.createElement('div');nav.className='dk-nav';hd.insertBefore(nav,hd.lastElementChild)}
 nav.innerHTML=`<button type="button" class="iconbtn dk-arr" data-dkstep="-1" aria-label="Previous">${ic('left',16)}</button><div class="dk-chips" role="tablist">${slides.map(s=>`<button type="button" role="tab" data-dkgo="${s.dataset.dk}">${esc(s.getAttribute('aria-label'))}</button>`).join('')}</div><button type="button" class="iconbtn dk-arr" data-dkstep="1" aria-label="Next">${ic('right',16)}</button>`;
 tr.addEventListener('scroll',()=>{if(DK_LOCK)return;clearTimeout(tr._t);tr._t=setTimeout(()=>{dkMark(dkNearest(tr))},60)},{passive:true});
 const target=DKKEY&&tr.querySelector(`[data-dk="${DKKEY}"]`);if(target)dkTo(tr,target);dkMark(target?DKKEY:slides[0].dataset.dk)}
/* slide tracks scroll sideways on phones and down, row by row, on computers */
function dkDown(tr){return getComputedStyle(tr).scrollSnapType.startsWith('y')}
function dkAt(tr,s){const a=tr.getBoundingClientRect(),b=s.getBoundingClientRect(),cs=getComputedStyle(tr);return{left:tr.scrollLeft+b.left-a.left-(parseFloat(cs.scrollPaddingLeft)||0),top:tr.scrollTop+b.top-a.top-(parseFloat(cs.scrollPaddingTop)||0)}}
function dkTo(tr,s,smooth){const p=dkAt(tr,s),d=dkDown(tr);tr.scrollTo({left:d?0:p.left,top:d?p.top:0,behavior:smooth?'smooth':'auto'})}
/* the slide in view; on a row of several, keep the one already picked when it is in that row */
function dkNear(tr,cur){const d=dkDown(tr),end=d&&tr.scrollTop+tr.clientHeight>=tr.scrollHeight-2;const ps=[...tr.children].map(s=>({s,v:d?dkAt(tr,s).top:dkAt(tr,s).left}));if(!ps.length)return null;
 const seen=end?ps.map(p=>p.v).filter(v=>v<=tr.scrollTop+tr.clientHeight-40):[],x=seen.length?Math.max(...seen):d?tr.scrollTop:tr.scrollLeft;let best=null,bd=1e9;
 for(const p of ps){const v=Math.abs(p.v-x);if(v<bd-1){bd=v;best=p.s}else if(v<bd+1&&p.s===cur)best=cur}return best}
function dkNearest(tr){const s=dkNear(tr,DKKEY&&tr.querySelector(`[data-dk="${DKKEY}"]`));return s&&s.dataset.dk}
function dkMark(k){DKKEY=k;$$('#fInsp .dk-chips [data-dkgo]').forEach(b=>{const on=b.dataset.dkgo===k;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);if(on){const c=b.parentElement;const l=b.offsetLeft-c.offsetLeft;if(l<c.scrollLeft||l+b.offsetWidth>c.scrollLeft+c.clientWidth)c.scrollTo({left:l-24,behavior:'smooth'})}})}
function dkGo(k){const tr=$('#inspector .dk-track'),s=tr&&tr.querySelector(`[data-dk="${k}"]`);if(!s)return;DK_LOCK=true;dkTo(tr,s,true);dkMark(k);setTimeout(()=>{DK_LOCK=false},600)}
/* computer panes: one turn of the mouse wheel, or one swipe on a trackpad, moves one row; a card that scrolls inside gets the wheel first */
document.addEventListener('wheel',e=>{const tr=e.target instanceof Element&&e.target.closest('.dk-track,.hp-track');if(!tr||e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX)||!dkDown(tr))return;const dy=e.deltaY*(e.deltaMode===1?40:e.deltaMode===2?400:1);
 for(let el=e.target;el&&el!==tr;el=el.parentElement){if(el.scrollHeight>el.clientHeight+1&&/auto|scroll/.test(getComputedStyle(el).overflowY)&&(dy>0?el.scrollTop+el.clientHeight<el.scrollHeight-1:el.scrollTop>0))return}
 e.preventDefault();clearTimeout(tr._wq);tr._wq=setTimeout(()=>{tr._wl=false;tr._wa=0},200);if(tr._wl)return;tr._wa=(tr._wa||0)+dy;if(Math.abs(tr._wa)<30)return;tr._wl=true;
 const y=tr.scrollTop,rows=[...new Set([...tr.children].map(s=>Math.round(dkAt(tr,s).top)))].sort((a,b)=>a-b),to=dy>0?rows.find(r=>r>y+2):rows.reverse().find(r=>r<y-2);if(to!=null)tr.scrollTo({top:to,behavior:'smooth'})},{passive:false});
/* keep the picked section in view above the dock */
function dockReveal(){const s=$(`#site .sec[data-sec="${state.selected}"]`),cv=$('#canvas'),p=$('#fInsp');if(!s||!cv||!p)return;const r=s.getBoundingClientRect(),c=cv.getBoundingClientRect(),bottom=document.body.classList.contains('dock-side')?c.bottom:p.getBoundingClientRect().top;
 const ft=$('.dv-shell.framed')?(state.device==='phone'&&devModel().os==='ios'?60:96)*devZ():0;if(r.top<c.top+ft+8||r.top>bottom-80)cv.scrollBy({top:(r.top-c.top-ft-12)/devZ(),behavior:'smooth'})}
renderInspector=(o=>function(){o.apply(this,arguments);dockSync();if(dockOn()&&state.rightTab==='section')dockify()})(renderInspector);
openPanel=(o=>function(){o.apply(this,arguments);dockSync()})(openPanel);
selectSection=(o=>function(id){const prev=state.selected;o(id);if(prev!==id)DKKEY=null;if(dockOn())requestAnimationFrame(dockReveal)})(selectSection);
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element))return;let el;
 if(el=t.closest('[data-dkgo]')){e.stopPropagation();dkGo(el.dataset.dkgo);return}
 if(el=t.closest('[data-dkstep]')){e.stopPropagation();const tr=$('#inspector .dk-track');if(!tr)return;const all=[...tr.querySelectorAll('.dk-slide')].map(s=>s.dataset.dk);const i=Math.max(0,all.indexOf(DKKEY));dkGo(all[Math.min(all.length-1,Math.max(0,i+(+el.dataset.dkstep)))]);return}},true);
document.addEventListener('click',()=>setTimeout(dockSync,0));
addEventListener('resize',()=>{clearTimeout(dockSync._t);dockSync._t=setTimeout(dockSync,150)});

/* ---------- one toolbar while designing; every edit box opens at the bottom ---------- */
Object.assign(P,{left:P.l,right:P.r,chev:'<path d="m6 9 6 6 6-6"/>'});
const OBW=()=>innerWidth;
function oneBarInit(){const pb=$('.prevbar');if(!pb||$('#obApp'))return;
 const logo=$('header.top .brandlogo');const app=document.createElement('button');app.type='button';app.id='obApp';app.className='btn sm ob-app';app.setAttribute('aria-haspopup','menu');app.setAttribute('aria-label','Main menu');
 app.innerHTML=`<span class="ob-burg">${ic('menu',17)}</span>${logo?logo.querySelector('.lg-l').outerHTML+logo.querySelector('.lg-d').outerHTML:''}${ic('chev',13)}`;pb.insertBefore(app,pb.firstChild);
 const pg=document.createElement('button');pg.type='button';pg.id='obPage';pg.className='btn sm ob-page';pg.setAttribute('aria-haspopup','menu');$('#dsBtn').after(pg);
 const mo=document.createElement('button');mo.type='button';mo.id='obMore';mo.className='btn sm ob-more';mo.setAttribute('aria-haspopup','menu');mo.setAttribute('aria-label','More');mo.innerHTML=ic('dots',16);$('.prevbar .next-btn').before(mo)}
function oneBarSync(){oneBarInit();const on=state.tab==='builder';document.body.classList.toggle('one-bar',on);const pg=$('#obPage');if(pg){const i=state.pages.findIndex(p=>p.id===state.pageId),p=state.pages[i]||state.pages[0];pg.innerHTML=`${ic(i<=0?'home':'filePlus',14)}<span class="obp-n">${esc(p?p.name:'Home')}</span>${state.pages.length>1?`<small>${state.pages.length}</small>`:''}${ic('chev',13)}`;pg.title='Pages: switch, add or manage pages'}
 const mb=$('#modeBtn');if(mb){const d=state.brand.mode==='dark';mb.innerHTML=`${ic(d?'moon':'sun',15)}<span>${d?'Dark':'Light'}</span>`;mb.title=`Showing the ${d?'dark':'light'} version. Click to switch.`}}
let OBM=null;
function obMenuClose(){if(OBM){OBM.el.remove();OBM.btn.setAttribute('aria-expanded','false');OBM=null}}
function obMenu(btn,html){const same=OBM&&OBM.btn===btn;obMenuClose();if(same)return;ask0();const el=document.createElement('div');el.className='ob-menu';el.setAttribute('role','menu');el.innerHTML=html;document.body.appendChild(el);OBM={el,btn};btn.setAttribute('aria-expanded','true');
 const r=btn.getBoundingClientRect();el.style.top=(r.bottom+6)+'px';el.style.left=Math.max(8,Math.min(r.left,innerWidth-el.offsetWidth-8))+'px'}
const obItem=(attrs,icon,label,sub,on)=>`<button type="button" role="menuitem" class="obm-i${on?' on':''}" ${attrs}>${icon?ic(icon,16):''}<span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span></button>`;
function appMenuHtml(){const tabs=$$('header.top .tabs .tab').map(b=>obItem(`data-tab="${b.dataset.tab}"`,{builder:'edit',designs:'folder',dashboard:'chat',plans:'card',admin:'lock'}[b.dataset.tab]||'info',b.textContent.trim(),'',b.dataset.tab===state.tab)).join('');const cp=$('#cartPill');
 return `<div class="obm-h">Think Web Pros Studio</div>${tabs}${cp&&cp.textContent.trim()?`<div class="obm-sep"></div>${obItem('data-tab="plans"','bag','Your plan',esc(cp.textContent.trim()))}`:''}<div class="obm-sep"></div>${obItem('data-helpopen','help','Help &amp; tutorial','Search tips or replay the tour')}`}
function pageMenuHtml(){return `<div class="obm-h">Pages</div>${state.pages.map((p,i)=>obItem(`data-gopage="${p.id}"`,i===0?'home':(p.icon&&P[p.icon]?p.icon:'filePlus'),esc(p.name),p.nav===false?'Not in the menu':'',p.id===state.pageId)).join('')}<div class="obm-sep"></div>${obItem('data-pageadd','plus','Add page')}${obItem('data-pagesmgr','menu','Pages &amp; menu','Rename, reorder and menu style')}`}
function moreMenuHtml(){const w=OBW(),d=state.brand.mode==='dark';let h='';
 if(w<=420)h+=obItem('data-toggle="lib"','menu','Sections','Add, move or remove sections');
 if(w<=600)h+=obItem('data-obredo','restart','Redo','',false).replace('<svg','<svg style="transform:scaleX(-1)"');
 if(w<=900){h+=`<div class="obm-h">Preview</div>`+[['desktop','Computer'],['tablet','Tablet'],['phone','Phone']].map(([k,l])=>obItem(`data-obdev="${k}"`,k,l,'',state.device===k)).join('');if(w<=600)h+=obItem('data-mode="toggle"',d?'sun':'moon',d?'Show light version':'Show dark version');h+=obItem('data-fullgo','full','Full screen','See your site the way visitors do')}
 h+=`<div class="obm-h">Design</div>${obItem('data-dsact="save"','save','Save to My designs')}${obItem('data-dsact="copy"','copy','Save as a copy')}${obItem('data-dsact="new"','plus','New design')}${obItem('data-dsact="all"','folder','Open My designs')}${obItem('data-dsact="quick"','spark','Quick start form')}${obItem('data-dsact="over"','restart','Start over')}`;if(w<=900)h+=`<div class="obm-sep"></div>${obItem('data-helpopen','help','Help &amp; tutorial','')}`;return h}
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element))return;let el;
 if(el=t.closest('#obApp')){e.stopPropagation();obMenu(el,appMenuHtml());return}
 if(el=t.closest('#obPage')){e.stopPropagation();obMenu(el,pageMenuHtml());return}
 if(el=t.closest('#obMore')){e.stopPropagation();obMenu(el,moreMenuHtml());return}
 if(el=t.closest('[data-obredo]')){e.stopPropagation();obMenuClose();redo();return}
 if(el=t.closest('[data-obdev]')){e.stopPropagation();obMenuClose();setDevice(el.dataset.obdev);return}
 if(OBM&&t.closest('.ob-menu [role=menuitem]')){setTimeout(obMenuClose,0);return}
 if(OBM&&!t.closest('.ob-menu'))obMenuClose()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&OBM)obMenuClose()});
addEventListener('resize',()=>{obMenuClose()});
renderPagebar=(o=>function(){o.apply(this,arguments);oneBarSync()})(renderPagebar);
setTab=(o=>function(t){obMenuClose();o(t);oneBarSync();dockSync()})(setTab);

/* Business and Style open in the bottom pane too, split into slides */
function dockifyGeneric(){const ins=$('#inspector');if(!ins||ins.querySelector(':scope>.dk-track'))return;const kids=[...ins.children];if(!kids.length)return;
 const slides=[];let cur=null;const used={};const key=k=>{k=k.toLowerCase().replace(/\W+/g,'')||'x';used[k]=(used[k]||0)+1;return used[k]>1?k+used[k]:k};
 const start=(t,icon)=>{cur=dkSlide(key(t),t,[],icon);slides.push(cur);return cur};
 if(state.rightTab==='info'){for(const k of kids){if(k.matches('.bf')){const l=k.querySelector('.bf-l label');start((l?l.childNodes[0].textContent:'Details').trim(),'info').appendChild(k)}else (cur||start('Your business','info')).appendChild(k)}}
 else{for(const k of kids){if(k.matches('.sectitle')){start(k.textContent.trim(),'edit');k.remove();continue}(cur||start('Style','edit')).appendChild(k)}}
 if(!slides.length)return;dockMount(ins,slides)}
function dockMount(ins,slides){const tr=document.createElement('div');tr.className='dk-track';tr.setAttribute('role','group');tr.setAttribute('aria-label','Settings, swipe for more');slides.forEach(s=>tr.appendChild(s));ins.appendChild(tr);
 const hd=$('#fInsp .insp-tabs');let nav=hd.querySelector('.dk-nav');if(!nav){nav=document.createElement('div');nav.className='dk-nav';hd.insertBefore(nav,hd.lastElementChild)}
 nav.innerHTML=`<button type="button" class="iconbtn dk-arr" data-dkstep="-1" aria-label="Previous">${ic('left',16)}</button><div class="dk-chips" role="tablist">${slides.map(s=>`<button type="button" role="tab" data-dkgo="${s.dataset.dk}">${esc(s.getAttribute('aria-label'))}</button>`).join('')}</div><button type="button" class="iconbtn dk-arr" data-dkstep="1" aria-label="Next">${ic('right',16)}</button>`;
 tr.addEventListener('scroll',()=>{if(DK_LOCK)return;clearTimeout(tr._t);tr._t=setTimeout(()=>{dkMark(dkNearest(tr))},60)},{passive:true});
 const k=DKK[state.rightTab],target=k&&tr.querySelector(`[data-dk="${k}"]`);if(target)dkTo(tr,target);dkMark(target?k:slides[0].dataset.dk)}
const DKK={};
dkMark=(o=>function(k){o(k);DKK[state.rightTab]=k})(dkMark);
dockOn=()=>state.tab==='builder'&&state.inspOpen;
renderInspector=(o=>function(){o.apply(this,arguments);if(dockOn()&&state.rightTab!=='section')dockifyGeneric();if(dockOn()&&state.rightTab==='section'&&!sec(state.selected)){const n=$('#fInsp .dk-nav');if(n)n.innerHTML=''}})(renderInspector);

/* Pages & menu opens as a bottom pane with slides, so the page stays in view */
pagesMgr=(o=>function(){o.apply(this,arguments);const m=$('#pgMgr');if(!m||state.tab!=='builder')return;const bg=m.closest('.modal-bg');bg.classList.add('dock-bg');m.classList.add('dock-modal');
 const kids=[...m.children].filter(k=>!k.matches('.modal-h'));const slides=[];let cur=null;
 for(const k of kids){if(k.matches('.sectitle')){cur=dkSlide('pages',k.textContent.trim(),[],'filePlus');slides.push(cur);k.remove();continue}
  if(k.matches('.hp-dev')){const b=k.querySelector('.hp-h b');cur=dkSlide(b&&/phone/i.test(b.textContent)?'phone':'computer',b?b.textContent.trim():'Menu',[k],b&&/phone/i.test(b.textContent)?'phone':'desktop');slides.push(cur);continue}
  if(k.matches('.row')&&k.querySelector('[data-closemodal]')){m.querySelector('.modal-h').appendChild(k);k.className='pm-done';continue}
  (cur||(cur=dkSlide('pages','Pages',[],'filePlus'),slides.push(cur),cur)).appendChild(k)}
 const tr=document.createElement('div');tr.className='dk-track';slides.forEach(s=>tr.appendChild(s));m.appendChild(tr);
 const k=DKK.pm;const t=k&&tr.querySelector(`[data-dk="${k}"]`);if(t)dkTo(tr,t);tr.addEventListener('scroll',()=>{DKK.pm=dkNearest(tr)},{passive:true})})(pagesMgr);

/* ---------- AI logo maker: wait for the live AI, recover from odd replies, and outside AI tools ---------- */
let SAMPLE_P=null,lmNoted=false;
function lmSampleReady(){if(SAMPLE)return Promise.resolve(SAMPLE);if(!SAMPLE_P)SAMPLE_P=new Promise(res=>{try{if(window.claude&&typeof window.claude.use==='function'){const t=setTimeout(()=>res(null),10000);window.claude.use('sample').then(s=>{clearTimeout(t);res(s||null)},()=>{clearTimeout(t);res(null)})}else res(null)}catch(e){res(null)}}).then(s=>{SAMPLE=s;const m=$('#lmMode');if(m)m.outerHTML=lmModeHtml();return s});return SAMPLE_P}
function lmParse(txt){const s=String(txt||'');const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)return null;try{return JSON.parse(s.slice(a,b+1))}catch(e){return null}}
async function lmJson(prompt,signal){try{return await SAMPLE.json(prompt,{modelTier:'default',cache:false,signal})}catch(e){const c=e&&e.code;if(['cancelled','not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed','rate_limited','session_expired','refused'].includes(c))throw e;
 const r=await SAMPLE(prompt+'\nReturn the JSON object only, with no other text.',{modelTier:'default',cache:false,signal});const o=lmParse(r&&r.text);if(!o)throw e;return o}}

const LM_EXT=[
 {k:'chatgpt',n:'ChatGPT',u:q=>`https://chatgpt.com/?q=${q}`,note:'Makes logo images'},
 {k:'claude',n:'Claude',u:q=>`https://claude.ai/new?q=${q}`,note:'Makes SVG logo files',svg:true},
 {k:'grok',n:'Grok',u:q=>`https://grok.com/?q=${q}`,note:'Makes logo images'},
 {k:'gemini',n:'Gemini',u:()=>`https://gemini.google.com/app`,note:'Paste the request'},
 {k:'copilot',n:'Copilot',u:q=>`https://copilot.microsoft.com/?q=${q}`,note:'Makes logo images'},
 {k:'ideogram',n:'Ideogram',u:()=>`https://ideogram.ai/`,note:'Great with lettering'}];
function lmExtPrompt(svg){const b=state.brand,L=LM||{};const ind=(()=>{try{const k=state.biz&&state.biz.industry;return k&&INDUSTRIES[k]?INDUSTRIES[k].label:''}catch(e){return''}})();
 const cols=[...new Set([L.shapeColor,L.textColor,b.colors.p,b.colors.a].filter(isHex).map(x=>x.toUpperCase()))].slice(0,3);
 const last=lmChat.filter(m=>m.who==='you').slice(-1)[0];
 return `Design a logo for "${L.name||b.name}"${ind?`, a ${ind.toLowerCase()}`:''}${L.tag?`, with the tagline "${L.tag}"`:''}. ${last?`What I want: ${last.text}. `:''}Use these brand colors: ${cols.join(', ')}. Keep it simple and readable at small sizes, with the business name spelled exactly right. ${svg?'Give me the logo as a downloadable SVG file with a transparent background, in a wide version (symbol beside the name) and a square version (symbol only).':'Give me a PNG on a transparent or plain white background, flat design, no mockups or 3D, in a wide version and a square version.'}`}
function lmOutsideHtml(){return `<div class="lm-ext"><div class="lm-ext-h"><b>${ic('link',14)} Design it with another AI</b><small>Sign in to the one you already use. We write the request for you, then you upload what it makes.</small></div>
 <div class="lm-ext-grid">${LM_EXT.map(x=>`<a class="lm-ext-b" href="#" data-lmext="${x.k}" rel="noopener"><b>${x.n}</b><small>${x.note}</small></a>`).join('')}</div>
 <details class="lm-ext-p"><summary>See or change the request</summary><textarea id="lmExtTxt" rows="4" aria-label="Request sent to the other AI">${esc(lmExtPrompt(false))}</textarea></details>
 <button type="button" class="btn sm lm-ext-up" data-pick="brand:logo">${ic('upload',14)} Upload the logo you made</button></div>`}
async function lmCopy(t){try{await navigator.clipboard.writeText(t);return true}catch(e){try{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();return ok}catch(e2){return false}}}
document.addEventListener('click',async e=>{const el=e.target instanceof Element&&e.target.closest('[data-lmext]');if(!el)return;e.preventDefault();e.stopPropagation();const x=LM_EXT.find(z=>z.k===el.dataset.lmext);if(!x)return;
 const ta=$('#lmExtTxt');const edited=ta&&ta.dataset.edited;const p=edited?ta.value:lmExtPrompt(!!x.svg);const url=x.u(encodeURIComponent(p));const w=window.open(url,'_blank');if(w)try{w.opener=null}catch(err){}const ok=await lmCopy(p);
 toast(`${w===null&&!ok?`Open ${x.n} at ${url.split('/')[2]} and paste your request.`:`Opening ${x.n}. Your request is ${ok?'copied, so paste it if it is not filled in already':'ready in "See or change the request"'}. When you have a logo, come back and tap Upload the logo you made.`}`)},true);
document.addEventListener('input',e=>{if(e.target&&e.target.id==='lmExtTxt')e.target.dataset.edited='1'});

/* ---------- address: suggest as you type, with live results when the network allows ---------- */
const US_ST={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY','District of Columbia':'DC'};
const AC_LIVE={},AC_OK={v:null};let acSeq=0;
function acFmt(p){const st=p.street||(p.housenumber?p.name:'')||'';const line1=[p.housenumber,st].filter(Boolean).join(' ')||p.name||'';const city=p.city||p.town||p.village||p.district||p.county||'';const state=p.countrycode==='US'?(US_ST[p.state]||p.state||''):(p.state||p.country||'');
 const tail=[city,[state,p.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');return line1&&tail?`${line1}, ${tail}`:''}
async function acLive(q){if(AC_OK.v===false)return[];if(AC_LIVE[q])return AC_LIVE[q];const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),2500);
 try{const r=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`,{signal:ctl.signal});if(!r.ok)throw 0;const j=await r.json();AC_OK.v=true;
  const f=(j.features||[]).map(x=>x.properties||{}).sort((a,b)=>(b.countrycode==='US')-(a.countrycode==='US'));const out=[...new Set(f.map(acFmt).filter(Boolean))].slice(0,5);AC_LIVE[q]=out;return out}
 catch(e){if(AC_OK.v===null)AC_OK.v=false;return[]}finally{clearTimeout(t)}}
acSuggest=(o=>function(raw){const r=o(raw);if(r.length)return r;const t=raw.trim().replace(/\s+/g,' ');if(t.length<1)return[];
 const near=[String(state.biz.address||'').split(',').slice(1).join(',').trim()].filter(x=>x&&AC_CITIES.includes(x)).concat(AC_CITIES.slice(0,3));
 if(/^\d+[a-z]?$/i.test(t))return[...new Set(near)].slice(0,3).map(c=>`${t} Main St, ${c}`);return[...new Set(near)].slice(0,3).map(c=>`${tcase(t)}, ${c}`)})(acSuggest);
function acRender(inp,list,live){let l=inp.parentElement.querySelector('.ac-list');if(!list.length){acClose();return}if(!l){l=document.createElement('ul');l.className='ac-list';l.setAttribute('role','listbox');l.id='ac-'+inp.id;inp.parentElement.appendChild(l)}
 acIdx=-1;inp.setAttribute('aria-expanded','true');
 l.innerHTML=list.map((x,i)=>{const[a,...r]=x.split(', ');return `<li role="option" id="${l.id}-${i}" data-acpick="${esc(x)}">${ic('pin',14)}<span><b>${esc(a)}</b>${r.length?`<small>${esc(r.join(', '))}</small>`:''}</span></li>`}).join('')+`<li class="ac-foot" aria-hidden="true">${live?'Matching addresses':'Suggestions'} · keep typing for more</li>`}
acShow=(o=>function(inp){o(inp);const v=inp.value.trim();clearTimeout(acShow._t);if(v.length<4||AC_OK.v===false)return;
 acShow._t=setTimeout(async()=>{const my=++acSeq;const live=await acLive(v);if(my!==acSeq||inp.value.trim()!==v||document.activeElement!==inp||!live.length)return;const loc=acSuggest(v);acRender(inp,[...new Set([...live,...loc])].slice(0,6),true)},250)})(acShow);
document.addEventListener('focusin',e=>{const t=e.target;if(t instanceof Element&&t.matches('[data-addr]')&&t.value.trim())acShow(t)});

/* ---------- food menus: drag dishes to reorder (or into another category) and delete them right on the page ---------- */
let MN_ON=null;
const MNI=(s,x)=>EDIT?` data-mnitem="${s.id}|${x._i}"${MN_ON===s.id+'|'+x._i?' data-mnon':''}`:'';
const MNC=(s,x)=>EDIT?`<span class="mn-ctl"><button type="button" class="mn-grab" data-mngrab="${s.id}|${x._i}" aria-label="Move ${esc(x.name||'dish')}. Drag, or use the arrow keys." title="Drag to move">${ic('grip',14)}</button><button type="button" class="mn-del" data-mndel="${s.id}|${x._i}" aria-label="Delete ${esc(x.name||'dish')}" title="Delete this dish">${ic('trash',13)}</button></span>`:'';
let MND=null;
function mnMove(id,from,cat,to){const s=sec(id);if(!s)return;const it=s.data.items;if(!it[from])return;snap();const[m]=it.splice(from,1);m.cat=cat;
 if(to==null){let at=-1;it.forEach((x,i)=>{if((x.cat||'Menu')===cat)at=i});if(at<0){const cats=menuCats(s.data);const ci=cats.indexOf(cat);at=it.length-1;for(let j=ci+1;j<cats.length;j++){const f=it.findIndex(x=>(x.cat||'Menu')===cats[j]);if(f>=0){at=f-1;break}}}it.splice(at+1,0,m)}
 else{if(to>from)to--;it.splice(Math.max(0,Math.min(it.length,to)),0,m)}
 if(MTAB[id]!==undefined&&cat!==MTAB[id])MTAB[id]=cat;hard()}
function mnClear(){$$('#site .mn-drop-b,#site .mn-drop-a,#site .mn-drop-in').forEach(e=>e.classList.remove('mn-drop-b','mn-drop-a','mn-drop-in'))}
function mnTarget(x,y){const g=MND.ghost;g.style.display='none';const el=document.elementFromPoint(x,y);g.style.display='';mnClear();MND.to=null;if(!el)return;
 const host=el.closest(`[data-sec="${MND.id}"]`);if(!host)return;
 const tab=el.closest('[data-mntab]');if(tab){const c=tab.dataset.mntab.split('|').slice(1).join('|');tab.classList.add('mn-drop-in');MND.to={cat:c,at:null};return}
 const it=el.closest('[data-mnitem]');if(it){const i=+it.dataset.mnitem.split('|')[1];if(i===MND.from)return;const r=it.getBoundingClientRect();const grid=it.classList.contains('mn-card');const after=grid?x>r.left+r.width/2:y>r.top+r.height/2;it.classList.add(after?'mn-drop-a':'mn-drop-b');
  const s=sec(MND.id);MND.to={cat:(s.data.items[i].cat||'Menu'),at:after?i+1:i};return}
 const grp=el.closest('[data-mngrp]');if(grp){grp.classList.add('mn-drop-in');MND.to={cat:grp.dataset.mngrp.split('|').slice(1).join('|'),at:null}}}
document.addEventListener('pointerdown',e=>{const b=e.target instanceof Element&&e.target.closest('#site [data-mngrab]');if(!b||e.button>0)return;e.preventDefault();
 const[id,i]=b.dataset.mngrab.split('|');const row=b.closest('[data-mnitem]');const r=row.getBoundingClientRect();
 const g=row.cloneNode(true);g.classList.add('mn-ghost');g.style.width=r.width+'px';g.style.left=r.left+'px';g.style.top=r.top+'px';const site=$('#site');g.setAttribute('style',g.getAttribute('style')+';'+site.getAttribute('style'));document.body.appendChild(g);
 row.classList.add('mn-lifted');MND={id,from:+i,row,ghost:g,dx:e.clientX-r.left,dy:e.clientY-r.top,to:null,moved:false,x:e.clientX,y:e.clientY};try{b.setPointerCapture(e.pointerId)}catch(err){}},true);
document.addEventListener('pointermove',e=>{if(!MND)return;e.preventDefault();MND.moved=MND.moved||Math.hypot(e.clientX-MND.x,e.clientY-MND.y)>4;MND.ghost.style.left=(e.clientX-MND.dx)+'px';MND.ghost.style.top=(e.clientY-MND.dy)+'px';mnTarget(e.clientX,e.clientY);
 const cv=$('#canvas').getBoundingClientRect(),dk=$('#fInsp.dock:not([hidden]),.dock-modal'),bot=dk&&!document.body.classList.contains('dock-side')?Math.min(cv.bottom,dk.getBoundingClientRect().top):cv.bottom;clearInterval(MND.sc);const edge=e.clientY<cv.top+50?-1:e.clientY>bot-50?1:0;if(edge)MND.sc=setInterval(()=>{$('#canvas').scrollTop+=edge*14},16)},{passive:false});
function mnEnd(ok){if(!MND)return;const d=MND;MND=null;clearInterval(d.sc);d.ghost.remove();d.row.classList.remove('mn-lifted');mnClear();if(ok&&d.moved&&d.to)mnMove(d.id,d.from,d.to.cat,d.to.at)}
document.addEventListener('pointerup',()=>mnEnd(true));document.addEventListener('pointercancel',()=>mnEnd(false));
document.addEventListener('click',e=>{const t=e.target instanceof Element&&e.target;if(!t)return;let el;
 if(el=t.closest('#site [data-mndel]')){e.preventDefault();e.stopPropagation();const[id,i]=el.dataset.mndel.split('|');const s=sec(id);if(!s||!s.data.items[+i])return;const nm=s.data.items[+i].name||'Dish';snap();s.data.items.splice(+i,1);hard();toast(`Deleted “${nm}”`,{label:'Undo',fn:undo});return}
 if(t.closest('#site [data-mngrab]')){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('keydown',e=>{const b=e.target instanceof Element&&e.target.closest('#site [data-mngrab]');if(!b||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
 const[id,i0]=b.dataset.mngrab.split('|');const i=+i0,s=sec(id);const it=s.data.items,c=it[i].cat||'Menu';const same=it.map((x,j)=>j).filter(j=>(it[j].cat||'Menu')===c);const k=same.indexOf(i);const n=same[k+(e.key==='ArrowUp'?-1:1)];if(n==null)return;
 MN_ON=id+'|'+n;mnMove(id,i,c,e.key==='ArrowUp'?n:n+1);const ni=e.key==='ArrowUp'?n:n;requestAnimationFrame(()=>{const nb=$(`#site [data-mngrab="${id}|${ni}"]`);if(nb)nb.focus()})});
document.addEventListener('pointerdown',e=>{const r=e.target instanceof Element&&e.target.closest('#site [data-mnitem]');const k=r?r.dataset.mnitem:null;if(k===MN_ON)return;MN_ON=k;$$('#site [data-mnon]').forEach(x=>x.removeAttribute('data-mnon'));if(r)r.setAttribute('data-mnon','')},true);

/* ---------- click anything on the page to edit it: footer, menu links, page background and list items jump to their own controls ---------- */
let JUMP=null;
function jumpFlash(el){if(!el)return;const f=el.closest('.li,label.fld,div.fld,details.bgx,.bf')||el;f.classList.remove('jump-flash');void f.offsetWidth;f.classList.add('jump-flash');setTimeout(()=>f.classList.remove('jump-flash'),1600)}
/* scroll the open pane to the slide holding `sel`; returns false while that pane is not showing */
function jumpTo(sel,focus){const el=$('#inspector '+sel);if(!el||!$('#inspector .dk-track'))return false;const sl=el.closest('.dk-slide');if(sl)dkGo(sl.dataset.dk);
 const d=el.closest('details');if(d)d.open=true;jumpFlash(el);if(focus&&matchMedia('(pointer:fine)').matches&&el.matches('input,textarea,select'))setTimeout(()=>el.focus({preventScroll:true}),350);return true}
/* Business and Style panes: open on the named slide (key = the slide's title in lower case, no spaces) */
function openPane(tab,key,sel,focus){JUMP=null;state.selected=null;SUB=false;HSEL=false;markSel();state.rightTab=tab;if(key)DKK[tab]=key;if(!state.inspOpen)openPanel('insp');renderInspector();
 requestAnimationFrame(()=>{const sl=key&&$(`#inspector .dk-slide[data-dk="${key}"]`);if(sel&&jumpTo(sel,focus))return;if(sl){dkGo(key);jumpFlash(sl.querySelector('input,textarea,select,details')||sl)}})}
function openPageBg(){openPane('brand','pagebackground','details.bgx');requestAnimationFrame(()=>{const d=$('#inspector [data-dk="pagebackground"] details.bgx');if(d)d.open=true})}
/* which control in the section pane belongs to the clicked spot: a marked field, or the list item (package, question, dish...) it sits in */
function jumpSel(t,s){const id=s.dataset.sec;const jl=t.closest('[data-jumpli]');if(jl&&s.contains(jl))return `[data-limove^="${id}|${jl.dataset.jumpli}|"]`;const j=t.closest('[data-jump]');if(j&&s.contains(j)){const k=j.dataset.jump;return k==='@hours'?'#h-open-0':`[data-sf="${id}|${k}"]`}
 for(let a=t;a&&a!==s.parentElement;a=a.parentElement){const keys=new Set();[a,...a.querySelectorAll('[data-edit],[data-img],[data-btn]')].forEach(e=>{const v=e.dataset&&(e.dataset.edit||e.dataset.img||e.dataset.btn);if(!v||!v.startsWith(id))return;const m=v.slice(id.length+1).match(/^(\w+)\.(\d+)(\.|$)/);if(m)keys.add(m[1]+'|'+m[2])});
  if(keys.size===1){const[l,k]=[...keys][0].split('|');return `[data-limove^="${id}|${l}|${k}|"]`}if(keys.size>1)return null}return null}
renderInspector=(o=>function(){o.apply(this,arguments);if(JUMP&&state.rightTab==='section'&&state.selected===JUMP.id&&state.inspOpen){const j=JUMP;requestAnimationFrame(()=>{if(jumpTo(j.sel))JUMP=null})}})(renderInspector);
/* decided before other handlers repaint the page (a menu link swaps the whole page), acted on after they finish */
addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element)||state.tab!=='builder')return;const go=clickEdit(t);if(go)setTimeout(go,0)},true);
function clickEdit(t){const site=t.closest('#site.edit');
 if(site){
  if(t.closest('[data-pgbg]'))return openPageBg;
  /* menu links still go to their page, then Pages & menu opens so the names and order can be changed */
  if(t.closest('.hnav [data-gopage],.mnav [data-gopage],.fnav [data-gopage],.mtab [data-gopage],.mtab [data-gosec]'))return()=>{if(!$('#pgMgr'))pagesMgr()};
  const fj=t.closest('[data-fjump]');if(fj&&!t.closest('[data-edit],[data-editb],[data-btn],a,button')){const[tab,key]=fj.dataset.fjump.split('|');return()=>openPane(tab,key,null,true)}
  const s=t.closest('.sec[data-sec]');if(s){if(t.closest('.sec-pill,.sec-grab,.sec-tools'))return null;const sel=jumpSel(t,s),id=s.dataset.sec;JUMP=sel?{id,sel}:null;
   return sel?()=>{if(JUMP&&state.selected===id&&state.inspOpen&&jumpTo(sel))JUMP=null}:null}
  /* bare page between or around sections */
  return t===site||t.matches('.sframe,.smain,.es-bar,.chat-dock')?openPageBg:null}
 /* the gray space around the preview */
 return (t.matches('.pane.prev')||t.closest('.dv-shell,#canvas'))&&!t.closest('#site,button,a,input,select,textarea,[role=button],label,.bp,.cpop')?openPageBg:null}
/* ---------- design hold: without a plan a design is kept for 1 hour; Design storage keeps every design for $20/month ----------
   The clock starts when a design is started (first section added) and is not reset by saving, autosaving or copying.
   Placing a plan order or buying Design storage in this browser sets state.keep, which stops the clock for every design.
   Until accounts exist this is enforced in the customer's browser only. */
const HOLD_KEY='twp-hold-v1';
const holdMs=()=>Math.max(.25,+((admin.storage||{}).hours)||1)*36e5;
const storagePrice=()=>+((admin.storage||{}).price)||20;
const holdHours=()=>{const h=Math.max(.25,+((admin.storage||{}).hours)||1);return h===1?'1 hour':h<1?Math.round(h*60)+' minutes':h+' hours'};
const holdOf=d=>d&&(d.hold||d.created||d.at);
const holdStart=()=>{const d=curDesign();return d?holdOf(d):state.draftAt};
const holdLeftOf=start=>state.keep||!start?Infinity:start+holdMs()-Date.now();
const holdLeft=()=>holdLeftOf(holdStart());
const holdClock=start=>new Date(start+holdMs()).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
function holdLeftText(ms){if(ms>=6e5){const t=Math.ceil(ms/6e4),h=Math.floor(t/60),m=t%60;return h?`${h} hr${m?' '+m+' min':''}`:m+' min'}const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
const keepLabel=()=>state.keep?(state.keep.kind==='storage'?'Design storage':'your plan'):'';
/* first run after this policy shipped: designs made before it get a fresh hour instead of vanishing at once */
function holdMigrate(){let v=null;try{v=localStorage.getItem(HOLD_KEY)}catch(e){}if(v)return;const now=Date.now();
 DESIGNS.forEach(d=>{d.hold=now;designStore(d).catch(()=>{})});if(state.sections.length)state.draftAt=now;save();try{localStorage.setItem(HOLD_KEY,'1')}catch(e){}}
/* remove designs whose free hour is up; the open one only on page load, so nobody loses work mid-edit without being asked */
function holdPurge(onLoad){if(state.keep||!designsReady)return 0;let n=0;
 let open=false;DESIGNS.filter(d=>holdLeftOf(holdOf(d))<=0&&(onLoad||d.id!==state.designId)).forEach(d=>{DESIGNS=DESIGNS.filter(x=>x!==d);designDrop(d.id);n++;if(d.id===state.designId){open=true;clearDesign()}});
 if(onLoad&&!open&&state.sections.length&&!curDesign()&&holdLeftOf(state.draftAt)<=0){clearDesign();n++}
 if(n){save();if(state.tab==='designs')renderDesigns()}return n}
function clearDesign(){const B=state.brand,def=defaultState().brand;state.brand={...def,name:state.biz.name||B.name,tagline:B.tagline,logo:B.logo,logoSize:B.logoSize,showName:B.showName};
 state.sections=[];state.pages=null;state.pageId='home';state.started=false;state.selected=null;state.designId=null;state.designName='Untitled design';state.draftAt=null;Object.keys(ssIdx).forEach(k=>delete ssIdx[k])}
function holdExpireNow(){const d=curDesign();if(d){DESIGNS=DESIGNS.filter(x=>x!==d);designDrop(d.id)}clearDesign();hist.length=0;fut.length=0;DIRTY=false;closeModal();state.tab='builder';hard();toast('Cleared. Here is a fresh blank page.')}
function holdInfo(){const left=holdLeft(),s=holdStart();
 if(state.keep){ask({icon:'save',title:'Your designs are kept',body:`${keepLabel()==='Design storage'?`You have <b>Design storage</b> (${money(storagePrice())}/month), so`:'You chose a plan, so'} ${esc(admin.company)} keeps every design you save. Nothing expires.`,btns:[['Close','pri']]});return}
 ask({icon:'clock',title:`Designs are kept free for ${holdHours()}`,body:`Without a plan, ${esc(admin.company)} keeps a design for ${holdHours()} from when you start it. ${s&&left>0?`This one is kept until <b>${holdClock(s)}</b> (${holdLeftText(left)} left). `:''}Saving and autosave keep it current but do not add time.<br><br>To keep it longer, choose a plan, or add <b>Design storage for ${money(storagePrice())}/month</b> to keep all your designs without choosing a plan yet.`,btns:[['Close',''],['See plans','',()=>setTab('plans')],[`Keep my designs · ${money(storagePrice())}/mo`,'pri',openStorage]]})}
let HOLD_ASKED=false,HOLD_WARNED=0;
function holdExpiredAsk(){HOLD_ASKED=true;ask({icon:'clock',tone:'warn',title:'Your free hour is up',body:`Without a plan, designs are kept for ${holdHours()}. To keep <b>${esc(state.designName)}</b>, add <b>Design storage</b> for ${money(storagePrice())}/month or choose a plan. Otherwise it is cleared, and anything still here is removed when you leave the studio.`,btns:[['Clear it and start new','warn',holdExpireNow],['See plans','',()=>setTab('plans')],[`Keep it · ${money(storagePrice())}/mo`,'pri',openStorage]]})}
function holdPill(){const cv=$('#canvas');if(!cv)return;let w=$('#holdWrap');const left=holdLeft();
 if(!isFinite(left)||state.tab!=='builder'){if(w)w.hidden=true;return}
 if(!w){w=document.createElement('div');w.id='holdWrap';w.className='hold-wrap';w.innerHTML='<button type="button" class="hold-pill" data-holdinfo></button>'}
 /* top of the preview on wide screens; bottom on phones, where the section toolbar sits at the top */
 const low=innerWidth<=760;w.classList.toggle('at-bottom',low);if(low?cv.lastElementChild!==w:cv.firstElementChild!==w)low?cv.append(w):cv.prepend(w);
 w.hidden=false;const b=w.firstChild,soon=left<6e5,out=left<=0;b.classList.toggle('low',soon);b.classList.toggle('out',out);
 const txt=out?'Free hour is up · Keep it':`Kept free ${holdLeftText(left)} more · <u>Keep it</u>`;if(b.dataset.t!==txt){b.dataset.t=txt;b.innerHTML=`${ic('clock',13)}<span>${txt}</span>`}
 b.title=out?'Designs without a plan are kept for '+holdHours():`Without a plan this design is kept until ${holdClock(holdStart())}. Click to keep it longer.`}
function holdTick(){if(!designsReady)return;
 if(!state.draftAt&&state.sections.length&&!state.keep){state.draftAt=Date.now();save()}
 holdPurge(false);holdPill();if(state.keep)return;const left=holdLeft();
 if(left<=6e5&&left>0&&HOLD_WARNED!==holdStart()){HOLD_WARNED=holdStart();toast(`${holdLeftText(left)} left on this design's free hour. Keep it with Design storage (${money(storagePrice())}/mo) or a plan.`,{label:'Keep it',fn:openStorage})}
 if(left<=0&&state.tab==='builder'&&!$('#modalRoot').innerHTML.trim()&&!document.body.classList.contains('tour-open'))holdExpiredAsk()}
/* Design storage checkout: same order flow as plans, shows in Admin > Orders */
function openStorage(){const b=state.biz||{},n=DESIGNS.length+(curDesign()||!state.sections.length?0:1);
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><form class="modal" id="storageForm" role="dialog" aria-label="Design storage"><div class="modal-h"><div><h2>Keep my designs</h2><p class="muted">Not ready to choose a plan? Design storage keeps all your designs for <b>${money(storagePrice())}/month</b>. Cancel any time, and it stops when you choose a plan.</p></div><button type="button" class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div>
 <p class="demo-note">Prototype checkout. No card is charged yet; the order goes to the admin dashboard. Designs stay in this browser until accounts are added.</p>
 <div class="grid2f"><label class="fld"><span>Your name</span><input type="text" id="st-name" required autocomplete="name"></label><label class="fld"><span>Business</span><input type="text" id="st-biz" required value="${esc(b.name||state.brand.name||'')}" autocomplete="organization"></label>
 <label class="fld"><span>Email</span><input type="email" id="st-email" required value="${esc(b.email||'')}" autocomplete="email"></label><label class="fld"><span>Phone</span><input type="text" inputmode="tel" id="st-phone" value="${esc(b.phone||'')}" autocomplete="tel"></label></div>
 <div class="grid2f"><label class="fld"><span>Card number</span><input type="text" id="st-card" inputmode="numeric" placeholder="4242 4242 4242 4242"></label><label class="fld"><span>Expiry / CVC</span><input type="text" id="st-exp" placeholder="12/28 · 123"></label></div>
 <div class="sum-tot"><div class="big"><span>Design storage</span><b class="num">${money(storagePrice())}/month</b></div><div class="sum-line"><span>Designs kept</span><span class="num">${n?n+' now, and any you add':'Every design you save'}</span></div></div>
 <div class="row" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-closemodal>Cancel</button><button class="btn pri" type="submit">Start Design storage</button></div></form></div>`;
 setTimeout(()=>$('#st-name')?.focus(),30)}
function placeStorage(){const v=id=>$('#'+id).value.trim();const o={id:'TWP-'+(admin.nextOrder++),kind:'storage',at:Date.now(),business:v('st-biz'),owner:v('st-name'),email:v('st-email'),phone:v('st-phone'),plan:'storage',addons:[],pos:null,hw:{},setup:0,monthly:storagePrice(),annual:false,status:'New',designs:DESIGNS.length+(curDesign()||!state.sections.length?0:1)};
 admin.orders.push(o);admin.customers.push({id:uid(),business:o.business,owner:o.owner,plan:'storage',addons:[],pos:null,vol:0,status:'Live',mrr:o.monthly,since:Date.now()});
 state.keep={kind:'storage',order:o.id,at:Date.now()};save();
 if(window.TWP)TWP.submitOrder(o,state);holdPill();if(state.tab==='designs')renderDesigns();
 $('#modalRoot').innerHTML=`<div class="modal-bg" data-modalbg><div class="modal" role="dialog" aria-label="Design storage started"><div class="modal-h"><h2>Your designs are kept</h2><button class="iconbtn" data-closemodal aria-label="Close">${ic('x',18)}</button></div><p>Thanks, ${esc(o.owner.split(' ')[0]||'there')}. Design storage is on at ${money(o.monthly)}/month, so nothing you save expires. ${esc(admin.company)} will email ${esc(o.email)} a receipt. Order ${o.id}.</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn pri" data-closemodal>Keep designing</button></div></div></div>`}
document.addEventListener('click',e=>{const t=e.target instanceof Element&&e.target;if(!t)return;
 if(t.closest('[data-holdinfo]')){e.stopPropagation();holdInfo();return}
 if(t.closest('[data-storage]')){e.stopPropagation();openStorage();return}},true);
document.addEventListener('submit',e=>{if(e.target.id==='storageForm'){e.preventDefault();e.stopPropagation();placeStorage()}},true);
(function holdStartup(){const go=()=>{if(!designsReady){setTimeout(go,100);return}holdMigrate();const n=holdPurge(true);if(n){hard();toast(`Designs are kept for ${holdHours()} without a plan. ${n===1?'1 older design was':n+' older designs were'} cleared.`,{label:'Why?',fn:holdInfo})}holdTick();setInterval(holdTick,1000)};go()})();

/* ---------- full screen: hide the studio and show the site edge to edge, the way a visitor sees it ---------- */
Object.assign(P,{full:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',fullx:'<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>'});
let FULL=null;
const fsDoc=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
function fullBtn(){let b=$('#fullExit');if(b)return b;b=document.createElement('button');b.type='button';b.id='fullExit';b.className='full-exit';b.setAttribute('data-fullx','');b.setAttribute('aria-label','Exit full screen');b.innerHTML=`${ic('fullx',16)}<span>Exit full screen</span>`;document.body.appendChild(b);return b}
function fullWake(){const b=$('#fullExit');if(!b)return;b.classList.remove('idle');const tb=$('#site .mtab');b.style.bottom=tb&&tb.offsetHeight&&innerWidth<=600?`calc(${Math.round(innerHeight-tb.getBoundingClientRect().top)+12}px + env(safe-area-inset-bottom,0px))`:'';clearTimeout(fullWake._t);fullWake._t=setTimeout(()=>b.classList.add('idle'),2600)}
function fullOn(){if(FULL||state.tab!=='builder'||!state.onboarded)return;const a=document.activeElement;if(a&&a.blur)a.blur();
 obMenuClose();closeColorPop();closeModal();ask0();$('#toasts').innerHTML='';FULL={native:false};document.body.classList.add('full-on');
 const site=$('#site');site.classList.remove('edit');paintSite(site,false);fullBtn();fullWake();
 const r=document.documentElement,go=r.requestFullscreen||r.webkitRequestFullscreen;
 if(go){try{const pr=go.call(r);FULL.native=true;if(pr&&pr.catch)pr.catch(()=>{if(FULL)FULL.native=false})}catch(e){FULL.native=false}}
 requestAnimationFrame(()=>{fitDevice();$('#canvas').scrollTop=0});
 toast(matchMedia('(hover:hover)').matches?'Full screen. Press Esc to go back to editing.':'Full screen. Tap Exit full screen to go back to editing.')}
function fullOff(){if(!FULL)return;const nat=fsDoc();FULL=null;document.body.classList.remove('full-on');clearTimeout(fullWake._t);const b=$('#fullExit');if(b)b.remove();$('#toasts').innerHTML='';
 if(nat){const x=document.exitFullscreen||document.webkitExitFullscreen;if(x)try{const pr=x.call(document);if(pr&&pr.catch)pr.catch(()=>{})}catch(e){}}
 const site=$('#site');site.classList.add('edit');paintSite(site,true);requestAnimationFrame(()=>{fitDevice();dockSync()})}
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,()=>{if(FULL&&FULL.native&&!fsDoc())fullOff();else if(FULL)requestAnimationFrame(fitDevice)}));
document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element))return;
 if(t.closest('[data-fullgo]')){e.stopPropagation();obMenuClose();fullOn();return}
 if(t.closest('[data-fullx]')){e.stopPropagation();fullOff()}},true);
document.addEventListener('keydown',e=>{if(FULL&&e.key==='Escape'&&!$('.pf-lb')){e.preventDefault();fullOff()}});
['pointermove','pointerdown','scroll'].forEach(ev=>document.addEventListener(ev,()=>{if(FULL)fullWake()},{passive:true,capture:true}));
renderSites=(o=>function(){if(FULL&&state.tab==='builder'){paintSite($('#site'),false);renderUrl();return}return o.apply(this,arguments)})(renderSites);
renderBuilder=(o=>function(){const r=o.apply(this,arguments);if(FULL){const s=$('#site');s.classList.remove('edit');paintSite(s,false)}return r})(renderBuilder);
fitDevice=(o=>function(){o.apply(this,arguments);const d=$('#device');if(FULL&&d&&state.device==='desktop'&&innerWidth>=1024){d.style.zoom='';d.style.width='100%';d.style.maxWidth='none';d.classList.remove('fitted')}})(fitDevice);

/* ---------- init ---------- */
window.addEventListener('resize',()=>{if(state.tab==='dashboard')fitMini();if(!$('#v-start').hidden)fitObMinis()});
const h=(location.hash||'').slice(1);if(['builder','designs','dashboard','plans','admin'].includes(h))state.tab=h;if(h==='quote'||h==='storage')state.tab='plans';
designsLoad();
if(!$('#v-'+state.tab))state.tab='builder';
if(isNarrow()){state.libOpen=false;state.inspOpen=false}
if(innerWidth<=760&&state.device!=='phone')state.device='phone';
pagesInit();
if(!state.announce||state.announce.v!==2)state.announce={on:false,text:'',v:2,style:'bar',speed:'normal',size:'md',where:'all',close:false};
hard();
if(h==='quote')openQuote();
if(h==='storage')openStorage();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(state.tab==='dashboard')fitMini()});
})();
