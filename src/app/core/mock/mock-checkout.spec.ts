import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideAppData } from '../config/app-data.providers.mock';
import { CheckoutApiService } from '../../features/checkout/data/checkout-api.service';
import { ProductsApiService } from '../../features/products/data/products-api.service';
import { MockProductBackend } from './mock-product-backend.service';

describe('Mock checkout through HTTP', () => {
  const request = { userId: 1, products: [{ id: 4, quantity: 2 }] };
  let api: CheckoutApiService;
  let mock: MockProductBackend;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(CheckoutApiService); mock = TestBed.inject(MockProductBackend);
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('returns sequential local receipts using current prices without deducting stock or storing orders', async () => {
    const products = TestBed.inject(ProductsApiService);
    const first = await firstValueFrom(api.create(request));
    expect(first.source).toBe('mock'); expect(first.receipt.subtotalCents).toBe(2000); expect(first.receipt.id).toBe(1);
    expect((await firstValueFrom(products.get(4))).stock).toBe(3);
    await firstValueFrom(products.update(4, { price: 12 }));
    const second = await firstValueFrom(api.create(request));
    expect(second.receipt.id).toBe(2); expect(second.receipt.subtotalCents).toBe(2400);
    await expectAsync(firstValueFrom(TestBed.inject(HttpClient).get('https://dummyjson.com/carts/1')))
      .toBeRejectedWith(jasmine.objectContaining({ status: 501 }));
    mock.reset(); expect((await firstValueFrom(api.create(request))).receipt.id).toBe(1);
  });
  it('rejects insufficient stock, missing products and unsupported demo identities', async () => {
    await expectAsync(firstValueFrom(api.create({ userId: 1, products: [{ id: 4, quantity: 4 }] })))
      .toBeRejectedWith(jasmine.objectContaining({ kind: 'conflict' }));
    await firstValueFrom(TestBed.inject(ProductsApiService).delete(4));
    await expectAsync(firstValueFrom(api.create(request))).toBeRejectedWith(jasmine.objectContaining({ kind: 'not-found' }));
    await expectAsync(firstValueFrom(api.create({ ...request, userId: 3 }))).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
  });
  it('validates raw HTTP input rather than trusting the application service', async () => {
    await expectAsync(firstValueFrom(TestBed.inject(HttpClient).post('https://dummyjson.com/carts/add', { userId: 1, products: [] })))
      .toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
  });
  it('does not allocate receipts on failed or malformed responses', async () => {
    for (const outcome of [503, 'malformed', 'empty', 'network'] as const) {
      mock.enqueue({ outcome }); await expectAsync(firstValueFrom(api.create(request))).toBeRejected();
    }
    expect((await firstValueFrom(api.create(request))).receipt.id).toBe(1);
  });
  it('cancels delayed submissions and invalidates pending submissions on mock reset', fakeAsync(() => {
    mock.enqueue({ outcome: 'success', delayMs: 50 });
    const cancelled = api.create(request).subscribe(() => fail('Cancelled checkout emitted')); cancelled.unsubscribe(); tick(50);
    api.create(request).subscribe(result => expect(result.receipt.id).toBe(1));
    mock.enqueue({ outcome: 'success', delayMs: 50 }); const error = jasmine.createSpy('reset error');
    api.create(request).subscribe({ error }); mock.reset(); tick(50);
    expect(error).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict' }));
  }));
});
