import {
  EMPTY, catchError, concatMap, defer, exhaustMap,
  finalize, mergeMap, of, switchMap, takeUntil, tap, throwError, timer
} from 'rxjs';
import type { Observable, SchedulerLike, Subscription } from 'rxjs';
import { fixtureStream, runVirtualExperiment } from './experiment-trace';
import type { ExperimentTrace, TimedValue, TraceEvent } from './experiment-trace';

export type OperationId = 'A' | 'B' | 'C' | 'D';
export type FlatteningStrategy = 'switchMap' | 'concatMap' | 'mergeMap' | 'exhaustMap';
export type ClickScenario = 'burst' | 'spaced';
export type TeardownChoice = 'none' | 'early' | 'late';
export interface FlatteningScenario {
  readonly clicks: ClickScenario;
  readonly strategy: FlatteningStrategy;
  readonly error: OperationId | 'none';
  readonly teardown: TeardownChoice;
}

export const DEFAULT_FLATTENING_SCENARIO: FlatteningScenario = {
  clicks: 'burst', strategy: 'switchMap', error: 'none', teardown: 'none'
};
export const OPERATION_LATENCY_MS: Readonly<Record<OperationId, number>> = { A: 31, B: 13, C: 23, D: 9 };
export const BURST_CLICKS: readonly TimedValue<OperationId>[] = [
  { atMs: 0, value: 'A' }, { atMs: 7, value: 'B' },
  { atMs: 11, value: 'C' }, { atMs: 47, value: 'D' }
];
const SPACED_CLICKS: readonly TimedValue<OperationId>[] = [
  { atMs: 0, value: 'A' }, { atMs: 38, value: 'B' },
  { atMs: 71, value: 'C' }, { atMs: 109, value: 'D' }
];

/** This same operator selection is exercised with TestScheduler subscription assertions. */
export function flattenOperations<T, R>(source$: Observable<T>, strategy: FlatteningStrategy,
  project: (value: T) => Observable<R>): Observable<R> {
  switch (strategy) {
    case 'switchMap': return source$.pipe(switchMap(project));
    case 'concatMap': return source$.pipe(concatMap(project));
    case 'mergeMap': return source$.pipe(mergeMap(project, 2));
    case 'exhaustMap': return source$.pipe(exhaustMap(project));
  }
}

export function startFlatteningExperiment(scenario: FlatteningScenario, scheduler: SchedulerLike,
  trace: ExperimentTrace): Subscription {
  const active = new Set<OperationId>();
  const queued = new Set<OperationId>();
  const clicks = scenario.clicks === 'burst' ? BURST_CLICKS : SPACED_CLICKS;
  const source$ = fixtureStream(clicks, scenario.clicks === 'burst' ? 49 : 111, scheduler).pipe(
    tap(id => {
      trace.record(id, 'trigger');
      if (scenario.strategy === 'exhaustMap' && active.size > 0) trace.record(id, 'ignore');
      const capacity = scenario.strategy === 'concatMap' ? 1 : scenario.strategy === 'mergeMap' ? 2 : Infinity;
      if (active.size >= capacity) {
        queued.add(id);
        trace.record(id, 'queue');
      }
    })
  );
  const result$ = flattenOperations(source$, scenario.strategy, id => defer(() => {
    queued.delete(id);
    active.add(id);
    let terminal = false;
    trace.record(id, 'subscribe');
    return timer(OPERATION_LATENCY_MS[id], scheduler).pipe(
      mergeMap(() => scenario.error === id ? throwError(() => new Error('Synthetic failure')) : of(id)),
      tap({
        next: () => trace.record(id, 'next'),
        error: () => { terminal = true; active.delete(id); trace.record(id, 'error'); },
        complete: () => { terminal = true; active.delete(id); trace.record(id, 'complete'); }
      }),
      // Recovery belongs to each inner operation; later outer clicks still work.
      catchError(() => EMPTY),
      finalize(() => {
        active.delete(id);
        if (!terminal) trace.record(id, 'cancel');
        trace.record(id, 'finalize');
      })
    );
  }));
  const cutoff$ = scenario.teardown === 'none' ? EMPTY : timer(
    scenario.teardown === 'early' ? 25 : 50, scheduler
  ).pipe(tap(() => trace.record('VIEW', 'teardown')));
  return result$.pipe(
    // Downstream placement cancels inners and discards work still buffered by concat/merge.
    takeUntil(cutoff$),
    finalize(() => {
      for (const id of queued) trace.record(id, 'drop');
      queued.clear();
      trace.record('RUN', 'finalize');
    })
  ).subscribe();
}

export function runFlatteningExperiment(scenario: FlatteningScenario): readonly TraceEvent[] {
  return runVirtualExperiment((scheduler, trace) => startFlatteningExperiment(scenario, scheduler, trace));
}
