import { HttpClient, HttpHandler, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Provider } from '@angular/core';
import { defer, filter, firstValueFrom, fromEvent, takeUntil, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { ProductsApiService } from '../../products/data/products-api.service';

export const RESOURCE_READ_TIMEOUT_MS = 15_000;

// Component-local policy: the existing product reader keeps its parser and captured-ID check.
// Delegate to the configured handler, not HttpBackend, preserving mock/session interceptors.
export const RESOURCE_READ_PROVIDERS: Provider[] = [
  ProductsApiService,
  {
    provide: HttpClient,
    useFactory: () => {
      const parent = inject(HttpHandler);
      return new HttpClient({
        handle: request => parent.handle(request.clone({
          credentials: 'omit', withCredentials: false, transferCache: false,
          cache: 'no-store', timeout: RESOURCE_READ_TIMEOUT_MS
        })).pipe(
          // These detail reads consume only final responses. Bound interceptor/mock delays too;
          // backend timeout alone does not run in HttpTestingController or an interceptor mock.
          filter(event => event instanceof HttpResponse),
          timeout({ first: RESOURCE_READ_TIMEOUT_MS })
        )
      });
    }
  }
];

/** First-value promise boundary that owns both its subscription and abort listener. */
export function abortableRead<T>(read: () => Observable<T>, abortSignal: AbortSignal): Promise<T> {
  if (abortSignal.aborted) {
    return Promise.reject(new DOMException('Read cancelled.', 'AbortError'));
  }
  // takeUntil subscribes to the notifier before defer invokes the cold reader. firstValueFrom
  // releases both subscriptions on success/error; abort completes and rejects with EmptyError.
  return firstValueFrom(defer(read).pipe(takeUntil(fromEvent(abortSignal, 'abort'))));
}
