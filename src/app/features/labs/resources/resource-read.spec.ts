import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EMPTY, EmptyError, Observable, Subject, of, throwError } from 'rxjs';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { productFixture } from '../../../testing/product-fixtures';
import { ProductsApiService } from '../../products/data/products-api.service';
import { RESOURCE_READ_PROVIDERS, abortableRead } from './resource-read';

describe('abortableRead: owned promise adapter', () => {
  it('does not invoke the cold reader or add a listener for an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const read = jasmine.createSpy('read').and.returnValue(of(1));
    const add = spyOn(controller.signal, 'addEventListener').and.callThrough();
    await expectAsync(abortableRead(read, controller.signal)).toBeRejectedWith(jasmine.objectContaining({ name: 'AbortError' }));
    expect(read).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects on abort, tears down the source, and removes its owned listener', async () => {
    const controller = new AbortController();
    const teardown = jasmine.createSpy('teardown');
    const source$ = new Observable<number>(() => teardown);
    const remove = spyOn(controller.signal, 'removeEventListener').and.callThrough();
    const promise = abortableRead(() => source$, controller.signal);
    const expectation = expectAsync(promise).toBeRejectedWith(jasmine.any(EmptyError));
    controller.abort();
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    await expectation;
  });

  it('installs abort observation before subscribing even if the source synchronously aborts', async () => {
    const controller = new AbortController();
    const teardown = jasmine.createSpy('synchronous abort cleanup');
    const source$ = new Observable<number>(subscriber => {
      controller.abort();
      subscriber.next(42); // Cannot rescue a cancelled read.
      return teardown;
    });
    await expectAsync(abortableRead(() => source$, controller.signal)).toBeRejectedWith(jasmine.any(EmptyError));
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('resolves the first value, removes its listener, and ignores late emissions and abort', async () => {
    const controller = new AbortController();
    const source$ = new Subject<number>();
    const remove = spyOn(controller.signal, 'removeEventListener').and.callThrough();
    const promise = abortableRead(() => source$, controller.signal);
    source$.next(1);
    expect(source$.observed).toBeFalse();
    expect(remove).toHaveBeenCalledTimes(1);
    source$.next(2);
    controller.abort();
    await expectAsync(promise).toBeResolvedTo(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('also releases a synchronously emitting source', async () => {
    const controller = new AbortController();
    const teardown = jasmine.createSpy('synchronous success cleanup');
    const source$ = new Observable<number>(subscriber => {
      subscriber.next(7);
      return teardown;
    });
    await expectAsync(abortableRead(() => source$, controller.signal)).toBeResolvedTo(7);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('propagates source errors without leaking the listener', async () => {
    const controller = new AbortController();
    const failure = new Error('Synthetic failure');
    const remove = spyOn(controller.signal, 'removeEventListener').and.callThrough();
    await expectAsync(abortableRead(() => throwError(() => failure), controller.signal)).toBeRejectedWith(failure);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('converts synchronous reader exceptions to handled promise rejections and cleans up', async () => {
    const controller = new AbortController();
    const failure = new Error('Synthetic factory failure');
    const remove = spyOn(controller.signal, 'removeEventListener').and.callThrough();
    await expectAsync(abortableRead(() => { throw failure; }, controller.signal)).toBeRejectedWith(failure);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('rejects empty completion rather than inventing a null product', async () => {
    const controller = new AbortController();
    const remove = spyOn(controller.signal, 'removeEventListener').and.callThrough();
    await expectAsync(abortableRead(() => EMPTY, controller.signal)).toBeRejectedWith(jasmine.any(EmptyError));
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('abortableRead with the existing ProductsApiService and HTTP test backend', () => {
  let api: ProductsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), ...RESOURCE_READ_PROVIDERS,
      { provide: API_CONFIG, useValue: createApiConfig('remote', 'https://example.test/lab') }
    ] });
    api = TestBed.inject(ProductsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('aborts its owned real HttpClient subscription without sending a replacement', async () => {
    const controller = new AbortController();
    const promise = abortableRead(() => api.get(1), controller.signal);
    const expectation = expectAsync(promise).toBeRejectedWith(jasmine.any(EmptyError));
    const request = http.expectOne('https://example.test/lab/products/1');
    controller.abort();
    expect(request.cancelled).toBeTrue();
    expect(() => request.flush(productFixture())).toThrow();
    await expectation;
    http.expectNone(() => true);
  });

  it('returns a strictly parsed product, dropping unneeded response fields', async () => {
    const controller = new AbortController();
    const promise = abortableRead(() => api.get(1), controller.signal);
    http.expectOne('https://example.test/lab/products/1').flush({ ...productFixture(), privateField: 'discard' });
    const product = await promise;
    expect(product.id).toBe(1);
    expect(product.reviews[0]?.author).toBe('Demo reviewer');
    expect(Object.keys(product)).not.toContain('privateField');
  });

  it('preserves the service expected-ID check at the promise boundary', async () => {
    const controller = new AbortController();
    const promise = abortableRead(() => api.get(1), controller.signal);
    const expectation = expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
    http.expectOne('https://example.test/lab/products/1').flush(productFixture({ id: 2 }));
    await expectation;
  });
});
