import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
const act=()=>p.evaluate(()=>{const e=document.activeElement;return `${e.tagName.toLowerCase()}[${e.getAttribute('role')||''}] "${(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent||'').trim().slice(0,40)}" inDialog=${!!e.closest('[role=dialog]')} dialogs=${document.querySelectorAll('[role=dialog]').length} ad=${e.getAttribute('aria-activedescendant')}`});
await p.goto('http://localhost:3210/',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
await p.getByRole('button',{name:/Buscar/}).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
console.log('open:',await act());
console.log(await p.evaluate(()=>{const d=document.querySelector('[role=dialog]');return d.outerHTML.slice(0,400)}));
for(let i=1;i<=5;i++){await p.keyboard.press('Tab'); await p.waitForTimeout(150); console.log('tab',i,await act());}
await p.keyboard.press('Escape'); await p.waitForTimeout(400); console.log('esc:',await act());
await p.getByRole('button',{name:/Buscar/}).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
await p.keyboard.type('campinas'); await p.waitForTimeout(500); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150);
console.log('arrow:',await act(), await p.evaluate(()=>[...document.querySelectorAll('[role=option]')].slice(0,3).map(o=>o.id+' sel='+o.getAttribute('aria-selected')+' '+o.textContent.slice(0,30))));
await p.keyboard.press('Escape'); await p.waitForTimeout(400); console.log('esc2:',await act());
await b.close();
