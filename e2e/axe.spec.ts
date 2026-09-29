import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, expectStableApp, test } from './fixtures';

interface AuditRoute {
  readonly name: string;
  readonly path: string;
  readonly heading: string | RegExp;
  readonly prepare: (page: Page) => Promise<void>;
}

const routes: readonly AuditRoute[] = [
  {
    name: 'dashboard', path: '/dashboard', heading: /Understand Angular\.\s*One module at a time\./,
    prepare: async page => {
      await page.getByRole('button', { name: 'Load widgets', exact: true }).click();
      await expect(page.getByText('0 loading · 3 loaded · 0 empty · 0 failed', { exact: true })).toBeVisible();
    },
  },
  {
    name: 'products', path: '/products', heading: 'Products',
    prepare: async page => {
      await expect(page.getByRole('region', { name: 'Product results', exact: true }))
        .toContainText('30 products found · 12 on this page');
    },
  },
  {
    name: 'performance', path: '/labs/performance', heading: 'Performance lab',
    prepare: async page => {
      await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption('when');
      await page.getByRole('button', { name: 'Open signal gate', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Fictional measurement summary', exact: true })).toBeVisible();
    },
  },
  {
    name: 'material-dates', path: '/labs/material-dates', heading: 'Material dates and time lab',
    prepare: async page => {
      await page.getByRole('button', { name: 'Fill single sample', exact: true }).click();
      await page.getByRole('button', { name: 'Fill range/time sample', exact: true }).click();
      await expect(page.locator('[data-single-value]')).toHaveText('2026-09-15');
      await expect(page.locator('[data-start-value]')).toHaveText('2026-09-16');
      await expect(page.locator('[data-end-value]')).toHaveText('2026-09-18');
      await expect(page.locator('[data-time-value]')).toHaveText('10:00');
    },
  },
];

async function audit(page: Page, testInfo: TestInfo, state: string): Promise<void> {
  await expectStableApp(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  // Keep complete node targets, HTML and failure summaries; do not baseline or suppress violations.
  await testInfo.attach(`axe-${state}`, {
    body: JSON.stringify({ url: page.url(), state, violations: results.violations }, null, 2),
    contentType: 'application/json',
  });
  expect.soft(results.violations, `${state}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
}

const displays = [
  { name: 'desktop-light', viewport: { width: 1280, height: 900 }, theme: 'light' },
  { name: 'mobile-390-dark', viewport: { width: 390, height: 844 }, theme: 'dark' },
] as const;

for (const display of displays) {
  test.describe(display.name, () => {
    test.use({ viewport: display.viewport, colorScheme: display.theme });

    for (const route of routes) {
      test(`${route.name}: WCAG AA in its populated state`, async ({ page }, testInfo) => {
        await page.goto(`/#${route.path}`);
        await expect(page.getByRole('heading', { name: route.heading, level: 1, exact: true })).toBeVisible();
        await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(display.theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', display.theme);
        await route.prepare(page);
        await audit(page, testInfo, `${display.name}-${route.name}-populated`);

        if (route.name === 'material-dates') {
          // The template explicitly supports Arrow Down / Escape on this public input.
          const time = page.locator('#material-time');
          await time.press('ArrowDown');
          await expect(time).toHaveAttribute('aria-expanded', 'true');
          await expect(page.getByRole('listbox')).toBeVisible();
          await audit(page, testInfo, `${display.name}-time-options-open`);
          await page.keyboard.press('Escape');
          await expect(page.getByRole('listbox')).toHaveCount(0);
          await expect(time).toBeFocused();
          await expect(page.locator('[data-time-value]')).toHaveText('10:00');
        }
      });
    }
  });
}
