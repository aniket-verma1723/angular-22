import { catchError, map, of, startWith } from 'rxjs';
import type { Observable } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import type { ApiError } from '../../core/http/api-error';

export type ReadState<T> = { readonly status: 'loading' } |
  { readonly status: 'success'; readonly value: T } |
  { readonly status: 'error'; readonly error: ApiError };

// Apply inside switchMap: a failed read must not terminate route or retry intents.
export function readState<T>(source$: Observable<T>): Observable<ReadState<T>> {
  return source$.pipe(
    map((value): ReadState<T> => ({ status: 'success', value })),
    catchError((error: unknown) => of<ReadState<T>>({ status: 'error', error: toApiError(error) })),
    startWith<ReadState<T>>({ status: 'loading' })
  );
}

export function readIdFromUrl(value: string | null): number | null {
  if (value === null || !/^[1-9][0-9]*$/.test(value) || value.trim() !== value) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
