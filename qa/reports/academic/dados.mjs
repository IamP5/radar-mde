import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://localhost:3210/dados',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const el=p.getByText('Rondônia').first(); await el.scrollIntoViewIfNeeded();
const box=await el.boundingBox(); await p.screenshot({path:'reports/academic/dados_uf.png',clip:{x:80,y:box.y-60,width:1300,height:260}});
console.log(await p.evaluate(()=>[...document.querySelectorAll('a')].filter(a=>/csv|json/i.test(a.href)).slice(0,4).map(a=>a.href+' | '+a.innerText.replace(/\n/g,' '))));
await b.close();
