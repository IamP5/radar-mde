import { chromium } from 'playwright';
import fs from 'fs';
const B='http://localhost:3299', D='reports/journalist/r3/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
const go=async(u)=>{await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(2000);};
async function exportAll(page, tag){
  const triggers = p.getByRole('button',{name:/Exportar|Baixar|Compartilhar gráfico|Opções do gráfico|exportar/i});
  const n = await triggers.count(); console.log(tag,'export triggers',n, await triggers.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')||e.innerText)));
  return n;
}
await go('/?ano=2021');
fs.writeFileSync(D+'home-2021.txt', await p.locator('main').innerText());
const n = await exportAll(p,'home');
const trig = p.getByRole('button',{name:/Exportar|Baixar|gráfico/i});
for (let i=0;i<n;i++){
  const t=trig.nth(i); const lab=(await t.getAttribute('aria-label'))||(await t.innerText());
  if (/CSV$/i.test(lab) && !/gráfico|mapa|distribui|evolu/i.test(lab)) continue;
  await t.scrollIntoViewIfNeeded(); await t.click(); await p.waitForTimeout(400);
  const items=await p.getByRole('menuitem').allInnerTexts(); console.log(' menu',i,lab,items);
  for (const [re,ext] of [[/PNG/,'png'],[/SVG/,'svg'],[/CSV/,'csv']]) {
    const mi=p.getByRole('menuitem',{name:re}); if(!(await mi.count())) continue;
    const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}).catch(()=>null), mi.first().click()]);
    if(dl){ const f=`home-${i}-${dl.suggestedFilename()}`; await dl.saveAs(D+f); console.log('   saved',f);} else console.log('   no download',ext);
    await p.waitForTimeout(300); await t.click(); await p.waitForTimeout(400);
  }
  const ci=p.getByRole('menuitem',{name:/cita/i}); if(await ci.count()){ await ci.first().click(); await p.waitForTimeout(300); console.log('   citation:', await p.evaluate(()=>navigator.clipboard.readText()));} else await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
}
console.log(errs.slice(0,10)); await b.close();
