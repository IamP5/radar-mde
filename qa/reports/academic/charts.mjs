import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}});
for (const [u,titles] of [['/rs/uniao-da-serra',['Investimento por aluno']],['/sp/adamantina',['Investimento por aluno']]]) {
  await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
  for (const t of titles){
    const panel=p.locator('section,div').filter({has:p.getByText(t,{exact:false})}).filter({has:p.locator('svg.recharts-surface')}).last();
    await panel.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
    const f='reports/academic/chart'+u.replace(/\//g,'_')+'_'+t.slice(0,8).replace(/\W/g,'')+'.png';
    await panel.screenshot({path:f}); console.log(f);
  }
}
await b.close();
