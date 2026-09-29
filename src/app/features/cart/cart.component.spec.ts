import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../app.config';
import { productFixture } from '../../testing/product-fixtures';
import { CartService } from './data/cart.service';

describe('Cart page', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows an empty recovery view without fetching products', async () => {
    const harness = await RouterTestingHarness.create('/cart');
    expect(harness.routeNativeElement?.textContent).toContain('Your cart is empty');
    expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/products');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('updates subtotal through quantity intent, retains state across routes and removes with focus recovery', async () => {
    const cart = TestBed.inject(CartService);
    cart.add(productFixture({ price: 2.5, stock: 4 }));
    const harness = await RouterTestingHarness.create('/cart');
    harness.fixture.autoDetectChanges();
    const input = harness.routeNativeElement?.querySelector('input');
    if (!input) throw new Error('Quantity input missing');
    input.value = '3'; input.dispatchEvent(new Event('change')); await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('$7.50');
    await harness.navigateByUrl('/dashboard'); await harness.navigateByUrl('/cart');
    expect(harness.routeNativeElement?.querySelector('input')?.value).toBe('3');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('button[aria-label="Remove Test notebook"]')?.click();
    await harness.fixture.whenStable();
    expect(cart.itemCount()).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('Your cart is empty');
    expect(document.activeElement).toBe(harness.routeNativeElement?.querySelector('h1') ?? null);
  });

  it('requires clear confirmation and can keep the cart', async () => {
    const cart = TestBed.inject(CartService); cart.add(productFixture());
    const harness = await RouterTestingHarness.create('/cart'); harness.fixture.autoDetectChanges();
    const click = async (text: string) => {
      const button = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].find(item => item.textContent?.trim() === text);
      if (!button) throw new Error('Missing ' + text);
      button.click(); await harness.fixture.whenStable();
    };
    await click('Clear cart'); await click('Keep cart'); expect(cart.itemCount()).toBe(1);
    expect(document.activeElement?.textContent?.trim()).toBe('Clear cart');
    await click('Clear cart'); await click('Yes, clear cart'); expect(cart.itemCount()).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('Cart cleared.');
  });
});
