import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210';
const b=await chromium.launch();
for (const theme of ['light','dark']){
 const c=await b.newContext({viewport:{width:375,height:812},colorScheme:theme}); await c.addInitScript(t=>{localStorage.setItem('theme',t); localStorage.setItem('radar-mde:watch',JSON.stringify(['sp/santo-andre','sp/sao-paulo','rj/volta-redonda']));},theme);
 const p=await c.newPage(); await p.goto(B+'/acompanhar',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
 const res=await p.evaluate(()=>{const L=c=>{const m=c.match(/[\d.]+/g).map(Number);const v=m.slice(0,3).map(x=>x/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]};
  const out={}; for(const e of document.querySelectorAll('main *')){ if(e.children.length||!/^\d+,\d$/.test(e.textContent.trim())) continue; let n=e, bg='rgba(0, 0, 0, 0)'; while(n&&/rgba\(0, 0, 0, 0\)|transparent/.test(bg)){bg=getComputedStyle(n).backgroundColor; n=n.parentElement;} const fg=getComputedStyle(e).color; const a=L(fg),bb=L(bg); const r=((Math.max(a,bb)+0.05)/(Math.min(a,bb)+0.05)).toFixed(2); out[bg+' / '+fg]=Math.min(out[bg+' / '+fg]||99, +r);} return out;});
 console.log(theme, res);
 // css vars
 console.log(theme, await p.evaluate(()=>['--bin-1','--bin-2','--bin-3','--bin-4','--bin-5','--bin-nd','--bin-zero','--red-1','--red-2','--series-3','--series-4','--critical-ink'].map(v=>v+'='+getComputedStyle(document.documentElement).getPropertyValue(v).trim()).join(' ')));
}
await b.close();
