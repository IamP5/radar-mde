import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
await p.goto(B+'/sp/santo-andre',{waitUntil:'networkidle'});
console.log('h1 snapshot:', await p.locator('h1').ariaSnapshot());
console.log('fonte links:', await p.evaluate(()=>[...document.querySelectorAll('a')].filter(a=>/SIOPE/.test(a.textContent)).slice(0,3).map(a=>a.getAttribute('aria-label')||a.textContent)));
for (const r of ['/','/regiao/sudeste','/sp','/sp/santo-andre']){ await p.goto(B+r,{waitUntil:'networkidle'});
 console.log(r,'table links:', await p.evaluate(()=>[...document.querySelectorAll('a,button')].filter(a=>/tabela/i.test(a.textContent)).map(a=>a.textContent.trim().slice(0,40)+' -> '+(a.getAttribute('href')||''))),
  'map describedby:', await p.evaluate(()=>[...document.querySelectorAll('svg[role],[role=group] svg, svg[aria-describedby]')].map(s=>s.getAttribute('aria-describedby')).filter(Boolean)));
}
// keyboard on home map
await p.goto(B+'/',{waitUntil:'networkidle'});
const g=p.locator('[role=group][aria-label^="Mapa"]'); console.log('map group label:', await g.getAttribute('aria-label'));
const first=g.locator('[tabindex="0"], a').first(); await first.focus(); await p.waitForTimeout(300);
console.log('focused shape:', await p.evaluate(()=>{const e=document.activeElement; return e.tagName+' '+(e.getAttribute('aria-label')||'')+' role='+e.getAttribute('role')}));
await p.screenshot({path:new URL('./r2/shots/map-kbd-focus.png',import.meta.url).pathname, clip:{x:0,y:550,width:900,height:380}});
await p.keyboard.press('Tab'); await p.waitForTimeout(200);
console.log('next:', await p.evaluate(()=>{const e=document.activeElement; return e.tagName+' '+(e.getAttribute('aria-label')||e.textContent.slice(0,30))}));
const nfocus=await g.locator('[tabindex="0"]').count(); console.log('tabbable shapes', nfocus, 'tabindex -1:', await g.locator('[tabindex="-1"]').count());
await b.close();
