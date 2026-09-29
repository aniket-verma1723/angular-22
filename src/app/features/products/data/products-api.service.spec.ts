import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject, switchMap } from 'rxjs';
import { provideAppData } from '../../../core/config/app-data.providers';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { productDraftFixture, productFixture, productPageFixture } from '../../../testing/product-fixtures';
import { DEFAULT_PRODUCT_QUERY } from './product.models';
import { ProductsApiService } from './products-api.service';

describe('ProductsApiService (HTTP testing backend, no mock interceptor)', () => {
  const base = 'https://dummyjson.com';
  let api: ProductsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(ProductsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('is cold and sends server pagination/sorting parameters once per subscription', async () => {
    const products$ = api.list({ ...DEFAULT_PRODUCT_QUERY, pageIndex: 2, pageSize: 24, sortBy: 'price', order: 'desc' });
    http.expectNone(() => true);
    const result = firstValueFrom(products$);
    const req = http.expectOne(request => request.url === `${base}/products`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('skip')).toBe('48');
    expect(req.request.params.get('limit')).toBe('24');
    expect(req.request.params.get('sortBy')).toBe('price');
    expect(req.request.params.get('order')).toBe('desc');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ products: [], total: 0, skip: 48, limit: 24 });
    expect((await result).items).toEqual([]);
  });

  it('normalizes search without turning user text into URL parameters', async () => {
    const result = firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, filter: { kind: 'search', term: '  pen & limit=1  ' } }));
    const req = http.expectOne(request => request.url === `${base}/products/search`);
    expect(req.request.params.get('q')).toBe('pen & limit=1');
    expect(req.request.params.get('limit')).toBe('12');
    req.flush(productPageFixture());
    expect((await result).items.length).toBe(1);
  });

  it('uses the category endpoint and accepts a safe configurable API base path', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('remote', 'https://example.test/api/') }] });
    api = TestBed.inject(ProductsApiService);
    http = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, filter: { kind: 'category', slug: 'home-decoration' } }));
    http.expectOne(req => req.url === 'https://example.test/api/products/category/home-decoration').flush(productPageFixture());
    expect((await result).total).toBe(1);
  });

  it('treats whitespace-only searches as the unfiltered endpoint', async () => {
    const result = firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, filter: { kind: 'search', term: '   ' } }));
    http.expectOne(req => req.url === `${base}/products` && !req.params.has('q')).flush(productPageFixture());
    expect((await result).total).toBe(1);
  });

  it('fetches details and categories through separate validated contracts', async () => {
    const detail = firstValueFrom(api.get(1));
    http.expectOne(`${base}/products/1`).flush(productFixture());
    expect((await detail).reviews[0]?.author).toBe('Demo reviewer');
    const categories = firstValueFrom(api.categories());
    http.expectOne(`${base}/products/categories`).flush([{ slug: 'stationery', name: 'Stationery' }]);
    expect(await categories).toEqual([{ slug: 'stationery', name: 'Stationery' }]);
  });

  it('POSTs only editable fields and labels remote results as simulated', async () => {
    const draft = { ...productDraftFixture(), unrelated: true };
    const result = firstValueFrom(api.create(draft));
    const req = http.expectOne({ method: 'POST', url: `${base}/products/add` });
    expect(req.request.body).toEqual(productDraftFixture());
    req.flush({ id: 500, ...productDraftFixture() });
    expect(await result).toEqual({ value: { id: 500, ...productDraftFixture() }, persistence: 'simulated' });
    http.expectNone(`${base}/products/500`);
  });

  it('PATCHes only selected fields and validates DELETE confirmation', async () => {
    const update = firstValueFrom(api.update(1, { stock: 0 }));
    const req = http.expectOne({ method: 'PATCH', url: `${base}/products/1` });
    expect(req.request.body).toEqual({ stock: 0 });
    req.flush(productFixture({ stock: 0 }));
    expect((await update).value.stock).toBe(0);
    const deletion = firstValueFrom(api.delete(1));
    http.expectOne({ method: 'DELETE', url: `${base}/products/1` }).flush({ id: 1, isDeleted: true, deletedOn: '2026-01-01T00:00:00Z' });
    expect((await deletion).persistence).toBe('simulated');
  });

  it('rejects invalid IDs, queries and drafts without sending requests', async () => {
    for (const request$ of [api.get(0), api.delete(-1), api.update(1.5, { stock: 1 }),
      api.create({ ...productDraftFixture(), price: -1 }), api.update(1, {}),
      api.list({ ...DEFAULT_PRODUCT_QUERY, pageIndex: -1 }),
      api.list({ ...DEFAULT_PRODUCT_QUERY, pageIndex: Number.MAX_SAFE_INTEGER }),
      api.list({ ...DEFAULT_PRODUCT_QUERY, filter: { kind: 'category', slug: '../auth' } })]) {
      await expectAsync(firstValueFrom<unknown>(request$)).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    http.expectNone(() => true);
  });

  it('maps malformed bodies and mismatched IDs to format errors', async () => {
    const page = firstValueFrom(api.list());
    const assertion = expectAsync(page).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
    http.expectOne(req => req.url === `${base}/products`).flush({ products: 'invalid' });
    await assertion;
    const detail = firstValueFrom(api.get(1));
    const mismatch = expectAsync(detail).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
    http.expectOne(`${base}/products/1`).flush(productFixture({ id: 2 }));
    await mismatch;
  });

  it('maps failures without exposing server bodies or replaying writes', async () => {
    const result = firstValueFrom(api.create(productDraftFixture()));
    const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'server', message: 'The service is temporarily unavailable.' }));
    http.expectOne(`${base}/products/add`).flush({ internal: 'Do not expose this' }, { status: 503, statusText: 'Unavailable' });
    await assertion;
    http.expectNone(() => true);
  });

  it('allows callers to cancel stale reads with switchMap', () => {
    const ids$ = new Subject<number>();
    const received: number[] = [];
    const subscription = ids$.pipe(switchMap(id => api.get(id))).subscribe(product => received.push(product.id));
    ids$.next(1);
    const first = http.expectOne(`${base}/products/1`);
    ids$.next(2);
    expect(first.cancelled).toBeTrue();
    http.expectOne(`${base}/products/2`).flush(productFixture({ id: 2 }));
    expect(received).toEqual([2]);
    ids$.next(3);
    const pending = http.expectOne(`${base}/products/3`);
    subscription.unsubscribe();
    expect(pending.cancelled).toBeTrue();
  });
});
