import { chromium } from 'playwright';
import fs from 'fs';
const B='http://localhost:3299';
const out='reports/academic/r3/';
const pages = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:1440,height:900}, acceptDownloads:true });
for (const p of pages) {
  const page = await ctx.newPage();
  const errs=[];
  page.on('console', m=>{ if(m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text().slice(0,300)); });
  page.on('pageerror', e=>errs.push('pageerror: '+e.message));
  const t0=Date.now();
  const r = await page.goto(B+p,{waitUntil:'networkidle',timeout:120000});
  await page.waitForTimeout(1500);
  const name=p.replace(/\//g,'_')||'_root';
  await page.screenshot({path:out+'shot'+name+'.png', fullPage:true});
  const txt = await page.evaluate(()=>document.body.innerText);
  fs.writeFileSync(out+'text'+name+'.txt', txt);
  console.log(p, r.status(), (Date.now()-t0)+'ms', 'errors:', JSON.stringify(errs));
  await page.close();
}
await browser.close();
