import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
await p.goto('http://localhost:3210/sp?ano=2014',{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
const h=await p.$$eval('a[href^="/sp/"]',as=>as.map(a=>a.getAttribute('href')));
console.log(h.length, h.filter(x=>x.includes('ano=')).length, h.slice(0,5));
await p.goto('http://localhost:3210/sp/santo-andre?ano=2014',{waitUntil:'networkidle'});
console.log('yearpicker on city page?', await p.locator('text=Exercício').count());
await b.close();
