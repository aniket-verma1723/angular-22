import { expect, hashRouteUrl, test } from './fixtures';

test('user URL search restores and profile posts lead to comments and back to the author', async ({ page }) => {
  await page.goto('/#/users');
  const search = page.getByRole('searchbox', { name: 'Search users', exact: true });
  await search.fill('Emily');
  await expect(page).toHaveURL(url => {
    const route = hashRouteUrl(url);
    return route.pathname === '/users' && route.searchParams.get('q') === 'Emily';
  });
  const directoryURL = page.url();
  await page.reload();
  await expect(search).toHaveValue('Emily');
  const user = page.getByRole('table', { name: 'Public users', exact: true })
    .getByRole('link', { name: 'Emily Johnson', exact: true });
  await user.click();
  await expect(page).toHaveURL(url => {
    const route = hashRouteUrl(url);
    return route.pathname === '/users/1' && route.searchParams.get('q') === 'Emily';
  });
  await expect(page.getByRole('region', { name: 'Public profile', exact: true }))
    .toContainText('Emily Johnson');
  await page.getByRole('link', { name: 'Back to users', exact: true }).click();
  await expect(page).toHaveURL(directoryURL);
  await expect(search).toHaveValue('Emily');
  await user.click();
  const posts = page.getByRole('region', { name: 'Posts by this user', exact: true });
  await expect(posts.getByRole('status').filter({ hasText: 'posts ·' })).toHaveText('12 posts · 10 on this page · offset 0');
  await posts.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(posts.getByRole('status').filter({ hasText: 'posts ·' })).toHaveText('12 posts · 2 on this page · offset 10');
  await expect(posts.getByRole('link', { name: "Emily's learning note 12", exact: true })).toBeVisible();
  await posts.getByRole('button', { name: 'Previous page', exact: true }).click();
  await posts.getByRole('link', { name: "Emily's learning note 1", exact: true }).click();
  await expect(page).toHaveURL(url => hashRouteUrl(url).pathname === '/posts/1');
  await expect(page.getByRole('region', { name: 'Post', exact: true }))
    .toContainText('A fictional practice note about learning together, written by Emily Johnson.');
  const comments = page.getByRole('region', { name: 'Comments', exact: true });
  await expect(comments.getByRole('status').filter({ hasText: 'comments ·' })).toHaveText('12 comments · 10 on this page · offset 0');
  await expect(comments).toContainText('Practice comment 1: thanks for sharing this learning note.');
  await comments.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(comments.getByRole('status').filter({ hasText: 'comments ·' })).toHaveText('12 comments · 2 on this page · offset 10');
  await expect(comments).toContainText('Practice comment 12: thanks for sharing this learning note.');
  await page.getByRole('region', { name: 'Author', exact: true })
    .getByRole('link', { name: 'Emily Johnson', exact: true }).click();
  await expect(page).toHaveURL(url => hashRouteUrl(url).pathname === '/users/1');
  await expect(page.getByRole('heading', { name: 'Emily Johnson', exact: true })).toBeVisible();
  await expect(posts.getByRole('status').filter({ hasText: 'posts ·' })).toHaveText('12 posts · 10 on this page · offset 0');
});

test('product images have descriptive dimensions and recreate priority across sort reversals', async ({ page }) => {
  // Seeds 01–09 match this query; audit rendered attributes, not private Angular state.
  await page.goto('/#/products?q=P02%20Mock%20Product%200&sort=title');
  const results = page.getByRole('region', { name: 'Product results', exact: true });
  const images = results.locator('img');
  const audit = async (first: string): Promise<void> => {
    await expect(results.getByRole('heading', { level: 2 }).first()).toHaveText(first);
    await expect(images).toHaveCount(9);
    await expect(results.locator('img[fetchpriority="high"]')).toHaveCount(1);
    await expect(results.locator('img[loading="eager"]')).toHaveCount(1);
    await expect(results.locator('img[loading="lazy"]')).toHaveCount(8);
    await expect(images.first()).toHaveAttribute('alt', first);
    await expect(images.first()).toHaveAttribute('fetchpriority', 'high');
    await expect(images.first()).toHaveAttribute('loading', 'eager');
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('width', '400');
      await expect(image).toHaveAttribute('height', '300');
      await expect(image).toHaveAttribute('src', '/mock-product.svg');
      await expect(image).toHaveAttribute('alt', /^P02 Mock Product 0[1-9]$/);
    }
    await expect.poll(() => images.first().evaluate(image =>
      image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
  };
  await audit('P02 Mock Product 01');
  for (const [direction, order, first] of [
    ['Descending', 'desc', 'P02 Mock Product 09'], ['Ascending', 'asc', 'P02 Mock Product 01']
  ] as const) {
    const previousPriority = await images.first().evaluateHandle(image => image);
    try {
      await page.getByRole('combobox', { name: 'Direction', exact: true }).press('Enter');
      await page.getByRole('option', { name: direction, exact: true }).click();
      await expect(page).toHaveURL(url => (hashRouteUrl(url).searchParams.get('order') ?? 'asc') === order);
      await audit(first);
      await expect.poll(() => previousPriority.evaluate(image => image.isConnected)).toBe(false);
    } finally {
      await previousPriority.dispose();
    }
  }
});

test('failed local product images become named fallbacks without hiding product links', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('A local baseURL is required.');
  // public/mock-product.svg is served at the root, not /images/; retain the guard elsewhere.
  const localImage = new URL('/mock-product.svg', baseURL).href;
  await page.route('**/mock-product.svg', async route => {
    if (route.request().url() === localImage) await route.abort('failed');
    else await route.fallback();
  });
  await page.goto('/#/products?q=P02%20Mock%20Product%200&sort=title');
  for (const title of ['P02 Mock Product 01', 'P02 Mock Product 09']) {
    const card = page.locator('app-product-card').filter({
      has: page.getByRole('heading', { name: title, exact: true })
    });
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('img', { name: `Image unavailable for ${title}`, exact: true })).toBeVisible();
    await expect(card.locator('img')).toHaveCount(0);
    await expect(card.getByRole('link', { name: `View details: ${title}`, exact: true })).toBeVisible();
  }
});
