import { chromium } from 'playwright';
const D='reports/journalist/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
for (const [u,n] of [['/','home'],['/regiao/sudeste','regiao-se'],['/sp','sp'],['/sp/sao-paulo','sp-sp'],['/explorar','explorar'],['/dados','dados'],['/sobre','sobre']]) {
  const t=Date.now();
  const r = await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle',timeout:180000});
  await p.waitForTimeout(1500);
  console.log(u, r.status(), Date.now()-t,'ms', await p.title());
  await p.screenshot({path:D+n+'.png',fullPage:true});
  const txt=await p.evaluate(()=>document.querySelector('main')?.innerText||document.body.innerText);
  (await import('fs')).writeFileSync(D+n+'.txt',txt);
}
console.log('errors', errs); await b.close();
