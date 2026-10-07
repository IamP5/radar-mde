import { chromium } from 'playwright';
const B='http://localhost:3299', D='reports/journalist/r3/';
const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(B+'/explorar?ano=2021&situacao=abaixo&porte=p5&ordem=-faltou',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
const t=p.locator('table'); await t.scrollIntoViewIfNeeded(); const bb=await t.boundingBox();
await p.screenshot({path:D+'explorer-rows.png',clip:{x:bb.x,y:bb.y,width:bb.width,height:260}});
// IPCA toggle URL on home
await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await p.getByRole('radio',{name:/IPCA|Corrigido/}).first().click(); await p.waitForTimeout(300); console.log('url after ipca', p.url());
// map export with municipal mode legend check
await b.close();
