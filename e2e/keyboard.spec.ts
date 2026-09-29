import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Real Tab traversal only: never substitute locator.focus() or a pointer action. */
async function tabTo(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  const isFocused = (): Promise<boolean> => target.evaluate(element => element === element.ownerDocument.activeElement);
  for (let tabs = 0; tabs <= 80; tabs++) {
    if (await isFocused()) return;
    if (tabs < 80) await target.page().keyboard.press('Tab');
  }
  throw new Error(`Not reachable within 80 Tab presses: ${target}`);
}

async function activate(target: Locator, key = 'Enter'): Promise<void> {
  await tabTo(target);
  await expect(target).toBeFocused();
  await target.page().keyboard.press(key);
}

async function publicMockLogin(page: Page, admin = false): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Your practice session', exact: true })).toBeFocused();
  await expect(page.getByText('Local mock · no remote sign-in', { exact: true })).toBeVisible();
  const username = page.getByRole('textbox', { name: 'Public demo username', exact: true });
  await tabTo(username);
  await page.keyboard.type('learner');
  await expect(username).toHaveValue('learner');
  const password = page.getByLabel('Public demo password', { exact: true });
  await tabTo(password);
  // Published fictional fixture values, not a real account or a secret.
  await page.keyboard.type('practice-only');
  if (admin) {
    const role = page.getByRole('combobox', { name: 'Local practice role', exact: true });
    await activate(role);
    await page.keyboard.press('End');
    await expect(page.getByRole('option', { name: 'Demo admin', exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(role).toContainText('Demo admin');
  }
  await activate(page.getByRole('button', { name: 'Sign in', exact: true }));
  const summary = page.getByRole('region', { name: 'Session summary', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary.locator('dd')).toHaveText(['Demo Learner', 'learner', '2', admin ? 'demo-admin' : 'learner']);
  await activate(page.getByRole('link', { name: 'Continue', exact: true }));
}

test('Tab-only catalogue → cart → public mock login → sample checkout → receipt', async ({ page }, testInfo) => {
  // Only the initial route is direct navigation; every subsequent action uses the keyboard.
  await page.goto('/products');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeFocused();
  const search = page.getByRole('searchbox', { name: 'Search products', exact: true });
  await tabTo(search);
  await page.keyboard.type('P02 Mock Product 02');
  await expect(page).toHaveURL(url => url.searchParams.get('q') === 'P02 Mock Product 02');
  const details = page.getByRole('link', { name: 'View details: P02 Mock Product 02', exact: true });
  await tabTo(details);
  await expect(details).toBeFocused();
  // Computed style evidence is a smoke check, not a contrast/occlusion or full WCAG audit.
  const focusStyle = await details.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'), outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow,
    };
  });
  expect(focusStyle.focusVisible).toBe(true);
  await testInfo.attach('catalogue-keyboard-focus-style', {
    body: JSON.stringify(focusStyle, null, 2), contentType: 'application/json',
  });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Product details', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'P02 Mock Product 02', exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: 'Add to cart', exact: true }), 'Space');
  await expect(page.getByRole('link', { name: 'Cart, 1 items', exact: true })).toBeVisible();
  await activate(page.getByRole('link', { name: 'View cart', exact: true }));
  await activate(page.getByRole('link', { name: 'Practice checkout', exact: true }));
  await expect(page).toHaveURL(url => url.pathname === '/login' && url.searchParams.get('returnUrl') === '/checkout');
  await publicMockLogin(page);
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeFocused();
  await activate(page.getByRole('button', { name: 'Use fictional sample', exact: true }));
  await activate(page.getByRole('button', { name: 'Continue to delivery', exact: true }));
  const standard = page.getByRole('radio', { name: 'Standard · practice option', exact: true });
  await activate(standard, 'Space');
  await expect(standard).toBeChecked();
  await activate(page.getByRole('button', { name: 'Continue to review', exact: true }));
  const acknowledgement = page.getByRole('checkbox', { name: 'I understand this is a simulation, not a purchase.', exact: true });
  await activate(acknowledgement, 'Space');
  await expect(acknowledgement).toBeChecked();
  await activate(page.getByRole('button', { name: 'Create simulated receipt', exact: true }));
  await expect(page.getByRole('heading', { name: 'Your simulated receipt', exact: true })).toBeFocused();
  await expect(page.getByRole('main')).toContainText(/Mock receipt \d+ · Demo user 2 · 1 items/);
  await expect(page.getByRole('main')).toContainText('The submitted cart was cleared.');
  await expect(page.getByRole('link', { name: 'Cart, 0 items', exact: true })).toBeVisible();
  await activate(page.getByRole('link', { name: 'View cart', exact: true }));
  await expect(page.getByRole('heading', { name: 'Your cart is empty', exact: true })).toBeVisible();
});

test('keyboard editor dirty-cancel traps focus, preserves the draft, and restores the initiating link', async ({ page }) => {
  await page.goto('/products/new');
  await publicMockLogin(page, true);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeFocused();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  const draft = 'Fictional keyboard-only notebook';
  await tabTo(title);
  await page.keyboard.type(draft);
  const back = page.getByRole('link', { name: 'Back to products', exact: true });
  await activate(back);
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  const keep = dialog.getByRole('button', { name: 'Keep editing', exact: true });
  await expect(keep).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(element.ownerDocument.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(keep).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(back).toBeFocused();
  await expect(title).toHaveValue(draft);
  await expect(page).toHaveURL(/\/products\/new$/);
  await page.keyboard.press('Enter');
  await expect(keep).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(back).toBeFocused();
  await expect(title).toHaveValue(draft);
});
