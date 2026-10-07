import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
for (const u of ['/','/ba']) {
await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
const t = p.getByRole('radio',{name:/IPCA|Corrigido/i}).or(p.getByRole('button',{name:/IPCA|Corrigido/i})).or(p.getByRole('tab',{name:/IPCA|Corrigido/i})).first();
console.log(u,'ipca toggle', await t.count());
if (await t.count()) { await t.scrollIntoViewIfNeeded(); const panel=t.locator('xpath=ancestor::*[contains(@class,"rounded-xl") or contains(@class,"rounded-lg")][1]');
 const before=(await panel.innerText()).replace(/\s+/g,' ').slice(0,260); await t.tap(); await p.waitForTimeout(600); const after=(await panel.innerText()).replace(/\s+/g,' ').slice(0,260);
 console.log(' before:',before,'\n after:',after); console.log(' url', p.url()); await panel.screenshot({path:`ipca_${u.replace(/\W/g,'')||'home'}.png`}); }
}
// watchlist
await p.goto(B+'/ba/conceicao-do-almeida',{waitUntil:'networkidle'}); await p.locator('button[aria-pressed]').first().tap(); await p.waitForTimeout(300);
await p.goto(B+'/acompanhar',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
console.log('acomp h1', await p.locator('h1').innerText(), '| footer', (await p.locator('footer a').allInnerTexts()).join('|'));
const cell = p.getByText('10,5',{exact:false}).first(); console.log('2024 cell', await cell.evaluate(e=>{const c=e.closest('[title],[aria-label]');return (c?.getAttribute('aria-label')||c?.getAttribute('title')||'')+' / '+e.parentElement.outerHTML.slice(0,200)}).catch(e=>'nf'));
await p.screenshot({path:'a360_acompanhar.png',fullPage:true});
console.log('errs',errs); await b.close();
