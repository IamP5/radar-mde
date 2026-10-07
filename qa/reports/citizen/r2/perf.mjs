import { chromium } from 'playwright';
const B='http://localhost:3299';
const b = await chromium.launch();
for (const u of process.argv.slice(2)) {
 const ctx = await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 11; SM-A022M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'});
 const p = await ctx.newPage();
 const cdp = await ctx.newCDPSession(p);
 await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 let bytes=0; const big=[]; 
 cdp.on('Network.loadingFinished',e=>{bytes+=e.encodedDataLength;});
 cdp.on('Network.responseReceived',e=>{big.push({url:e.response.url,id:e.requestId})});
 const sizes={}; cdp.on('Network.loadingFinished',e=>sizes[e.requestId]=e.encodedDataLength);
 const t0=Date.now();
 await p.goto(B+u,{waitUntil:'load',timeout:300000}); const tLoad=Date.now()-t0;
 await p.waitForLoadState('networkidle',{timeout:300000}); const tIdle=Date.now()-t0;
 const nav = await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const fcp=performance.getEntriesByName('first-contentful-paint')[0];return {dcl:Math.round(n.domContentLoadedEventEnd),fcp:Math.round(fcp?.startTime||0)}});
 const top = big.map(r=>({u:r.url.replace(B,'').slice(0,90),kb:Math.round((sizes[r.id]||0)/1024)})).sort((a,b)=>b.kb-a.kb).slice(0,6);
 console.log(u,{totalKB:Math.round(bytes/1024),tLoad,tIdle,...nav}); console.log('  top',JSON.stringify(top));
 await ctx.close();
}
await b.close();
