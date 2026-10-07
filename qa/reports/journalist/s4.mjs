import { chromium } from 'playwright';
const D='reports/journalist/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
for (const run of [1,2]) {
await p.goto('http://localhost:3210/?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
const sel=await p.locator('[role=radio][aria-checked=true]').first().innerText().catch(()=>'?'); console.log('selected year', sel);
const map = p.locator('svg[aria-label^="Mapa do Brasil"]'); await map.scrollIntoViewIfNeeded();
const bb = await map.boundingBox(); console.log('map',bb);
// hover center of SP approx
const shapes = map.locator('path[data-id], [data-id]'); console.log('shapes with data-id', await shapes.count());
await p.mouse.move(bb.x+bb.width*0.66, bb.y+bb.height*0.72); await p.waitForTimeout(600);
await p.screenshot({path:D+`map-hover-2021-${run}.png`,clip:{x:bb.x-20,y:bb.y-20,width:bb.width+40,height:bb.height+40}});
await p.mouse.click(bb.x+bb.width*0.66, bb.y+bb.height*0.72); await p.waitForURL(u=>!u.toString().endsWith('ano=2021')||u.pathname!=='/',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(2500);
console.log('after map click URL:', p.url());
const t = await p.locator('main').innerText(); console.log(t.match(/Em \d{4},[^.]*\./)?.[0]);
}
// ranking table link
await p.goto('http://localhost:3210/?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const href = await p.locator('table a').first().getAttribute('href'); console.log('ranking table first link', href);
const ufMultHref = await p.locator('a[href^="/ac"], a[href^="/rs"]').first().getAttribute('href'); console.log('multiples link', ufMultHref);
const defHref = await p.locator('ol a').first().getAttribute('href'); console.log('deficit list link', defHref);
// map mode permalink
await p.getByRole('radio',{name:'Municípios'}).first().click().catch(e=>console.log('no radio',e.message)); await p.waitForTimeout(500);
console.log('URL after map mode change', p.url());
console.log(errs); await b.close();
