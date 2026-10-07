import { chromium, devices } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
for (const u of ['/','/ba/conceicao-do-almeida','/acompanhar']) {
 const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage();
 const list=[]; p.on('requestfinished',async r=>{const s=await r.sizes().catch(()=>null); if(s) list.push({u:r.url().replace(B,'').slice(0,70),kb:Math.round((s.responseBodySize+s.responseHeadersSize)/1024)})});
 await p.goto(B+u,{waitUntil:'networkidle'}); await p.waitForTimeout(6000);
 const tot=list.reduce((a,x)=>a+x.kb,0); const data=list.filter(x=>/data|geo|json|topo/.test(x.u));
 console.log(u,'totalKB',tot,'n',list.length,'data:',JSON.stringify(data));
 await ctx.close();
}
await b.close();
