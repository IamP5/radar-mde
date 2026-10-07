import { chromium } from 'playwright';
const S=new URL('./shots/',import.meta.url).pathname;
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light'}); const p=await ctx.newPage();
const cdp=await ctx.newCDPSession(p);
const targets=[['/','Mapa · Brasil','home-map'],['/','Evolução 2008','home-evol'],['/sp/santo-andre','Onde fica','santo-map'],['/explorar','Municípios','explorar-legend'],['/regiao/sudeste','Mapa · Região','sudeste-map']];
for(const [r,h,n] of targets){ await p.goto('http://localhost:3210'+r,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(500);
 const sec=p.locator('main section').filter({has:p.locator(`h2:has-text("${h}")`)}).last();
 for(const t of ['none','deuteranopia','protanopia','achromatopsia']){ await cdp.send('Emulation.setEmulatedVisionDeficiency',{type:t}); await p.waitForTimeout(200);
  await sec.screenshot({path:`${S}cvd-${n}-${t}.png`}); } await cdp.send('Emulation.setEmulatedVisionDeficiency',{type:'none'}); }
await b.close();
