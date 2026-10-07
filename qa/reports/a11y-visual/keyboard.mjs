import { chromium } from 'playwright';
const route=process.argv[2]||'/'; const N=+(process.argv[3]||80); const w=+(process.argv[4]||1280);
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:w,height:800}}); const p=await ctx.newPage();
await p.goto('http://localhost:3210'+route,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(500);
const out=[];
for(let i=0;i<N;i++){
 await p.keyboard.press('Tab'); await p.waitForTimeout(60);
 const d=await p.evaluate(()=>{const e=document.activeElement; if(!e||e===document.body) return {d:'BODY'};
  const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
  // obscured by sticky bars?
  const stick=[...document.querySelectorAll('header, [class*="sticky"]')].filter(x=>{const st=getComputedStyle(x);return (st.position==='sticky'||st.position==='fixed')&&!x.contains(e)});
  let obsc=0; for(const x of stick){const xr=x.getBoundingClientRect(); if(xr.bottom>r.top && xr.top<r.bottom && xr.right>r.left && xr.left<r.right){ obsc=Math.max(obsc, Math.min(r.bottom,xr.bottom)-Math.max(r.top,xr.top)) }}
  const ring = s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0 ? `outline ${s.outlineWidth} ${s.outlineColor}` : (s.boxShadow!=='none'?'shadow':'NONE');
  return {d:`${e.tagName.toLowerCase()}${e.getAttribute('role')?'['+e.getAttribute('role')+']':''} "${(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,40)}"`, y:Math.round(r.top), h:Math.round(r.height), ring, obsc:Math.round(obsc), inView: r.bottom>0&&r.top<innerHeight}});
 out.push(d); console.log(String(i+1).padStart(3), d.d, 'y='+d.y, d.ring, d.obsc?'OBSCURED '+d.obsc+'px of '+d.h:'', d.inView===false?'OFFSCREEN':'');
}
await b.close();
