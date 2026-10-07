import { chromium } from 'playwright';
const route=process.argv[2]; const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
await p.goto('http://localhost:3210'+route,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
await p.keyboard.press('End'); await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.focus('footer a');
let obs=0;
for(let i=0;i<60;i++){ await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(250);
 const d=await p.evaluate(()=>{const e=document.activeElement;const r=e.getBoundingClientRect();
  const bars=[...document.querySelectorAll('body *')].filter(x=>{const s=getComputedStyle(x);return (s.position==='sticky'||s.position==='fixed')&&!x.contains(e)&&x.getBoundingClientRect().height>0&&x.getBoundingClientRect().height<200});
  let bottom=0; for(const x of bars){const xr=x.getBoundingClientRect(); if(xr.top<=1) bottom=Math.max(bottom,xr.bottom);}
  return {t:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30), top:Math.round(r.top), bottom:Math.round(r.bottom), bar:Math.round(bottom)}});
 if(d.top<d.bar){obs++; console.log('OBSCURED', JSON.stringify(d));}
}
console.log(route,'obscured count',obs); await b.close();
