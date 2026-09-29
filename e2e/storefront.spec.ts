import type { Locator, Page } from '@playwright/test';
import { expect, hashRouteUrl, test } from './fixtures';

async function expectRenderedRow(row: Locator): Promise<void> {
  await expect.poll(() => row.evaluate(element => {
    const viewport = element.closest('[role="list"]');
    if (!viewport) throw new Error('Virtual row requires its list viewport.');
    const bounds = viewport.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  })).toBe(true);
}

async function signInWithPublicMock(page: Page, admin = false): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Your practice session', exact: true })).toBeVisible();
  await expect(page.getByText('Local mock · no remote sign-in', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fill public demo values', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Public demo username', exact: true })).toHaveValue('learner');
  if (admin) {
    await page.getByRole('combobox', { name: 'Local practice role', exact: true }).press('Enter');
    await page.getByRole('option', { name: 'Demo admin', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Session summary', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary.locator('dd')).toHaveText(['Demo Learner', 'learner', '2', admin ? 'demo-admin' : 'learner']);
  await page.getByRole('link', { name: 'Continue', exact: true }).click();
}

test('catalogue search, sort and page survive detail navigation and reload', async ({ page }) => {
  await page.goto('/#/products?sort=price&order=desc');
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('P02 Mock Product');
  await expect(page).toHaveURL(url => hashRouteUrl(url).searchParams.get('q') === 'P02 Mock Product');
  const results = page.getByRole('region', { name: 'Product results', exact: true });
  await expect(results).toContainText('30 products found · 12 on this page');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page).toHaveURL(url => hashRouteUrl(url).searchParams.get('page') === '2');
  await expect(results.getByRole('heading', { level: 2 }).first()).toHaveText('P02 Mock Product 18');
  const sharedURL = page.url();
  await page.getByRole('link', { name: 'View details: P02 Mock Product 18', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Product details', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← Back to products', exact: true }).click();
  await expect(page).toHaveURL(sharedURL);
  await page.reload();
  await expect(page).toHaveURL(sharedURL);
  await expect(page.getByRole('searchbox', { name: 'Search products', exact: true })).toHaveValue('P02 Mock Product');
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toContainText('Price');
  await expect(page.getByRole('combobox', { name: 'Direction', exact: true })).toContainText('Descending');
  await expect(results.getByRole('heading', { level: 2 }).first()).toHaveText('P02 Mock Product 18');
});

test('guest cart redirects to public mock login and creates a user 2 receipt', async ({ page }) => {
  await page.goto('/#/products/2');
  await expect(page.getByRole('heading', { name: 'P02 Mock Product 02', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Cart, 1 items', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View cart', exact: true }).click();
  await page.getByRole('link', { name: 'Practice checkout', exact: true }).click();
  await expect(page).toHaveURL(url => {
    const route = hashRouteUrl(url);
    return route.pathname === '/login' && route.searchParams.get('returnUrl') === '/checkout';
  });
  await signInWithPublicMock(page);
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use fictional sample', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to delivery', exact: true }).click();
  await page.getByRole('radio', { name: 'Standard · practice option', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I understand this is a simulation, not a purchase.', exact: true }).check();
  await page.getByRole('button', { name: 'Create simulated receipt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your simulated receipt', exact: true })).toBeFocused();
  await expect(page.getByRole('main')).toContainText(/Mock receipt \d+ · Demo user 2 · 1 items/);
  await expect(page.getByRole('main')).toContainText('The submitted cart was cleared.');
  await expect(page.getByRole('link', { name: 'Cart, 0 items', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View cart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty', exact: true })).toBeVisible();
});

test('demo-admin creates, reads, updates and deletes a product; Escape preserves a dirty draft', async ({ page }) => {
  await page.goto('/#/products/new');
  await signInWithPublicMock(page, true);
  const title = 'P11 browser practice notebook';
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  const back = page.getByRole('link', { name: 'Back to products', exact: true });
  await back.click();
  const dirtyDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await expect(dirtyDialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dirtyDialog).toHaveCount(0);
  await expect(back).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('A fictional notebook created only for this browser practice session.');
  await page.getByRole('spinbutton', { name: 'Price (USD)', exact: true }).fill('12.50');
  await page.getByRole('spinbutton', { name: 'Stock', exact: true }).fill('5');
  await page.getByRole('combobox', { name: 'Category', exact: true }).press('Enter');
  await page.getByRole('option', { name: 'Stationery', exact: true }).click();
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved in this mock session', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View saved product', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit product', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`${title} revised`);
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Save result', exact: true })).toContainText(`${title} revised`);
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete product?', exact: true });
  await expect(deleteDialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await deleteDialog.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deleted from this mock session', exact: true })).toBeVisible();
  await back.click();
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(title);
  await expect(page).toHaveURL(url => hashRouteUrl(url).searchParams.get('q') === title);
  await expect(page.getByRole('heading', { name: 'No products found', exact: true })).toBeVisible();
});

test('task native keyboard move and completion persist appropriately; dirty navigation is guarded', async ({ page }) => {
  await page.goto('/#/tasks');
  const open = page.locator('#task-list-OPEN');
  const task = page.locator('[data-task-id="1"]');
  await expect(open.locator('[data-task-id]').first()).toHaveAttribute('data-task-id', '1');
  await page.getByRole('button', { name: 'Move task 1 down in OPEN', exact: true }).press('Enter');
  await expect(open.locator('[data-task-id]').nth(1)).toHaveAttribute('data-task-id', '1');
  await expect(page.getByRole('button', { name: 'Move task 1 down in OPEN', exact: true })).toBeFocused();
  await page.getByRole('checkbox', { name: 'Mark task 1 completed', exact: true }).check();
  await expect(page.locator('#task-list-DONE [data-task-id="1"]')).toBeVisible();
  await expect(task).toHaveAttribute('aria-busy', 'false');
  await expect(task).toContainText('Updated in session mock data');
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark task 1 completed', exact: true })).toBeChecked();
  await page.getByRole('textbox', { name: 'Task text', exact: true }).fill('Keep this unsaved fictional task');
  const dashboard = page.getByRole('link', { name: 'Learning Store dashboard', exact: true });
  await dashboard.click();
  const dialog = page.getByRole('dialog', { name: 'Discard task draft?', exact: true });
  await expect(dialog.getByRole('button', { name: 'Keep working', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(dashboard).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Task text', exact: true })).toHaveValue('Keep this unsaved fictional task');
  await dashboard.click();
  await dialog.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(page).toHaveURL(/\/#\/dashboard$/);
});

test('dashboard remains idle until Load and exposes complete grouped mock totals', async ({ page }) => {
  await page.goto('/#/dashboard');
  await expect(page.getByText('Widgets idle. No data requested.', { exact: true })).toBeVisible();
  await expect(page.getByText('Not loaded. Select Load widgets to request data.', { exact: true })).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Request strategy', exact: true }).selectOption('forkJoin');
  await expect(page.getByText('Widgets idle. No data requested.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load widgets', exact: true }).click();
  await expect(page.getByText('0 loading · 3 loaded · 0 empty · 0 failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Users', exact: true })).toContainText('Total: 30');
  await expect(page.getByRole('article', { name: 'Tasks', exact: true })).toContainText('Total: 42');
  await expect(page.getByRole('article', { name: 'Tasks', exact: true })).toContainText('3 completed · 7 incomplete');
  await expect(page.getByRole('article', { name: 'Posts · public user 1', exact: true })).toContainText('Total: 12');
  await expect(page.getByRole('button', { name: 'Load widgets', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload snapshot', exact: true }).click();
  await expect(page.getByText('0 loading · 3 loaded · 0 empty · 0 failed', { exact: true })).toBeVisible();
});

test('CDK portal traps keyboard focus and virtual rows keep selection by stable ID', async ({ page }) => {
  await page.goto('/#/labs/cdk');
  const trigger = page.getByRole('button', { name: 'Open portal help', exact: true });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Portal help', exact: true });
  const acknowledge = dialog.getByRole('button', { name: 'Acknowledge help', exact: true });
  const close = dialog.getByRole('button', { name: 'Close help', exact: true });
  await expect(acknowledge).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(acknowledge).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toContainText('Help acknowledged. Closing destroys this view.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Virtual people', exact: true }).press('Enter');
  const viewport = page.getByRole('list', { name: 'Fictional people', exact: true });
  // Attached rows precede CDK's spacer/transform render. Keyboard focus must use painted geometry.
  await expect.poll(() => viewport.evaluate(element => element.scrollHeight)).toBe(48_000);
  const first = page.getByRole('checkbox', { name: 'Fictional person 0001', exact: true });
  await expectRenderedRow(first);
  await first.press('Space');
  await expect(first).toBeChecked();
  await page.getByRole('button', { name: 'Jump to last person', exact: true }).press('Enter');
  await expect(first).toHaveCount(0);
  const last = page.getByRole('checkbox', { name: 'Fictional person 1000', exact: true });
  await expectRenderedRow(last);
  await last.press('Space');
  await expect(last).toBeChecked();
  await expect(page.locator('[data-selected-count]')).toHaveText('2');
  await page.getByRole('button', { name: 'Jump to first person', exact: true }).press('Enter');
  await expectRenderedRow(first);
  await expect(first).toBeChecked();
  await expect(page.locator('[data-selected-count]')).toHaveText('2');
  await expect.poll(() => page.getByRole('list', { name: 'Fictional people', exact: true }).getByRole('listitem').count()).toBeLessThan(1000);
  await page.getByRole('button', { name: 'Reset local selection', exact: true }).press('Enter');
  await expect(first).not.toBeChecked();
  await expect(page.locator('[data-selected-count]')).toHaveText('0');
});
