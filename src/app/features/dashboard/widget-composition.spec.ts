import { map, switchMap } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { ApiError } from '../../core/http/api-error';
import { composeWidgets } from './widget-composition';
import type { WidgetData, WidgetId, WidgetStates, WidgetStrategy } from './widget-composition';

const USERS: WidgetData = { kind: 'users', total: 1, previews: [{ id: 1, label: 'Public User' }] };
const TASKS: WidgetData = { kind: 'tasks', total: 1, count: 1, completed: 1, incomplete: 0 };
const POSTS: WidgetData = { kind: 'posts', total: 1, previews: [{ id: 1, label: 'Public title' }] };
const STRATEGIES: readonly WidgetStrategy[] = ['independent', 'combineLatest', 'forkJoin'];

function statusCode(states: WidgetStates): string {
  const codes = { idle: 'I', loading: 'L', success: 'S', error: 'E', empty: '0' };
  return codes[states.users.status] + codes[states.tasks.status] + codes[states.posts.status];
}

describe('dashboard widget composition timelines', () => {
  let scheduler: TestScheduler;
  beforeEach(() => { scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected)); });

  for (const strategy of ['independent', 'combineLatest'] as const) {
    it(`${strategy} reports a source completing without a value instead of leaving that widget loading`, () => {
      scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const users$ = cold<WidgetData>('--|');
        const tasks$ = cold<WidgetData>('---t|', { t: TASKS });
        const posts$ = cold<WidgetData>('-----p|', { p: POSTS });
        const result$ = composeWidgets(strategy, { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
        expectObservable(result$.pipe(map(statusCode))).toBe('a-bc-d|', {
          a: 'LLL', b: 'ELL', c: 'ESL', d: 'ESS'
        });
        expectSubscriptions(users$.subscriptions).toBe('^-!');
        expectSubscriptions(tasks$.subscriptions).toBe('^---!');
        expectSubscriptions(posts$.subscriptions).toBe('^-----!');
      });
    });

    it(`${strategy} seeds loading and emits partial success/error without cancelling healthy requests`, () => {
      scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const users$ = cold<WidgetData>('--u|', { u: USERS });
        const tasks$ = cold<WidgetData>('----#', {}, new ApiError('server', 'Not rendered'));
        const posts$ = cold<WidgetData>('------p|', { p: POSTS });
        const result$ = composeWidgets(strategy, { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
        expectObservable(result$.pipe(map(statusCode))).toBe('a-b-c-d|', {
          a: 'LLL', b: 'SLL', c: 'SEL', d: 'SES'
        });
        expectSubscriptions(users$.subscriptions).toBe('^--!');
        expectSubscriptions(tasks$.subscriptions).toBe('^---!');
        expectSubscriptions(posts$.subscriptions).toBe('^------!');
      });
    });

    it(`${strategy} retries only the targeted source and ignores duplicate retries while it is active`, () => {
      scheduler.run(({ cold, hot, expectObservable, expectSubscriptions, flush }) => {
        const users$ = cold<WidgetData>('-u|', { u: USERS });
        const failedTasks$ = cold<WidgetData>('---#');
        const recoveredTasks$ = cold<WidgetData>('----t|', { t: TASKS });
        const posts$ = cold<WidgetData>('----p|', { p: POSTS });
        const retry$ = hot<WidgetId>('------tt------|', { t: 'tasks' });
        let attempts = 0;
        const result$ = composeWidgets(strategy, { users: () => users$,
          tasks: () => ++attempts === 1 ? failedTasks$ : recoveredTasks$, posts: () => posts$ }, retry$);
        expectObservable(result$.pipe(map(statusCode))).toBe('ab-cd-e---f---|', {
          a: 'LLL', b: 'SLL', c: 'SEL', d: 'SES', e: 'SLS', f: 'SSS'
        });
        expectSubscriptions(users$.subscriptions).toBe('^-!');
        expectSubscriptions(failedTasks$.subscriptions).toBe('^--!');
        expectSubscriptions(recoveredTasks$.subscriptions).toBe('------^----!');
        expectSubscriptions(posts$.subscriptions).toBe('^----!');
        flush();
        expect(attempts).toBe(2);
      });
    });
  }

  it('forkJoin waits for completion, not merely for all first emissions, and retains a failed section', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const users$ = cold<WidgetData>('--u----|', { u: USERS });
      const tasks$ = cold<WidgetData>('----#');
      const posts$ = cold<WidgetData>('---p-|', { p: POSTS });
      const result$ = composeWidgets('forkJoin', { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
      expectObservable(result$.pipe(map(statusCode))).toBe('a------(b|)', { a: 'LLL', b: 'SES' });
      expectSubscriptions(users$.subscriptions).toBe('^------!');
      expectSubscriptions(tasks$.subscriptions).toBe('^---!');
      expectSubscriptions(posts$.subscriptions).toBe('^----!');
    });
  });

  it('forkJoin preserves three distinct error states rather than collapsing an all-failed group', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const users$ = cold<WidgetData>('-#');
      const tasks$ = cold<WidgetData>('--#');
      const posts$ = cold<WidgetData>('---#');
      const result$ = composeWidgets('forkJoin', { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
      expectObservable(result$.pipe(map(statusCode))).toBe('a--(b|)', { a: 'LLL', b: 'EEE' });
      expectSubscriptions(users$.subscriptions).toBe('^!');
      expectSubscriptions(tasks$.subscriptions).toBe('^-!');
      expectSubscriptions(posts$.subscriptions).toBe('^--!');
    });
  });

  it('forkJoin converts a no-emission completion to an error without discarding other results', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const users$ = cold<WidgetData>('--|');
      const tasks$ = cold<WidgetData>('-t|', { t: TASKS });
      const posts$ = cold<WidgetData>('---p|', { p: POSTS });
      const result$ = composeWidgets('forkJoin', { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
      expectObservable(result$.pipe(map(statusCode))).toBe('a---(b|)', { a: 'LLL', b: 'ESS' });
      expectSubscriptions(users$.subscriptions).toBe('^-!');
      expectSubscriptions(tasks$.subscriptions).toBe('^-!');
      expectSubscriptions(posts$.subscriptions).toBe('^---!');
    });
  });

  it('distinguishes a valid zero-total result from an empty observable', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const users$ = cold<WidgetData>('--u|', { u: { kind: 'users', total: 0, previews: [] } });
      const tasks$ = cold<WidgetData>('-t|', { t: TASKS });
      const posts$ = cold<WidgetData>('---p|', { p: POSTS });
      const result$ = composeWidgets('forkJoin', { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
      expectObservable(result$.pipe(map(statusCode))).toBe('a---(b|)', { a: 'LLL', b: '0SS' });
      expectSubscriptions(users$.subscriptions).toBe('^--!');
      expectSubscriptions(tasks$.subscriptions).toBe('^-!');
      expectSubscriptions(posts$.subscriptions).toBe('^---!');
    });
  });

  it('forkJoin remains loading if a source emits but never completes, until its owner cancels', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const users$ = cold<WidgetData>('--u', { u: USERS });
      const tasks$ = cold<WidgetData>('-t|', { t: TASKS });
      const posts$ = cold<WidgetData>('---p|', { p: POSTS });
      const result$ = composeWidgets('forkJoin', { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
      expectObservable(result$.pipe(map(statusCode)), '--------!').toBe('a', { a: 'LLL' });
      expectSubscriptions(users$.subscriptions).toBe('^-------!');
      expectSubscriptions(tasks$.subscriptions).toBe('^-!');
      expectSubscriptions(posts$.subscriptions).toBe('^---!');
    });
  });

  it('switching strategy cancels the old group and starts exactly one fresh request per domain', () => {
    scheduler.run(({ cold, hot, expectObservable, expectSubscriptions }) => {
      const users$ = cold<WidgetData>('--u|', { u: USERS });
      const tasks$ = cold<WidgetData>('------t|', { t: TASKS });
      const posts$ = cold<WidgetData>('--------p|', { p: POSTS });
      const strategy$ = hot<WidgetStrategy>('a---b------|', { a: 'independent', b: 'forkJoin' });
      const result$ = strategy$.pipe(switchMap(strategy => composeWidgets(strategy, {
        users: () => users$, tasks: () => tasks$, posts: () => posts$
      })));
      expectObservable(result$.pipe(map(statusCode))).toBe('a-b-a--------(c|)', { a: 'LLL', b: 'SLL', c: 'SSS' });
      expectSubscriptions(users$.subscriptions).toBe(['^--!', '----^--!']);
      expectSubscriptions(tasks$.subscriptions).toBe(['^---!', '----^------!']);
      expectSubscriptions(posts$.subscriptions).toBe(['^---!', '----^--------!']);
    });
  });

  for (const strategy of STRATEGIES) {
    it(`${strategy} unsubscribes every unfinished source on owner teardown`, () => {
      scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const users$ = cold<WidgetData>('-----u|', { u: USERS });
        const tasks$ = cold<WidgetData>('------t|', { t: TASKS });
        const posts$ = cold<WidgetData>('-------p|', { p: POSTS });
        const result$ = composeWidgets(strategy, { users: () => users$, tasks: () => tasks$, posts: () => posts$ });
        expectObservable(result$.pipe(map(statusCode)), '---!').toBe('a', { a: 'LLL' });
        expectSubscriptions(users$.subscriptions).toBe('^--!');
        expectSubscriptions(tasks$.subscriptions).toBe('^--!');
        expectSubscriptions(posts$.subscriptions).toBe('^--!');
      });
    });
  }

  it('never exposes an arbitrary ApiError message, including synchronous request factory failures', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const tasks$ = cold<WidgetData>('-t|', { t: TASKS });
      const posts$ = cold<WidgetData>('-p|', { p: POSTS });
      const result$ = composeWidgets('forkJoin', {
        users: () => { throw new ApiError('format', 'Untrusted server text'); },
        tasks: () => tasks$, posts: () => posts$
      }).pipe(map(states => states.users));
      expectObservable(result$).toBe('a-(b|)', { a: { status: 'loading' },
        b: { status: 'error', message: 'The service returned an invalid response.' } });
      expectSubscriptions(tasks$.subscriptions).toBe('^-!');
      expectSubscriptions(posts$.subscriptions).toBe('^-!');
    });
  });
});
