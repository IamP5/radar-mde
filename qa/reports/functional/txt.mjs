import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
const [u,re]=process.argv.slice(2);
await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle',timeout:120000}); await p.waitForTimeout(500);
const t=await p.locator('main').innerText();
for(const l of t.split('\n')) if(!re||new RegExp(re,'i').test(l)) console.log(l);
if(process.argv[4]) await p.screenshot({path:'reports/functional/shots/'+process.argv[4]+'.png',fullPage:true});
await b.close();
