import { chromium } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
for (const u of ['/mg?ano=2021','/mg?ano=2021','/sp?ano=2020','/regiao/sul?ano=2021','/?ano=2021']) {
  await p.goto(B+u,{waitUntil:'networkidle'});
  for (const w of [500,3000]) { await p.waitForTimeout(w); const t=await p.locator('main').innerText(); console.log(u,w,'|',(t.match(/Em 20\d\d,[^\n]*/)||[''])[0].slice(0,70), '| sel', await p.locator('[role=radio][aria-checked=true]').first().innerText().catch(()=>'?')); }
}
await b.close();
