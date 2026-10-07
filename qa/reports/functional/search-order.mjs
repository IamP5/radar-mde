import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:3210/sobre',{waitUntil:'networkidle'});
await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
const d=p.getByRole('dialog');
for (const q of ['mato grosso','goias','amapa','para','rio de janeiro']) {
  await d.getByRole('combobox').fill(q); await p.waitForTimeout(400);
  const o=(await d.getByRole('option').allInnerTexts()).map(s=>s.replace(/\n/g,' '));
  const sel=(await d.locator('[role=option][aria-selected=true]').allInnerTexts()).join().replace(/\n/g,' ');
  console.log(JSON.stringify(q),'| selected:',sel,'| n=',o.length,'| all:',o.join(' ; '),'| territory idx:',o.findIndex(x=>!/hab\./.test(x)));
}
await b.close();
