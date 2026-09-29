import assert from 'node:assert/strict';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { auditBuild } from '../quality/bundle-audit.mjs';

// Read-only, one-shot artifact smoke: build:pages and installed Chrome are prerequisites.
// No build, browser download, live API, authentication, clipboard access or generated reports.
const timeout = 15000;
const check = expect.configure({ timeout });
const workspace = fileURLToPath(new URL('../../', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

function inside(root, target) {
  const part = relative(root, target);
  return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

function safePath(path) {
  return path.startsWith('/') && !path.includes('//') &&
    !/[\\:%?#\x00-\x20\x7f<>"|*]/.test(path) &&
    path.split('/').every(part => part !== '.' && part !== '..' && !/[. ]$/.test(part));
}

function readBaseHref(index) {
  // Accept the CLI's single, quoted base declaration, not ambiguous HTML or URL aliases.
  const tags = index.replace(/<!--[\s\S]*?-->/g, '').match(/<base\b[^>]*>/gi) ?? [];
  assert.equal(tags.length, 1, 'Built index must contain exactly one base element');
  const match = /^<base\s+href\s*=\s*(["'])([^"']*)\1\s*\/?>$/i.exec(tags[0]);
  assert(match, 'Expected a single quoted base href in the built index');
  const base = match[2];
  assert(safePath(base) && base.endsWith('/'),
    'Base href must be an absolute path ending in /, without URL escapes, query, hash or dot segments');
  assert.notEqual(base, '/', 'A subpath build is required; run build:pages first');
  assert.equal(new URL(base, 'http://127.0.0.1').pathname, base, 'Base href must be canonical');
  return base;
}

function staticServer(root, base) {
  return createServer({ requestTimeout: timeout, headersTimeout: timeout }, async (request, response) => {
    const end = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(message);
    };
    try {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        return end(405, 'Method not allowed');
      }
      const raw = (request.url ?? '').split('?')[0];
      // Decode before containment checks, but never accept encoded separators or double encoding.
      if (/%(?:2f|5c)/i.test(raw)) return end(403, 'Forbidden');
      const path = decodeURIComponent(raw);
      if (!safePath(path)) return end(403, 'Forbidden');
      if (!path.startsWith(base)) return end(404, 'Not found');
      const name = path === base ? 'index.html' : path.slice(base.length);
      let target = resolve(root, name);
      if (!inside(root, target)) return end(403, 'Forbidden');
      // The audit rejects existing symlinks; recheck every requested component too.
      let component = root;
      for (const part of name.split('/')) {
        component = resolve(component, part);
        if ((await lstat(component)).isSymbolicLink()) return end(403, 'Forbidden');
      }
      target = await realpath(target);
      if (!inside(root, target)) return end(403, 'Forbidden');
      if (!(await stat(target)).isFile()) return end(404, 'Not found');
      const body = await readFile(target);
      response.writeHead(200, {
        'Content-Type': mime[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': body.length
      });
      response.end(body);
    } catch (error) {
      end(error instanceof URIError ? 400 :
        ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500, 'Static request failed');
    }
  });
}

function lazyPaths(audit, base) {
  const entries = {
    labs: 'labs.routes.ts', zoneless: 'zoneless/zoneless-lab.component.ts',
    performance: 'performance/performance.routes.ts', cdk: 'cdk/cdk-lab.component.ts'
  };
  return Object.fromEntries(Object.entries(entries).map(([name, entry]) => {
    const matches = audit.lazyEntries.filter(item =>
      item.entryPoint?.replaceAll('\\', '/') === `src/app/features/labs/${entry}`);
    assert.equal(matches.length, 1, `Expected one audited lazy entry for ${entry}`);
    return [name, base + matches[0].path];
  }));
}

async function smoke(browser, origin, base, chunks) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce',
    locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block', permissions: []
  });
  const problems = [], documents = [];
  const scripts = new Set(), pending = new Set();
  let apiRequests = 0;
  const app = origin + base;
  try {
    context.setDefaultTimeout(timeout);
    context.setDefaultNavigationTimeout(timeout);
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = await request.allHeaders();
      const api = ['fetch', 'xhr', 'eventsource'].includes(request.resourceType());
      if (api) apiRequests++;
      if (request.method() !== 'GET' || url.origin !== origin || !url.pathname.startsWith(base) ||
          !safePath(url.pathname) || url.username || url.password || api ||
          headers.authorization || headers['proxy-authorization'] || headers.cookie) {
        problems.push(`Forbidden browser request: ${request.method()} ${url.pathname} (${request.resourceType()})`);
        return route.abort();
      }
      return route.continue();
    });
    await context.routeWebSocket('**/*', socket => {
      problems.push('Unexpected WebSocket');
      socket.close();
    });
    context.on('page', page => page.on('pageerror', error => problems.push(`Page error: ${error.message}`)));
    context.on('request', request => {
      pending.add(request);
      if (request.resourceType() === 'document') {
        const url = new URL(request.url());
        documents.push(url.pathname + url.search);
      }
    });
    context.on('requestfinished', request => {
      pending.delete(request);
      if (request.resourceType() === 'script') scripts.add(new URL(request.url()).pathname);
    });
    context.on('requestfailed', request => {
      pending.delete(request);
      problems.push(`Failed request: ${new URL(request.url()).pathname}`);
    });
    context.on('response', response => {
      if (response.status() !== 200) {
        problems.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
      }
    });

    const clean = async page => {
      await check.poll(() => pending.size, { message: 'Started static requests must finish' }).toBe(0);
      assert.equal(await page.evaluate(() => typeof window.Zone), 'undefined', 'Zone must not exist in production');
      assert.equal(apiRequests, 0, 'No fetch, XHR or event stream is allowed');
      assert.deepEqual(problems, [], 'Unexpected browser traffic/errors');
      assert(documents.every(path => path === base), 'Documents must request only the mounted base, without route/query');
    };
    const loaded = async name => {
      await check.poll(() => scripts.has(chunks[name]), { message: `Lazy ${name} chunk must finish loading` }).toBe(true);
    };
    const heading = (page, name) => page.getByRole('heading', { name, exact: true, level: 1 });
    const dashboard = async page => {
      await check(page).toHaveURL(`${app}#/dashboard`);
      await check(page.getByRole('heading', { level: 1 })).toContainText('Understand Angular.');
      await check(page.getByText('Widgets idle. No data requested.', { exact: true })).toBeVisible();
      await check(page.getByRole('button', { name: 'Load widgets', exact: true })).toBeEnabled();
      await clean(page);
    };

    // Root redirect and explicit dashboard entry both leave widgets idle, without HTTP data reads.
    const initial = await context.newPage();
    await initial.goto(app);
    await dashboard(initial);
    await check(initial.locator('base')).toHaveCount(1);
    await check(initial.locator('base')).toHaveAttribute('href', base);
    assert.equal(await initial.evaluate(() => document.baseURI), app);
    await initial.goto(`${app}#/dashboard`);
    await dashboard(initial);
    for (const [name, path] of Object.entries(chunks)) {
      assert(!scripts.has(path), `Dashboard must not load the ${name} lab chunk`);
    }
    await initial.close();

    // A fresh document, not just a same-document hash change, exercises a shared deep link.
    const page = await context.newPage();
    const deep = `${app}#/labs/zoneless?practice=refresh`;
    const beforeDeep = documents.length;
    const zoneless = async () => {
      await check(page).toHaveURL(deep);
      await check(heading(page, 'Zoneless notification lab')).toBeVisible();
      await check(page.getByTestId('probe-status')).toHaveText('Idle — ready to arm.');
      await loaded('labs');
      await loaded('zoneless');
      await clean(page);
    };
    await page.goto(deep);
    await zoneless();
    await page.reload();
    await zoneless();
    assert.deepEqual(documents.slice(beforeDeep), [base, base], 'Deep entry and reload must request the base document');

    const beforeHistory = documents.length;
    const allLabs = page.getByRole('link', { name: 'All labs', exact: true });
    await check(allLabs).toHaveAttribute('href', '#/labs');
    await allLabs.click();
    await check(page).toHaveURL(`${app}#/labs`);
    await check(heading(page, 'Angular labs')).toBeVisible();
    await page.goBack();
    await zoneless();
    await page.goForward();
    await check(page).toHaveURL(`${app}#/labs`);
    await check(heading(page, 'Angular labs')).toBeVisible();
    assert.equal(documents.length, beforeHistory, 'Hash Back/Forward must not request another document');

    await page.getByRole('link', { name: 'Open performance lab', exact: true }).click();
    await check(page).toHaveURL(`${app}#/labs/performance`);
    await check(heading(page, 'Performance lab')).toBeVisible();
    await loaded('performance');
    const images = page.getByRole('region', { name: 'Image fill workbench', exact: true });
    const image = images.locator('img');
    await image.scrollIntoViewIfNeeded();
    await check(images.locator('[data-image-status]')).toHaveText('Local image ready.');
    await check(image).toBeVisible();
    await check.poll(() => image.evaluate(element => element instanceof HTMLImageElement &&
      element.complete && element.naturalWidth > 0 && element.naturalHeight > 0)).toBe(true);
    assert.equal(await image.evaluate(element => element.currentSrc), `${app}mock-product.svg`,
      'The real image must load beneath the deployment prefix');
    await clean(page);

    await allLabs.click();
    await check(heading(page, 'Angular labs')).toBeVisible();
    await page.getByRole('link', { name: 'Open CDK lab', exact: true }).click();
    await check(page).toHaveURL(`${app}#/labs/cdk`);
    await check(heading(page, 'CDK lab')).toBeVisible();
    await loaded('cdk');
    const utilities = page.getByRole('button', { name: 'Accessibility and utilities', exact: true });
    await utilities.click();
    await check(utilities).toHaveAttribute('aria-pressed', 'true');
    await check(page.getByRole('heading', { name: 'Local accessibility and text utilities', exact: true })).toBeVisible();
    const publicLink = page.getByRole('textbox', { name: 'Public product link', exact: true });
    await check(publicLink).toBeVisible();
    await check(publicLink).toHaveAttribute('readonly', '');
    await check(publicLink).toHaveValue(`${app}#/products/1`);
    await clean(page); // Inspect only: no clipboard permission, copy action or product navigation.

    await page.goto(`${app}#/missing-pages-smoke?source=hash-regression`);
    await check(heading(page, 'Page not found')).toBeVisible();
    await check(page).toHaveURL(`${app}#/missing-pages-smoke?source=hash-regression`);
    const recovery = page.getByRole('link', { name: 'Back to overview', exact: true });
    await check(recovery).toHaveAttribute('href', '#/dashboard');
    await recovery.click();
    await dashboard(page);
    return { lazyChunks: Object.keys(chunks).length, documentRequests: documents.length, apiRequests };
  } finally {
    try { await context.close(); } finally {
      assert.deepEqual(problems, [], 'Unexpected browser traffic/errors, including during cleanup');
    }
  }
}

async function main() {
  assert.equal(process.argv.length, 2, 'Usage: node tools/deployment/pages-smoke.mjs');
  const root = await realpath(resolve(workspace, 'dist/angular-22/browser'));
  const statsPath = resolve(workspace, 'dist/angular-22/stats.json');
  // Fail before opening any server/browser on stale artifacts or known mock/test/Zone inputs.
  const audit = auditBuild(statsPath, root);
  const base = readBaseHref(await readFile(resolve(root, 'index.html'), 'utf8'));
  const chunks = lazyPaths(audit, base);
  const server = staticServer(root, base);
  let browser;
  try {
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    const address = server.address();
    assert(address && typeof address !== 'string', 'Expected an owned loopback listener');
    const origin = `http://127.0.0.1:${address.port}`;
    // Intentional negative outside the browser: a path route must not fall back to index.html.
    const missing = await fetch(`${origin}${base}labs/zoneless`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeout)
    });
    await missing.text();
    assert.equal(missing.status, 404, 'Static hosting must return 404 for an unhashed deep route');
    browser = await chromium.launch({ channel: 'chrome', headless: true, timeout });
    const result = await smoke(browser, origin, base, chunks);
    return { base, ...result, unhashedRouteStatus: missing.status };
  } finally {
    try { await browser?.close(); } finally {
      await new Promise((done, reject) => {
        server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : done());
        server.closeAllConnections();
      });
    }
  }
}

main().then(result => console.log(`Pages artifact smoke passed: ${JSON.stringify(result)}`)).catch(error => {
  console.error(`Pages artifact smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
