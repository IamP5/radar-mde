import { chromium } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>errs.push(p.url()+' '+m.type()+' '+m.text()));
for (const u of ['/mg?ano=2020','/mg?ano=2024','/ba?ano=2021','/rs?ano=2021','/mg?ano=2021']) {
  await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
  const t=await p.locator('main').innerText(); console.log(u,'|',(t.match(/Em 20\d\d,[^\n]*/)||[''])[0].slice(0,50), '| url', p.url());
}
console.log(errs.slice(0,10)); await b.close();
