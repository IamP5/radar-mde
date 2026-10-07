import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto(B+'/ba/conceicao-do-almeida',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
// Watch
const w = p.locator('button[aria-pressed]').first();
for (let i=0;i<2;i++){ await w.tap(); await p.waitForTimeout(400); console.log('watch tap',i,await w.getAttribute('aria-pressed'), (await w.innerHTML()).match(/lucide-([a-z-]+)/)?.[1], (await w.innerText()).trim()); await p.screenshot({path:`watch_${i}.png`,clip:{x:0,y:330,width:390,height:140}}); }
const toast = await p.locator('[data-sonner-toast], [role=status]').allInnerTexts(); console.log('status texts', toast.filter(Boolean).slice(0,4));
// glossary terms
const terms = p.locator('button:has-text("MDE"), [data-glossary], abbr, button.underline');
const gl = await p.evaluate(()=>[...document.querySelectorAll('button,[role=button]')].filter(e=>/decoration-dotted|underline-offset|border-dotted/.test(e.className)).map(e=>e.innerText.trim()).slice(0,30));
console.log('glossary triggers', gl.length, gl);
const first = p.locator('button', {hasText:/^MDE$/}).first();
if (await first.count()){ const bb=await first.boundingBox(); console.log('MDE trigger box',bb); await first.tap(); await p.waitForTimeout(600);
  const pop = await p.locator('[role=dialog], [data-popup], [role=tooltip], [data-side]').allInnerTexts(); console.log('popover', pop.map(s=>s.slice(0,200)));
  await p.screenshot({path:'glossary_mde.png'});
  await p.touchscreen.tap(380, 800); await p.waitForTimeout(400);
  console.log('popover after outside tap', (await p.locator('[role=dialog], [role=tooltip], [data-side]').count()));
}
// "O que posso fazer?" anchor
await p.evaluate(()=>scrollTo(0,0));
const oq = p.getByRole('link',{name:/O que posso fazer/}).or(p.getByRole('button',{name:/O que posso fazer/})).first();
await oq.tap(); await p.waitForTimeout(1200);
const agir = await p.evaluate(()=>{const e=document.getElementById('agir');return e? Math.round(e.getBoundingClientRect().top):null});
console.log('after O que posso fazer: #agir top', agir, p.url());
await p.screenshot({path:'agir_jump.png'});
// kit cards
const cards = await p.locator('#agir [role=radio], #agir [role=tab], #agir button').allInnerTexts(); console.log('kit buttons', cards.map(s=>s.replace(/\s+/g,' ')).slice(0,12));
const card4 = p.locator('#agir').getByText(/Tribunal de Contas ou ao MP/).first(); await card4.tap(); await p.waitForTimeout(400);
console.log('para after card4', (await p.locator('#agir').innerText()).match(/Para:[^\n]*/)?.[0]);
const [pop] = await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null), p.locator('#agir').getByRole('button',{name:/WhatsApp/}).or(p.locator('#agir').getByRole('link',{name:/WhatsApp/})).first().tap()]);
const waurl = pop ? decodeURIComponent(pop.url()) : null; console.log('wa kit url len', waurl?.length, waurl?.slice(0,250)); if(pop) await pop.close();
const mail = p.locator('#agir').getByRole('link',{name:/E-mail/}).or(p.locator('#agir').getByRole('button',{name:/E-mail/})).first();
console.log('mail href', (await mail.getAttribute('href'))?.slice(0,200), 'len', (await mail.getAttribute('href'))?.length);
const sizes = await p.evaluate(()=>[...document.querySelectorAll('#agir a,#agir button')].map(e=>(e.innerText||'').trim().slice(0,25)+':'+Math.round(e.getBoundingClientRect().height)));
console.log('kit target heights', sizes.join(' | '));
// chart focus ring
const c = p.locator('.recharts-wrapper').first(); await c.scrollIntoViewIfNeeded(); const cb = await c.boundingBox();
for (let k=0;k<2;k++){ await p.touchscreen.tap(cb.x+cb.width*0.8, cb.y+cb.height*0.5); await p.waitForTimeout(500);
 console.log('chart active', await p.evaluate(()=>{const a=document.activeElement;const cs=getComputedStyle(a);return a.tagName+' '+cs.outlineStyle+' '+cs.outlineWidth}));}
await p.screenshot({path:'chart_tap.png',clip:{x:0,y:Math.max(0,cb.y-10),width:390,height:cb.height+20}});
// year picker
await p.evaluate(()=>scrollTo(0,0));
const y24 = p.getByRole('radio',{name:'2024'}).or(p.getByRole('button',{name:'2024'})).or(p.getByRole('tab',{name:'2024'})).first();
await y24.tap(); await p.waitForTimeout(1000);
console.log('url after 2024', p.url()); console.log('hero', (await p.locator('main').innerText()).split('\n').filter(l=>/Em 2024|aplicou/.test(l)).slice(0,2));
await p.screenshot({path:'year2024.png'});
const sh = p.getByRole('button',{name:/Compartilhar/}); await sh.tap(); await p.waitForTimeout(400);
const [pop2] = await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null), p.getByRole('menuitem',{name:/WhatsApp/}).tap()]);
console.log('share wa', pop2 && decodeURIComponent(pop2.url())); if(pop2) await pop2.close();
// targets
const small = await p.evaluate(()=>[...document.querySelectorAll('a,button,[role=tab],[role=radio]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<24}).map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,20)+':'+Math.round(e.getBoundingClientRect().height)));
console.log('targets <24px', small.length, small.slice(0,20).join(' | '));
console.log('scrollWidth', await p.evaluate(()=>document.documentElement.scrollWidth));
console.log('errs',errs); await b.close();
