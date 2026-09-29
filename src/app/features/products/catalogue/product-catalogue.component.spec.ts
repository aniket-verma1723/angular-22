import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { productFixture, productPageFixture } from '../../../testing/product-fixtures';
import { CartService } from '../../cart/data/cart.service';

describe('Product catalogue', () => {
  const base = 'https://dummyjson.com';
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let initial: TestRequest;
  let categories: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/products');
    harness.fixture.autoDetectChanges();
    initial = http.expectOne(req => req.url === `${base}/products`);
    categories = http.expectOne(`${base}/products/categories`);
  });
  afterEach(() => http.verify());

  function element(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) throw new Error('Catalogue not routed');
    return element;
  }

  function ready(): void {
    categories.flush([{ slug: 'stationery', name: 'Stationery' }]);
    initial.flush({ ...productPageFixture(), total: 30 });
    harness.detectChanges();
  }

  function search(value: string): void {
    const input = element().querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('Search input missing');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('adds through card output without HTTP writes and updates cart feedback', async () => {
    ready();
    const add = element().querySelector<HTMLButtonElement>('button[aria-label="Add to cart: Test notebook"]');
    if (!add) throw new Error('Add button missing');
    add.click(); await harness.fixture.whenStable();
    expect(TestBed.inject(CartService).itemCount()).toBe(1);
    expect(element().textContent).toContain('Cart now has 1 items');
    http.expectNone(req => req.method !== 'GET');
  });

  it('renders loading then accessible cards, zero values and detail links', () => {
    expect(element().textContent).toContain('Loading products');
    categories.flush([]);
    initial.flush({ ...productPageFixture(), products: [productFixture({ price: 0, stock: 0, rating: 0 })] });
    harness.detectChanges();
    expect(element().textContent).toContain('$0.00');
    expect(element().textContent).toContain('Out of stock');
    expect(element().textContent).toContain('Rating 0.0 / 5');
    expect(element().querySelector('a[aria-label="View details: Test notebook"]')?.getAttribute('href')).toBe('#/products/1');
    expect(element().querySelector('[aria-label="Product results"]')?.getAttribute('aria-busy')).toBe('false');
  });

  it('debounces normalized searches and does not repeat equivalent queries', fakeAsync(() => {
    ready();
    search('p'); tick(150); search(' pen '); tick(299);
    http.expectNone(req => req.url.includes('/search'));
    tick(1);
    const request = http.expectOne(req => req.url === `${base}/products/search`);
    expect(request.request.params.get('q')).toBe('pen');
    expect(TestBed.inject(Router).url).toBe('/products?q=pen');
    request.flush(productPageFixture());
    search('pen  '); tick(300);
    http.expectNone(req => req.url.includes('/search'));
  }));

  it('cancels a stale request when a newer URL query arrives', async () => {
    categories.flush([]);
    await harness.navigateByUrl('/products?q=second');
    expect(initial.cancelled).toBeTrue();
    const request = http.expectOne(req => req.url === `${base}/products/search`);
    request.flush({ ...productPageFixture(), products: [productFixture({ id: 2, title: 'Latest result' })] });
    harness.detectChanges();
    expect(element().textContent).toContain('Latest result');
    expect(element().textContent).not.toContain('Test notebook');
  });

  it('canonicalizes invalid query parameters without sending duplicate requests', async () => {
    ready();
    await harness.navigateByUrl('/products?page=-2&pageSize=900&sort=unknown&category=..%2Fauth&extra=1');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/products');
    http.expectNone(req => req.url.startsWith(base));
  });

  it('uses server pagination and resets page after page-size changes', async () => {
    ready();
    const paginator = await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatPaginatorHarness);
    await paginator.goToNextPage();
    const second = http.expectOne(req => req.url === `${base}/products`);
    expect(second.request.params.get('skip')).toBe('12');
    expect(TestBed.inject(Router).url).toBe('/products?page=2');
    second.flush({ products: [productFixture({ id: 13 })], total: 30, skip: 12, limit: 12 });
    harness.detectChanges();
    const nextPaginator = await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatPaginatorHarness);
    await nextPaginator.setPageSize(24);
    const resized = http.expectOne(req => req.url === `${base}/products`);
    expect(resized.request.params.get('skip')).toBe('0');
    expect(resized.request.params.get('limit')).toBe('24');
    resized.flush({ ...productPageFixture(), total: 30, limit: 24 });
  });

  it('uses Material category/sort controls and preserves the query on detail links', async () => {
    ready();
    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    const selects = await loader.getAllHarnesses(MatSelectHarness);
    const category = selects[0];
    const sort = selects[1];
    if (!category || !sort) throw new Error('Filter controls missing');
    await category.open(); await category.clickOptions({ text: 'Stationery' });
    http.expectOne(req => req.url === `${base}/products/category/stationery`).flush(productPageFixture());
    await sort.open(); await sort.clickOptions({ text: 'Price' });
    const sorted = http.expectOne(req => req.url === `${base}/products/category/stationery`);
    expect(sorted.request.params.get('sortBy')).toBe('price');
    sorted.flush(productPageFixture());
    harness.detectChanges();
    expect(element().querySelector('a[aria-label^="View details"]')?.getAttribute('href')).toBe('#/products/1?category=stationery&sort=price');
  });

  it('keeps category failure separate from successful product results and retries only categories', async () => {
    categories.flush({}, { status: 503, statusText: 'Unavailable' });
    initial.flush(productPageFixture());
    harness.detectChanges();
    expect(element().textContent).toContain('Test notebook');
    expect(element().textContent).toContain('Category choices could not be loaded');
    const retry = await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatButtonHarness.with({ text: 'Try again' }));
    await retry.click();
    http.expectOne(`${base}/products/categories`).flush([]);
    http.expectNone(req => req.url === `${base}/products`);
  });

  it('recovers from a failed read on explicit retry', async () => {
    categories.flush([]);
    initial.flush({}, { status: 500, statusText: 'Failure' });
    harness.detectChanges();
    expect(element().textContent).toContain('Service unavailable');
    const retry = await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatButtonHarness.with({ text: 'Try again' }));
    await retry.click();
    http.expectOne(req => req.url === `${base}/products`).flush(productPageFixture());
    harness.detectChanges();
    expect(element().textContent).toContain('Test notebook');
  });

  it('keeps the search stream alive after errors', fakeAsync(() => {
    categories.flush([]);
    initial.flush({}, { status: 500, statusText: 'Failure' });
    search('recovery'); tick(300);
    http.expectOne(req => req.url === `${base}/products/search`).flush(productPageFixture());
    harness.detectChanges();
    expect(element().textContent).toContain('Test notebook');
  }));

  it('offers recovery for out-of-range pages without filtering a server page locally', async () => {
    categories.flush([]);
    await harness.navigateByUrl('/products?page=99');
    const request = http.expectOne(req => req.url === `${base}/products`);
    request.flush({ products: [], total: 30, skip: 1176, limit: 12 });
    harness.detectChanges();
    expect(element().textContent).toContain('No products on this page');
    const first = await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatButtonHarness.with({ text: 'Go to first page' }));
    await first.click();
    http.expectOne(req => req.url === `${base}/products`).flush(productPageFixture());
  });

  it('restores controls on navigation and cancels uncommitted search edits', fakeAsync(() => {
    ready(); search('stale'); tick(100);
    void TestBed.inject(Router).navigateByUrl('/products?category=stationery'); tick();
    http.expectOne(req => req.url === `${base}/products/category/stationery`).flush(productPageFixture());
    tick(300); harness.detectChanges();
    http.expectNone(req => req.url.includes('/search'));
    expect(element().querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
  }));

  it('cancels outstanding product and category requests when leaving the route', async () => {
    await harness.navigateByUrl('/dashboard');
    expect(initial.cancelled).toBeTrue();
    expect(categories.cancelled).toBeTrue();
  });

  it('clears a pending draft on the already-unfiltered URL without reviving it', fakeAsync(() => {
    ready(); search('stale'); tick(100);
    const clear = [...element().querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Clear filters'));
    if (!clear) throw new Error('Clear control missing');
    clear.click(); tick(500);
    expect(element().querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect(TestBed.inject(Router).url).toBe('/products');
    http.expectNone(req => req.url.includes('/search'));
    expect(element().textContent).not.toContain('Unable to update the URL');
    search('fresh'); tick(300);
    http.expectOne(req => req.url === `${base}/products/search`).flush(productPageFixture());
  }));

  it('does not apply an old debounce after leaving and revisiting the catalogue', fakeAsync(() => {
    ready(); search('abandoned'); tick(100);
    void TestBed.inject(Router).navigateByUrl('/dashboard'); tick();
    void TestBed.inject(Router).navigateByUrl('/products'); tick();
    http.expectOne(req => req.url === `${base}/products`).flush(productPageFixture());
    http.expectOne(`${base}/products/categories`).flush([]);
    tick(300);
    http.expectNone(req => req.url.includes('/search'));
    expect(TestBed.inject(Router).url).toBe('/products');
    search('fresh'); tick(300);
    http.expectOne(req => req.url === `${base}/products/search`).flush(productPageFixture());
  }));

  it('restores a shareable search URL and clears category when searching', async () => {
    ready();
    await harness.navigateByUrl('/products?q=notebook&category=stationery&page=2&pageSize=24&sort=rating&order=desc');
    await harness.fixture.whenStable();
    const request = http.expectOne(req => req.url === `${base}/products/search`);
    expect(request.request.params.get('skip')).toBe('24');
    expect(request.request.params.get('sortBy')).toBe('rating');
    expect(request.request.params.get('order')).toBe('desc');
    expect(TestBed.inject(Router).url).not.toContain('category');
    request.flush({ products: [], total: 0, skip: 24, limit: 24 });
    expect(element().querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('notebook');
  });
});
