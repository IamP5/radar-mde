import { chromium } from 'playwright';
const B=process.env.BASE; const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
await p.goto(B+'/sp/santo-andre',{waitUntil:'networkidle'}); await p.addStyleTag({content:'html{font-size:200% !important}'}); await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{const h=document.querySelector('h1'); let n=h, out=[]; for(let i=0;i<7&&n;i++){const r=n.getBoundingClientRect(); out.push(`${n.tagName}.${String(n.className).slice(0,90)} w=${Math.round(r.width)}`); n=n.parentElement;} 
 const sib=[...h.closest('.flex, .grid')?.parentElement?.children||[]].map(c=>`${c.tagName}.${String(c.className).slice(0,80)} w=${Math.round(c.getBoundingClientRect().width)}`); return out.join('\n')+'\n--\n'+sib.join('\n')}));
await p.screenshot({path:new URL('./r2/shots/textzoom-santo-full.png',import.meta.url).pathname, fullPage:false, clip:{x:0,y:0,width:1280,height:900}});
await p.evaluate(()=>scrollTo(0,0)); await p.setViewportSize({width:1280,height:2400}); await p.screenshot({path:new URL('./r2/shots/textzoom-santo-tall.png',import.meta.url).pathname});
await b.close();
