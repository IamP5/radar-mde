import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
const S=new URL('./'+(process.env.SHOTDIR||'shots')+'/',import.meta.url).pathname;
const act=()=>p.evaluate(()=>{const e=document.activeElement;return `${e.tagName.toLowerCase()}[${e.getAttribute('role')||''}] "${(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent||'').trim().slice(0,40)}" inDialog=${!!e.closest('[role=dialog]')}`});
await p.goto((process.env.BASE||'http://localhost:3210')+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
// skip link
await p.keyboard.press('Tab'); await p.screenshot({path:S+'k-skiplink.png',clip:{x:0,y:0,width:500,height:120}});
await p.keyboard.press('Enter'); await p.waitForTimeout(200); console.log('after skip:',await act(), 'hash', await p.evaluate(()=>location.hash));
await p.keyboard.press('Tab'); console.log('next tab after skip:',await act());
// palette
await p.keyboard.press('Meta+k'); await p.waitForTimeout(400);
let open=await p.locator('[role=dialog]').count(); console.log('palette open via Meta+K:',open, await act());
if(!open){ await p.keyboard.press('Control+k'); await p.waitForTimeout(400); open=await p.locator('[role=dialog]').count(); console.log('ctrl+k',open, await act()); }
const dlg=await p.evaluate(()=>{const d=document.querySelector('[role=dialog]'); return d?{label:d.getAttribute('aria-label')||d.getAttribute('aria-labelledby'),modal:d.getAttribute('aria-modal'),title:d.querySelector('h2')?.textContent}:null}); console.log('dialog',dlg);
await p.keyboard.type('santo'); await p.waitForTimeout(600);
const opts=await p.evaluate(()=>{const lb=document.querySelector('[role=listbox]'); const inp=document.activeElement; return {listbox:!!lb, opts:document.querySelectorAll('[role=option]').length, activedesc:inp.getAttribute('aria-activedescendant'), controls:inp.getAttribute('aria-controls'), expanded:inp.getAttribute('aria-expanded'), live:[...document.querySelectorAll('[role=dialog] [aria-live],[role=dialog] [role=status]')].map(x=>x.textContent.slice(0,40))}}); console.log('combobox',opts);
await p.screenshot({path:S+'k-palette.png'});
for(let i=0;i<12;i++){await p.keyboard.press('Tab');} console.log('after 12 tabs in palette:',await act());
await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('after Esc:',await act(), 'dialogs', await p.locator('[role=dialog]').count());
// theme toggle via keyboard
// segmented radiogroup arrows
await p.goto((process.env.BASE||'http://localhost:3210')+'/sp',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
const r=p.locator('[role=radiogroup] [role=radio][aria-checked=true]').nth(1); await r.focus(); console.log('focused',await act());
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); console.log('after →',await act());
// Select (combobox) in /sp filters
const cb=p.locator('button[role=combobox]').first(); await cb.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('select open',await act(), await p.locator('[role=listbox]').count());
await p.keyboard.press('ArrowDown'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('select after esc',await act());
// "Trocar de estado" popover
const tr=p.getByRole('button',{name:'Trocar de estado'}); await tr.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('popover open focus:',await act()); await p.screenshot({path:S+'k-trocar.png',clip:{x:0,y:0,width:1280,height:600}});
for(let i=0;i<40;i++) await p.keyboard.press('Tab'); console.log('after 40 tabs:',await act());
await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('after esc:',await act());
// santo andre share / watch
await p.goto((process.env.BASE||'http://localhost:3210')+'/sp/santo-andre',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
const sh=p.getByRole('button',{name:'Compartilhar'}); await sh.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400); console.log('share menu:',await act(), await p.locator('[role=menu]').count());
await p.screenshot({path:S+'k-share.png',clip:{x:0,y:0,width:1280,height:500}});
await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('after esc:',await act());
const w=p.getByRole('button',{name:'Acompanhar'}); await w.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('watch pressed:', await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/Acompanh/.test(b.textContent)).map(b=>b.outerHTML.slice(0,200))), await act());
const live=await p.evaluate(()=>[...document.querySelectorAll('[aria-live],[role=status]')].map(x=>x.textContent.slice(0,60))); console.log('live',live);
await b.close();
