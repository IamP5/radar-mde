import { chromium } from 'playwright';
import fs from 'fs';
const B='http://localhost:3299', D='reports/journalist/r2/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
const go=async(u)=>{await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(2000);};
const rows=async(n=6)=>p.locator('table tbody tr').evaluateAll((rs,n)=>rs.filter(r=>r.innerText.trim()).slice(0,n).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,200)),n);
// J03: set filters via UI
await go('/explorar?ano=2021');
const t0=await p.locator('main').innerText(); console.log('EC119 in explorer 2021:', /EC 119/.test(t0));
console.log('headers', (await p.locator('table thead th').allInnerTexts()).map(s=>s.replace(/\s+/g,' ')));
await p.getByRole('combobox',{name:/Situação/}).click(); await p.waitForTimeout(300); await p.getByRole('option',{name:/Abaixo de 25%/}).click(); await p.waitForTimeout(400);
await p.getByRole('combobox',{name:'População'}).click(); await p.waitForTimeout(300); await p.getByRole('option',{name:/Mais de 500 mil/}).click(); await p.waitForTimeout(400);
await p.locator('table thead').getByRole('button',{name:/Faltou/}).click(); await p.waitForTimeout(500);
const url1=p.url(); console.log('J03 URL', url1);
const r1=await rows(3);
for (const run of [1,2]) { await p.goto(url1,{waitUntil:'networkidle'}); await p.waitForTimeout(2000); console.log('J03 reload rows', run, (await rows(3)).map(s=>s.slice(0,60)), 'same=', JSON.stringify(await rows(3))===JSON.stringify(r1)); }
await p.screenshot({path:D+'explorar-filters.png'});
// copy link button
const cl=p.getByRole('button',{name:/Copiar link/}); console.log('copy link btn', await cl.count()); if(await cl.count()){await cl.first().click(); await p.waitForTimeout(300); console.log('clip', await p.evaluate(()=>navigator.clipboard.readText()));}
// CSV menu
const ex=p.getByRole('button',{name:/Exportar|CSV/}).first(); await ex.click(); await p.waitForTimeout(300);
console.log('csv menu', await p.getByRole('menuitem').allInnerTexts());
for (const [lbl,f] of [[/Só 2021 · CSV padrão/,'year.csv'],[/Série .* Excel Brasil/,'series-excel.csv']]) {
  if(!(await p.getByRole('menuitem').count())) {await ex.click(); await p.waitForTimeout(300);}
  const [dl]=await Promise.all([p.waitForEvent('download'), p.getByRole('menuitem',{name:lbl}).click()]);
  await dl.saveAs(D+f); console.log('dl',dl.suggestedFilename());
}
// capitals 2021 below
await go('/explorar?ano=2021&capital=1&situacao=abaixo');
console.log('J07 capitals below 2021', (await rows(10)).map(s=>s.slice(0,40)));
await go('/explorar?ano=2025&ordem=variacao');
console.log('J07 delta asc 2025', (await rows(5)).map(s=>s.slice(0,140)));
await p.screenshot({path:D+'explorar-delta.png'});
await go('/explorar?ano=2021');
console.log('J08 default sort 2021 top', (await rows(4)).map(s=>s.slice(0,160)));
await p.screenshot({path:D+'explorar-2021-atip.png'});
console.log(errs); await b.close();
