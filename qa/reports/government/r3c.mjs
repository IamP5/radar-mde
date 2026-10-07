import { chromium } from 'playwright';
import fs from 'node:fs';
const D='/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r3/';
const B='http://localhost:3299';
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1440,height:900}, acceptDownloads:true, permissions:['clipboard-read','clipboard-write']}); const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
const out={};
await p.goto(B+'/mg/uberlandia?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
const trig = p.getByRole('button',{name:/Exportar|Baixar|gráfico/i});
out.triggers = await trig.allInnerTexts().catch(()=>[]);
out.triggerAria = await p.locator('button[aria-haspopup="menu"]').evaluateAll(a=>a.map(x=>(x.getAttribute('aria-label')||x.innerText).slice(0,60)));
const first = p.locator("button[aria-label^=\"Exportar: % da receita\"]").first();
await first.click(); await p.waitForTimeout(300);
out.items = await p.getByRole('menuitem').allInnerTexts();
for (const re of [/PNG/i, /CSV/i, /cita/i]) {
  const it = p.getByRole('menuitem',{name:re}).first();
  if (!(await it.count())) { out['no '+re]=true; continue; }
  if (/cita/i.test(String(re))) { await it.click(); await p.waitForTimeout(300); out.citation = await p.evaluate(()=>navigator.clipboard.readText()); continue; }
  const [dl] = await Promise.all([p.waitForEvent('download',{timeout:15000}), it.click()]);
  const f = D+'chart_'+dl.suggestedFilename(); await dl.saveAs(f); out['dl '+re]=f;
  await first.click(); await p.waitForTimeout(300);
}
await p.keyboard.press('Escape');
console.log(JSON.stringify(out,null,1)); console.log('ERRS',errs);
await b.close();
