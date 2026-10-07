import { chromium } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
for (const run of [1,2]){
await p.goto(B+'/rs/porto-alegre?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await p.getByRole('button',{name:/Compartilhar/}).first().click(); await p.waitForTimeout(400);
const mi=p.getByRole('menuitem',{name:/WhatsApp/});
const html=await mi.evaluate(e=>e.outerHTML.slice(0,300));
const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null), mi.click()]);
console.log(run, pop? decodeURIComponent(pop.url()).slice(0,400) : 'no popup '+html);
if(pop) await pop.close();
}
// python check of POA ipca carry to 2021
await b.close();
