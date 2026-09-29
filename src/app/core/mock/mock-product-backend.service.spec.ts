import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { firstValueFrom, map, switchMap } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { API_CONFIG, createApiConfig } from '../config/api-config';
import { provideAppData } from '../config/app-data.providers.mock';
import { ProductsApiService } from '../../features/products/data/products-api.service';
import { DEFAULT_PRODUCT_QUERY } from '../../features/products/data/product.models';
import { productDraftFixture } from '../../testing/product-fixtures';
import { MockProductBackend } from './mock-product-backend.service';
import type { MockOutcome } from './mock-product-backend.service';

describe('Mock product backend through the real HTTP service', () => {
  const base = 'https://dummyjson.com';
  let api: ProductsApiService;
  let mock: MockProductBackend;
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(ProductsApiService);
    mock = TestBed.inject(MockProductBackend);
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });
  // Any accidental API fallthrough is a failed test, never a real network request.
  afterEach(() => http.verify());

  it('lists deterministic pages and categories', async () => {
    const first = await firstValueFrom(api.list());
    expect(first.total).toBe(30);
    expect(first.items.length).toBe(12);
    expect(first.items[0]?.id).toBe(1);
    const second = await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, pageIndex: 1 }));
    expect(second.skip).toBe(12);
    expect(second.items[0]?.id).toBe(13);
    expect((await firstValueFrom(api.categories())).length).toBe(3);
    expect((await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, pageIndex: 3 }))).items).toEqual([]);
  });

  it('applies search, category filtering and numeric sorting before pagination', async () => {
    const search = await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, filter: { kind: 'search', term: 'PRODUCT 02' } }));
    expect(search.items.map(item => item.id)).toEqual([2]);
    const category = await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, filter: { kind: 'category', slug: 'stationery' } }));
    expect(category.total).toBe(10);
    expect(category.items.every(item => item.category === 'stationery')).toBeTrue();
    const sorted = await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, sortBy: 'price', order: 'desc', pageIndex: 1 }));
    expect(sorted.items.map(item => item.id)).toEqual([18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7]);
  });

  it('sorts changed titles alphabetically in both directions', async () => {
    await firstValueFrom(api.update(3, { title: 'AAA notebook' }));
    await firstValueFrom(api.update(1, { title: 'ZZZ notebook' }));
    const ascending = await firstValueFrom(api.list());
    const descending = await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, order: 'desc' }));
    expect(ascending.items[0]?.id).toBe(3);
    expect(descending.items[0]?.id).toBe(1);
  });

  it('breaks equal ratings by stable product ID', async () => {
    const page = await firstValueFrom(api.list({ ...DEFAULT_PRODUCT_QUERY, sortBy: 'rating', order: 'desc' }));
    expect(page.items.slice(0, 6).map(item => item.id)).toEqual([5, 10, 15, 20, 25, 30]);
  });

  it('persists create/update/delete in this session and resets both data and IDs', async () => {
    const created = await firstValueFrom(api.create(productDraftFixture()));
    expect(created.persistence).toBe('session');
    expect(created.value.id).toBe(31);
    expect((await firstValueFrom(api.get(31))).title).toBe(productDraftFixture().title);
    expect((await firstValueFrom(api.create(productDraftFixture()))).value.id).toBe(32);
    const updated = await firstValueFrom(api.update(31, { title: 'Changed title', stock: 0 }));
    expect(updated.value.stock).toBe(0);
    expect((await firstValueFrom(api.get(31))).title).toBe('Changed title');
    expect((await firstValueFrom(api.delete(31))).value.isDeleted).toBeTrue();
    await expectAsync(firstValueFrom(api.get(31))).toBeRejectedWith(jasmine.objectContaining({ kind: 'not-found' }));
    mock.reset();
    expect((await firstValueFrom(api.list())).total).toBe(30);
    expect((await firstValueFrom(api.create(productDraftFixture()))).value.id).toBe(31);
  });

  it('does not expose mutable database references through raw HTTP responses', async () => {
    const raw = await firstValueFrom(client.get<unknown>(`${base}/products/1`));
    if (typeof raw !== 'object' || raw === null || !('images' in raw) || !Array.isArray(raw.images)) {
      fail('Expected a product with images');
      return;
    }
    raw.images[0] = '/modified.svg';
    expect((await firstValueFrom(api.get(1))).images).toEqual(['/mock-product.svg']);
  });

  it('validates direct HTTP payloads rather than trusting the client service', async () => {
    for (const payload of [{ title: 'Incomplete' }, { ...productDraftFixture(), stock: -1 },
      { ...productDraftFixture(), category: 'unknown-category' }]) {
      await expectAsync(firstValueFrom(client.post<unknown>(`${base}/products/add`, payload)))
        .toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
    }
    await expectAsync(firstValueFrom(client.patch<unknown>(`${base}/products/1`, { extra: true })))
      .toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
    expect((await firstValueFrom(api.list())).total).toBe(30);
  });

  for (const query of ['skip=-1', 'limit=Infinity', 'limit=101', 'sortBy=unknown', 'order=sideways',
    'skip=0&skip=12', 'category=stationery', 'q=unexpected']) {
    it(`rejects unsupported or ambiguous list parameters: ${query}`, async () => {
      await expectAsync(firstValueFrom(client.get<unknown>(`${base}/products?${query}`)))
        .toBeRejectedWith(jasmine.objectContaining({ status: 400 }));
    });
  }

  it('returns safe empty and malformed responses without changing the seeds', async () => {
    mock.setScenario({ outcome: 'empty' });
    expect((await firstValueFrom(api.list())).items).toEqual([]);
    expect(await firstValueFrom(api.categories())).toEqual([]);
    await expectAsync(firstValueFrom(api.create(productDraftFixture()))).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    mock.enqueue({ outcome: 'malformed' });
    await expectAsync(firstValueFrom(api.list())).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
    mock.setScenario({ outcome: 'success' });
    expect((await firstValueFrom(api.list())).total).toBe(30);
  });

  const errors: readonly { outcome: MockOutcome; kind: string }[] = [
    { outcome: 400, kind: 'validation' }, { outcome: 422, kind: 'validation' },
    { outcome: 401, kind: 'unauthorized' }, { outcome: 403, kind: 'forbidden' },
    { outcome: 404, kind: 'not-found' }, { outcome: 409, kind: 'conflict' },
    { outcome: 429, kind: 'rate-limit' }, { outcome: 500, kind: 'server' },
    { outcome: 503, kind: 'server' }, { outcome: 'network', kind: 'network' }
  ];
  for (const { outcome, kind } of errors) {
    it(`simulates ${outcome} without committing writes or retrying`, async () => {
      mock.enqueue({ outcome });
      await expectAsync(firstValueFrom(api.create(productDraftFixture()))).toBeRejectedWith(jasmine.objectContaining({ kind }));
      expect((await firstValueFrom(api.list())).total).toBe(30);
    });
  }

  it('exposes the simulated Retry-After duration', async () => {
    mock.enqueue({ outcome: 429 });
    await expectAsync(firstValueFrom(api.list())).toBeRejectedWith(jasmine.objectContaining({ retryAfterSeconds: 2 }));
  });

  it('delays responses deterministically and cancels writes on unsubscribe', fakeAsync(() => {
    mock.enqueue({ outcome: 'success', delayMs: 100 });
    let received = false;
    api.get(1).subscribe(() => { received = true; });
    tick(99);
    expect(received).toBeFalse();
    tick(1);
    expect(received).toBeTrue();
    mock.enqueue({ outcome: 'success', delayMs: 100 });
    const subscription = api.create(productDraftFixture()).subscribe({ next: () => fail('Cancelled write emitted') });
    subscription.unsubscribe();
    tick(100);
    api.list().subscribe(page => expect(page.total).toBe(30));
  }));

  it('delays errors too, instead of throwing them before the chosen latency', fakeAsync(() => {
    mock.enqueue({ outcome: 503, delayMs: 50 });
    const error = jasmine.createSpy('error');
    api.get(1).subscribe({ error });
    tick(49);
    expect(error).not.toHaveBeenCalled();
    tick(1);
    expect(error).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'server' }));
  }));

  it('invalidates pending operations on reset and clears queued scenarios', fakeAsync(() => {
    mock.enqueue({ outcome: 'success', delayMs: 100 });
    const error = jasmine.createSpy('reset error');
    api.create(productDraftFixture()).subscribe({ next: () => fail('Stale write committed'), error });
    mock.enqueue({ outcome: 500 });
    mock.reset();
    tick(100);
    expect(error).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict' }));
    api.list().subscribe(page => expect(page.total).toBe(30));
  }));

  it('reproduces out-of-order responses under RxJS virtual time', () => {
    new TestScheduler((actual, expected) => expect(actual).toEqual(expected)).run(({ expectObservable }) => {
      mock.enqueue({ outcome: 'success', delayMs: 100 });
      mock.enqueue({ outcome: 'success', delayMs: 10 });
      expectObservable(api.get(1).pipe(map(product => product.id))).toBe('100ms (a|)', { a: 1 });
      expectObservable(api.get(2).pipe(map(product => product.id))).toBe('10ms (b|)', { b: 2 });
    });
  });

  it('demonstrates latest-read-wins and source teardown with switchMap', () => {
    new TestScheduler((actual, expected) => expect(actual).toEqual(expected)).run(({ cold, expectObservable, expectSubscriptions }) => {
      mock.enqueue({ outcome: 'success', delayMs: 5 });
      mock.enqueue({ outcome: 'success', delayMs: 1 });
      const ids$ = cold('a-b----|', { a: 1, b: 2 });
      const current$ = ids$.pipe(switchMap(id => api.get(id)), map(product => product.id));
      expectObservable(current$).toBe('---b---|', { b: 2 });
      expectSubscriptions(ids$.subscriptions).toBe('^------!');
    });
  });

  it('limits scenario latency and does not leak unsupported API calls', async () => {
    for (const delayMs of [-1, 0.5, Infinity, 10001]) {
      expect(() => mock.setScenario({ outcome: 'success', delayMs })).toThrowError();
    }
    await expectAsync(firstValueFrom(client.get<unknown>(`${base}/recipes`)))
      .toBeRejectedWith(jasmine.objectContaining({ status: 501 }));
    await expectAsync(firstValueFrom(client.put<unknown>(`${base}/products/1`, {})))
      .toBeRejectedWith(jasmine.objectContaining({ status: 501 }));
  });

  it('does not intercept assets or similar-looking external origins', async () => {
    for (const url of ['/mock-product.svg', 'https://dummyjson.com.example.test/products', 'https://example.test/products']) {
      const response = firstValueFrom(client.get<unknown>(url));
      http.expectOne(url).flush({ external: true });
      expect(await response).toEqual({ external: true });
    }
  });

  it('matches API base paths by segment rather than string prefix', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('mock', 'https://example.test/api') }] });
    api = TestBed.inject(ProductsApiService);
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    expect((await firstValueFrom(api.get(1))).id).toBe(1);
    const unrelated = firstValueFrom(client.get<unknown>('https://example.test/api-other/products'));
    http.expectOne('https://example.test/api-other/products').flush({ external: true });
    expect(await unrelated).toEqual({ external: true });
    await expectAsync(firstValueFrom(client.get<unknown>('https://example.test/api/unknown')))
      .toBeRejectedWith(jasmine.objectContaining({ status: 501 }));
  });
});
