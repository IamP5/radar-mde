import { chromium } from 'playwright';
import fs from 'fs';
const B='http://localhost:3299', D='reports/journalist/r2/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
const go=async(u)=>{await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(2000);};
const rows=async(n=6)=>p.locator('table tbody tr').evaluateAll((rs,n)=>rs.filter(r=>r.innerText.trim()).slice(0,n).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,220)),n);
await go('/explorar?ano=2021&situacao=abaixo&porte=p5&ordem=-faltou');
const t=await p.locator('main').innerText(); console.log('pandemia note:', (t.match(/2021 foi ano de pandemia[^\n]*/)||[''])[0]);
const ex=p.getByRole('button',{name:/Exportar|CSV/}).first();
await ex.click(); await p.waitForTimeout(500);
const [dl]=await Promise.all([p.waitForEvent('download'), p.getByRole('menuitem',{name:/Série .* Excel Brasil/}).click()]);
await dl.saveAs(D+'series-excel.csv'); console.log('dl',dl.suggestedFilename());
await go('/explorar?ano=2021&capital=1&situacao=abaixo');
console.log('J07 capitals below 2021', (await rows(10)).map(s=>s.slice(0,30)));
await go('/explorar?ano=2025&ordem=variacao');
console.log('J07 delta asc 2025', (await rows(4)).map(s=>s.slice(0,150)));
await p.screenshot({path:D+'explorar-delta.png'});
await go('/explorar?ano=2021');
console.log('J08 default sort 2021 top', (await rows(3)).map(s=>s.slice(0,200)));
await p.screenshot({path:D+'explorar-2021-atip.png'});
// stat cards
const t2=await p.locator('main').innerText(); console.log(t2.slice(t2.indexOf('Faltou'), t2.indexOf('Faltou')+200));
// bad params
await go('/explorar?ano=1999&ordem=zzz&porte=xx&situacao=foo&uf=ZZ');
console.log('bad params ->', p.url(), (await p.locator('main').innerText()).match(/[\d.]+ de [\d.]+ municípios/)?.[0]);
console.log(errs); await b.close();
