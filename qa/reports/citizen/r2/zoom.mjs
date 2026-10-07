import { chromium, devices } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage();
for (const u of ['/ba/conceicao-do-almeida','/pi/bom-principio-do-piaui']) {
await p.goto('http://localhost:3299'+u,{waitUntil:'networkidle'});
const pn = p.getByText(process.env.T).first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
await pn.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
const r = await pn.evaluate(e=>{const t=[...e.querySelectorAll('svg text')].filter(x=>/%$/.test(x.textContent)).map(x=>{const b=x.getBoundingClientRect();return x.textContent+':'+Math.round(b.left)});const s=e.querySelector('svg').getBoundingClientRect();return {t,svgLeft:Math.round(s.left)}});
console.log(u, JSON.stringify(r));
const bb=await pn.boundingBox(); await p.screenshot({path:'zoom_fundeb_'+u.split('/').pop()+'.png',clip:{x:bb.x,y:bb.y+130,width:120,height:260}});
}
await b.close();
