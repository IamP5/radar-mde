import { chromium } from 'playwright';
import fs from 'fs';
const B='http://localhost:3299', D='reports/journalist/r2/';
const b = await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(p.url()+' '+m.text()));
const txt=async()=> (await p.locator('main').innerText());
const go=async(u)=>{await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);};
// JOR-01 city ano
for (const r of [1,2]){ await go('/rs/porto-alegre?ano=2021'); const t=await txt(); console.log('J01', t.match(/MDE \d{4}\n[^\n]+/)?.[0]?.replace('\n',' '), '|', (t.match(/Em \d{4}[^\n]{0,120}/)||[])[0]); }
await p.screenshot({path:D+'city-poa-2021.png',fullPage:true}); fs.writeFileSync(D+'city-poa-2021.txt',await txt());
// share link
const sb=p.getByRole('button',{name:/Compartilhar/}).first(); if(await sb.count()){await sb.click();await p.waitForTimeout(300); const mi=p.getByRole('menuitem',{name:/Copiar/}); if(await mi.count()){await mi.click();await p.waitForTimeout(300); console.log('J01 share clip', await p.evaluate(()=>navigator.clipboard.readText()).catch(e=>e.message));} else console.log('menu', await p.getByRole('menuitem').allInnerTexts()); await p.keyboard.press('Escape');}
// JOR-02 map click
for (const r of [1,2]){ await go('/?ano=2021'); const map=p.locator('svg[aria-label^="Mapa"]').first(); await map.scrollIntoViewIfNeeded(); const sp=map.locator('[data-id="35"]'); const bb=await sp.boundingBox().catch(()=>null); if(!bb){console.log('J02 no SP shape');break;} await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:5}); await p.waitForTimeout(400); await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(3000); console.log('J02 map click ->',p.url()); }
await go('/?ano=2021');
console.log('J02 ufTable links', await p.locator('table a').evaluateAll(a=>a.slice(0,3).map(x=>x.getAttribute('href'))));
console.log('J02 deficit links', await p.locator('ol a').evaluateAll(a=>a.slice(0,2).map(x=>x.getAttribute('href'))));
const home=await txt(); fs.writeFileSync(D+'home-2021.txt',home);
await p.screenshot({path:D+'home-2021.png',fullPage:true});
await go('/'); fs.writeFileSync(D+'home.txt',await txt()); await p.screenshot({path:D+'home.png',fullPage:true});
console.log(errs); await b.close();
