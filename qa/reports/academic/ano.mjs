import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
for (const u of ['/?ano=2014','/sp?ano=2014','/regiao/sudeste?ano=2014','/sp/santo-andre?ano=2014','/sp/santo-andre?ano=2021']) {
  await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  const t=await p.evaluate(()=>document.body.innerText);
  console.log(u, '->', [...new Set(t.match(/(em|Em|·|MDE|Posição em) 20\d\d/g))].slice(0,6).join(' ; '));
}
// click from /sp?ano=2014 to a city
await p.goto('http://localhost:3210/sp?ano=2014',{waitUntil:'networkidle'});
const links=await p.$$eval('a[href*="/sp/"]',as=>as.slice(0,3).map(a=>a.getAttribute('href'))); console.log('links from /sp?ano=2014', links);
await b.close();
