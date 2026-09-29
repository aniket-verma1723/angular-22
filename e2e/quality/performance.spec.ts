import { expect, test } from '../fixtures';

// Behavioral checks only. The mock dev server cannot establish production chunk sizes or Web Vitals.
test('signal defer renders once per mount and releases its instance on unmount', async ({ page }) => {
  await page.goto('/labs/performance');
  await expect(page.getByRole('heading', { name: 'Performance lab', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deferred trigger workbench', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Deferred trigger', exact: true }).selectOption('when');

  const summary = page.getByRole('heading', { name: 'Fictional measurement summary', exact: true });
  const observation = page.locator('[data-lifetime-observation]');
  const inspect = page.getByRole('button', { name: 'Inspect payload lifetimes', exact: true });
  await expect(page.locator('[data-defer-state="placeholder"]')).toHaveText('Signal summary waiting for the gate.');
  await expect(summary).toHaveCount(0);
  await inspect.click();
  await expect(observation).toContainText('created: 0; destroyed: 0; active: 0.');

  await page.getByRole('button', { name: 'Open signal gate', exact: true }).press('Enter');
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-instance-id]')).toHaveText('1');
  await expect(page.locator('[data-measurement-count]')).toHaveText('200');
  await inspect.click();
  await expect(observation).toContainText('created: 1; destroyed: 0; active: 1.');
  await page.getByRole('button', { name: 'Close signal gate', exact: true }).press('Enter');
  await expect(page.locator('[data-gate-state]')).toHaveText('Signal gate: closed');
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-instance-id]')).toHaveText('1');

  await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
  await expect(summary).toHaveCount(0);
  await inspect.click();
  await expect(observation).toContainText('created: 1; destroyed: 1; active: 0.');
  await page.getByRole('button', { name: 'Mount experiment', exact: true }).click();
  await expect(page.locator('[data-defer-state="placeholder"]')).toHaveText('Signal summary waiting for the gate.');
  await expect(summary).toHaveCount(0);
  await page.getByRole('button', { name: 'Open signal gate', exact: true }).click();
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-instance-id]')).toHaveText('2');
  await inspect.click();
  await expect(observation).toContainText('created: 2; destroyed: 1; active: 1.');
});
