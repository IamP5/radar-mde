import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
const act=()=>p.evaluate(()=>{const e=document.activeElement;return `${e.tagName} "${(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)}"`});
console.log('initial',await act());
console.log(await p.evaluate(()=>[...document.querySelectorAll('body a, body button')].slice(0,8).map(e=>`${e.tagName} "${e.textContent.trim().slice(0,25)}" tabindex=${e.getAttribute('tabindex')} vis=${getComputedStyle(e).display}`).join('\n')));
for(let i=0;i<6;i++){await p.keyboard.press('Tab'); console.log(i+1, await act());}
await b.close();
