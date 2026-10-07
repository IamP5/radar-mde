// Round 2: city page — year picker, letters (all 4 tabs), edit persistence, mailto length, print PDF
import { chromium } from 'playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r2/';
fs.mkdirSync(D, { recursive: true });
const B = process.env.B || 'http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};
const kpi = async () => (await p.locator('section[aria-label^="Indicadores"]').first().innerText().catch(() => 'NO KPI')).replace(/\n/g, ' | ');

async function letters(u) {
  const tabs = p.locator('#agir [role=tab]');
  const n = await tabs.count();
  const res = [];
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await p.waitForTimeout(350);
    const ta = p.locator('#agir textarea:visible');
    const body = await ta.inputValue();
    const mail = await p.locator('#agir [role=tabpanel]:visible a[href^="mailto:"]').getAttribute('href').catch(() => null);
    const wa = await p.locator('#agir [role=tabpanel]:visible a[href*="wa.me"]').getAttribute('href').catch(() => null);
    const where = await p.locator('#agir [role=tabpanel]:visible').innerText().then(t => t.split('Copiar')[0]);
    res.push({ tab: (await tabs.nth(i).innerText()).replace(/\n/g, ' '), body, mailLen: mail?.length, waLen: wa?.length, where });
  }
  return res;
}

for (const u of ['/mg/uberlandia', '/ba/feira-de-santana', '/mt/boa-esperanca-do-norte', '/rj/cabo-frio', '/sp/buri', '/sp/franca', '/se/aracaju', '/sp/sao-paulo', '/df/brasilia']) {
  const r = await p.goto(B + u, { waitUntil: 'networkidle', timeout: 180000 });
  const o = (out[u] = { status: r.status() });
  o.kpi = await kpi();
  o.header = (await p.locator('main').innerText()).slice(0, 500).replace(/\n/g, ' | ');
  o.letters = await letters(u);
  if (u === '/mg/uberlandia' || u === '/mt/boa-esperanca-do-norte') await p.screenshot({ path: D + 'city' + u.replace(/\//g, '_') + '.png', fullPage: true });
}

// ?ano on city: twice
for (const u of ['/mg/uberlandia?ano=2019', '/pa/concordia-do-para?ano=2016']) {
  await p.goto(B + u, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  out['ano ' + u] = { kpi: await kpi(), url: p.url(), radio: await p.locator('[role=radio][aria-checked=true]').first().innerText().catch(() => null) };
  await p.screenshot({ path: D + 'ano' + u.replace(/[\/?=]/g, '_') + '.png', fullPage: true });
}
// Year picker click -> URL + map/histogram; share link includes year?
await p.goto(B + '/mg/uberlandia', { waitUntil: 'networkidle' });
await p.getByRole('radio', { name: '2021' }).first().click();
await p.waitForTimeout(1500);
out.pick2021 = { url: p.url(), kpi: await kpi() };
out.pick2021.text = (await p.locator('main').innerText()).slice(0, 4000);
await p.getByRole('button', { name: /Compartilhar/ }).first().click();
await p.waitForTimeout(300);
await p.getByRole('menuitem', { name: /Copiar link/ }).click();
await p.waitForTimeout(300);
out.pick2021.shareClip = await p.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
await p.screenshot({ path: D + 'uberlandia_2021_picked.png', fullPage: true });

// Edit persistence across tab switch
await p.locator('#agir [role=tab]').nth(0).click();
await p.waitForTimeout(300);
const ta = p.locator('#agir textarea:visible');
await ta.fill('EDITADO PELO QA\n' + (await ta.inputValue()));
await p.locator('#agir [role=tab]').nth(1).click();
await p.waitForTimeout(300);
await p.locator('#agir [role=tab]').nth(0).click();
await p.waitForTimeout(300);
out.editPersists = (await p.locator('#agir textarea:visible').inputValue()).startsWith('EDITADO PELO QA');
// Copy copies edited text
await p.locator('#agir textarea:visible').fill('EDITADO 2');
await p.locator('#agir [role=tabpanel]:visible').getByRole('button', { name: /Copiar/ }).click();
await p.waitForTimeout(300);
out.copyEdited = await p.evaluate(() => navigator.clipboard.readText());

// Print
for (const u of ['/mg/uberlandia', '/ba/feira-de-santana']) {
  await p.goto(B + u, { waitUntil: 'networkidle' });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: D + 'print' + u.replace(/\//g, '_') + '.pdf', format: 'A4', printBackground: true });
  await p.emulateMedia({ media: 'screen' });
}
// Print with a picked year
await p.goto(B + '/mg/uberlandia?ano=2021', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: D + 'print_uberlandia_2021.pdf', format: 'A4', printBackground: true });

fs.writeFileSync(D + 'r2_city.json', JSON.stringify({ out, errs }, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.letters ? { status: v.status, kpi: v.kpi.slice(0, 200), letters: v.letters.map(l => ({ tab: l.tab, len: l.body.length, mailLen: l.mailLen, waLen: l.waLen })) } : (v && v.text ? { ...v, text: v.text.slice(0, 600) } : v)])), null, 1));
console.log('ERRS', errs);
await b.close();
