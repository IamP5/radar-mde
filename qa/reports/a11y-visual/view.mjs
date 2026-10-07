// node view.mjs <route> <theme> <width> <headingText|-> <outName> [offsetY] [height]
import { chromium } from 'playwright';
const [route,theme,w,text,out,off='-120',h='900']=process.argv.slice(2);
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:+w,height:+h},colorScheme:theme,reducedMotion:'reduce',deviceScaleFactor:+w<500?2:1});
await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme);
const p=await ctx.newPage(); await p.goto((process.env.BASE||'http://localhost:3210')+route,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(600);
if(text!=='-'){ await p.evaluate(([t,o])=>{const el=[...document.querySelectorAll('h1,h2,h3')].find(e=>e.textContent.includes(t)); if(el){window.scrollTo(0, el.getBoundingClientRect().top+scrollY+ +o);} },[text,off]); await p.waitForTimeout(400);}
await p.screenshot({path:new URL('./'+(process.env.SHOTDIR||'shots')+'/'+out+'.png',import.meta.url).pathname});
await b.close();
