import { chromium } from 'playwright';
const B=process.env.BASE||'http://localhost:3210'; const S=new URL('./r2/shots/',import.meta.url).pathname;
const b=await chromium.launch();
async function ctx(theme,w,h=900){ const c=await b.newContext({viewport:{width:w,height:h},colorScheme:theme,reducedMotion:'reduce',deviceScaleFactor:w<500?2:1}); await c.addInitScript(t=>{localStorage.setItem('theme',t); localStorage.setItem('radar-mde:watch',JSON.stringify(['sp/santo-andre','sp/sao-paulo','rj/volta-redonda']));},theme); return c.newPage(); }
for (const [theme,w] of [['light',1280],['dark',768],['light',375],['dark',375]]) {
  const p=await ctx(theme,w,w<500?812:900); const tag=`${theme}-${w}`;
  // home info popover
  await p.goto(B+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
  await p.getByRole('button',{name:'Como o valor que faltou aplicar é calculado'}).click(); await p.waitForTimeout(400);
  await p.screenshot({path:`${S}info-popover-${tag}.png`}); await p.keyboard.press('Escape');
  // palette ver todos
  await p.getByRole('button',{name:/Buscar/}).first().click(); await p.waitForTimeout(500); await p.keyboard.type('santa'); await p.waitForTimeout(700);
  await p.screenshot({path:`${S}palette-${tag}.png`});
  const vt=p.getByText(/Ver todos/i).first(); if(await vt.count()){ await vt.click(); await p.waitForTimeout(800); await p.screenshot({path:`${S}palette-vertodos-${tag}.png`}); console.log(tag,'after ver todos url', p.url()); }
  await p.keyboard.press('Escape');
  // explorer + csv menu
  await p.goto(B+'/explorar',{waitUntil:'networkidle'}); await p.waitForTimeout(700);
  await p.screenshot({path:`${S}explorar-${tag}.png`});
  const csv=p.getByRole('button',{name:/CSV/}).first(); if(await csv.count()){ await csv.click(); await p.waitForTimeout(400); await p.screenshot({path:`${S}explorar-csvmenu-${tag}.png`}); await p.keyboard.press('Escape'); }
  await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(400); await p.screenshot({path:`${S}explorar-scrolled-${tag}.png`});
  // watchlist
  await p.goto(B+'/acompanhar',{waitUntil:'networkidle'}); await p.waitForTimeout(800); await p.screenshot({path:`${S}watch-${tag}.png`, fullPage:true});
  // footer
  await p.goto(B+'/sobre',{waitUntil:'networkidle'}); await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(300); await p.screenshot({path:`${S}footer-${tag}.png`});
  // UF page recurrence filter + table
  await p.goto(B+'/sp',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
  await p.evaluate(()=>{const el=[...document.querySelectorAll('h2')].find(h=>/Todos os munic/.test(h.textContent)); scrollTo(0,el.getBoundingClientRect().top+scrollY-160)}); await p.waitForTimeout(400);
  await p.screenshot({path:`${S}sp-table-${tag}.png`});
  await p.close(); console.log('done',tag);
}
await b.close();
