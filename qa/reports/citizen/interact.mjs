import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
const popups=[]; ctx.on('page',pg=>popups.push(pg.url()));
await p.goto(B+'/ba/conceicao-do-almeida',{waitUntil:'networkidle'});
// Watch
const w = p.locator('button[aria-pressed]').first();
await w.tap(); await p.waitForTimeout(400);
await p.screenshot({path:'watch_after_tap.png',clip:{x:0,y:180,width:390,height:160}});
console.log('watch pressed', await w.getAttribute('aria-pressed'), await w.innerHTML().then(h=>h.match(/lucide-([a-z-]+)/)?.[1]));
console.log('LS', await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))));
// Share
const s = p.getByRole('button',{name:/Compartilhar/});
await s.tap(); await p.waitForTimeout(500);
await p.screenshot({path:'share_menu.png'});
const wa = p.getByRole('menuitem',{name:/WhatsApp/});
const [pop] = await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null), wa.tap()]);
console.log('wa popup', pop && decodeURIComponent(pop.url()));
if (pop) await pop.close();
// Charts: tap on trend chart
const charts = p.locator('.recharts-wrapper');
console.log('charts', await charts.count());
const c0 = charts.first(); await c0.scrollIntoViewIfNeeded(); const bb = await c0.boundingBox();
await p.touchscreen.tap(bb.x+bb.width*0.8, bb.y+bb.height*0.5); await p.waitForTimeout(500);
console.log('tooltip visible after tap:', await p.locator('.recharts-tooltip-wrapper').first().evaluate(e=>getComputedStyle(e).visibility+' '+e.innerText.replace(/\s+/g,' ')).catch(e=>'none'));
await p.screenshot({path:'chart_tap.png'});
// Vizinhos rows tap targets
const viz = await p.evaluate(()=>{const h=[...document.querySelectorAll('h2,h3,div')].find(e=>e.textContent.trim()==='Vizinhos'); const panel=h?.closest('section,[class*=rounded]'); return [...(panel?.querySelectorAll('a')||[])].slice(0,3).map(a=>({href:a.getAttribute('href'),h:a.getBoundingClientRect().height}));});
console.log('vizinhos links', JSON.stringify(viz));
// small tap targets on page
const small = await p.evaluate(()=>[...document.querySelectorAll('a,button,[role=tab],select,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<32)}).map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,30)+':'+Math.round(e.getBoundingClientRect().height)).slice(0,40));
console.log('small targets', small.length, small.join(' | '));
// small fonts
const fonts = await p.evaluate(()=>{const m={};for(const e of document.querySelectorAll('body *')){if(!e.childNodes.length||![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const f=parseFloat(getComputedStyle(e).fontSize);if(f<12){m[f]=(m[f]||0)+1;}}return m;});
console.log('fonts<12px', JSON.stringify(fonts));
// Action kit tabs
const tabs = await p.getByRole('tab').allInnerTexts(); console.log('kit tabs', tabs);
const copyBtn = p.getByRole('button',{name:/Copiar texto/}).first(); await copyBtn.scrollIntoViewIfNeeded(); await copyBtn.tap(); await p.waitForTimeout(300);
console.log('clipboard head', (await p.evaluate(()=>navigator.clipboard.readText())).slice(0,80));
console.log('errors',errs); await b.close();
