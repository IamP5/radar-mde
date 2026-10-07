import { chromium } from 'playwright';
const D='reports/journalist/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); 
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://localhost:3210'});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
for (const run of [1,2]){
await p.goto('http://localhost:3210/rs/porto-alegre?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const t=await p.locator('main').innerText(); console.log('city ?ano=2021 ->', t.match(/MDE \d{4}\n[^\n]+/)?.[0], '|', t.match(/Em \d{4}[^\n]+/)?.[0]);
}
await p.screenshot({path:D+'city-poa-ano2021.png'});
await p.getByRole('button',{name:/Compartilhar/}).click(); await p.waitForTimeout(400);
const items=await p.getByRole('menuitem').allInnerTexts(); console.log('share items',items);
await p.getByRole('menuitem',{name:/Copiar/}).click().catch(e=>console.log(e.message)); await p.waitForTimeout(400);
console.log('clipboard:', await p.evaluate(()=>navigator.clipboard.readText()).catch(e=>e.message));
// cmd-k
await p.keyboard.press('Meta+k'); await p.waitForTimeout(500);
await p.keyboard.type('sao paulo'); await p.waitForTimeout(800);
await p.screenshot({path:D+'cmdk.png'});
console.log('cmdk options', (await p.getByRole('option').allInnerTexts()).slice(0,10));
await p.keyboard.press('Escape');
await p.keyboard.press('Meta+k'); await p.waitForTimeout(300); await p.keyboard.type('capitais'); await p.waitForTimeout(600);
console.log('cmdk capitais', (await p.getByRole('option').allInnerTexts()).slice(0,8));
await p.keyboard.press('Escape');
// home ranking table sort by Faltou
await p.goto('http://localhost:3210/?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await p.locator('table').getByRole('button',{name:/Faltou/}).click(); await p.waitForTimeout(300);
const rows = await p.locator('table tbody tr').evaluateAll(rs=>rs.slice(0,6).map(r=>r.innerText.replace(/\s+/g,' ')));
console.log('UF table sorted by faltou', rows, p.url());
console.log(errs); await b.close();
