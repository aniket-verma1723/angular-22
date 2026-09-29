import { expect, expectStableApp, test } from './fixtures';

const displays = [
  { width: 1440, theme: 'dark' },
  { width: 1280, theme: 'light' },
  { width: 1199, theme: 'light' },
  { width: 390, theme: 'dark' },
  { width: 320, theme: 'light' },
] as const;

for (const display of displays) {
  test.describe(`Dashboard at ${display.width}px in ${display.theme} mode`, () => {
    test.use({ viewport: { width: display.width, height: 900 }, colorScheme: display.theme });

    test('keeps the workspace summary readable beside or above later milestones', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(display.theme);
      await expectStableApp(page);

      const foundation = page.getByRole('region', { name: 'Your workspace is taking shape.', exact: true });
      await expect(foundation).toBeVisible();
      const layout = await foundation.evaluate(element => {
        const summary = element.firstElementChild;
        const milestones = element.querySelector('.next-step');
        if (!summary || !milestones) throw new Error('Dashboard summary and milestones must be present.');
        const bounds = element.getBoundingClientRect();
        const summaryBounds = summary.getBoundingClientRect();
        const milestoneBounds = milestones.getBoundingClientRect();
        return {
          width: bounds.width,
          summary: { width: summaryBounds.width, top: summaryBounds.top, bottom: summaryBounds.bottom },
          milestones: { width: milestoneBounds.width, top: milestoneBounds.top, left: milestoneBounds.left },
          summaryRight: summaryBounds.right,
        };
      });

      if (display.width >= 1200) {
        // A long auto-sized sidebar previously consumed the entire grid, leaving a 0px summary.
        expect(layout.summary.width).toBeGreaterThan(layout.width * 0.55);
        expect(layout.milestones.width).toBeLessThan(layout.summary.width);
        expect(layout.milestones.left).toBeGreaterThan(layout.summaryRight);
        expect(Math.abs(layout.milestones.top - layout.summary.top)).toBeLessThan(1);
      } else {
        expect(layout.summary.width).toBeGreaterThan(layout.width * 0.95);
        expect(layout.milestones.width).toBeGreaterThan(layout.width * 0.95);
        expect(layout.milestones.top).toBeGreaterThan(layout.summary.bottom);
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByText('Widgets idle. No data requested.', { exact: true })).toBeVisible();
      await expect(foundation.getByRole('link', { name: 'Open performance lab', exact: true }))
        .toHaveAttribute('href', '/labs/performance');
    });
  });
}
