import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const B='http://localhost:3299';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true}); const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
// Explorar 2021
await p.goto(B+'/explorar?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
let t=await p.evaluate(()=>document.body.innerText);
console.log('explorar 2021 EC119 note:', /EC 119|pandemia/i.test(t), (t.match(/[^\n]*EC 119[^\n]*/)||[''])[0].slice(0,200));
console.log('explorar atip marker:', /atípic/i.test(t));
await p.screenshot({path:'reports/academic/r2/explorar_2021.png'});
await p.getByRole('button',{name:/Exportar/}).first().click(); await p.waitForTimeout(500);
console.log('menu items:', await p.getByRole('menuitem').allInnerTexts());
const [d]=await Promise.all([p.waitForEvent('download'), p.getByRole('menuitem').first().click()]);
console.log('explorar export file', d.suggestedFilename());
await d.saveAs('reports/academic/r2/explorar.csv');
// Fortaleza saude column + per-aluno chart
await p.goto(B+'/ce/fortaleza',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
t=await p.evaluate(()=>document.body.innerText);
console.log('fortaleza has Saúde column:', /\tSaúde\t/.test(t));
// Adamantina chart
await p.goto(B+'/sp/adamantina',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
const panel=p.locator('section,div').filter({has:p.getByText('Investimento por aluno',{exact:false})}).filter({has:p.locator('svg.recharts-surface')}).last();
await panel.scrollIntoViewIfNeeded(); await p.waitForTimeout(800); await panel.screenshot({path:'reports/academic/r2/chart_adamantina_aluno.png'});
// glossary term
const term=p.locator('text=MDE').first();
// home ranking money format
await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
t=await p.evaluate(()=>document.body.innerText);
console.log('home R$ with ,5:', (t.match(/R\$ \d{1,3}\.\d{3},\d/g)||[]).slice(0,3));
console.log('home KPI label:', (t.match(/[^\n]*(Deixou de ir|faltou)[^\n]*/gi)||[]).slice(0,4));
for (const u of ['/sobre','/dados','/sp/adamantina','/pa/mojui-dos-campos?ano=2010','/explorar']) {
  await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
  const r=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa']).analyze();
  console.log('axe',u, r.violations.map(v=>`${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes[0].target}`));
}
console.log('errors',errs);
await b.close();
