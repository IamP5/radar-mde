import { chromium } from 'playwright';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
for (const u of ['/sp/santo-andre?ano=2014','/sp/santo-andre?ano=2021','/mt/boa-esperanca-do-norte?ano=2014','/pa/mojui-dos-campos?ano=2010','/sp/santo-andre?ano=1999','/sp/santo-andre?ano=abc']) {
  await p.goto('http://localhost:3299'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  const t=await p.evaluate(()=>document.body.innerText);
  const kpi=(t.match(/MDE (em )?20\d\d\n[^\n]+/)||[''])[0].replace(/\n/g,' ');
  console.log(u,'|',kpi,'|',[...new Set(t.match(/(Posição em|Onde fica ·|MDE em|Em) 20\d\d/g))].join(';'),'|', (t.match(/[^\n]*(não existia|ainda não existia)[^\n]*/i)||[''])[0].slice(0,160));
  await p.screenshot({path:'reports/academic/r2/ano'+u.replace(/[\/?=]/g,'_')+'.png'});
}
// year picker interaction from Santo André
await p.goto('http://localhost:3299/sp/santo-andre',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
const btn=p.getByRole('button',{name:/^2014$/}).or(p.getByRole('tab',{name:/^2014$/})).or(p.getByRole('radio',{name:/^2014$/})).first();
await btn.click(); await p.waitForTimeout(1200);
const t2=await p.evaluate(()=>document.body.innerText);
console.log('after click url',p.url(),'|',(t2.match(/Posição em 20\d\d/)||[])[0], '| share?');
console.log('errors',errs);
await b.close();
