import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto(B+'/',{waitUntil:'networkidle'});
// home search field
const hs = p.getByText('Digite o nome da sua cidade').first();
const hsb = await hs.locator('xpath=ancestor-or-self::button[1]').boundingBox().catch(()=>null);
console.log('home search box', hsb);
await hs.tap(); await p.waitForTimeout(1200);
const input = p.locator('[cmdk-input], input[placeholder*="Buscar"], input[placeholder*="cidade"]').first();
console.log('palette input visible', await input.isVisible(), 'focused', await input.evaluate(e=>e===document.activeElement));
await p.screenshot({path:'search_open.png'});
const close = p.getByRole('button',{name:/Fechar/i}); console.log('close btn', await close.count(), await close.first().boundingBox().catch(()=>null));
const qs=['conceicao do almeda','sto antonio','sao joao','S. Paulo','bom jesus go','sao joao pi','itapeva','feira santana','goiania','bahia','para','agua fria','cachoeira','sta luzia','xique xique','xiquexique','olho dagua'];
for (const q of qs){ await input.fill(q); await p.waitForTimeout(700);
  const items = await p.locator('[cmdk-item]').allInnerTexts();
  const more = await p.locator('[cmdk-list]').innerText().catch(()=> '');
  const extra = (more.match(/(ver todos[^\n]*|\+\s?\d+[^\n]*|Você quis dizer[^\n]*|Nenhum[^\n]*)/i)||[''])[0];
  console.log(JSON.stringify(q),'=>',items.length, items.slice(0,5).map(s=>s.replace(/\s+/g,' ')).join(' | '), '||', extra);
  if (['conceicao do almeda','sao joao'].includes(q)) await p.screenshot({path:`search_${q.replace(/\W+/g,'_')}.png`});
}
// ver todos
await input.fill('sao joao'); await p.waitForTimeout(600);
const vt = p.getByText(/ver todos/i).first();
if (await vt.count()) { await vt.tap(); await p.waitForTimeout(800); console.log('after ver todos items', await p.locator('[cmdk-item]').count(), p.url()); await p.screenshot({path:'search_vertodos.png'}); }
// close
if (await close.count()) { await close.first().tap(); await p.waitForTimeout(400); console.log('palette closed', !(await input.isVisible().catch(()=>false))); }
// nav labels
console.log('nav', (await p.locator('header nav a, nav a').allInnerTexts()).slice(0,8));
console.log('scrollWidth', await p.evaluate(()=>document.documentElement.scrollWidth));
console.log('errs',errs); await b.close();
