import { chromium } from 'playwright';
const BASE=process.env.BASE||'http://localhost:3210';
const ROUTES = {home:'/', sudeste:'/regiao/sudeste', sp:'/sp', santo:'/sp/santo-andre', explorar:'/explorar', acompanhar:'/acompanhar', dados:'/dados', sobre:'/sobre'};
const combos=(process.argv[2]||'light:1440').split(','); const only=process.argv[3]?.split(',');
const dir=new URL('./'+(process.env.SECDIR||'sec')+'/',import.meta.url).pathname;
const b = await chromium.launch();
for (const c of combos){ const [theme,w]=c.split(':');
 const ctx=await b.newContext({viewport:{width:+w,height:900},colorScheme:theme,reducedMotion:'reduce',deviceScaleFactor:+w<500?2:1});
 await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme); const p=await ctx.newPage();
 for (const [n,r] of Object.entries(ROUTES)){ if(only&&!only.includes(n))continue;
  await p.goto(BASE+r,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(600);
  await p.screenshot({path:`${dir}${n}-${theme}-${w}-00top.png`});
  const secs=await p.locator('main section').all(); let i=1;
  for(const s of secs){ const t=(await s.locator('h2,h3').first().textContent().catch(()=>''))||''; 
    try{await s.screenshot({path:`${dir}${n}-${theme}-${w}-${String(i).padStart(2,'0')}.png`}); console.log(n,theme,w,i,t.slice(0,50));}catch(e){console.log('fail',n,i)} i++; }
 } await ctx.close(); }
await b.close();
