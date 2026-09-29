import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { auditBuild } from './bundle-audit.mjs';

// One-shot, read-only CLI; existing production build + stats and installed Chrome required.
// Optional --desktop-only. No build, downloads, deployment, screenshots or app instrumentation.
const timeout = 15000;
const check = expect.configure({ timeout });
const workspace = fileURLToPath(new URL('../../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
function inside(root, path) {
  const part = relative(root, path);
  return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}
function staticServer(root) {
  return createServer(async (request, response) => {
    const end = status => { response.writeHead(status); response.end(); };
    try {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (request.method !== 'GET') return end(405);
      const path = decodeURIComponent((request.url ?? '').split('?')[0]);
      if (!path.startsWith('/') || path.startsWith('//') || /[\\:\x00-\x1f]/.test(path) ||
          path.split('/').some(part => part === '..' || /[. ]$/.test(part))) return end(403);
      let target = resolve(root, `.${path === '/' ? '/index.html' : path}`);
      if (!inside(root, target)) return end(403);
      try { target = await realpath(target); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (extname(path)) return end(404);
        target = await realpath(resolve(root, 'index.html')); // Extensionless SPA route only.
      }
      if (!inside(root, target)) return end(403);
      if (!(await stat(target)).isFile()) return end(404);
      const body = await readFile(target);
      response.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
        'Content-Length': body.length });
      response.end(body);
    } catch (error) { end(error instanceof URIError ? 400 : error.code === 'ENOENT' ? 404 : 500); }
  });
}
function installObservers() {
  const state = { lcp: [], shifts: [], observers: [] };
  window.__qualityMeasurement = state; // Test-owned, per-document; never persisted or added to app code.
  for (const type of ['largest-contentful-paint', 'layout-shift']) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) throw new Error(`Unsupported observer: ${type}`);
    const consume = entries => entries.forEach(entry => {
      if (type === 'largest-contentful-paint') state.lcp.push(entry.startTime);
      else state.shifts.push({ value: entry.value, startTime: entry.startTime, hadRecentInput: entry.hadRecentInput,
        sources: (entry.sources ?? []).map(source => ({ tag: source.node?.nodeName ?? null,
          id: source.node?.id ?? null, previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })) });
    });
    const observer = new PerformanceObserver(list => consume(list.getEntries()));
    observer.observe({ type, buffered: true });
    state.observers.push({ observer, consume });
  }
  performance.setResourceTimingBufferSize(2000);
}
async function settle(page) {
  // Two painted frames, not an idle callback (which may starve), sleep or speed threshold.
  await page.evaluate(async limit => {
    let timer;
    try {
      await Promise.race([
        new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Frame/idle timeout')), limit); })
      ]);
    } finally { clearTimeout(timer); }
  }, timeout);
}
async function observations(page, chunks) {
  await settle(page);
  return page.evaluate(paths => {
    const state = window.__qualityMeasurement;
    state.observers.forEach(({ observer, consume }) => consume(observer.takeRecords()));
    return { lcpCandidateMs: state.lcp.at(-1) ?? null,
      observedLayoutShiftSumExcludingRecentInput: state.shifts.filter(e => !e.hadRecentInput).reduce((n, e) => n + e.value, 0),
      layoutShiftAttribution: state.shifts.filter(e => !e.hadRecentInput),
      resources: performance.getEntriesByType('resource').filter(e => paths.includes(new URL(e.name).pathname))
        .map(e => ({ path: new URL(e.name).pathname, encodedBodyBytes: e.encodedBodySize,
          decodedBodyBytes: e.decodedBodySize, transferBytes: e.transferSize, durationMs: e.duration })) };
  }, Object.values(chunks));
}
async function geometry(page) {
  return page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing geometry target: ${selector}`);
      const rect = element.getBoundingClientRect();
      return { heightPx: rect.height, documentTopPx: rect.top + scrollY };
    };
    return { workbench: box('#trigger-workbench'),
      summary: box(document.querySelector('app-deferred-summary') ? 'app-deferred-summary' : '[data-defer-state="placeholder"]'),
      downstream: box('section[aria-labelledby="route-heading"]') };
  });
}
async function visit(browser, origin, profile, chunks, exercise) {
  const context = await browser.newContext({ viewport: profile.viewport, colorScheme: profile.colorScheme,
    deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const problems = [], scripts = [];
  try {
    context.setDefaultTimeout(timeout);
    context.setDefaultNavigationTimeout(timeout);
    await context.addInitScript(installObservers);
    await context.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin || request.method() !== 'GET' ||
          ['fetch', 'xhr'].includes(request.resourceType())) {
        problems.push(`Unexpected request: ${request.method()} ${request.url()}`);
        return route.abort();
      }
      return route.continue();
    });
    await context.routeWebSocket('**/*', socket => { problems.push(`Unexpected WebSocket: ${socket.url()}`); socket.close(); });
    context.on('request', request => { if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname); });
    context.on('requestfailed', request => problems.push(`Request failed: ${request.url()}`));
    context.on('response', response => { if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`); });
    context.on('page', page => page.on('pageerror', error => problems.push(error.message)));
    const page = await context.newPage();
    const count = name => scripts.filter(path => path === chunks[name]).length;
    return await exercise({ page, count, scripts });
  } finally {
    try { await context.close(); } finally { assert.deepEqual(problems, [], 'Unexpected browser traffic/errors'); }
  }
}
async function measure(browser, origin, profile, chunks) {
  const dashboard = await visit(browser, origin, profile, chunks, async ({ page, count }) => {
    await page.goto(`${origin}/dashboard`);
    await check(page.getByRole('heading', { level: 1 })).toContainText('Understand Angular.');
    const sample = await observations(page, chunks);
    for (const name of Object.keys(chunks)) assert.equal(count(name), 0, `Dashboard requested ${name}`);
    return sample;
  });
  const lab = await visit(browser, origin, profile, chunks, async ({ page, count, scripts }) => {
    const heading = name => page.getByRole('heading', { name, exact: true });
    const summary = heading('Fictional measurement summary');
    const button = page.getByRole('button', { name: 'Load interaction summary', exact: true });
    const fetchWith = async (name, action) => {
      const [response] = await Promise.all([page.waitForResponse(origin + chunks[name]), action()]);
      assert.equal(response.status(), 200, `${name} response`);
      assert.equal(await response.finished(), null, `${name} response completion`);
    };
    const lifetime = async expected => {
      await page.getByRole('button', { name: 'Inspect payload lifetimes', exact: true }).click();
      const observation = page.locator('[data-lifetime-observation]');
      await check(observation).toContainText(expected);
      return (await observation.innerText()).replace(/\s+/g, ' ').trim();
    };
    await fetchWith('preloaded', () => page.goto(`${origin}/labs/performance`));
    await check(heading('Performance lab')).toBeVisible();
    await check(summary).toHaveCount(0);
    await check(heading('Preload candidate route lesson')).toHaveCount(0);
    await check(heading('On-demand route lesson')).toHaveCount(0);
    const beforeInput = await observations(page, chunks);
    assert.equal(count('deferred'), 0); assert.equal(count('demand'), 0); assert.equal(count('preloaded'), 1);
    const placeholder = await geometry(page);
    await fetchWith('deferred', () => button.focus());
    await settle(page);
    await check(summary).toHaveCount(0);
    const prefetched = await lifetime('created: 0; destroyed: 0; active: 0.');
    await button.focus();
    const start = await page.evaluate(() => performance.now());
    await button.press('Enter');
    await check(summary).toBeVisible();
    await settle(page);
    const automationWallDurationMs = await page.evaluate(() => performance.now()) - start;
    const completed = await geometry(page);
    await check(page.locator('[data-instance-id]')).toHaveText('1');
    const rendered = await lifetime('created: 1; destroyed: 0; active: 1.');
    await fetchWith('demand', () => page.getByRole('link', { name: 'Load on demand', exact: true }).click());
    await check(heading('On-demand route lesson')).toBeVisible();
    await page.getByRole('link', { name: 'Open preload candidate', exact: true }).click();
    await check(heading('Preload candidate route lesson')).toBeVisible();
    assert.equal(count('preloaded'), 1); assert.equal(count('demand'), 1); assert.equal(count('deferred'), 1);
    await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
    await check(summary).toHaveCount(0);
    const unmounted = await lifetime('created: 1; destroyed: 1; active: 0.');
    await page.getByRole('link', { name: 'All labs', exact: true }).click();
    await check(heading('Angular labs')).toBeVisible();
    await settle(page); // Warm the index before the repeat-visit baseline.
    const beforeRepeat = scripts.length;
    await page.getByRole('link', { name: 'Open performance lab', exact: true }).click();
    await check(heading('Performance lab')).toBeVisible();
    const reset = await lifetime('created: 0; destroyed: 0; active: 0.');
    await button.press('Enter');
    await check(summary).toBeVisible();
    await check(page.locator('[data-instance-id]')).toHaveText('1');
    const recreated = await lifetime('created: 1; destroyed: 0; active: 1.');
    for (const [link, title] of [['Load on demand', 'On-demand route lesson'], ['Open preload candidate', 'Preload candidate route lesson']]) {
      await page.getByRole('link', { name: link, exact: true }).click(); await check(heading(title)).toBeVisible();
    }
    const final = await observations(page, chunks);
    assert.equal(scripts.length - beforeRepeat, 0, 'Repeat SPA visit downloaded JavaScript');
    return { beforeInput, automationWallDurationMs, placeholder, completed,
      downstreamTopDeltaPx: completed.downstream.documentTopPx - placeholder.downstream.documentTopPx,
      lifecycle: { prefetched, rendered, unmounted, reset, recreated }, repeatJavaScriptRequests: 0,
      observedLayoutShiftSumExcludingRecentInput: final.observedLayoutShiftSumExcludingRecentInput,
      layoutShiftAttribution: final.layoutShiftAttribution, resources: final.resources };
  });
  return { ...profile, dashboard, lab };
}
async function main() {
  assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--desktop-only'), 'Usage: measure-browser.mjs [--desktop-only]');
  const root = await realpath(resolve(workspace, 'dist/angular-22/browser'));
  const statsPath = resolve(workspace, 'dist/angular-22/stats.json');
  const audit = auditBuild(statsPath, root);
  const stats = JSON.parse(await readFile(statsPath, 'utf8'));
  const entries = { labs: 'labs.routes.ts', performance: 'performance/performance.routes.ts',
    deferred: 'performance/deferred-summary.component.ts', demand: 'performance/demand-lesson.component.ts', preloaded: 'performance/preload-lesson.component.ts' };
  const chunks = Object.fromEntries(Object.entries(entries).map(([name, entry]) => {
    const matches = Object.entries(stats.outputs).filter(([path, output]) => /\.m?js$/.test(path) &&
      output.entryPoint?.replaceAll('\\', '/') === `src/app/features/labs/${entry}`);
    assert.equal(matches.length, 1, `Expected one emitted entry for ${entry}`);
    return [name, `/${matches[0][0]}`];
  }));
  const server = staticServer(root);
  let browser;
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true, timeout });
    const profiles = [{ name: 'desktop-light', viewport: { width: 1280, height: 900 }, colorScheme: 'light' },
      { name: '390-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' }];
    const samples = [];
    for (const profile of profiles.slice(0, process.argv[2] ? 1 : 2)) samples.push(await measure(browser, origin, profile, chunks));
    return { environment: { node: process.version, chrome: browser.version(), profiles: samples.length },
      notes: ['Existing production artifacts assumed; audit rejects known mock/test inputs. No build performed.',
        'Fresh context per cold document. HTTP cache disabled by no-store and routing; repeat visits test same-document module reuse before reload.',
        'Uncompressed local responses: Resource Timing sizes are observed; gzip is only an artifact estimate.',
        'LCP candidates sampled before first input, not finalized field LCP. Layout-shift sums exclude recent input, not session-window CLS.',
        'Enter-to-visible plus two-frame automation wall duration includes driver overhead; INP not measured.',
        'No throttling, arbitrary sleeps, Lighthouse score, speed claim or image audit. Narrow viewport is not mobile hardware.'],
      bundle: { rawBytes: audit.initial.rawBytes, gzipEstimateBytes: audit.initial.gzipEstimateBytes,
        lazy: audit.lazyEntries.filter(entry => Object.values(chunks).includes(`/${entry.path}`)), lazyMeaning: audit.lazyEntryMeaning }, samples };
  } finally {
    try { await browser?.close(); } finally {
      await new Promise((done, reject) => { server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : done()); server.closeAllConnections(); });
    }
  }
}
main().then(report => console.log(JSON.stringify(report, null, 2))).catch(error => {
  console.error(JSON.stringify({ error: error.message })); process.exitCode = 1;
});
