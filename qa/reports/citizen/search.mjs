import { chromium, devices } from 'playwright';
const B='http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({...devices['iPhone 13']});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto(B+'/',{waitUntil:'networkidle'});
const btn = p.getByRole('button',{name:/buscar|pesquis|search/i}).first();
console.log('search btn box', await btn.boundingBox(), await btn.getAttribute('aria-label'));
await btn.tap();
await p.waitForTimeout(800);
await p.screenshot({path:'search_open.png'});
const input = p.getByPlaceholder(/Buscar município/);
const qs = ['sao joao','São João','S. Paulo','sao paulo','itapeva','conceicao do almeda','conceição almeida','feira de santana','feira santana','picos','picos pi','agua fria','Bom Jesus','bom jesus go','goiania','goiânia','santo antonio de jesus','sto antonio','sao goncalo','mundo novo ba'];
for (const q of qs) {
  await input.fill(''); await input.type(q,{delay:20}); await p.waitForTimeout(700);
  const items = await p.locator('[cmdk-item]').allInnerTexts();
  console.log(JSON.stringify(q),'=>',items.length, items.slice(0,6).map(s=>s.replace(/\s+/g,' ')).join(' | '));
  if (['sao joao','itapeva','conceicao do almeda'].includes(q)) await p.screenshot({path:`search_${q.replace(/\W+/g,'_')}.png`});
}
// tap first result for itapeva
await input.fill('itapeva'); await p.waitForTimeout(600);
const it = p.locator('[cmdk-item]').first(); console.log('item box', await it.boundingBox());
await it.tap(); await p.waitForURL(/itapeva/,{timeout:60000}); console.log('went to', p.url());
console.log('errors',errs); await b.close();
