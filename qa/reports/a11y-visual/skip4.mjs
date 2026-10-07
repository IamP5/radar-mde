import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:800}}); 
await ctx.addInitScript(()=>{ window.__f=[]; document.addEventListener('focusin',e=>window.__f.push('in '+e.target.tagName+' '+(e.target.textContent||'').trim().slice(0,20)),true); document.addEventListener('focusout',e=>window.__f.push('out '+e.target.tagName+' '+(e.target.textContent||'').trim().slice(0,20)),true);});
const p=await ctx.newPage();
for (const r of ['/','/dados','/sobre']){ await p.goto(B+r,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
console.log(r, await p.evaluate(()=>window.__f));
await p.keyboard.press('Tab'); console.log(r,'tab1', await p.evaluate(()=>document.activeElement.textContent.trim().slice(0,30)));}
await b.close();
