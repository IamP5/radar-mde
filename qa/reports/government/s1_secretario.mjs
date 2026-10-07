import { chromium } from 'playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/';
const B = 'http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};
for (const u of ['/mg/uberlandia', '/ba/feira-de-santana']) {
  const t0 = Date.now();
  const r = await p.goto(B + u, { waitUntil: 'networkidle', timeout: 180000 });
  const slug = u.replace(/\//g, '_');
  out[u] = { status: r.status(), ms: Date.now() - t0, title: await p.title() };
  await p.screenshot({ path: D + `s1${slug}_full.png`, fullPage: true });
  out[u].h1 = await p.locator('h1').first().innerText();
  out[u].stats = await p.locator('section[aria-label^="Indicadores"]').innerText().catch(() => null);
  out[u].alerts = await p.locator('text=Sinais de alerta').locator('xpath=ancestor::*[contains(@class,"rounded")][1]').innerText().catch(() => null);
  // year-a-year table first rows
  out[u].table = (await p.locator('table').first().innerText()).split('\n').slice(0, 40).join(' | ');
  // ?ano param
  await p.goto(B + u + '?ano=2019', { waitUntil: 'networkidle' });
  out[u].withAno = await p.locator('section[aria-label^="Indicadores"]').innerText().catch(() => null);
  // Templates
  const tabs = p.getByRole('tab');
  const n = await tabs.count();
  out[u].templates = [];
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await p.waitForTimeout(400);
    const panel = p.locator('[role=tabpanel]:visible').last();
    const ta = panel.locator('textarea');
    const to = await panel.locator('p').first().innerText();
    const body = await ta.inputValue();
    await panel.getByRole('button', { name: /Copiar/ }).click();
    await p.waitForTimeout(300);
    const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
    out[u].templates.push({ tab: await tabs.nth(i).innerText(), to, body, clipEqual: clip === body, btn: await panel.getByRole('button', { name: /Copia/ }).innerText() });
    if (i === 0) await p.locator('#agir').screenshot({ path: D + `s1${slug}_kit.png` });
  }
  // print
  await p.emulateMedia({ media: 'print' });
  await p.screenshot({ path: D + `s1${slug}_printmedia.png`, fullPage: true });
  await p.pdf({ path: D + `s1${slug}.pdf`, format: 'A4', printBackground: true });
  await p.emulateMedia({ media: 'screen' });
}
fs.writeFileSync(D + 's1_out.json', JSON.stringify({ out, errs }, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ...v, templates: v.templates.map(t => ({ tab: t.tab, to: t.to, clipEqual: t.clipEqual, btn: t.btn, len: t.body.length })) }])), null, 1));
console.log('ERRS', errs);
await b.close();
