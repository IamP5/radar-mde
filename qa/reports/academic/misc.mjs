import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const b=await chromium.launch(); const p=await (await b.newContext()).newPage({viewport:{width:1440,height:900}});
// search without accents
await p.goto('http://localhost:3210/',{waitUntil:'networkidle'});
await p.keyboard.press('Meta+k'); await p.waitForTimeout(800);
await p.keyboard.type('santo andre'); await p.waitForTimeout(1200);
console.log('search:', (await p.locator('[role=dialog]').innerText()).slice(0,300).replace(/\n/g,' | '));
await p.screenshot({path:'reports/academic/search.png'});
await p.keyboard.press('Escape');
// ano param on city page
await p.goto('http://localhost:3210/sp/santo-andre?ano=2014',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const t=await p.evaluate(()=>document.body.innerText);
console.log('ano=2014 city kpi:', (t.match(/MDE 20\d\d\n[^\n]+/)||[])[0], '| posição:', (t.match(/Posição em \d+/)||[])[0], '| onde fica:', (t.match(/Onde fica · \d+/)||[])[0]);
for (const u of ['/sobre','/sp/santo-andre','/dados']) {
  await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle'});
  const r=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa']).analyze();
  console.log('axe',u, r.violations.map(v=>`${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes[0].target} ${v.nodes[0].failureSummary.slice(0,140).replace(/\n/g,' ')}`));
}
await b.close();
