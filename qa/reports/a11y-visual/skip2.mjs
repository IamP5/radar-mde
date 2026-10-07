import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
for (const r of ['/','/sp/santo-andre']){
await p.goto(B+r,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
const act=()=>p.evaluate(()=>{const e=document.activeElement;return `${e.tagName} id=${e.id} "${(e.textContent||'').trim().slice(0,30)}" url=${location.pathname}${location.hash}`});
await p.keyboard.press('Tab'); console.log(r,'tab1',await act());
await p.keyboard.press('Enter'); await p.waitForTimeout(400); console.log(r,'enter',await act());
await p.keyboard.press('Tab'); console.log(r,'tab2',await act());
}
await b.close();
