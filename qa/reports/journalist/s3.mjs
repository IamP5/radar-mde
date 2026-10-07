import { chromium } from 'playwright';
import fs from 'fs';
const D='reports/journalist/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true}); const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:3210/explorar?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
await p.screenshot({path:D+'explorar-2021.png'});
console.log((await p.locator('main').innerText()).slice(0,1500));
// pick situation below
await p.getByRole('combobox',{name:/Situação/}).click(); await p.waitForTimeout(300);
await p.getByRole('option',{name:/Abaixo de 25%/}).click(); await p.waitForTimeout(500);
await p.getByRole('combobox',{name:'População'}).click(); await p.waitForTimeout(300);
await p.getByRole('option',{name:/Mais de 500 mil/}).click(); await p.waitForTimeout(500);
// sort by Faltou desc
await p.getByRole('button',{name:'Faltou'}).click(); await p.waitForTimeout(300);
console.log('URL after filters:',p.url());
await p.screenshot({path:D+'explorar-2021-big-below.png'});
console.log((await p.locator('main').innerText()).slice(0,3000));
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button',{name:/Exportar CSV/}).click()]);
await dl.saveAs(D+'explorar.csv'); console.log('download', dl.suggestedFilename());
// reload and see if filters survive
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1500);
console.log('after reload:', (await p.locator('main').innerText()).slice(0,400));
console.log(errs); await b.close();
