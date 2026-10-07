import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
const p = await ctx.newPage();
let bytes=0; const reqs=[]; p.on('response',async r=>{ if(r.url().includes('/data/')) reqs.push(r.url().replace(B,''));});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto(B+'/',{waitUntil:'networkidle'});
const map = p.locator('svg').filter({has:p.locator('path')}).nth(0);
// find map panel
const panel = p.getByText('Mapa · Brasil').locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
await panel.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
await p.screenshot({path:'home_map.png'});
const paths = panel.locator('svg path');
console.log('map paths', await paths.count());
// tap on Bahia: find path with aria-label or title
const info = await panel.locator('svg path').evaluateAll(ps=>ps.slice(0,30).map(p=>p.getAttribute('aria-label')||p.getAttribute('data-uf')||p.querySelector('title')?.textContent||''));
console.log('labels', info.slice(0,10));
const svg = panel.locator('svg').first(); const bb = await svg.boundingBox(); console.log('svg box',bb);
// tap center-east (Bahia approx)
const url0=p.url();
await p.touchscreen.tap(bb.x+bb.width*0.78, bb.y+bb.height*0.45); await p.waitForTimeout(1500);
await p.screenshot({path:'home_map_tap1.png'});
console.log('after tap url', p.url());
await p.waitForTimeout(3000); console.log('after 3s', p.url());
// Municípios toggle
await p.goto(B+'/',{waitUntil:'networkidle'});
const munBtn = p.getByRole('radio',{name:'Municípios'}).or(p.getByRole('button',{name:'Municípios'})).or(p.getByRole('tab',{name:'Municípios'})).first();
await munBtn.tap(); await p.waitForTimeout(6000);
await panel.scrollIntoViewIfNeeded(); await p.screenshot({path:'home_map_mun.png'});
console.log('data reqs', reqs);
console.log('errs',errs); await b.close();
