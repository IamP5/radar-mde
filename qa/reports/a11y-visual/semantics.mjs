import { chromium } from 'playwright';
const ROUTES=['/','/regiao/sudeste','/sp','/sp/santo-andre','/explorar','/acompanhar','/dados','/sobre'];
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage();
for(const r of ROUTES){
 await p.goto('http://localhost:3210'+r,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(500);
 const info=await p.evaluate(()=>{
  const vis=e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'};
  const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map(h=>h.tagName[1]+' '+h.textContent.trim().slice(0,50));
  const lm=[...document.querySelectorAll('header,nav,main,footer,aside,[role=region],section[aria-label],section[aria-labelledby],[role=search]')].map(e=>`${e.tagName.toLowerCase()}${e.getAttribute('role')?'['+e.getAttribute('role')+']':''}${e.getAttribute('aria-label')?' "'+e.getAttribute('aria-label')+'"':''}`);
  const svgs=[...document.querySelectorAll('main svg')].filter(s=>s.getBoundingClientRect().width>120).map(s=>{const lab=s.getAttribute('aria-label')||s.closest('[aria-label]')?.getAttribute('aria-label')||'';return `${s.getAttribute('role')||'-'} hidden=${!!s.closest('[aria-hidden=true]')} label="${lab.slice(0,70)}" w=${Math.round(s.getBoundingClientRect().width)} paths=${s.querySelectorAll('path').length} focusable=${s.querySelectorAll('[tabindex],a').length}`});
  const live=[...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].map(e=>`${e.getAttribute('role')||''} live=${e.getAttribute('aria-live')} "${e.textContent.trim().slice(0,50)}"`);
  const unnamed=[...document.querySelectorAll('button,a[href],[role=button],[role=radio],[role=tab]')].filter(e=>!(e.getAttribute('aria-label')||e.textContent.trim()||e.getAttribute('title')||e.getAttribute('aria-labelledby'))).map(e=>e.outerHTML.slice(0,120));
  const tables=[...document.querySelectorAll('table')].map(t=>`caption=${!!t.querySelector('caption')} rows=${t.rows.length} th=${t.querySelectorAll('th').length}`);
  const titleAttrOnly=[...document.querySelectorAll('[title]')].filter(e=>!['BUTTON','A','ABBR'].includes(e.tagName)).length;
  return {title:document.title,lang:document.documentElement.lang,hs,lm,svgs,live,unnamed,tables,titleAttrOnly};
 });
 console.log('\n=====',r,JSON.stringify(info,null,1));
}
await b.close();
