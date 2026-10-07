import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const D = '/Users/tuba/Dev/projects/radar-mde/qa/reports/government/';
const B = 'http://localhost:3210';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + p.url() + ' ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push('console ' + p.url() + ' ' + m.text().slice(0, 300)));
const out = {};
async function kit(u) {
  await p.goto(B + u, { waitUntil: 'networkidle', timeout: 180000 });
  const res = { header: (await p.locator('main').innerText()).slice(0, 700) };
  const tas = await p.locator('#agir textarea').evaluateAll(t => t.map(x => x.value));
  res.templates = tas;
  res.tos = await p.locator('#agir [role=tab]').allInnerTexts();
  return res;
}
for (const u of ['/se/aracaju', '/rj/cabo-frio', '/sp/sao-paulo', '/df/brasilia', '/mt/boa-esperanca-do-norte', '/pa/belem', '/ac/marechal-thaumaturgo']) {
  try { out[u] = await kit(u); } catch (e) { out[u] = { err: e.message.slice(0, 200), url: p.url() }; }
  await p.screenshot({ path: D + 's3' + u.replace(/\//g, '_') + '.png', fullPage: false });
}
// ?ano drilldown on city
await p.goto(B + '/pa/concordia-do-para?ano=2016', { waitUntil: 'networkidle' });
out.anoCity = await p.locator('section[aria-label^="Indicadores"]').innerText();
// a11y
for (const u of ['/ba/feira-de-santana', '/sp', '/explorar']) {
  await p.goto(B + u, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
  out['axe ' + u] = r.violations.map(v => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')}`);
}
// mobile kit
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(B + '/ba/feira-de-santana', { waitUntil: 'networkidle' });
await mp.locator('#agir').scrollIntoViewIfNeeded();
await mp.locator('#agir').screenshot({ path: D + 's3_mobile_kit.png' });
out.mobileOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
fs.writeFileSync(D + 's3_out.json', JSON.stringify({ out, errs }, null, 2));
for (const [k, v] of Object.entries(out)) console.log(k, typeof v === 'object' && v.templates ? { tos: v.tos, header: v.header.slice(0, 300) } : v);
console.log('ERRS', errs);
await b.close();
