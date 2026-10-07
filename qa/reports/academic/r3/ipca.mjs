import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,200)));
await p.goto('http://localhost:3299/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const sec=p.locator('section,div').filter({has:p.getByText('Maiores déficits acumulados',{exact:false})}).filter({has:p.getByText('Corrigido (IPCA)')}).last();
await sec.getByText('Corrigido (IPCA)').click(); await p.waitForTimeout(800);
console.log((await sec.innerText()).split('\n').slice(0,16).join(' | '));
await sec.screenshot({path:'reports/academic/r3/deficits_ipca.png'});
for (const u of ['/rs/porto-alegre','/sp/santo-andre?ano=2019']) {
 await p.goto('http://localhost:3299'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
 const t=await p.evaluate(()=>document.body.innerText);
 console.log(u, (t.match(/Déficit[^\n]*\n[^\n]+\n[^\n]+/)||[''])[0].replace(/\n/g,' | '), '|', (t.match(/[^\n]*IPCA[^\n]*/g)||[]).slice(0,3));
}
// chart actions
await p.goto('http://localhost:3299/sp/adamantina',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const acts=p.getByRole('button',{name:/(Ações|Baixar|Exportar|opções|menu)/i});
console.log('chart action buttons', await acts.count(), (await acts.allInnerTexts()).slice(0,5), await acts.evaluateAll(a=>a.slice(0,5).map(x=>x.getAttribute('aria-label'))));
const panel=p.locator('section,div').filter({has:p.getByText('Investimento por aluno (R$/ano)',{exact:false})}).filter({has:p.locator('svg.recharts-surface')}).last();
await panel.scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await panel.screenshot({path:'reports/academic/r3/chart_adamantina_aluno.png'});
console.log('errors',errs);
await b.close();
