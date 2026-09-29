import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { productFixture } from '../../../testing/product-fixtures';
import { CartService } from '../../cart/data/cart.service';

describe('Product detail', () => {
  const base = 'https://dummyjson.com/products';
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('adds a loaded detail once up to stock and shares it with the cart route', async () => {
    const harness = await RouterTestingHarness.create('/products/1');
    http.expectOne(`${base}/1`).flush(productFixture({ stock: 1 }));
    harness.detectChanges();
    const button = await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatButtonHarness.with({ text: 'Add to cart' }));
    await button.click();
    expect(TestBed.inject(CartService).itemCount()).toBe(1);
    expect(await button.isDisabled()).toBeTrue();
    await harness.navigateByUrl('/cart');
    expect(harness.routeNativeElement?.textContent).toContain('Test notebook');
    http.expectNone(req => req.method !== 'GET');
  });

  it('renders product fields and reviews while retaining the catalogue return query', async () => {
    const harness = await RouterTestingHarness.create('/products/1?q=notebook&page=2&sort=price&id=999');
    expect(harness.routeNativeElement?.textContent).toContain('Loading product');
    http.expectOne(`${base}/1`).flush(productFixture());
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Test notebook');
    expect(harness.routeNativeElement?.textContent).toContain('Demo reviewer');
    expect(harness.routeNativeElement?.textContent).toContain('Useful');
    expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/products?q=notebook&page=2&sort=price');
    expect(harness.routeNativeElement?.querySelector('img')?.alt).toContain('Test notebook');
  });

  for (const id of ['0', '-1', 'invalid', '1.5', '9007199254740992']) {
    it(`rejects invalid route ID ${id} without an HTTP request`, async () => {
      const harness = await RouterTestingHarness.create(`/products/${id}`);
      expect(harness.routeNativeElement?.textContent).toContain('Invalid product link');
      http.expectNone(() => true);
    });
  }

  for (const [status, heading] of [[404, 'Product not found'], [403, 'Access denied'], [401, 'Demo session required']] as const) {
    it(`distinguishes status ${status} from other failures`, async () => {
      const harness = await RouterTestingHarness.create('/products/1');
      http.expectOne(`${base}/1`).flush({}, { status, statusText: 'Failure' });
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain(heading);
      expect(harness.routeNativeElement?.textContent).not.toContain('Try again');
    });
  }

  it('recovers from a network error with an explicit retry', async () => {
    const harness = await RouterTestingHarness.create('/products/1');
    http.expectOne(`${base}/1`).error(new ProgressEvent('error'));
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Connection problem');
    await (await TestbedHarnessEnvironment.loader(harness.fixture).getHarness(MatButtonHarness.with({ text: 'Try again' }))).click();
    expect(harness.routeNativeElement?.textContent).toContain('Loading product');
    expect(harness.routeNativeElement?.textContent).not.toContain('Connection problem');
    http.expectOne(`${base}/1`).flush(productFixture({ images: [], reviews: [] }));
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No reviews yet');
    expect(harness.routeNativeElement?.querySelectorAll('img').length).toBe(1);
  });

  it('shows format errors rather than rendering malformed details', async () => {
    const harness = await RouterTestingHarness.create('/products/1');
    http.expectOne(`${base}/1`).flush({ title: 'Incomplete' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Invalid service response');
  });

  it('cancels stale IDs when Angular reuses the detail component and on teardown', async () => {
    const harness = await RouterTestingHarness.create('/products/1');
    const first = http.expectOne(`${base}/1`);
    await harness.navigateByUrl('/products/2');
    expect(first.cancelled).toBeTrue();
    const second = http.expectOne(`${base}/2`);
    await harness.navigateByUrl('/dashboard');
    expect(second.cancelled).toBeTrue();
  });
});
