import { chromium } from 'playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r2/';
const B = process.env.B || 'http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};
async function pick(label, option, scope = p) {
  await scope.getByRole('combobox', { name: label }).first().click();
  await p.waitForTimeout(300);
  await p.getByRole('option', { name: option }).first().click();
  await p.waitForTimeout(500);
}
const cnt = () => p.locator('#municipios [role=status]').first().innerText();

// UF: SP 2021 below + reinc 3+, sort; URL; reload; new tab
await p.goto(B + '/sp?ano=2021', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(800);
await pick(/Situação em/, /Abaixo de 25%/);
out.uf_below = await cnt();
await pick(/Reincidência/, /^2\+ anos fora de 2020/);
out.uf_below_2x = await cnt();
await pick(/Reincidência/, /^3\+ anos/);
out.uf_below_3 = await cnt();
await p.locator('#municipios').getByRole('button', { name: /Anos < 25%/ }).click();
await p.waitForTimeout(400);
out.uf_url = p.url();
out.uf_top = await p.locator('#municipios tbody tr').evaluateAll(t => t.slice(0, 5).map(x => x.innerText.replace(/\s+/g, ' ')));
await p.locator('#municipios').screenshot({ path: D + 'uf_sp_2021_below_reinc3.png' });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
out.uf_afterReload = await cnt();
const p2 = await ctx.newPage();
await p2.goto(out.uf_url, { waitUntil: 'networkidle' });
await p2.waitForTimeout(1000);
out.uf_newTab = await p2.locator('#municipios [role=status]').first().innerText();
await p2.close();
// MDE + Fundeb combined? (status is single select) — check options
await p.getByRole('combobox', { name: /Situação em/ }).first().click();
await p.waitForTimeout(300);
out.uf_statusOptions = await p.getByRole('option').allInnerTexts();
out.uf_statusMulti = await p.getByRole('listbox').getAttribute('aria-multiselectable').catch(() => null);
await p.keyboard.press('Escape');
// UF CSV links
out.uf_csvLinks = await p.locator('a[href*="/dados/csv"]').evaluateAll(a => a.map(x => x.getAttribute('href') + ' | ' + x.innerText));

// PA 2016 headline
await p.goto(B + '/pa?ano=2016', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
out.pa_headline = (await p.locator('main').innerText()).split('Mapa de')[0].slice(-900);
out.pa_deficits = (await p.getByText('Maiores déficits').locator('xpath=ancestor::*[contains(@class,"rounded")][1]').innerText().catch(() => '')).slice(0, 700);
await p.screenshot({ path: D + 'pa_2016.png', fullPage: false });

// Explorer
await p.goto(B + '/explorar?uf=SP&ano=2021', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(1500);
await pick(/^Situação em/, /Abaixo de 25%/);
await p.getByRole('button', { name: /Reincidentes/ }).click();
await p.waitForTimeout(500);
out.ex_url = p.url();
out.ex_count = (await p.locator('[aria-live=polite]').first().innerText()).replace(/\s+/g, ' ');
const p3 = await ctx.newPage();
await p3.goto(out.ex_url, { waitUntil: 'networkidle' });
await p3.waitForTimeout(2000);
out.ex_newTab = (await p3.locator('[aria-live=polite]').first().innerText()).replace(/\s+/g, ' ');
await p3.close();
for (const [i, label] of [[0, /Só 2021 · CSV padrão/], [1, /Série .* · CSV padrão/], [2, /Só 2021 · Excel Brasil/], [3, /Série .* · Excel Brasil/]]) {
  await p.getByRole('button', { name: /Exportar CSV/ }).click();
  await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('menuitem', { name: label }).click()]);
  const f = D + 'ex_' + i + '_' + dl.suggestedFilename();
  await dl.saveAs(f);
  out['ex_dl_' + i] = f;
}
// /dados/csv excel variants
for (const id of ['ma', 'ma-excel', 'regiao-norte-excel', 'estados']) {
  const r = await ctx.request.get(B + '/dados/csv/' + id);
  const body = await r.body();
  fs.writeFileSync(D + 'dados_' + id + '.csv', body);
  out['dados_' + id] = { status: r.status(), ct: r.headers()['content-type'], cd: r.headers()['content-disposition'], head: body.toString('utf8').split('\n').slice(0, 3).join(' // ').slice(0, 600) };
}
// /dados page links
await p.goto(B + '/dados', { waitUntil: 'networkidle' });
out.dados_links = (await p.locator('a[href*="/dados/csv"]').evaluateAll(a => a.map(x => x.getAttribute('href')))).slice(0, 12);
fs.writeFileSync(D + 'r2_auditor.json', JSON.stringify({ out, errs }, null, 2));
console.log(JSON.stringify(out, null, 1));
console.log('ERRS', errs);
await b.close();
