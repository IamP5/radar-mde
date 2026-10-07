import { chromium } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 11; SM-A022M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8}); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
const reqs=[]; p.on('requestfinished',async r=>{const s=await r.sizes().catch(()=>null); reqs.push({u:r.url().replace(B,''),kb:Math.round(((s?.responseBodySize||0)+(s?.responseHeadersSize||0))/1024)})});
// journey: home -> search -> city
let t0=Date.now();
await p.goto(B+'/',{waitUntil:'load'});
await p.getByText('Digite o nome da sua cidade').first().tap();
const input = p.locator('[cmdk-input]').first(); await input.waitFor({timeout:30000});
await input.type('conceicao do almeida',{delay:30}); await p.locator('[cmdk-item]').first().waitFor();
await p.locator('[cmdk-item]').first().tap(); await p.waitForURL(/conceicao-do-almeida/,{timeout:60000});
await p.getByText(/Em 2025, aplicou/).first().waitFor();
console.log('journey home->verdict ms', Date.now()-t0);
await p.waitForLoadState('networkidle');
const tot=reqs.reduce((a,x)=>a+x.kb,0); console.log('journey total KB',tot, 'rsc/prefetch', JSON.stringify(reqs.filter(r=>/_rsc|\/geo\/|\/data\//.test(r.u)).map(r=>r.u.slice(0,50)+':'+r.kb)));
const hero = (await p.locator('main').innerText()).split('\n').find(l=>/Em 2025, aplicou/.test(l)); console.log('HERO', hero);
await p.screenshot({path:'a360_city_top.png'});
// naming
console.log('nav', (await p.locator('nav a').allInnerTexts()).slice(0,6).join('|'));
const w = p.locator('button[aria-pressed]').first(); console.log('watch label', (await w.innerText()).trim()); await w.tap(); await p.waitForTimeout(400); console.log('after tap', (await w.innerText()).trim(), (await w.innerHTML()).match(/lucide-([a-z-]+)/)?.[1]);
// targets
const small = await p.evaluate(()=>[...document.querySelectorAll('a,button,[role=tab],[role=radio]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<24}).map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,20)+':'+Math.round(e.getBoundingClientRect().height)));
console.log('targets <24 (visual box)', small.length, small.join(' | '));
// effective hit area of glossary triggers via elementFromPoint 4px above/below
const hit = await p.evaluate(()=>{const g=[...document.querySelectorAll('button')].filter(e=>/decoration-dotted|underline-offset/.test(e.className)).slice(0,6);return g.map(e=>{const r=e.getBoundingClientRect();const cx=r.left+r.width/2;let up=0,dn=0;for(let d=1;d<16;d++){const el=document.elementFromPoint(cx,r.top-d);if(el&&(el===e||e.contains(el)))up=d;else break}for(let d=1;d<16;d++){const el=document.elementFromPoint(cx,r.bottom+d);if(el&&(el===e||e.contains(el)))dn=d;else break}return e.innerText.trim()+':'+Math.round(r.height)+'+'+up+'+'+dn;});});
console.log('glossary hit (h+up+down)', hit.join(' | '));
console.log('errs', errs); await b.close();
