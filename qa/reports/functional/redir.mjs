import { chromium } from 'playwright';
const B=process.env.BASE??'http://localhost:3299';
const b=await chromium.launch(); const p=await b.newPage();
for (const u of process.argv.slice(2)) { const r=await p.goto(B+u,{waitUntil:'networkidle'}); console.log(u,'->',r.status(),p.url().replace(B,''),'|',await p.title()); }
await b.close();
