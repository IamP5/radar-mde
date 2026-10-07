import { chromium } from 'playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/';
const B = 'http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};

async function pick(label, option) {
  await p.getByRole('combobox', { name: label }).click();
  await p.waitForTimeout(300);
  await p.getByRole('option', { name: option }).first().click();
  await p.waitForTimeout(400);
}

// --- UF dashboard: MA, 2019, below 25%
await p.goto(B + '/ma?ano=2020', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(800);
out.ma_yearShown = await p.locator('[role=radio][aria-checked=true]').first().innerText();
await pick(/Situação em/, /Abaixo de 25%/);
out.ma_urlAfterFilter = p.url();
out.ma_count = await p.locator('#municipios [role=status]').innerText();
// sort by Anos < 25%
await p.locator('#municipios').getByRole('button', { name: 'Anos < 25%' }).click();
await p.waitForTimeout(300);
out.ma_sortedTop = (await p.locator('#municipios tbody tr').evaluateAll(trs => trs.slice(0, 8).map(t => t.innerText.replace(/\s+/g, ' '))));
await p.locator('#municipios').screenshot({ path: D + 's2_ma_2020_below.png' });
// reload: does filter survive?
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(600);
out.ma_countAfterReload = await p.locator('#municipios [role=status]').innerText();
// Fundeb filter
await pick(/Situação em/, /Fundeb abaixo/);
out.ma_fun = await p.locator('#municipios [role=status]').innerText();
// UF CSV
out.ma_csvHref = await p.locator('a[href^="/dados/csv"]').getAttribute('href');
try { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.locator('a[href^="/dados/csv"]').click()]); out.ma_clickDownload = dl.suggestedFilename(); } catch (e) { out.ma_clickDownload = 'FAIL ' + e.message.slice(0, 100); }
const t0=Date.now(); const resp = await ctx.request.get(B + out.ma_csvHref, { timeout: 180000 });
fs.writeFileSync(D + 's2_ma.csv', await resp.body()); out.ma_csvStatus = resp.status(); out.ma_csvHeaders = resp.headers(); out.ma_csvMs=Date.now()-t0;

// --- Explorer: SP 2023 below + reincidentes
await p.goto(B + '/explorar?uf=SP&ano=2021', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(1500);
out.ex_yearShown = await p.getByRole('combobox', { name: 'Exercício' }).innerText();
await pick(/^Situação em/, /Abaixo de 25%/);
out.ex_url1 = p.url();
await p.getByRole('button', { name: /Reincidentes/ }).click();
await p.waitForTimeout(400);
out.ex_url2 = p.url();
out.ex_count = (await p.locator('[aria-live=polite]').first().innerText()).replace(/\s+/g, ' ');
await p.getByRole('button', { name: 'Anos < 25%' }).click();
await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Anos < 25%' }).click();
await p.waitForTimeout(300);
out.ex_top = (await p.locator('tbody tr').evaluateAll(trs => trs.slice(0, 6).map(t => t.innerText.replace(/\s+/g, ' '))));
await p.screenshot({ path: D + 's2_explorar_sp_2021_below_reinc.png', fullPage: false });
const [dl2] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Exportar CSV/ }).click()]);
await dl2.saveAs(D + 's2_explorar.csv');
out.ex_csvName = dl2.suggestedFilename();
// Reopen same URL in a new page = "shared link"
const p2 = await ctx.newPage();
await p2.goto(out.ex_url2, { waitUntil: 'networkidle' });
await p2.waitForTimeout(1500);
out.ex_sharedCount = (await p2.locator('[aria-live=polite]').first().innerText()).replace(/\s+/g, ' ');
await p2.close();

// --- PA page, check TCM, PA 2016 coverage
await p.goto(B + '/pa?ano=2016', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(800);
await p.screenshot({ path: D + 's2_pa_2016.png', fullPage: true });
out.pa_text = (await p.locator('main').innerText()).slice(0, 2500);
// drill-down from table preserves ?ano?
const firstCity = p.locator('#municipios tbody tr a').first();
out.pa_firstHref = await firstCity.getAttribute('href');
await firstCity.click();
await p.waitForLoadState('networkidle');
out.pa_cityUrl = p.url();
out.pa_cityStatLabel = await p.locator('section[aria-label^="Indicadores"]').innerText().catch(() => null);

fs.writeFileSync(D + 's2_out.json', JSON.stringify({ out, errs }, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
console.log('ERRS', errs);
await b.close();
