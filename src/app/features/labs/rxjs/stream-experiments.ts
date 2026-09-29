import {
  EMPTY, NEVER, Subscription, auditTime, catchError, combineLatest, debounceTime,
  defer, distinctUntilChanged, filter, forkJoin, from, map, mergeMap, of, retry,
  scan, share, startWith, takeUntil, tap, throttleTime, throwError, timeout, timer, withLatestFrom
} from 'rxjs';
import type { SchedulerLike } from 'rxjs';
import { ExperimentTrace, fixtureStream, traceStream } from './experiment-trace';

export function startTransformExperiment(_scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const result$ = from([1, 2, 3, 4]).pipe(
    map(value => value * 2),
    filter(value => value > 4),
    tap(value => trace.record(`TAP:${value}`, 'next')),
    scan((total, value) => total + value, 0),
    startWith(0)
  );
  return traceStream(result$, 'SCAN', trace, String).subscribe();
}

export function startTimingExperiment(scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const owner = new Subscription();
  const source$ = fixtureStream([
    { atMs: 0, value: 'A' }, { atMs: 3, value: 'B' }, { atMs: 11, value: 'B' },
    { atMs: 22, value: 'C' }, { atMs: 35, value: 'D' }
  ], 45, scheduler).pipe(tap(id => trace.record(id, 'trigger')), share());
  owner.add(traceStream(source$.pipe(debounceTime(6, scheduler), distinctUntilChanged()),
    'DEBOUNCE', trace, value => value).subscribe());
  owner.add(traceStream(source$.pipe(throttleTime(6, scheduler, { leading: true, trailing: false })),
    'THROTTLE', trace, value => value).subscribe());
  owner.add(traceStream(source$.pipe(auditTime(6, scheduler)), 'AUDIT', trace, value => value).subscribe());
  return owner;
}

export function startCombinationExperiment(scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const owner = new Subscription();
  const primary$ = fixtureStream([
    { atMs: 2, value: 'A' }, { atMs: 9, value: 'C' }, { atMs: 21, value: 'D' }
  ], 24, scheduler);
  const secondary$ = fixtureStream([{ atMs: 6, value: 'B' }, { atMs: 15, value: 'C' }], 18, scheduler);
  const pairId = (values: readonly string[]): string => values.join('+');
  owner.add(traceStream(combineLatest([primary$, secondary$]), 'COMBINE', trace, pairId).subscribe());
  owner.add(traceStream(combineLatest([primary$.pipe(startWith('S')), secondary$.pipe(startWith('S'))]),
    'SEEDED', trace, pairId).subscribe());
  owner.add(traceStream(forkJoin([primary$, secondary$]), 'JOIN', trace, pairId).subscribe());
  owner.add(traceStream(primary$.pipe(withLatestFrom(secondary$)), 'LATEST', trace, pairId).subscribe());
  owner.add(traceStream(primary$.pipe(withLatestFrom(secondary$.pipe(startWith('S')))),
    'LATEST-SEED', trace, pairId).subscribe());
  owner.add(traceStream(forkJoin([of('A'), EMPTY]), 'JOIN-EMPTY', trace, pairId).subscribe());
  owner.add(traceStream(combineLatest([of('A'), EMPTY]), 'COMBINE-EMPTY', trace, pairId).subscribe());
  owner.add(traceStream(forkJoin([of('A'), NEVER]), 'JOIN-NEVER', trace, pairId)
    .pipe(takeUntil(timer(30, scheduler))).subscribe());
  const recoverable$ = throwError(() => new Error('Synthetic failure')).pipe(
    catchError(() => { trace.record('WIDGET-B', 'error'); return of('E'); })
  );
  owner.add(traceStream(forkJoin([of('A'), recoverable$]), 'JOIN-RECOVER', trace, pairId).subscribe());
  return owner;
}

export function startErrorExperiment(scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const owner = new Subscription();
  for (const policy of ['TRANSIENT', 'VALIDATION', 'EXHAUSTED']) {
    let attempt = 0;
    const request$ = defer(() => {
      attempt++;
      const id = `${policy}-${attempt}`;
      trace.record(id, 'factory');
      return traceStream(timer(7, scheduler).pipe(mergeMap(() => {
        if (policy === 'TRANSIENT' && attempt === 3) return of('A');
        return throwError(() => policy === 'VALIDATION' ? 'validation' : 'transient');
      })), id, trace, value => value);
    });
    owner.add(traceStream(request$.pipe(
      retry({
        count: 2,
        delay: (error: unknown) => error === 'transient'
          ? timer(5, scheduler) : throwError(() => error)
      }),
      catchError(() => EMPTY)
    ), policy, trace, value => value).subscribe());
  }
  owner.add(traceStream(NEVER.pipe(timeout({ first: 13, scheduler })), 'TIMEOUT', trace, () => 'A')
    .pipe(catchError(() => EMPTY)).subscribe());
  return owner;
}
