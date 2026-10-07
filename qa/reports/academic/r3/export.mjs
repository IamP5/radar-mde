import { chromium } from 'playwright';
import fs from 'fs';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true}); const p=await ctx.newPage();
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://localhost:3299'});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto('http://localhost:3299/sp/adamantina',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const btn=p.getByRole('button',{name:/Exportar: Investimento por aluno/});
await btn.click(); await p.waitForTimeout(400);
const items=await p.getByRole('menuitem').allInnerTexts(); console.log('items',items);
for (const re of [/CSV/i,/PNG/i,/SVG/i]) {
  await (await p.getByRole('menuitem').count() ? null : btn.click()); await p.waitForTimeout(300);
  const [d]=await Promise.all([p.waitForEvent('download',{timeout:15000}), p.getByRole('menuitem',{name:re}).first().click()]);
  const f='reports/academic/r3/'+d.suggestedFilename(); await d.saveAs(f); console.log('saved',f, fs.statSync(f).size);
  await p.waitForTimeout(500);
}
await btn.click(); await p.waitForTimeout(300);
await p.getByRole('menuitem',{name:/citação/i}).first().click(); await p.waitForTimeout(500);
console.log('clipboard:', await p.evaluate(()=>navigator.clipboard.readText()));
console.log('errors',errs);
await b.close();
