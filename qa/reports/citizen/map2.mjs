import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
const p = await ctx.newPage();
for (const [u,label] of [['/','home'],['/ba','ba'],['/ba/conceicao-do-almeida','city']]) {
  await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  const shapes = p.locator('svg[role=img] [data-id]');
  const n = await shapes.count(); console.log(label,'shapes',n);
  if(!n) continue;
  // pick the biggest shape visible
  const idx = await shapes.evaluateAll(es=>{let bi=0,ba=0;es.forEach((e,i)=>{const r=e.getBoundingClientRect();if(r.width*r.height>ba){ba=r.width*r.height;bi=i}});return bi;});
  const s = shapes.nth(idx); await s.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const bb = await s.boundingBox();
  // find a point inside the shape
  const pt = await s.evaluate(e=>{const r=e.getBoundingClientRect();for(let k=0;k<400;k++){const x=r.left+r.width*Math.random(),y=r.top+r.height*Math.random();if(document.elementFromPoint(x,y)===e)return {x,y};}return null;});
  console.log(' pt',pt);
  if(!pt) continue;
  await p.touchscreen.tap(pt.x,pt.y); await p.waitForTimeout(700);
  await p.screenshot({path:`maptap_${label}_1.png`});
  console.log(' after tap1', p.url(), (await p.locator('text=Toque de novo').count()));
  await p.touchscreen.tap(pt.x,pt.y); await p.waitForTimeout(4000);
  console.log(' after tap2', p.url());
}
await b.close();
