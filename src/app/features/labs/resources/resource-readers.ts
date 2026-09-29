import { httpResource } from '@angular/common/http';
import { DestroyRef, Injector, computed, inject, resource, signal } from '@angular/core';
import type { ResourceRef, Signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, defer, map, of, startWith, switchMap, throwIfEmpty } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { ApiError, toApiError } from '../../../core/http/api-error';
import type { ProductDetail } from '../../products/data/product.models';
import { parseProductDetail, parseProductId } from '../../products/data/product.parsers';
import { ProductsApiService } from '../../products/data/products-api.service';
import { RESOURCE_READ_TIMEOUT_MS, abortableRead } from './resource-read';

export type ResourceVariant = 'rxjs' | 'httpResource' | 'rxResource' | 'resource';
export type ResourceReadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly id: number }
  | { readonly status: 'reloading'; readonly id: number; readonly product: ProductDetail }
  | { readonly status: 'resolved'; readonly id: number; readonly product: ProductDetail }
  | { readonly status: 'error'; readonly id: number; readonly message: string };

export const IDLE_READ: ResourceReadState = { status: 'idle' };

export interface ResourceReader {
  readonly state: Signal<ResourceReadState>;
  readonly selectedId: Signal<number | undefined>;
  load(id: number): void;
  clear(): void;
}

function safeReadMessage(error: unknown): string {
  switch (toApiError(error).kind) {
    case 'not-found': return 'Product not found. Choose another ID or retry.';
    case 'format': return 'The service returned an invalid product response.';
    case 'forbidden': return 'This public read was denied by the service.';
    case 'unauthorized': return 'The service rejected this public read. No sign-in is performed here.';
    case 'network': return 'The service could not be reached. Try again.';
    default: return 'The read failed or timed out. Try again.';
  }
}

function resourceState(ref: ResourceRef<ProductDetail | undefined>, id: number | undefined): ResourceReadState {
  if (id === undefined) return IDLE_READ;
  const status = ref.status();
  if (status === 'error') return { status, id, message: safeReadMessage(ref.error()) };
  // A new reactive request synchronously invalidates the old stream, before its effect runs.
  // Check loading first: an obsolete response must not become a transient identity error.
  if (status === 'loading') return { status, id };
  // value() can throw in error state. hasValue is both the runtime guard and type narrowing.
  if (ref.hasValue()) {
    const product = ref.value();
    // httpResource.parse receives only the body. Validate identity at the publication boundary,
    // after Angular has associated this value with the current reactive request.
    if (product.id !== id) {
      // Retrying a rejected identity must never expose that invalid value as a stale preview.
      if (status === 'reloading') return { status: 'loading', id };
      return { status: 'error', id, message: safeReadMessage(new ApiError('format', 'Unexpected product identity.')) };
    }
    return { status: status === 'reloading' ? 'reloading' : 'resolved', id, product };
  }
  return { status: 'loading', id };
}

/** Call once in the active experiment's injection context, never from a computed/effect. */
export function createResourceReader(variant: ResourceVariant): ResourceReader {
  const api = inject(ProductsApiService);
  const destroyRef = inject(DestroyRef);
  const selectedId = signal<number | undefined>(undefined);

  if (variant === 'rxjs') {
    const intent$ = new Subject<{ readonly id: number | undefined; readonly previous?: ProductDetail }>();
    const state = toSignal(intent$.pipe(switchMap(({ id, previous }) => {
      if (id === undefined) return of(IDLE_READ);
      const loading: ResourceReadState = previous
        ? { status: 'reloading', id, product: previous } : { status: 'loading', id };
      return defer(() => api.get(id)).pipe(
        // Completion cancels timeout; without this, EMPTY leaves the loading seed forever.
        // Keep it before startWith so the seed cannot count as a product emission.
        throwIfEmpty(),
        map((product): ResourceReadState => ({ status: 'resolved', id, product })),
        catchError((error: unknown) => of<ResourceReadState>({ status: 'error', id, message: safeReadMessage(error) })),
        startWith(loading)
      );
    })), { initialValue: IDLE_READ });
    destroyRef.onDestroy(() => intent$.complete());
    return {
      state, selectedId: selectedId.asReadonly(),
      load(id) {
        if (destroyRef.destroyed) return;
        parseProductId(id);
        const current = state();
        const same = selectedId() === id;
        if (same && (current.status === 'loading' || current.status === 'reloading')) return;
        selectedId.set(id);
        intent$.next({ id, previous: same && current.status === 'resolved' ? current.product : undefined });
      },
      clear() {
        if (destroyRef.destroyed) return;
        selectedId.set(undefined);
        intent$.next({ id: undefined });
      }
    };
  }

  const injector = inject(Injector);
  const config = inject(API_CONFIG);
  const makeHttpResource = () => httpResource(
    () => {
      const id = selectedId();
      return id === undefined ? undefined : {
        url: `${config.baseUrl}/products/${id}`, method: 'GET',
        credentials: 'omit', withCredentials: false, transferCache: false,
        cache: 'no-store', timeout: RESOURCE_READ_TIMEOUT_MS
      };
    },
    {
      injector,
      // No selection reads here: an older response can arrive before cancellation's effect.
      parse: parseProductDetail
    }
  );

  const makeParameterResource = () => variant === 'rxResource' ? rxResource({
    injector, params: selectedId.asReadonly(),
    stream: ({ params }) => api.get(params)
  }) : resource({
    injector, params: selectedId.asReadonly(),
    loader: ({ params, abortSignal }) => abortableRead(() => api.get(params), abortSignal)
  });
  // Only this selected branch is constructed; factories for other variants never run.
  const current = signal<ResourceRef<ProductDetail | undefined>>(
    variant === 'httpResource' ? makeHttpResource() : makeParameterResource()
  );
  const state = computed(() => resourceState(current(), selectedId()));
  return {
    state, selectedId: selectedId.asReadonly(),
    load(id) {
      if (destroyRef.destroyed) return;
      parseProductId(id);
      if (selectedId() === id) {
        current().reload(); // Angular refuses overlapping reloads while already loading.
        return;
      }
      selectedId.set(id);
    },
    clear() {
      if (destroyRef.destroyed) return;
      // In installed 22.1.7 loadEffect returns early for undefined params before aborting.
      // Explicit destruction guarantees Clear cancels HTTP, not merely hides its response.
      current().destroy();
      selectedId.set(undefined);
      current.set(variant === 'httpResource' ? makeHttpResource() : makeParameterResource());
    }
  };
}
