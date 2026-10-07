import { chromium } from 'playwright';
const B=process.env.BASE; const S=new URL('./r2/shots/',import.meta.url).pathname;
const b=await chromium.launch(); const c=await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'}); await c.addInitScript(()=>localStorage.setItem('theme','dark')); const p=await c.newPage();
for (const r of ['/','/sp','/sp/santo-andre']){ await p.goto(B+r,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
 const n=r==='/'?'home':r.replace(/\//g,'_').slice(1); await p.pdf({path:`${S}print-${n}.pdf`,format:'A4',printBackground:true}); console.log(n); }
await b.close();
