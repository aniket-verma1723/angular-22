import AxeBuilder from '@axe-core/playwright';
import { expect, expectStableApp, test } from './fixtures';

for (const display of [
  { width: 1280, theme: 'light' },
  { width: 390, theme: 'dark' }
] as const) {
  test.describe(`Zoneless ${display.width}px ${display.theme}`, () => {
    test.use({ viewport: { width: display.width, height: 900 }, colorScheme: display.theme });

    test('native callbacks refresh both notification modes without a second interaction', async ({ page }) => {
      await page.goto('/labs');
      await page.getByRole('link', { name: 'Open zoneless lab', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Zoneless notification lab', exact: true })).toBeVisible();
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(display.theme);
      expect(await page.evaluate(() => 'Zone' in globalThis)).toBe(false);
      for (const mode of ['Signal notification', 'markForCheck notification']) {
        await page.getByRole('radio', { name: mode, exact: true }).check();
        await page.getByRole('button', { name: 'Arm callback', exact: true }).press('Enter');
        await expect(page.getByTestId('probe-status')).toContainText('Pending');
        // No clicks or application method calls between starting the timer and observing its result.
        await expect(page.getByTestId('probe-status')).toContainText('Done');
        await expect(page.getByTestId('probe-count')).toHaveText('1');
        await page.getByRole('button', { name: 'Reset probe', exact: true }).press('Enter');
        await expect(page.getByTestId('probe-count')).toHaveText('0');
      }
      await expectStableApp(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(audit.violations).toEqual([]);
    });
  });
}

test('cancel and navigation destroy pending work; a fresh lab starts idle', async ({ page }) => {
  await page.goto('/labs/zoneless');
  await page.clock.install();
  await page.getByRole('button', { name: 'Arm callback', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel callback', exact: true }).click();
  await page.clock.runFor(1100);
  await expect(page.getByTestId('probe-status')).toContainText('Cancelled');
  await expect(page.getByTestId('probe-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Reset probe', exact: true }).click();
  await page.getByRole('button', { name: 'Arm callback', exact: true }).click();
  await page.getByRole('link', { name: 'All labs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Angular labs', exact: true })).toBeVisible();
  await page.clock.runFor(1100);
  await page.getByRole('link', { name: 'Open zoneless lab', exact: true }).click();
  await expect(page.getByTestId('probe-status')).toContainText('Idle');
  await expect(page.getByTestId('probe-count')).toHaveText('0');
});

test('the session expiry timer refreshes the visible sign-in state without user input', async ({ page }) => {
  await page.clock.install();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Fill public demo values', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Session summary', exact: true })).toBeVisible();
  await page.clock.fastForward(30 * 60_000);
  await expect(page.getByText('Demo session expired. Sign in again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Session summary', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

for (const variant of ['rxjs', 'httpResource', 'rxResource', 'resource']) {
  test(`${variant} publishes success, error and recovery without Zone.js`, async ({ page }) => {
    await page.goto('/labs/resources');
    await page.getByRole('combobox', { name: 'Read variant', exact: true }).selectOption(variant);
    const id = page.getByRole('textbox', { name: 'Product ID', exact: true });
    await id.fill('1');
    await page.getByRole('button', { name: 'Load product', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'P02 Mock Product 01', exact: true })).toBeVisible();
    await id.fill('999');
    await page.getByRole('button', { name: 'Load product', exact: true }).click();
    await expect(page.locator('#resource-read-error')).toBeVisible();
    await id.fill('2');
    await page.getByRole('button', { name: 'Load product', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'P02 Mock Product 02', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('idle');
  });
}
