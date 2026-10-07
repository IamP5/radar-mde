import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 11; SM-A022M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto(B+'/pi/bom-principio-do-piaui',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
await p.screenshot({path:'a360_city_top.png'});
const ov = await p.evaluate(()=>document.documentElement.scrollWidth); console.log('scrollWidth',ov);
// watch tap twice repro
const w = p.locator('button[aria-pressed]').first();
for (let i=0;i<2;i++){ await w.tap(); await p.waitForTimeout(300); console.log('tap',i,await w.getAttribute('aria-pressed'), (await w.innerHTML()).match(/lucide-([a-z-]+)/)?.[1], (await w.innerText()).trim()); }
await w.tap(); await p.waitForTimeout(300);
// chart tap & focus ring repeat
const c = p.locator('.recharts-wrapper').first(); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox();
await p.touchscreen.tap(bb.x+bb.width*0.5, bb.y+bb.height*0.4); await p.waitForTimeout(500);
await p.screenshot({path:'a360_chart_tap.png'});
const focus = await p.evaluate(()=>{const a=document.activeElement;return a.tagName+' '+(a.getAttribute('class')||'')+' outline:'+getComputedStyle(a).outlineStyle+' '+getComputedStyle(a).outlineColor});
console.log('active after chart tap', focus);
// tap elsewhere to dismiss
await p.touchscreen.tap(20, bb.y-40); await p.waitForTimeout(500);
console.log('tooltip after tapping outside', await p.locator('.recharts-tooltip-wrapper').first().evaluate(e=>getComputedStyle(e).visibility));
// Watchlist page
const t0=Date.now(); const reqs=[]; p.on('response',r=>{if(r.url().includes('/data/'))reqs.push(r.url().replace(B,''))});
await p.goto(B+'/acompanhar',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
console.log('acompanhar', Date.now()-t0,'ms', reqs);
await p.screenshot({path:'a360_acompanhar.png',fullPage:true});
// Explorar
await p.goto(B+'/explorar',{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
console.log('explorar scrollWidth', await p.evaluate(()=>document.documentElement.scrollWidth));
await p.screenshot({path:'a360_explorar.png'});
// home 360
await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
await p.screenshot({path:'a360_home.png'});
console.log('errs',errs); await b.close();
