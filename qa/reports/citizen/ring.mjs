import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage();
for (const u of ['/ba/conceicao-do-almeida','/go/goias']) for (let k=0;k<2;k++){
 await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
 const c = p.locator('.recharts-wrapper').first(); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox();
 await p.touchscreen.tap(bb.x+bb.width*0.8, bb.y+bb.height*0.5); await p.waitForTimeout(500);
 const a = await p.evaluate(()=>{const a=document.activeElement;const cs=getComputedStyle(a);return a.tagName+'.'+(a.getAttribute('class')||'').slice(0,40)+' outline='+cs.outlineStyle+' '+cs.outlineWidth});
 console.log(u,k,a);
 await p.screenshot({path:`ring_${u.split('/').pop()}_${k}.png`,clip:{x:0,y:Math.max(0,bb.y-10),width:390,height:bb.height+20}});
}
await b.close();
