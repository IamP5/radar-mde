import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:900}});
for (const u of ['/sp/buri','/sp/franca']) {
await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle'});
const alerts = await p.getByText('Sinais de alerta').locator('xpath=../../..').innerText();
await p.getByRole('tab',{name:/CACS/}).click(); await p.waitForTimeout(500);
const t = await p.locator('#agir textarea:visible').inputValue();
console.log('#####',u,'\nALERTS:',alerts.replace(/\n/g,' | ').slice(0,500),'\nCACS mentions Fundeb pay/70%?', /70%|60%|profissionais|remunera/.test(t), '\n', t.slice(0,300));
}
await b.close();
