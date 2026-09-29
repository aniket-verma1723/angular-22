import { Observable, Subscription, VirtualTimeScheduler, defer, finalize, tap } from 'rxjs';
import type { SchedulerLike } from 'rxjs';

export const MAX_TRACE_EVENTS = 160;
export const MAX_VIRTUAL_MS = 500;

export type TraceKind = 'trigger' | 'subscribe' | 'next' | 'error' | 'complete'
  | 'cancel' | 'finalize' | 'queue' | 'ignore' | 'drop' | 'teardown' | 'factory'
  | 'resolve' | 'reject-empty' | 'reject-timeout';

export interface TraceEvent {
  readonly atMs: number;
  readonly operationId: string;
  readonly kind: TraceKind;
}

/** Only bounded, synthetic operation IDs enter this timeline, never error messages or payloads. */
export class ExperimentTrace {
  private readonly events: TraceEvent[] = [];
  private readonly origin: number;

  constructor(private readonly scheduler: SchedulerLike) {
    this.origin = scheduler.now();
  }

  record(operationId: string, kind: TraceKind, atMs = this.elapsed()): void {
    if (!/^[A-Z0-9][A-Z0-9:+-]{0,39}$/.test(operationId)
      || operationId.trim() !== operationId
      || !Number.isSafeInteger(atMs) || atMs < 0 || atMs > MAX_VIRTUAL_MS) {
      throw new RangeError('Invalid synthetic trace event.');
    }
    if (this.events.length < MAX_TRACE_EVENTS) this.events.push({ atMs, operationId, kind });
  }

  elapsed(): number {
    return this.scheduler.now() - this.origin;
  }

  snapshot(): readonly TraceEvent[] {
    return this.events.map(event => ({ ...event })).sort((left, right) => left.atMs - right.atMs);
  }
}

/** Defer gives each subscription its own terminal flag, including synchronous sources. */
export function traceStream<T>(source$: Observable<T>, operationId: string, trace: ExperimentTrace,
  identify: (value: T) => string): Observable<T> {
  return defer(() => {
    let terminal = false;
    trace.record(operationId, 'subscribe');
    return source$.pipe(
      tap({
        next: value => trace.record(`${operationId}:${identify(value)}`, 'next'),
        error: () => { terminal = true; trace.record(operationId, 'error'); },
        complete: () => { terminal = true; trace.record(operationId, 'complete'); }
      }),
      finalize(() => {
        if (!terminal) trace.record(operationId, 'cancel');
        trace.record(operationId, 'finalize');
      })
    );
  });
}

export interface TimedValue<T> {
  readonly atMs: number;
  readonly value: T;
}

/** Cold fixture: the subscriber owns every scheduled notification. */
export function fixtureStream<T>(values: readonly TimedValue<T>[], completeAtMs: number,
  scheduler: SchedulerLike): Observable<T> {
  return new Observable<T>(subscriber => {
    for (const item of values) {
      subscriber.add(scheduler.schedule(() => subscriber.next(item.value), item.atMs));
    }
    subscriber.add(scheduler.schedule(() => subscriber.complete(), completeAtMs));
  });
}

export function runVirtualExperiment(
  setup: (scheduler: SchedulerLike, trace: ExperimentTrace) => Subscription
): readonly TraceEvent[] {
  const scheduler = new VirtualTimeScheduler(undefined, MAX_VIRTUAL_MS);
  const trace = new ExperimentTrace(scheduler);
  const owner = new Subscription();
  try {
    owner.add(setup(scheduler, trace));
    scheduler.flush();
  } finally {
    // A safety bound is not a teardown policy: always dispose remaining actions too.
    owner.unsubscribe();
  }
  return trace.snapshot();
}
