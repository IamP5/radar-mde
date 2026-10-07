// Re-runnable a11y + responsive regression check.
// Usage: cd qa && node reports/a11y-visual/a11y-regression.mjs [--base http://localhost:3210] [--quick]
// Prints axe violation counts per route/theme and horizontal overflow per viewport. Exit code 1 if any.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const args = process.argv.slice(2);
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : (process.env.BASE||'http://localhost:3210');
const QUICK = args.includes('--quick');
const ROUTES = ['/', '/regiao/sudeste', '/sp', '/sp/santo-andre', '/explorar', '/acompanhar', '/dados', '/sobre', '/rota-inexistente'];
const THEMES = ['light', 'dark'];
const VIEWPORTS = QUICK ? [320, 768, 1440] : [320, 375, 414, 768, 1024, 1280, 1440, 1920];
const OUT = new URL('./', import.meta.url).pathname;

const browser = await chromium.launch();
const results = { axe: {}, overflow: [], targets: {} };
let fail = 0;

async function ctxFor(theme, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  return ctx;
}
async function settle(page) { await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(400); }

console.log('== axe (wcag2a, wcag2aa, wcag21aa, wcag22aa) ==');
for (const theme of THEMES) {
  const ctx = await ctxFor(theme); const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const v = res.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, help: x.help, targets: x.nodes.slice(0, 6).map((n) => ({ t: n.target.join(' '), s: n.failureSummary?.split('\n').slice(1, 2).join(' ').slice(0, 220), html: n.html.slice(0, 160) })) }));
    results.axe[`${theme} ${r}`] = v;
    const total = v.reduce((a, b) => a + b.n, 0); if (total) fail++;
    console.log(`${theme.padEnd(5)} ${r.padEnd(20)} rules=${v.length} nodes=${total} ${v.map((x) => `${x.id}(${x.n})`).join(' ')}`);
  }
  await ctx.close();
}

console.log('\n== horizontal overflow / small targets ==');
for (const theme of THEMES) {
  for (const w of VIEWPORTS) {
    const ctx = await ctxFor(theme, w); const page = await ctx.newPage();
    for (const r of ROUTES) {
      await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const sw = document.documentElement.scrollWidth;
        const off = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width && r.right > vw + 1) {
            // ignore elements inside a horizontally scrollable/clipping ancestor
            let p = el.parentElement, clipped = false;
            while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
            if (!clipped) off.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className?.baseVal ?? el.className).split(' ').slice(0, 3).join('.')} r=${Math.round(r.right)}`);
          }
        }
        const small = [];
        for (const el of document.querySelectorAll('a[href],button,[role=button],[role=radio],[role=tab],input,select,[tabindex="0"]')) {
          const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
          if (!r.width || s.visibility === 'hidden') continue;
          const inline = el.tagName === 'A' && s.display === 'inline';
          if (!inline && (r.width < 24 || r.height < 24)) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return { vw, sw, off: [...new Set(off)].slice(0, 8), small: [...new Set(small)].slice(0, 12), nSmall: small.length };
      });
      const over = m.sw > m.vw;
      if (over) fail++;
      results.overflow.push({ theme, w, r, ...m });
      if (theme === 'light') results.targets[`${w} ${r}`] = m.small;
      console.log(`${theme.padEnd(5)} ${String(w).padStart(4)} ${r.padEnd(20)} ${over ? `OVERFLOW sw=${m.sw}>${m.vw} ${m.off.slice(0, 3).join(' | ')}` : 'ok'}${m.nSmall ? `  smallTargets=${m.nSmall}` : ''}`);
    }
    await ctx.close();
  }
}
fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1));
await browser.close();
console.log(`\nfailing checks: ${fail}  (details: ${OUT}results.json)`);
process.exit(fail ? 1 : 0);
