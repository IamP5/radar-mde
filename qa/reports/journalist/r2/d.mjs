import { chromium } from 'playwright';
const B='http://localhost:3299', D='reports/journalist/r2/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
for (const run of [1,2]) {
await p.goto(B+'/rs/porto-alegre?ano=2021',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await p.getByRole('button',{name:/Compartilhar/}).first().click(); await p.waitForTimeout(400);
const wa = await p.locator('a[href*="wa.me"], a[href*="whatsapp"]').first().getAttribute('href').catch(()=>null);
console.log('WA', run, wa && decodeURIComponent(wa));
await p.keyboard.press('Escape');
}
// home KPI tooltip
await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const tips = p.locator('button[aria-label*="Como"], button[aria-label*="calcul"], [data-slot=tooltip-trigger], button:has(svg.lucide-info)');
console.log('info triggers', await tips.count());
if (await tips.count()) { await tips.first().hover(); await tips.first().click().catch(()=>{}); await p.waitForTimeout(500); console.log('tip text', (await p.locator('[role=tooltip], [data-slot=popover-content], [data-slot=tooltip-content]').allInnerTexts()).join(' | ').slice(0,600)); }
await p.screenshot({path:D+'home-kpi.png',clip:{x:0,y:300,width:1440,height:500}});
// footer
console.log('footer', (await p.locator('footer').innerText()).replace(/\s+/g,' ').slice(0,500));
// UF table aluno format and grammar on state pages
const ufrows = await p.locator('table tbody tr').evaluateAll(rs=>rs.slice(0,3).map(r=>r.innerText.replace(/\s+/g,' ')));
console.log('uf rows', ufrows);
for (const u of ['/sp','/rs','/mg?ano=2021','/ac']) { await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1200); const t=await p.locator('main').innerText(); console.log(u,'|',(t.match(/Em 20\d\d,[^\n]*/)||[''])[0].slice(0,260)); const g=t.match(/Governo do estado\n[^\n]+\n[^\n]+/); console.log('   gov:', g&&g[0].replace(/\n/g,' / ')); const c=t.match(/Abaixo dos 25%\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+/); console.log('   card:', c&&c[0].replace(/\n/g,' / '));}
// deficit ellipsis
await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
console.log('deficit items', await p.locator('ol li').evaluateAll(l=>l.slice(0,3).map(x=>x.innerText.replace(/\s+/g,' '))));
console.log(errs); await b.close();
