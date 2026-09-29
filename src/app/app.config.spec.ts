import { HashLocationStrategy, Location, LocationStrategy } from '@angular/common';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from './app.config';
import { productFixture } from './testing/product-fixtures';

describe('Application hash routing configuration', () => {
  beforeEach(() => TestBed.configureTestingModule({
    // Keep the application's location strategy: provideLocationMocks would replace it.
    providers: [...appConfig.providers, provideHttpClientTesting()]
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('provides HashLocationStrategy through the actual application configuration', () => {
    expect(TestBed.inject(LocationStrategy)).toBeInstanceOf(HashLocationStrategy);
  });

  for (const internalUrl of [
    '/products',
    '/products?q=note%20book&page=2',
    '/products/1#reviews',
    '/products?q=note%20book&page=2#results'
  ]) {
    it(`prepares a hash href without changing query or fragment content: ${internalUrl}`, () => {
      expect(TestBed.inject(LocationStrategy).prepareExternalUrl(internalUrl)).toBe(`#${internalUrl}`);
      expect(TestBed.inject(Location).prepareExternalUrl(internalUrl)).toBe(`#${internalUrl}`);
    });
  }

  it('keeps URL trees internal until preparing the external href', () => {
    const router = TestBed.inject(Router);
    const tree = router.createUrlTree(['/products'], {
      queryParams: { q: 'note book', page: 2 }, fragment: 'results'
    });
    const internalUrl = '/products?q=note%20book&page=2#results';

    expect(router.serializeUrl(tree)).toBe(internalUrl);
    expect(TestBed.inject(Location).prepareExternalUrl(router.serializeUrl(tree))).toBe(`#${internalUrl}`);
    expect(router.serializeUrl(router.parseUrl(internalUrl))).toBe(internalUrl);
    expect(tree.queryParamMap.get('q')).toBe('note book');
    expect(tree.queryParamMap.get('page')).toBe('2');
    expect(tree.fragment).toBe('results');
  });

  it('navigates with an internal URL while keeping HTTP requests separate from hash hrefs', async () => {
    const harness = await RouterTestingHarness.create();
    const internalUrl = '/products/1?q=notebook#reviews';
    await harness.navigateByUrl(internalUrl);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('https://dummyjson.com/products/1');
    expect(request.request.method).toBe('GET');
    request.flush(productFixture());
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(internalUrl);
    expect(TestBed.inject(Location).path(true)).toBe(internalUrl);
    expect(TestBed.inject(Location).prepareExternalUrl(internalUrl)).toBe('#/products/1?q=notebook#reviews');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Product details');
    expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('#/products?q=notebook');
    http.expectNone(() => true);
  });
});
