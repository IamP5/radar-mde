import { chromium } from 'playwright';
const D='reports/journalist/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p = await ctx.newPage();
await p.goto('http://localhost:3210/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await p.screenshot({path:D+'home-top.png',clip:{x:0,y:250,width:1440,height:400}});
// hover map
const paths = await p.locator('main svg path').count(); console.log('paths',paths);
// find the map svg
const box = await p.locator('main svg').nth(0).boundingBox(); console.log(box);
// hover over SP region approx
await p.mouse.move(box.x+box.width*0.62, box.y+box.height*0.72); await p.waitForTimeout(500);
await p.screenshot({path:D+'map-hover.png',clip:{x:100,y:600,width:800,height:700}});
// Share button?
console.log(await p.locator('button').allInnerTexts());
console.log('url',p.url());
await b.close();
