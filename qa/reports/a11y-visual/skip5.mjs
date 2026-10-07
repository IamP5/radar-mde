import { chromium } from 'playwright';
const B=process.env.BASE; const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
await p.goto(B+'/sp/santo-andre',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
console.log('main tabindex', await p.getAttribute('main','tabindex'));
await p.focus('a[href="#conteudo"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
console.log('after skip', await p.evaluate(()=>document.activeElement.tagName+'#'+document.activeElement.id));
await p.keyboard.press('Tab'); console.log('next', await p.evaluate(()=>document.activeElement.textContent.trim().slice(0,30)));
// emptyState role on /acompanhar empty
const c2=await b.newContext(); const p2=await c2.newPage(); await p2.goto(B+'/acompanhar',{waitUntil:'networkidle'}); await p2.waitForTimeout(500);
console.log('empty acompanhar status roles', await p2.evaluate(()=>[...document.querySelectorAll('[role=status]')].map(e=>e.textContent.slice(0,40))));
await p2.screenshot({path:new URL('./r2/shots/acompanhar-empty.png',import.meta.url).pathname,clip:{x:0,y:200,width:1280,height:420}});
await b.close();
