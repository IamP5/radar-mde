import { chromium } from 'playwright';
const ROUTES=['/','/regiao/sudeste','/sp','/sp/santo-andre','/explorar','/acompanhar','/dados','/sobre'];
const widths=(process.argv[2]||'320,375,768,1024,1440').split(',').map(Number);
const b=await chromium.launch();
for(const w of widths){ const p=await (await b.newContext({viewport:{width:w,height:900}})).newPage();
 for(const r of ROUTES){ await p.goto((process.env.BASE||'http://localhost:3210')+r,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(400);
  const res=await p.evaluate(()=>{ const out=[];
   for(const el of document.querySelectorAll('main *, header *')){ const s=getComputedStyle(el); if(s.display==='none')continue;
     // clipped by overflow hidden without ellipsis
     if((s.overflowX==='hidden'||s.overflowX==='clip') && el.scrollWidth>el.clientWidth+2 && s.textOverflow!=='ellipsis' && el.clientWidth>0){
       out.push(`HIDDEN-CLIP ${el.tagName.toLowerCase()}.${String(el.className.baseVal??el.className).split(' ').slice(0,4).join('.')} sw=${el.scrollWidth} cw=${el.clientWidth} "${el.textContent.trim().slice(0,40)}"`);}
     // horizontally scrollable regions: is content hidden?
     if((s.overflowX==='auto'||s.overflowX==='scroll') && el.scrollWidth>el.clientWidth+2){
       out.push(`HSCROLL ${el.tagName.toLowerCase()}[${el.getAttribute('role')||el.dataset.slot||''}] sw=${el.scrollWidth} cw=${el.clientWidth} tabindex=${el.getAttribute('tabindex')} "${el.textContent.trim().slice(0,30)}"`);}
     // ellipsis truncation
     if(s.textOverflow==='ellipsis' && el.scrollWidth>el.clientWidth+1) out.push(`ELLIPSIS ${el.tagName.toLowerCase()} title=${!!(el.title||el.closest('[title]'))} "${el.textContent.trim().slice(0,50)}"`);
   } return [...new Set(out)]; });
  console.log(`\n## ${w} ${r} (${res.length})`); const counts={}; for(const x of res){const k=x.split(' ')[0]; counts[k]=(counts[k]||0)+1;} 
  const shown={}; for(const x of res){const k=x.split(' ')[0]; shown[k]=(shown[k]||0)+1; if(shown[k]<=6) console.log('  ',x.slice(0,200));} console.log('  counts',counts);
 } }
await b.close();
