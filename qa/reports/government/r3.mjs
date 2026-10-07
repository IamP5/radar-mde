// Round 3 re-validation (government persona)
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r3/';
fs.mkdirSync(D, { recursive: true });
const B = process.env.B || 'http://localhost:3299';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};
const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = 'ERROR ' + e.message.split('\n')[0].slice(0, 200); } };
const kpi = async () => (await p.locator('section[aria-label^="Indicadores"]').first().innerText().catch(() => 'NO KPI')).replace(/\n/g, ' | ');

// 1) letters
for (const u of ['/rj/cabo-frio', '/sp/franca', '/mg/uberlandia', '/sp/buri', '/mt/boa-esperanca-do-norte']) {
  await step('letters ' + u, async () => {
    await p.goto(B + u, { waitUntil: 'networkidle', timeout: 180000 });
    const res = { kpi: await kpi(), head: (await p.locator('main').innerText()).slice(0, 600).replace(/\n/g, ' | '), letters: [] };
    const tabs = p.locator('#agir [role=tab]');
    for (let i = 0; i < await tabs.count(); i++) {
      await tabs.nth(i).click(); await p.waitForTimeout(350);
      const panel = p.locator('#agir [role=tabpanel]:visible');
      res.letters.push({
        tab: (await tabs.nth(i).innerText()).replace(/\n/g, ' '),
        body: await panel.locator('textarea').inputValue(),
        mail: await panel.locator('a[href^="mailto:"]').getAttribute('href').catch(() => null),
        buttons: await panel.getByRole('button').allInnerTexts().catch(() => []),
        links: await panel.locator('a').allInnerTexts().catch(() => []),
      });
    }
    return res;
  });
}
// 2) edit persistence (x2) + mailto copies full text
for (const u of ['/mg/uberlandia', '/sp/franca']) {
  await step('edit ' + u, async () => {
    await p.goto(B + u, { waitUntil: 'networkidle' });
    const tabs = p.locator('#agir [role=tab]');
    await tabs.nth(1).click(); await p.waitForTimeout(300);
    await p.locator('#agir [role=tabpanel]:visible textarea').fill('QA EDIT ' + u);
    await tabs.nth(3).click(); await p.waitForTimeout(300);
    await tabs.nth(1).click(); await p.waitForTimeout(300);
    const kept = (await p.locator('#agir [role=tabpanel]:visible textarea').inputValue()) === 'QA EDIT ' + u;
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    await p.locator('#agir [role=tab]').nth(1).click(); await p.waitForTimeout(300);
    const afterReload = (await p.locator('#agir [role=tabpanel]:visible textarea').inputValue()).slice(0, 40);
    return { keptAcrossTabs: kept, afterReload };
  });
}
// 3) UF table export + recurrence options
await step('uf', async () => {
  await p.goto(B + '/sp?ano=2021', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const res = {};
  const cnt = () => p.locator('#municipios [role=status]').first().innerText();
  const pick = async (label, option) => { await p.getByRole('combobox', { name: label }).first().click(); await p.waitForTimeout(300); await p.getByRole('option', { name: option }).first().click(); await p.waitForTimeout(500); };
  await p.getByRole('combobox', { name: /Reincidência/ }).first().click(); await p.waitForTimeout(300);
  res.recOptions = await p.getByRole('option').allInnerTexts(); await p.keyboard.press('Escape');
  await p.getByRole('combobox', { name: /Situação em/ }).first().click(); await p.waitForTimeout(300);
  res.sitOptions = await p.getByRole('option').allInnerTexts(); await p.keyboard.press('Escape');
  await pick(/Situação em/, /^MDE e Fundeb/); res.both = await cnt();
  await pick(/Situação em/, /^Abaixo de 25%/); res.below = await cnt();
  for (const [k, re] of [['u5', /últimos 5/], ['s2', /^2\+ anos seguidos/], ['s3', /^3\+ anos seguidos/], ['2x', /fora de 2020/]]) {
    await pick(/Reincidência/, re); res['rec_' + k] = await cnt();
    res['rec_' + k + '_top'] = await p.locator('#municipios tbody tr').evaluateAll(t => t.slice(0, 3).map(x => x.innerText.replace(/\s+/g, ' ')));
    res['rec_' + k + '_col'] = await p.locator('#municipios thead th').last().innerText();
  }
  await pick(/Reincidência/, /últimos 5/);
  res.url = p.url();
  await p.locator('#municipios').screenshot({ path: D + 'uf_sp_2021_below_u5.png' });
  const dls = [];
  for (const label of [/Só 2021 · CSV padrão/, /Série .* · Excel Brasil/]) {
    await p.getByRole('button', { name: /Exportar tabela/ }).click(); await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('menuitem', { name: label }).click()]);
    const f = D + 'uf_' + dl.suggestedFilename(); await dl.saveAs(f); dls.push(f);
  }
  res.downloads = dls;
  res.headerCsv = await p.locator('a[href*="/dados/csv"]').evaluateAll(a => a.map(x => x.getAttribute('href') + ' | ' + x.innerText.trim()));
  // deficits list markers
  res.deficits = await p.locator('text=Maiores déficits').first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]').innerText().then(t => t.slice(0, 500)).catch(() => '');
  return res;
});
await step('pa deficits', async () => {
  await p.goto(B + '/pa', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const box = p.locator('text=Maiores déficits').first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  await box.screenshot({ path: D + 'pa_deficits.png' });
  return { text: (await box.innerText()).slice(0, 700), labels: await box.locator('[aria-label], [title]').evaluateAll(e => e.slice(0, 10).map(x => x.getAttribute('aria-label') || x.getAttribute('title'))) };
});
// 4) Explorer export columns + recurrence parity
await step('explorer', async () => {
  await p.goto(B + '/explorar?uf=SP&ano=2021&situacao=abaixo', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  const res = { controls: await p.locator('main').getByRole('combobox').evaluateAll(e => e.map(x => x.getAttribute('aria-label') + '=' + x.innerText.replace(/\n/g, ' '))) };
  const rc = p.getByRole('combobox', { name: /Reincid/ });
  if (await rc.count()) { await rc.first().click(); await p.waitForTimeout(300); res.recOptions = await p.getByRole('option').allInnerTexts(); await p.keyboard.press('Escape'); }
  res.buttons = await p.locator('main').getByRole('button').allInnerTexts().then(a => a.slice(0, 20));
  await p.getByRole('button', { name: /Exportar CSV/ }).click(); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('menuitem', { name: /Só 2021 · Excel Brasil/ }).click()]);
  const f = D + 'ex_' + dl.suggestedFilename(); await dl.saveAs(f); res.file = f;
  res.head = fs.readFileSync(f, 'utf8').split('\n').slice(0, 2).join(' // ');
  return res;
});
// 5) City Fonte links, deficit KPI caveat
await step('cabo-frio page', async () => {
  await p.goto(B + '/rj/cabo-frio', { waitUntil: 'networkidle' });
  return { kpi: await kpi(), fonte: await p.locator('table a[href*="fnde"], table a[href*="tesouro"], table a').evaluateAll(a => a.slice(0, 4).map(x => (x.getAttribute('aria-label') || x.innerText) + ' -> ' + x.getAttribute('href').slice(0, 90))), headerSrc: await p.locator('main header a, main a[title*="fonte"], main a[title*="Dados"]').evaluateAll(a => a.slice(0, 6).map(x => x.innerText.trim() + ' -> ' + (x.getAttribute('href') || '').slice(0, 90))) };
});
// 6) print
for (const u of ['/mg/uberlandia', '/rj/cabo-frio', '/sp?ano=2021&situacao=below']) {
  await step('print ' + u, async () => {
    await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    await p.emulateMedia({ media: 'print' });
    const f = D + 'print' + u.replace(/[\/?=&]/g, '_') + '.pdf';
    await p.pdf({ path: f, format: 'A4', printBackground: true });
    await p.emulateMedia({ media: 'screen' });
    return f;
  });
}
// 7) axe
for (const u of ['/sp?situacao=below&ano=2021', '/rj/cabo-frio', '/explorar?uf=SP']) {
  await step('axe ' + u, async () => {
    await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return r.violations.map(v => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')}`);
  });
}
// 8) mobile kit intro
await step('mobile', async () => {
  const m = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(B + '/sp/franca', { waitUntil: 'networkidle' });
  await mp.locator('#agir').scrollIntoViewIfNeeded();
  await mp.locator('#agir').screenshot({ path: D + 'mobile_kit.png' });
  const r = { overflow: await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) };
  await m.close();
  return r;
});
fs.writeFileSync(D + 'r3.json', JSON.stringify({ out, errs }, null, 2));
const short = JSON.parse(JSON.stringify(out));
for (const k of Object.keys(short)) if (short[k]?.letters) short[k].letters = short[k].letters.map(l => ({ tab: l.tab, len: l.body.length, mailLen: l.mail?.length, buttons: l.buttons }));
console.log(JSON.stringify(short, null, 1));
console.log('ERRS', errs);
await b.close();
