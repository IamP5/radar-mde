import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
for (const u of ['/','/sp','/sp/santo-andre','/explorar','/regiao/sudeste']) {
  const r = await p.goto('http://localhost:3210'+u,{waitUntil:'networkidle',timeout:120000});
  console.log(u, r.status(), (await p.title()));
}
console.log('errors', errs.slice(0,5)); await b.close();
