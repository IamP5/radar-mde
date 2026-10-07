import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13'], acceptDownloads:true});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto(B+'/ba/conceicao-do-almeida',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
// email flow
const agir = p.locator('#agir');
await agir.scrollIntoViewIfNeeded();
const mail = agir.getByRole('link',{name:/E-mail/}).or(agir.getByRole('button',{name:/E-mail/})).first();
console.log('mail tag', await mail.evaluate(e=>e.tagName+' href='+(e.getAttribute('href')||'').slice(0,160)+' len='+(e.getAttribute('href')||'').length));
await p.evaluate(()=>navigator.clipboard.writeText('x'));
// intercept navigation to mailto
let mailto=null; p.on('framenavigated',f=>{}); await p.route('**/*',r=>r.continue());
const navP = p.evaluate(()=>new Promise(res=>{const o=window.open;window.open=(u,...a)=>{res('open:'+u);return null};const d=Object.getOwnPropertyDescriptor(Location.prototype,'href');document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&a.href.startsWith('mailto')){e.preventDefault();res('a:'+a.href)}},true);setTimeout(()=>res('none'),4000)}));
await mail.tap(); const r = await navP; mailto = r;
console.log('mail action', decodeURIComponent(mailto).slice(0,400), 'len', mailto.length);
await p.waitForTimeout(400);
const clip = await p.evaluate(()=>navigator.clipboard.readText()); console.log('clipboard after email', clip.length, clip.slice(0,60).replace(/\n/g,' '));
console.log('status', (await agir.locator('[role=status]').allInnerTexts()).join(' / '));
await agir.screenshot({path:'kit_after_email.png'});
// edit text then switch tab and back (persist)
const ta = agir.locator('textarea').first(); await ta.click(); await p.keyboard.press('End'); await ta.evaluate(e=>{e.setSelectionRange(0,0)}); await p.keyboard.type('MARIA ');
await agir.getByText('Avisar o conselho do Fundeb').tap(); await p.waitForTimeout(300); await agir.getByText('Pedir informações').first().tap(); await p.waitForTimeout(300);
console.log('edit kept', (await agir.locator('textarea').first().inputValue()).startsWith('MARIA'));
// chart download menu
const menus = p.getByRole('button',{name:/baixar|download|exportar|opções do gráfico|mais opções|ações/i});
console.log('chart action buttons', await menus.count(), (await menus.evaluateAll(es=>es.map(e=>(e.getAttribute('aria-label')||e.innerText)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)))).slice(0,6));
const m0 = menus.first(); await m0.scrollIntoViewIfNeeded(); await m0.tap(); await p.waitForTimeout(500);
const items = await p.getByRole('menuitem').allInnerTexts(); console.log('menu items', items);
await p.screenshot({path:'chart_menu.png'});
for (const it of items) {
  if (!/PNG|SVG|CSV|imagem|dados/i.test(it)) continue;
  const [dl] = await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null), p.getByRole('menuitem',{name:it,exact:true}).tap()]);
  if (dl) { const f='dl_'+dl.suggestedFilename(); await dl.saveAs(f); console.log('download', it, '->', dl.suggestedFilename()); } else console.log('no download for', it);
  await p.waitForTimeout(500); if (it!==items[items.length-1]) { await m0.tap(); await p.waitForTimeout(400); }
}
await p.keyboard.press('Escape');
// IPCA
const ipcaTxt = (await p.locator('main').innerText()).split('\n').filter(l=>/IPCA|corrigid|valores de hoje|em R\$ de/i.test(l)); console.log('IPCA lines', ipcaTxt.slice(0,8));
const ipcaToggle = p.getByRole('radio',{name:/IPCA|Corrigido/i}).or(p.getByRole('button',{name:/IPCA|Corrigido/i})).or(p.getByRole('tab',{name:/IPCA|Corrigido/i}));
console.log('ipca toggles on city', await ipcaToggle.count());
const def = p.getByText(/Déficit até/).first(); await def.scrollIntoViewIfNeeded(); const card = def.locator('xpath=ancestor::*[contains(@class,"rounded")][1]'); await card.screenshot({path:'deficit_card.png'});
const pa = p.getByText('Investimento por aluno').first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]'); await pa.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await pa.screenshot({path:'per_aluno.png'});
console.log('per aluno text', (await pa.innerText()).replace(/\s+/g,' ').slice(0,300));
console.log('errs', errs); await b.close();
