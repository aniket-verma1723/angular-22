import { catchError, map, of, startWith } from 'rxjs';
import type { Observable } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import type { ApiError } from '../../../core/http/api-error';

export type ProductLoadState<T> = { readonly status: 'loading' } |
  { readonly status: 'success'; readonly value: T } |
  { readonly status: 'error'; readonly error: ApiError };

export function productLoadState<T>(request$: Observable<T>): Observable<ProductLoadState<T>> {
  return request$.pipe(
    map((value): ProductLoadState<T> => ({ status: 'success', value })),
    catchError((error: unknown) => of<ProductLoadState<T>>({ status: 'error', error: toApiError(error) })),
    startWith<ProductLoadState<T>>({ status: 'loading' })
  );
}
