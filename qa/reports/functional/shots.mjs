import { chromium } from 'playwright';
const B='http://localhost:3210'; const out='reports/functional/';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
for (const [u,n] of process.argv.slice(2).map(s=>s.split('='))) {
  await p.goto(B+u,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(800);
  await p.screenshot({path:out+n+'.png',fullPage:true});
  console.log(u, await p.title());
}
await b.close();
