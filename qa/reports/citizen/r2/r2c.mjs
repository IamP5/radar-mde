import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 11; SM-A022M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto(B+'/pi/bom-principio-do-piaui',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
// glossary dismiss
const t = p.locator('button',{hasText:/^MDE$/}).first(); await t.tap(); await p.waitForTimeout(500);
const vis = async()=> p.getByText('Manutenção e Desenvolvimento do Ensino: o dinheiro').first().isVisible().catch(()=>false);
console.log('popover open', await vis());
await p.touchscreen.tap(340, 120); await p.waitForTimeout(500); console.log('after outside tap open?', await vis());
await t.tap(); await p.waitForTimeout(400); await p.mouse.wheel(0,600); await p.waitForTimeout(600); console.log('after scroll open?', await vis());
// Fundeb chart axis
const fund = p.getByText('% do Fundeb pago aos profissionais').first(); await fund.scrollIntoViewIfNeeded();
const panel = fund.locator('xpath=ancestor::*[contains(@class,"rounded")][1]'); await p.waitForTimeout(500);
await panel.screenshot({path:'a360_fundeb_chart.png'});
const ticks = await panel.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return e.textContent+'@'+Math.round(r.left)}));
const pl = Math.round((await panel.boundingBox()).x); console.log('fundeb y ticks', ticks, 'panel left', pl);
for (const name of ['% da receita de impostos aplicado','Investimento por aluno']){ const pn=p.getByText(name).first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]'); const tk=await pn.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').evaluateAll(es=>es.map(e=>e.textContent+'@'+Math.round(e.getBoundingClientRect().left))); console.log(name,tk); }
// full page 360 screenshot segments
const H = await p.evaluate(()=>document.documentElement.scrollHeight); console.log('H',H,'sw',await p.evaluate(()=>document.documentElement.scrollWidth));
await p.evaluate(()=>scrollTo(0,0));
await p.screenshot({path:'a360_city_top.png'});
// nd city
await p.goto(B+'/rn/porto-do-mangue',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
await p.screenshot({path:'a360_nd_city.png'});
const sh = p.getByRole('button',{name:/Compartilhar/}); await sh.tap(); await p.waitForTimeout(400);
const [pop] = await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null), p.getByRole('menuitem',{name:/WhatsApp/}).tap()]);
console.log('nd share', pop && decodeURIComponent(pop.url()).slice(0,300)); if(pop) await pop.close();
// watchlist: star 2 cities then visit
await p.goto(B+'/ba/conceicao-do-almeida',{waitUntil:'networkidle'}); await p.locator('button[aria-pressed]').first().tap(); await p.waitForTimeout(300);
await p.goto(B+'/pi/bom-principio-do-piaui',{waitUntil:'networkidle'}); await p.locator('button[aria-pressed]').first().tap(); await p.waitForTimeout(300);
const reqs=[]; p.on('requestfinished',async r=>{const s=await r.sizes().catch(()=>null); if(/\/data\//.test(r.url())) reqs.push(r.url().replace(B,'')+' '+Math.round((s?.responseBodySize||0)/1024)+'KB')});
await p.goto(B+'/acompanhar',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
console.log('acompanhar data reqs', reqs);
await p.screenshot({path:'a360_acompanhar.png',fullPage:true});
console.log('acomp sw', await p.evaluate(()=>document.documentElement.scrollWidth));
// dark mode city
await p.emulateMedia({colorScheme:'dark'}); await p.goto(B+'/ba/conceicao-do-almeida#agir',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
await p.screenshot({path:'a360_dark_agir.png'});
console.log('errs',errs); await b.close();
