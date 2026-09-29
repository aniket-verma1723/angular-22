import { EMPTY, catchError, combineLatest, defaultIfEmpty, defer, distinctUntilChanged,
  exhaustMap, filter, forkJoin, map, merge, of, scan, startWith } from 'rxjs';
import type { Observable } from 'rxjs';
import { toApiError } from '../../core/http/api-error';

export type WidgetId = 'users' | 'tasks' | 'posts';
export type WidgetStrategy = 'independent' | 'combineLatest' | 'forkJoin';

export interface WidgetPreview {
  readonly id: number;
  readonly label: string;
}

export type WidgetData =
  | { readonly kind: 'users' | 'posts'; readonly total: number; readonly previews: readonly WidgetPreview[] }
  | { readonly kind: 'tasks'; readonly total: number; readonly count: number;
      readonly completed: number; readonly incomplete: number };

export type WidgetState =
  | { readonly status: 'idle' | 'loading' | 'empty' }
  | { readonly status: 'success'; readonly data: WidgetData }
  | { readonly status: 'error'; readonly message: string };

export type WidgetStates = Readonly<Record<WidgetId, WidgetState>>;
export type WidgetSources = Readonly<Record<WidgetId, () => Observable<WidgetData>>>;

const LOADING: WidgetState = { status: 'loading' };
export const IDLE_WIDGETS: WidgetStates = {
  users: { status: 'idle' }, tasks: { status: 'idle' }, posts: { status: 'idle' }
};
const LOADING_WIDGETS: WidgetStates = { users: LOADING, tasks: LOADING, posts: LOADING };
const NO_RESPONSE: WidgetState = { status: 'error', message: 'The service completed without a response.' };

function safeFailure(error: unknown): WidgetState {
  const kind = toApiError(error).kind;
  const message = kind === 'network' ? 'Unable to reach the service. Try again when connected.'
    : kind === 'format' ? 'The service returned an invalid response.'
    : kind === 'rate-limit' ? 'Too many requests. Please try again later.'
    : kind === 'server' ? 'The service is temporarily unavailable.'
    : 'This public data could not be loaded. Please try again.';
  return { status: 'error', message };
}

function settledRequest(source: () => Observable<WidgetData>): Observable<WidgetState> {
  return defer(source).pipe(
    map((data): WidgetState => data.total === 0 ? { status: 'empty' } : { status: 'success', data }),
    // EMPTY is not a valid empty page; keep it from silently collapsing a snapshot.
    defaultIfEmpty(NO_RESPONSE),
    catchError((error: unknown) => of(safeFailure(error)))
  );
}

/** One active strategy, one subscription per domain; callers own group cancellation. */
export function composeWidgets(
  strategy: WidgetStrategy, sources: WidgetSources, retry$: Observable<WidgetId> = EMPTY
): Observable<WidgetStates> {
  if (strategy === 'forkJoin') {
    // Recovery belongs inside each request, before joining, so healthy results survive.
    return forkJoin({ users: settledRequest(sources.users), tasks: settledRequest(sources.tasks),
      posts: settledRequest(sources.posts) }).pipe(startWith(LOADING_WIDGETS));
  }

  const section = (id: WidgetId): Observable<WidgetState> => retry$.pipe(
    filter(target => target === id),
    startWith(id),
    exhaustMap(() => settledRequest(sources[id]).pipe(startWith(LOADING)))
  );
  const users$ = section('users');
  const tasks$ = section('tasks');
  const posts$ = section('posts');

  if (strategy === 'combineLatest') {
    // Each input starts with loading: the first successful request need not wait for its peers.
    return combineLatest({ users: users$, tasks: tasks$, posts: posts$ });
  }
  return merge(
    users$.pipe(map(users => ({ users }))),
    tasks$.pipe(map(tasks => ({ tasks }))),
    posts$.pipe(map(posts => ({ posts })))
  ).pipe(
    scan((states: WidgetStates, patch): WidgetStates => ({ ...states, ...patch }), LOADING_WIDGETS),
    startWith(LOADING_WIDGETS),
    distinctUntilChanged((previous, current) => previous.users === current.users &&
      previous.tasks === current.tasks && previous.posts === current.posts)
  );
}
