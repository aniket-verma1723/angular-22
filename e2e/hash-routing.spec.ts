import { expect, hashRouteUrl, test } from './fixtures';

test('a product hash deep link reloads the root document and preserves query-owned results', async ({ page }) => {
  const documents: URL[] = [];
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(new URL(request.url()));
    }
  });
  await page.goto('/#/products?q=P02%20Mock%20Product&page=2&sort=price&order=desc');
  const expectProducts = async (): Promise<void> => {
    await expect(page).toHaveURL(url => {
      const route = hashRouteUrl(url);
      return url.pathname === '/' && url.search === '' && route.pathname === '/products' &&
        route.searchParams.get('q') === 'P02 Mock Product' && route.searchParams.get('page') === '2' &&
        route.searchParams.get('sort') === 'price' && route.searchParams.get('order') === 'desc';
    });
    await expect(page.getByRole('searchbox', { name: 'Search products', exact: true })).toHaveValue('P02 Mock Product');
    await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toContainText('Price');
    await expect(page.getByRole('combobox', { name: 'Direction', exact: true })).toContainText('Descending');
    const results = page.getByRole('region', { name: 'Product results', exact: true });
    await expect(results).toContainText('30 products found · 12 on this page');
    await expect(results.getByRole('heading', { level: 2 }).first()).toHaveText('P02 Mock Product 18');
  };
  await expectProducts();
  const sharedURL = page.url();
  await page.reload();
  await expectProducts();
  await expect(page).toHaveURL(sharedURL);
  // Neither the Angular route nor its query belongs in the HTTP document request.
  expect(documents.map(url => url.pathname + url.search)).toEqual(['/', '/']);
});

test('Back and Forward restore hash routes and product queries without another document request', async ({ page }) => {
  const documents: string[] = [];
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.goto('/#/products?q=P02%20Mock%20Product%200');
  const results = page.getByRole('region', { name: 'Product results', exact: true });
  await expect(results).toContainText('9 products found · 9 on this page');
  const catalogueURL = page.url();
  const details = page.getByRole('link', { name: 'View details: P02 Mock Product 01', exact: true });
  await expect(details).toHaveAttribute('href', '#/products/1?q=P02%20Mock%20Product%200');
  await details.click();
  await expect(page).toHaveURL(url => hashRouteUrl(url).pathname === '/products/1');
  const detailHeading = page.getByRole('heading', { name: 'Product details', exact: true });
  await expect(detailHeading).toBeVisible();
  const detailURL = page.url();
  const dashboard = page.getByRole('link', { name: 'Learning Store dashboard', exact: true });
  await expect(dashboard).toHaveAttribute('href', '#/dashboard');
  await dashboard.click();
  await expect(page).toHaveURL(/\/#\/dashboard$/);
  const dashboardHeading = page.getByRole('heading', { level: 1 });
  await expect(dashboardHeading).toContainText('Understand Angular.');

  await page.goBack();
  await expect(page).toHaveURL(detailURL);
  await expect(detailHeading).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(catalogueURL);
  await expect(page.getByRole('searchbox', { name: 'Search products', exact: true })).toHaveValue('P02 Mock Product 0');
  await expect(results).toContainText('9 products found · 9 on this page');
  await page.goForward();
  await expect(page).toHaveURL(detailURL);
  await expect(detailHeading).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/#\/dashboard$/);
  await expect(dashboardHeading).toContainText('Understand Angular.');
  expect(documents).toHaveLength(1);
});

test('an unknown hash route renders the not-found page and recovers through its overview link', async ({ page }) => {
  await page.goto('/#/missing-learning-page?source=hash-regression');
  await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '' &&
    hashRouteUrl(url).pathname === '/missing-learning-page');
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  const recovery = page.getByRole('link', { name: 'Back to overview', exact: true });
  await expect(recovery).toHaveAttribute('href', '#/dashboard');
  await recovery.click();
  await expect(page).toHaveURL(/\/#\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Understand Angular.');
});

test('a guest checkout hash deep link redirects to mock login with a route-only return URL', async ({ page }) => {
  await page.goto('/#/checkout');
  await expect(page).toHaveURL(url => {
    const route = hashRouteUrl(url);
    return url.pathname === '/' && url.search === '' && route.pathname === '/login' &&
      route.searchParams.get('returnUrl') === '/checkout';
  });
  await expect(page.getByRole('heading', { name: 'Your practice session', exact: true })).toBeVisible();
  await expect(page.getByText('Local mock · no remote sign-in', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toHaveCount(0);
});
