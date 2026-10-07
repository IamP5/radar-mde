import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const [u, n='4', scheme='light'] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13'], colorScheme:scheme});
const p = await ctx.newPage();
await p.goto(B+u,{waitUntil:'networkidle',timeout:180000}); await p.waitForTimeout(800);
const name=(u.replace(/\W+/g,'_')||'home')+(scheme==='dark'?'_dark':'');
const H = await p.evaluate(()=>document.documentElement.scrollHeight);
const segs = Math.min(+n, Math.ceil(H/1500));
for (let i=0;i<segs;i++){ await p.screenshot({path:`r2/c_${name}_${i}.png`, fullPage:true, clip:{x:0,y:i*1500,width:390,height:Math.min(1500,H-i*1500)}, scale:'css'}); }
console.log(name, H, segs); await b.close();
