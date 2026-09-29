import { expect, test as base } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

interface BrowserSafety {
  readonly externalRequests: string[];
  readonly pageErrors: string[];
}

interface Fixtures {
  browserSafety: BrowserSafety;
}

export const test = base.extend<Fixtures>({
  browserSafety: [async ({ page, context, baseURL }, use) => {
    if (!baseURL) throw new Error('Mock-only tests require a configured baseURL.');
    const local = new URL(baseURL);
    if (local.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname)) {
      throw new Error('Mock-only tests require an HTTP loopback baseURL.');
    }

    const safety: BrowserSafety = { externalRequests: [], pageErrors: [] };
    const guard = async (route: Route): Promise<void> => {
      const request = route.request();
      const url = new URL(request.url());
      const allowed = url.protocol === 'data:' ||
        ((url.protocol === 'http:' || url.protocol === 'blob:') && url.origin === local.origin);
      if (allowed) {
        await route.continue();
      } else {
        safety.externalRequests.push(`${request.method()} ${request.url()}`);
        await route.abort('blockedbyclient');
      }
    };
    const listeners = new Map<Page, (error: Error) => void>();
    const observe = (observed: Page): void => {
      const listener = (error: Error): void => {
        safety.pageErrors.push(`${observed.url()}\n${error.stack ?? error.message}`);
      };
      listeners.set(observed, listener);
      observed.on('pageerror', listener);
    };
    context.pages().forEach(observe);
    context.on('page', observe);
    // The page route is the normal boundary; the context route also covers popup requests.
    await context.route('**/*', guard);
    await page.route('**/*', guard);
    // HMR may use a local socket. Do not permit an external socket to bypass HTTP routing.
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      if (url.protocol === 'ws:' && url.host === local.host) {
        socket.connectToServer();
      } else {
        safety.externalRequests.push(`WebSocket ${socket.url()}`);
        socket.close();
      }
    });
    try {
      await use(safety);
    } finally {
      await page.unroute('**/*', guard);
      await context.unroute('**/*', guard);
      context.off('page', observe);
      for (const [observed, listener] of listeners) observed.off('pageerror', listener);
    }
  }, { auto: true }],
});

test.afterEach(async ({ browserSafety, page }, testInfo) => {
  if (browserSafety.externalRequests.length || browserSafety.pageErrors.length) {
    await testInfo.attach('browser-safety', {
      body: JSON.stringify(browserSafety, null, 2),
      contentType: 'application/json',
    });
  }
  expect.soft(browserSafety.externalRequests, 'External requests are forbidden in mock-only tests').toEqual([]);
  expect.soft(browserSafety.pageErrors, 'Unhandled browser errors').toEqual([]);
  if (!page.isClosed() && page.url().startsWith('http://')) {
    expect.soft(await page.evaluate(() => 'Zone' in globalThis),
      'Application browser builds must not load Zone.js').toBe(false);
  }
});

/** Read Angular's path/query from the fragment, not the physical document URL. */
export function hashRouteUrl(url: URL): URL {
  return new URL(url.hash.slice(1), url.origin);
}

/** Wait for observable layout and finite Material/CSS animations, not network idle. */
export async function expectStableApp(page: Page): Promise<void> {
  const main = page.getByRole('main');
  await expect(main).toBeVisible();
  await expect.poll(async () => (await main.boundingBox())?.width ?? 0,
    { message: 'Main content has a rendered width' }).toBeGreaterThan(0);
  await expect(main.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation =>
    (animation.pending || animation.playState === 'running') &&
    animation.effect?.getComputedTiming().iterations !== Infinity,
  ).length), { message: 'Finite UI transitions have settled' }).toBe(0);
}

export { expect };
