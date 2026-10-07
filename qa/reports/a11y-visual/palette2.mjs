import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
const act=()=>p.evaluate(()=>{const e=document.activeElement;return `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent||'').trim().slice(0,30)}" inDialog=${!!e.closest('[role=dialog]')} dialogs=${document.querySelectorAll('[role=dialog]').length}`});
await p.goto('http://localhost:3210/',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); // skip link
await p.keyboard.press('Meta+k'); await p.waitForTimeout(500); console.log('open',await act());
await p.keyboard.type('santo'); await p.waitForTimeout(500);
for(let i=1;i<=3;i++){await p.keyboard.press('Tab'); await p.waitForTimeout(150); console.log('tab',i,await act());}
await p.keyboard.press('Escape'); await p.waitForTimeout(400); console.log('esc', await act());
// open with ctrl+k from a link with focus
await p.focus('a[href="/explorar"]'); await p.keyboard.press('Control+k'); await p.waitForTimeout(500); console.log('ctrl+k',await act());
await p.keyboard.press('Escape'); await p.waitForTimeout(400); console.log('esc', await act());
await b.close();
