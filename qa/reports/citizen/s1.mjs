import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,300)));
const urls = process.argv.slice(2);
for (const u of urls) {
  const t0=Date.now();
  const r = await p.goto(B+u,{waitUntil:'networkidle',timeout:180000});
  const dt=Date.now()-t0;
  await p.waitForTimeout(800);
  const ov = await p.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, h:document.documentElement.scrollHeight,
    wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>window.innerWidth+1 && r.width>0}).slice(0,5).map(e=>e.tagName+'.'+(e.className?.baseVal??e.className).toString().slice(0,60))}));
  const name=u.replace(/\W+/g,'_')||'home';
  await p.screenshot({path:`m_${name}.png`,fullPage:true});
  console.log(u, r.status(), dt+'ms', JSON.stringify(ov));
}
console.log('errors', errs.slice(0,10)); await b.close();
