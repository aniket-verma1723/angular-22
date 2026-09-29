import { Subject, of, switchMap, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { readIdFromUrl, readState } from './read-state';
import type { ReadState } from './read-state';

describe('Shared read states', () => {
  it('starts each inner read loading and keeps the outer intent stream alive after failure', () => {
    const intents$ = new Subject<boolean>();
    const states: ReadState<number>[] = [];
    const subscription = intents$.pipe(switchMap(fail => readState(fail
      ? throwError(() => new ApiError('network', 'Offline')) : of(42)))).subscribe(state => states.push(state));
    intents$.next(true);
    intents$.next(false);
    expect(states.map(state => state.status)).toEqual(['loading', 'error', 'loading', 'success']);
    expect(states[3]).toEqual({ status: 'success', value: 42 });
    subscription.unsubscribe();
  });

  it('cancels the old inner source and tears down the active one', () => {
    const intents$ = new Subject<Subject<number>>();
    const old$ = new Subject<number>();
    const next$ = new Subject<number>();
    const values: ReadState<number>[] = [];
    const subscription = intents$.pipe(switchMap(readState)).subscribe(state => values.push(state));
    intents$.next(old$); intents$.next(next$); old$.next(1); next$.next(2);
    expect(values).toEqual([{ status: 'loading' }, { status: 'loading' }, { status: 'success', value: 2 }]);
    subscription.unsubscribe(); next$.next(3);
    expect(values.length).toBe(3);
  });

  for (const id of [null, '', '0', '-1', '01', '1.5', '1e2', '0x10', '1\n', ' 1', '9007199254740992']) {
    it(`rejects invalid route ID ${JSON.stringify(id)}`, () => expect(readIdFromUrl(id)).toBeNull());
  }
  it('accepts positive safe integer IDs', () => {
    expect(readIdFromUrl('1')).toBe(1);
    expect(readIdFromUrl(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});
