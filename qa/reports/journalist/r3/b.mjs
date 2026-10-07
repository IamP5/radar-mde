import { chromium } from 'playwright';
import fs from 'fs';
const B='http://localhost:3299', D='reports/journalist/r3/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
const go=async(u)=>{await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(2000);};
await go('/');
const tog=p.getByRole('radio',{name:/IPCA|Corrigido/}); console.log('ipca toggle',await tog.count());
const before=await p.locator('ol li').evaluateAll(l=>l.slice(0,5).map(x=>x.innerText.replace(/\s+/g,' ')));
if(await tog.count()){await tog.first().click(); await p.waitForTimeout(500);}
const after=await p.locator('ol li').evaluateAll(l=>l.slice(0,6).map(x=>x.innerText.replace(/\s+/g,' ')));
console.log('nominal',before); console.log('ipca',after, 'url', p.url());
const t=await p.locator('main').innerText(); console.log((t.match(/Maiores déficits[^\n]*\n[^\n]*/)||[''])[0]);
await p.screenshot({path:D+'deficits-ipca.png',fullPage:false});
// state delta wording
for (const u of ['/sp?ano=2021','/regiao/sul?ano=2021']) { await go(u); const s=await p.locator('main').innerText(); console.log(u, (s.match(/Abaixo dos 25%\n[^\n]+\n[^\n]+\n[^\n]+/)||[''])[0].replace(/\n/g,' / ')); }
// city page
await go('/rs/porto-alegre?ano=2021');
const ct=await p.locator('main').innerText(); fs.writeFileSync(D+'poa-2021.txt',ct);
console.log('city deficit', (ct.match(/Déficit[^\n]*\n[^\n]+\n[^\n]+\n?[^\n]*/)||[''])[0].replace(/\n/g,' / '));
const ex=p.getByRole('button',{name:/^Exportar/}); console.log('city export', await ex.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))));
if(await ex.count()){ await ex.first().click(); await p.waitForTimeout(400); const [dl]=await Promise.all([p.waitForEvent('download'), p.getByRole('menuitem',{name:/PNG/}).click()]); await dl.saveAs(D+'city-'+dl.suggestedFilename()); console.log('saved city', dl.suggestedFilename());
 await ex.first().click(); await p.waitForTimeout(400); const [d2]=await Promise.all([p.waitForEvent('download'), p.getByRole('menuitem',{name:/^Dados em CSV$/}).click()]); await d2.saveAs(D+'city-'+d2.suggestedFilename()); }
await p.getByRole('button',{name:/Compartilhar/}).first().click(); await p.waitForTimeout(400);
console.log('share items', await p.getByRole('menuitem').allInnerTexts());
const wa=await p.locator('[role=menu] a[href*="wa.me"]').first().getAttribute('href').catch(()=>null); console.log('share WA', wa&&decodeURIComponent(wa).slice(0,300));
await p.keyboard.press('Escape');
// explorer counts / invalid ano
await go('/explorar?ano=2008'); console.log('explorer 2008', (await p.locator('main').innerText()).match(/[\d.]+ de [\d.]+ municípios[^\n]*/)?.[0]);
await go('/explorar?ano=1999'); console.log('ano=1999 ->', p.url());
await go('/explorar?ano=2021'); const et=await p.locator('main').innerText(); console.log('explorer faltou card', (et.match(/Faltou aplicar[^\n]*\n[^\n]+\n[^\n]+/)||[''])[0].replace(/\n/g,' / '));
console.log('explorer top rows', await p.locator('table tbody tr').evaluateAll(rs=>rs.filter(r=>r.innerText.trim()).slice(0,3).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,170))));
await go('/explorar?ano=2021&situacao=abaixo&porte=p5&ordem=-faltou');
console.log('big cities', await p.locator('table tbody tr').evaluateAll(rs=>rs.filter(r=>r.innerText.trim()).slice(0,4).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,120))));
console.log(errs.slice(0,10)); await b.close();
