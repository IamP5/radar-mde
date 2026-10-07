import { chromium } from 'playwright';
const BASE=process.env.BASE||'http://localhost:3210';
const ROUTES = {home:'/', sudeste:'/regiao/sudeste', sp:'/sp', santo:'/sp/santo-andre', explorar:'/explorar', acompanhar:'/acompanhar', dados:'/dados', sobre:'/sobre', '404':'/rota-inexistente'};
const combos = (process.argv[2]||'light:1440,light:375,dark:1440,dark:375,light:320,light:768,light:1024').split(',');
const b = await chromium.launch();
for (const c of combos) { const [theme,w]=c.split(':');
  const ctx = await b.newContext({viewport:{width:+w,height:900}, colorScheme:theme, reducedMotion:'reduce', deviceScaleFactor: +w<500?2:1});
  await ctx.addInitScript(t=>localStorage.setItem('theme',t), theme);
  const p = await ctx.newPage();
  for (const [n,r] of Object.entries(ROUTES)) {
    await p.goto(BASE+r,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(500);
    const dark = await p.evaluate(()=>document.documentElement.classList.contains('dark'));
    await p.screenshot({path:new URL('./'+(process.env.SHOTDIR||'shots')+'/',import.meta.url).pathname+`${n}-${theme}-${w}.png`, fullPage:true});
    const h = await p.evaluate(()=>document.documentElement.scrollHeight);
    console.log(n,theme,w,'darkClass',dark,'h',h);
  }
  await ctx.close();
}
await b.close();
