import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
await p.goto((process.env.BASE||'http://localhost:3210')+'/sp',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.focus('footer a');
for(let i=0;i<80;i++){ await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(200);
 const d=await p.evaluate(()=>{const e=document.activeElement;const r=e.getBoundingClientRect();return {t:e.textContent.trim().slice(0,30),top:r.top}});
 if(d.top<100 && d.top>-50){ console.log('obscured',d); await p.screenshot({path:new URL('./shots/focus-obscured-sp.png',import.meta.url).pathname,clip:{x:0,y:0,width:1280,height:300}}); break; } }
await b.close();
