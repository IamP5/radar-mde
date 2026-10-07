import { chromium } from 'playwright';
const S=new URL('./'+(process.env.SHOTDIR||'shots')+'/',import.meta.url).pathname; const B=(process.env.BASE||'http://localhost:3210');
const b=await chromium.launch();
// 1) 200% zoom == 640px CSS viewport at 1280 device; check reflow & sticky height share
for (const [w,h] of [[640,400],[320,256]]) { const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
  for (const r of ['/','/sp','/sp/santo-andre','/explorar']) { await p.goto(B+r,{waitUntil:'networkidle'}); await p.waitForTimeout(300);
    await p.evaluate(()=>window.scrollTo(0,1400)); await p.waitForTimeout(300);
    const m=await p.evaluate(()=>{let bottom=0; for(const x of document.querySelectorAll('body *')){const s=getComputedStyle(x); if((s.position==='sticky'||s.position==='fixed')&&x.getBoundingClientRect().top<=1&&x.getBoundingClientRect().height<innerHeight) bottom=Math.max(bottom,x.getBoundingClientRect().bottom);} return {sw:document.documentElement.scrollWidth,vw:innerWidth,stickyBottom:Math.round(bottom),vh:innerHeight}});
    console.log(`zoom ${w}x${h} ${r}`, JSON.stringify(m), `sticky covers ${Math.round(m.stickyBottom/m.vh*100)}%`);
    await p.screenshot({path:`${S}zoom-${w}x${h}-${r.replace(/\//g,'_')}.png`}); } }
// 2) text-only zoom: root font-size 200%
{ const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
  for (const r of ['/','/sp/santo-andre']) { await p.goto(B+r,{waitUntil:'networkidle'}); await p.addStyleTag({content:'html{font-size:200% !important}'}); await p.waitForTimeout(400);
   const m=await p.evaluate(()=>{ const bad=[]; for(const el of document.querySelectorAll('main *')){ const s=getComputedStyle(el); if(el.children.length===0&&el.textContent.trim()&&el.scrollHeight>el.clientHeight+2&&(s.overflowY==='hidden'||s.overflow==='hidden')) bad.push(el.textContent.trim().slice(0,30)); } const px=[...document.querySelectorAll('main *')].filter(e=>/\d+px/.test(getComputedStyle(e).fontSize)).length; return {sw:document.documentElement.scrollWidth, clipped:bad.slice(0,8), nClipped:bad.length}});
   console.log('text-zoom 200%',r,JSON.stringify(m)); await p.screenshot({path:`${S}textzoom${r.replace(/\//g,'_')}.png`}); } }
// 3) forced colors
{ const ctx=await b.newContext({viewport:{width:1280,height:900},forcedColors:'active',colorScheme:'dark'}); const p=await ctx.newPage();
  for (const r of ['/','/sp/santo-andre']) { await p.goto(B+r,{waitUntil:'networkidle'}); await p.waitForTimeout(400); await p.screenshot({path:`${S}forced${r.replace(/\//g,'_')}.png`});
   await p.evaluate(()=>{const el=[...document.querySelectorAll('h2')].find(h=>/Mapa|Onde fica/.test(h.textContent)); scrollTo(0,el.getBoundingClientRect().top+scrollY-120)}); await p.waitForTimeout(300); await p.screenshot({path:`${S}forced-map${r.replace(/\//g,'_')}.png`}); }
  // segmented selected state in forced colors
  await p.goto(B+'/',{waitUntil:'networkidle'}); await p.screenshot({path:`${S}forced-segmented.png`,clip:{x:0,y:230,width:1440>1280?1280:1280,height:60}});
}
// 4) reduced motion check: transitions/animations durations
{ const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}); const p=await ctx.newPage(); await p.goto(B+'/',{waitUntil:'networkidle'});
  const m=await p.evaluate(()=>{let anim=0,smooth=getComputedStyle(document.documentElement).scrollBehavior; for(const e of document.querySelectorAll('*')){const s=getComputedStyle(e); if(parseFloat(s.animationDuration)>0.01&&s.animationName!=='none') anim++;} return {anim,smooth}}); console.log('reduced-motion',JSON.stringify(m)); }
// 5) print
{ const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
  for (const r of ['/','/sp/santo-andre']) { await p.goto(B+r,{waitUntil:'networkidle'}); await p.waitForTimeout(400); await p.emulateMedia({media:'print'});
   const m=await p.evaluate(()=>({header:getComputedStyle(document.querySelector('body > header, header')).position, stickySub:[...document.querySelectorAll('.sticky')].map(e=>getComputedStyle(e).position).join(','), printRules:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return []}}).filter(r=>r.media&&/print/.test(r.media.mediaText)).length}));
   console.log('print',r,JSON.stringify(m));
   await p.pdf({path:`${S}print${r.replace(/\//g,'_')}.pdf`,format:'A4',printBackground:true}); await p.screenshot({path:`${S}print${r.replace(/\//g,'_')}.png`,fullPage:false}); await p.emulateMedia({media:'screen'}); } }
await b.close();
