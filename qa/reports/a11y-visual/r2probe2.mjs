import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210'; const S=new URL('./r2/shots/',import.meta.url).pathname;
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
await p.goto(B+'/sp/santo-andre',{waitUntil:'networkidle'});
const kit=p.locator('section').filter({has:p.locator('h2:has-text("O que você pode fazer")')});
console.log(await kit.locator('[role=tablist],[role=radiogroup]').first().ariaSnapshot().catch(e=>'no tablist'));
// glossary terms
const terms=await p.evaluate(()=>[...document.querySelectorAll('main [class*="decoration-dotted"], main abbr, main dfn, main [data-term]')].slice(0,6).map(e=>`${e.tagName} role=${e.getAttribute('role')} tabindex=${e.getAttribute('tabindex')} aria-describedby=${e.getAttribute('aria-describedby')} "${e.textContent.trim().slice(0,20)}" ${e.outerHTML.slice(0,140)}`));
console.log(terms.join('\n'));
const t=p.locator('main button', {hasText:/^MDE$/}).first(); 
if(await t.count()){ await t.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400); console.log('term popover:', await p.evaluate(()=>{const d=document.querySelector('[role=dialog],[role=tooltip],[data-slot=popover-content]'); return d? d.getAttribute('role')+' '+d.textContent.slice(0,100):'none'}), 'focus:', await p.evaluate(()=>document.activeElement.outerHTML.slice(0,80)));
 await p.screenshot({path:S+'glossary-popover.png',clip:{x:0,y:300,width:900,height:400}}); await p.keyboard.press('Escape'); await p.waitForTimeout(200); console.log('after esc focus:', await p.evaluate(()=>document.activeElement.textContent.slice(0,30)));}
// home info popover
await p.goto(B+'/',{waitUntil:'networkidle'});
const info=p.locator('button[aria-label*="Como"], button[aria-label*="Sobre"], button[aria-label*="calcul"], button[aria-label*="Saiba"]').first();
console.log('info buttons:', await p.evaluate(()=>[...document.querySelectorAll('main button')].filter(b=>b.querySelector('svg')&&b.textContent.trim()==='').map(b=>b.getAttribute('aria-label')).slice(0,6)));
const ib=p.locator('main button').filter({hasText:''}).and(p.locator('[aria-label]')).first();
const labels=await p.evaluate(()=>[...document.querySelectorAll('main button[aria-label]')].map(b=>b.getAttribute('aria-label')).slice(0,8)); console.log(labels);
await b.close();
