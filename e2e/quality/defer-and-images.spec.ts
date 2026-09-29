import type { Locator, Page, Route } from '@playwright/test';
import { expect, expectStableApp, test } from '../fixtures';

// Real public triggers, not Angular testing/debug APIs. HMR/cache can affect downloads:
// these assertions establish rendering behavior, not production splitting or Web Vitals.
async function openLab(page: Page): Promise<void> {
  await page.goto('/labs/performance');
  await expect(page.getByRole('heading', { name: 'Performance lab', exact: true })).toBeVisible();
  await expectStableApp(page);
}

function summary(page: Page): Locator {
  return page.getByRole('heading', { name: 'Fictional measurement summary', exact: true });
}

async function expectOneSummary(page: Page, instance = '1'): Promise<void> {
  await expect(summary(page)).toHaveCount(1);
  await expect(summary(page)).toBeVisible();
  await expect(page.locator('[data-instance-id]')).toHaveText(instance);
  await expect(page.locator('[data-measurement-count]')).toHaveText('200');
  await expect(page.locator('[data-defer-state]')).toHaveCount(0);
}

for (const action of ['click', 'Enter'] as const) {
  test(`Interaction waits through focus then renders on ${action}`, async ({ page }) => {
    await openLab(page);
    const trigger = page.getByRole('button', { name: 'Load interaction summary', exact: true });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await expect(page.locator('[data-defer-state="placeholder"]')).toHaveText('Interaction summary waiting.');
    await expect(summary(page)).toHaveCount(0);
    // Focus is a prefetch condition, not permission to instantiate the summary.
    if (action === 'click') await trigger.click();
    else await trigger.press('Enter');
    await expectOneSummary(page);
    await trigger.press('Enter');
    await expect(page.locator('[data-instance-id]')).toHaveText('1');
  });
}

test('Viewport waits outside view then renders when its actual placeholder is scrolled into view', async ({ page }) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
  await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption({ label: 'Viewport' });
  const mount = page.getByRole('button', { name: 'Mount experiment', exact: true });
  await mount.focus();
  // Keep native keyboard focus while scrolling far below the workbench. Using keyboard
  // activation avoids a locator click scrolling the mount button/placeholder back into view.
  await page.getByRole('heading', { name: 'Image fill workbench', exact: true }).scrollIntoViewIfNeeded();
  await expect(mount).toBeFocused();
  await expect(mount).not.toBeInViewport();
  await page.keyboard.press('Enter');
  const placeholder = page.locator('[data-defer-state="placeholder"]');
  await expect(placeholder).toHaveText('Viewport summary waiting to enter view.');
  await expect(placeholder).not.toBeInViewport();
  await expect(summary(page)).toHaveCount(0);
  await placeholder.scrollIntoViewIfNeeded();
  await expectOneSummary(page);
});

test('When (signal) renders only after opening the gate and remains complete after closing it', async ({ page }) => {
  await openLab(page);
  await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption({ label: 'When (signal)' });
  await expect(page.locator('[data-defer-state="placeholder"]')).toHaveText('Signal summary waiting for the gate.');
  await expect(summary(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Open signal gate', exact: true }).press('Enter');
  await expectOneSummary(page);
  await page.getByRole('button', { name: 'Close signal gate', exact: true }).press('Enter');
  await expect(page.locator('[data-gate-state]')).toHaveText('Signal gate: closed');
  await expectOneSummary(page);
});

for (const action of ['pointer hover', 'keyboard focus'] as const) {
  test(`Hover or focus renders from ${action} without activation`, async ({ page }) => {
    await openLab(page);
    // Park the pointer outside the new trigger so selection cannot accidentally hover it.
    await page.mouse.move(0, 0);
    await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption({ label: 'Hover or focus' });
    await expect(page.locator('[data-defer-state="placeholder"]')).toHaveText('Hover summary waiting for hover or focus.');
    await expect(summary(page)).toHaveCount(0);
    const trigger = page.getByRole('button', { name: 'Hover or focus to load summary', exact: true });
    if (action === 'pointer hover') {
      await trigger.hover();
    } else {
      await page.getByRole('button', { name: 'Unmount experiment', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(trigger).toBeFocused();
    }
    await expectOneSummary(page);
  });
}

for (const label of ['Idle', 'Immediate'] as const) {
  test(`${label} automatically renders on mounting without a summary interaction`, async ({ page }) => {
    await openLab(page);
    await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
    await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption({ label });
    await expect(summary(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Mount experiment', exact: true }).click();
    // No transient-placeholder assertion: native idle/immediate may finish before the driver reads.
    // Locator assertions are bounded by the suite's normal assertion/test deadlines.
    await expectOneSummary(page);
    await expect(page.getByRole('heading', { name: 'Image fill workbench', exact: true })).toBeAttached();
  });
}

test('Timer (1500 ms) starts a fresh native delay on each mount', async ({ page }) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
  await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption({ label: 'Timer (1500 ms)' });
  for (const instance of ['1', '2']) {
    const mount = page.getByRole('button', { name: 'Mount experiment', exact: true });
    // Observe public click + DOM insertion, without replacing timers, waiting a fixed duration,
    // or touching Angular state. The observer is disposed even when a bounded assertion fails.
    const observation = await mount.evaluateHandle(button => {
      const workbench = document.getElementById('trigger-workbench');
      if (!workbench) throw new Error('Missing trigger workbench');
      let started: number | null = null;
      let elapsed: number | null = null;
      let placeholderSeen = false;
      const start = (): void => { started = performance.now(); };
      const observer = new MutationObserver(() => {
        if (workbench.querySelector('[data-defer-state="placeholder"]')) placeholderSeen = true;
        if (started !== null && elapsed === null && workbench.querySelector('[data-instance-id]')) {
          elapsed = performance.now() - started;
        }
      });
      button.addEventListener('click', start, { capture: true, once: true });
      observer.observe(workbench, { childList: true, subtree: true });
      return {
        read: () => ({ elapsed, placeholderSeen }),
        dispose: () => {
          observer.disconnect();
          button.removeEventListener('click', start, true);
        }
      };
    });
    try {
      await mount.click();
      await expectOneSummary(page, instance);
      const timing = await observation.evaluate(probe => probe.read());
      expect(timing.placeholderSeen).toBe(true);
      expect(timing.elapsed).not.toBeNull();
      // Allow one millisecond of native timer/clock quantization, not an arbitrary sleep.
      expect(timing.elapsed).toBeGreaterThanOrEqual(1499);
    } finally {
      await observation.evaluate(probe => probe.dispose());
      await observation.dispose();
    }
    await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
    await expect(summary(page)).toHaveCount(0);
  }
});

interface ImageGeometry {
  readonly width: number;
  readonly height: number;
  readonly statusOffset: number;
}

async function geometry(lesson: Locator): Promise<ImageGeometry> {
  return lesson.evaluate(section => {
    const frame = section.querySelector('[data-image-frame]');
    const status = section.querySelector('[data-image-status]');
    if (!frame || !status) throw new Error('Missing image geometry landmarks');
    const bounds = frame.getBoundingClientRect();
    return {
      width: bounds.width, height: bounds.height,
      statusOffset: status.getBoundingClientRect().top - bounds.top
    };
  });
}

async function expectGeometry(lesson: Locator, before: ImageGeometry): Promise<void> {
  await expect.poll(async () => {
    const after = await geometry(lesson);
    return Math.max(Math.abs(after.width - before.width), Math.abs(after.height - before.height),
      Math.abs(after.statusOffset - before.statusOffset));
  }, { message: 'Loading, fitting and fallback preserve reserved frame and following text geometry' }).toBeLessThan(1);
}

for (const display of [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'narrow 390px', viewport: { width: 390, height: 844 } }
] as const) {
  test(`local fill image preserves real geometry through load, fit, failure and restore at ${display.name}`, async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('A loopback baseURL is required.');
    await page.setViewportSize(display.viewport);
    const localImage = new URL('/mock-product.svg', baseURL).href;
    const unavailableImage = new URL('/mock-product-unavailable.svg', baseURL).href;
    const imageRequests: string[] = [];
    page.on('request', request => {
      if (request.resourceType() === 'image') imageRequests.push(request.url());
    });
    const pending: { route?: Route } = {};
    // Hold only this known same-origin image. All other requests retain the shared guards.
    await page.route(localImage, route => { pending.route = route; });
    const lesson = page.getByRole('region', { name: 'Image fill workbench', exact: true });
    const image = lesson.locator('img');
    let before: ImageGeometry;
    try {
      await openLab(page);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => pending.route !== undefined, { message: 'The real local image request started' }).toBe(true);
      await expect(lesson.locator('[data-image-status]')).toHaveText('Local image loading.');
      await expectStableApp(page);
      before = await geometry(lesson);
      expect(before.width).toBeGreaterThan(0);
      expect(before.width).toBeLessThanOrEqual(Math.min(512, display.viewport.width));
      expect(before.width / before.height).toBeCloseTo(16 / 9, 2);
      await expect(lesson.locator('[data-image-frame]')).toHaveCSS('position', 'relative');
      await expect(image).toHaveCSS('position', 'absolute');
      await expect(image).toHaveAttribute('src', '/mock-product.svg');
      await expect(image).toHaveAttribute('alt', 'Purple fictional product cube on a pale background');
      await expect(image).toHaveAttribute('sizes', /\(max-width: 600px\) 80vw, 40vw$/);
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).not.toHaveAttribute('fetchpriority', 'high');
      expect(await image.getAttribute('width')).toBeNull();
      expect(await image.getAttribute('height')).toBeNull();
    } finally {
      // Fallback (not continue) passes this request through the fixture's network guard.
      if (pending.route) await pending.route.fallback();
      await page.unroute(localImage);
    }
    const expectDecoded = async (): Promise<void> => {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement &&
        element.complete && element.naturalWidth === 400 && element.naturalHeight === 300)).toBe(true);
      await expect(lesson.locator('[data-image-status]')).toHaveText('Local image ready.');
      const box = await image.boundingBox();
      if (!box) throw new Error('Decoded image has no rendered box');
      expect(box.width).toBeCloseTo(before.width, 1);
      expect(box.height).toBeCloseTo(before.height, 1);
    };
    await expectDecoded();
    await expectGeometry(lesson, before);
    const crop = lesson.getByRole('button', { name: 'Crop image (cover)', exact: true });
    await expect(crop).toHaveAttribute('aria-pressed', 'false');
    await expect(image).toHaveCSS('object-fit', 'contain');
    await crop.press('Space');
    await expect(crop).toHaveAttribute('aria-pressed', 'true');
    await expect(image).toHaveCSS('object-fit', 'cover');
    await expectGeometry(lesson, before);

    // Exercise the real missing local URL; do not synthesize an error event or hide an external URL.
    await lesson.getByRole('button', { name: 'Try unavailable local image', exact: true }).click();
    await lesson.locator('[data-image-frame]').scrollIntoViewIfNeeded();
    const fallback = lesson.getByRole('img', { name: 'Image unavailable: purple fictional product cube', exact: true });
    await expect(fallback).toBeVisible();
    await expect(image).toHaveCount(0);
    await expect(lesson.locator('[data-image-status]')).toHaveText('Local image unavailable.');
    expect(imageRequests).toContain(unavailableImage);
    await expectGeometry(lesson, before);
    const fallbackBox = await fallback.boundingBox();
    if (!fallbackBox) throw new Error('Fallback has no rendered box');
    expect(fallbackBox.width).toBeCloseTo(before.width, 1);
    expect(fallbackBox.height).toBeCloseTo(before.height, 1);

    await lesson.getByRole('button', { name: 'Restore local image', exact: true }).press('Enter');
    await expectDecoded();
    await expect(fallback).toHaveCount(0);
    await expect(image).toHaveAttribute('src', '/mock-product.svg');
    await expect(image).toHaveCSS('object-fit', 'cover');
    await expectGeometry(lesson, before);
    await crop.press('Space');
    await expect(image).toHaveCSS('object-fit', 'contain');
    await expectGeometry(lesson, before);
    await expect.poll(() => lesson.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.getByRole('main').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect([...new Set(imageRequests)].sort()).toEqual([localImage, unavailableImage].sort());
  });
}
