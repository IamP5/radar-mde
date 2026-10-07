import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r2/';
const B = process.env.B || 'http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};
const kpi = async () => (await p.locator('section[aria-label^="Indicadores"]').first().innerText().catch(() => 'NO KPI')).replace(/\n/g, ' | ');
// axe
for (const u of ['/ba/feira-de-santana', '/ba/feira-de-santana?ano=2016', '/sp?situacao=below&ano=2021', '/explorar?uf=SP&situacao=abaixo', '/pa/mojui-dos-campos?ano=2010']) {
  await p.goto(B + u, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
  out['axe ' + u] = r.violations.map(v => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')}`);
}
// edge years
for (const u of ['/pa/mojui-dos-campos?ano=2010', '/ba/feira-de-santana?ano=1999', '/ba/feira-de-santana?ano=abc', '/rj/cabo-frio?ano=2022']) {
  await p.goto(B + u, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  out['edge ' + u] = { kpi: await kpi(), head: (await p.locator('main').innerText()).slice(0, 450).replace(/\n/g, ' | ') };
  await p.screenshot({ path: D + 'edge' + u.replace(/[\/?=]/g, '_') + '.png' });
}
// edits lost on tab switch — second repro on another city
await p.goto(B + '/sp/franca', { waitUntil: 'networkidle' });
const tabs = p.locator('#agir [role=tab]');
await tabs.nth(1).click(); await p.waitForTimeout(300);
await p.locator('#agir textarea:visible').fill('Fulano de Tal — CACS\n');
await tabs.nth(3).click(); await p.waitForTimeout(300);
await tabs.nth(1).click(); await p.waitForTimeout(300);
out.editPersists2 = (await p.locator('#agir textarea:visible').inputValue()).startsWith('Fulano');
// year change resets letters?
await p.locator('#agir textarea:visible').fill('Fulano 2');
await p.getByRole('radio', { name: '2019' }).first().click(); await p.waitForTimeout(800);
out.editAfterYear = (await p.locator('#agir textarea:visible').inputValue()).startsWith('Fulano 2');
// glossary terms
out.glossary = await p.locator('main [data-slot=popover-trigger], main button[aria-haspopup="dialog"]').evaluateAll(a => a.slice(0, 12).map(x => x.innerText));
const g = p.locator('main [data-slot=popover-trigger], main button[aria-haspopup="dialog"]').first();
if (await g.count()) { await g.click(); await p.waitForTimeout(300); out.glossaryOpen = (await p.locator('[role=dialog], [data-slot=popover-content]').first().innerText().catch(() => 'none')).slice(0, 300); await p.keyboard.press('Escape'); }
// Year picker keyboard + kit button
out.oqueFazer = await p.getByRole('link', { name: /O que posso fazer/ }).getAttribute('href').catch(() => null);
// mobile
const m = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(B + '/sp/franca?ano=2021', { waitUntil: 'networkidle' });
await mp.waitForTimeout(1000);
out.mobileOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await mp.screenshot({ path: D + 'mobile_franca_top.png' });
await mp.locator('#agir').scrollIntoViewIfNeeded();
await mp.locator('#agir').screenshot({ path: D + 'mobile_kit.png' });
await mp.goto(B + '/sp?ano=2021&situacao=below&reinc=3', { waitUntil: 'networkidle' });
await mp.waitForTimeout(800);
await mp.locator('#municipios').screenshot({ path: D + 'mobile_uf_table.png' });
out.mobileUfOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
fs.writeFileSync(D + 'r2_fresh.json', JSON.stringify({ out, errs }, null, 2));
console.log(JSON.stringify(out, null, 1));
console.log('ERRS', errs);
await b.close();
