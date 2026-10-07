import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
for (const r of ['/dados','/sp/santo-andre','/']){
await p.goto('http://localhost:3210'+r,{waitUntil:'networkidle'});
const snap=await p.locator('main').ariaSnapshot();
const names={}; for(const m of snap.matchAll(/- (link|button) "([^"]+)"/g)){names[m[2]]=(names[m[2]]||0)+1}
console.log(r, Object.entries(names).filter(([k,v])=>v>2).map(([k,v])=>`${k} x${v}`).join(' | '));
}
await b.close();
