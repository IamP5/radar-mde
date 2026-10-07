import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}});
for (const u of ['/mt/sorriso','/mt/boa-esperanca-do-norte']) {
  await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(5000);
  const h=p.getByText('Onde fica',{exact:false}).first(); await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(2000);
  const n=await p.evaluate(()=>[...document.querySelectorAll('svg path')].map(x=>getComputedStyle(x).fill).reduce((a,f)=>(a[f]=(a[f]||0)+1,a),{}));
  console.log(u, JSON.stringify(n).slice(0,400));
  await p.screenshot({path:'reports/academic/map'+u.replace(/\//g,'_')+'.png'});
}
await b.close();
