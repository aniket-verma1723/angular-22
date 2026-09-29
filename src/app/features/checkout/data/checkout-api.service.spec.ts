import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { checkoutReceiptFixture, checkoutRequestFixture } from '../../../testing/checkout-fixtures';
import { CheckoutApiService } from './checkout-api.service';
import { parseCheckoutReceipt, parseCheckoutRequest } from './checkout.parsers';

describe('Checkout contracts and HTTP', () => {
  const url = 'https://dummyjson.com/carts/add';
  let api: CheckoutApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(CheckoutApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('posts only IDs/quantities and validates a simulated receipt into integer cents', async () => {
    const parsed = parseCheckoutRequest({ ...checkoutRequestFixture(), address: 'Do not transmit', secret: 'not a real secret' });
    const result = firstValueFrom(api.create(parsed));
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual(checkoutRequestFixture());
    request.flush({ ...checkoutReceiptFixture(), ignored: 'not retained' });
    const value = await result;
    expect(value.source).toBe('remote'); expect(value.receipt.subtotalCents).toBe(2500);
    expect(value.receipt.discountedTotalCents).toBe(2300);
    expect(value.receipt.lines[0].unitPriceCents).toBe(1250);
    expect(Object.keys(value.receipt)).not.toContain('ignored');
  });

  for (const payload of [null, {}, { userId: 1, products: [] }, { userId: 0, products: [{ id: 1, quantity: 1 }] },
    { userId: 1, products: [{ id: 0, quantity: 1 }] }, { userId: 1, products: [{ id: 1, quantity: 0 }] },
    { userId: 1, products: [{ id: 1, quantity: 1.5 }] }, { userId: 1, products: [{ id: 1, quantity: 100 }] },
    { userId: 1, products: [{ id: 1, quantity: 1 }, { id: 1, quantity: 2 }] }]) {
    it(`rejects invalid checkout payload ${JSON.stringify(payload)}`, () => expect(() => parseCheckoutRequest(payload)).toThrowError());
  }
  const malformed: readonly unknown[] = [null, {}, { ...checkoutReceiptFixture(), userId: 2 },
    { ...checkoutReceiptFixture(), total: -1 }, { ...checkoutReceiptFixture(), discountedTotal: 26 },
    { ...checkoutReceiptFixture(), totalQuantity: 3 }, { ...checkoutReceiptFixture(), totalProducts: 2 },
    { ...checkoutReceiptFixture(), total: 24 }, { ...checkoutReceiptFixture(), id: Infinity },
    { ...checkoutReceiptFixture(), products: [] }, { ...checkoutReceiptFixture(), products: [{ id: 2, quantity: 2, title: 'Wrong product', price: 12.5, total: 25 }] },
    { ...checkoutReceiptFixture(), products: [{ id: 1, quantity: 2, title: 'Bad price', price: 12.501, total: 25 }] }];
  malformed.forEach((receipt, index) => it(`rejects malformed/mismatched receipt ${index}`, () => {
    expect(() => parseCheckoutReceipt(receipt, checkoutRequestFixture())).toThrowError();
  }));

  it('allows zero-valued receipts', () => {
    const raw = { ...checkoutReceiptFixture(), products: [{ id: 1, quantity: 2, title: 'Free sample', price: 0, total: 0 }], total: 0, discountedTotal: 0 };
    expect(parseCheckoutReceipt(raw, checkoutRequestFixture()).subtotalCents).toBe(0);
  });

  it('matches reordered receipt lines by identity and rejects duplicate or changed quantities', () => {
    const request = { userId: 1, products: [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }] };
    const raw = { ...checkoutReceiptFixture(), products: [
      { id: 2, quantity: 1, title: 'Second item', price: 5, total: 5 },
      { id: 1, quantity: 2, title: 'First item', price: 12.5, total: 25 }
    ], totalProducts: 2, totalQuantity: 3, total: 30 };
    expect(parseCheckoutReceipt(raw, request).lines.map(line => line.id)).toEqual([2, 1]);
    expect(() => parseCheckoutReceipt({ ...raw, products: [raw.products[0], raw.products[0]] }, request)).toThrowError();
    expect(() => parseCheckoutReceipt({ ...raw, products: [{ ...raw.products[0], quantity: 2, total: 10 }, raw.products[1]] }, request)).toThrowError();
  });

  it('surfaces HTTP failures without retrying', async () => {
    const result = firstValueFrom(api.create(checkoutRequestFixture()));
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'server' }));
    http.expectNone(url);
  });
  it('cancels on unsubscribe', () => {
    const sub = api.create(checkoutRequestFixture()).subscribe(); const request = http.expectOne(url);
    sub.unsubscribe(); expect(request.cancelled).toBeTrue();
  });
  it('bounds a stalled request to fifteen seconds', fakeAsync(() => {
    const error = jasmine.createSpy('timeout');
    api.create(checkoutRequestFixture()).subscribe({ error }); const request = http.expectOne(url);
    tick(14999); expect(error).not.toHaveBeenCalled(); tick(1);
    expect(error).toHaveBeenCalled(); expect(request.cancelled).toBeTrue(); http.expectNone(url);
  }));
});
