import { EMPTY, NEVER, EmptyError, TimeoutError, VirtualTimeScheduler, finalize, firstValueFrom,
  lastValueFrom, timeout } from 'rxjs';
import { ExperimentTrace, MAX_VIRTUAL_MS, fixtureStream, traceStream } from './experiment-trace';
import type { TraceEvent } from './experiment-trace';

/** The subscriptions finish during flush; only already-settled promise microtasks remain. */
export async function runPromiseExperiment(): Promise<readonly TraceEvent[]> {
  const scheduler = new VirtualTimeScheduler(undefined, MAX_VIRTUAL_MS);
  const trace = new ExperimentTrace(scheduler);
  const pending: Promise<void>[] = [];
  for (const boundary of ['FIRST', 'LAST', 'EMPTY-FIRST', 'EMPTY-LAST', 'NEVER-FIRST', 'NEVER-LAST']) {
    let settledAtMs = 0;
    const fixture$ = boundary.startsWith('EMPTY') ? EMPTY : boundary.startsWith('NEVER') ? NEVER
      : fixtureStream([{ atMs: 7, value: 'A' }, { atMs: 16, value: 'B' }], 19, scheduler);
    const bounded$ = traceStream(fixture$.pipe(timeout({ first: 13, each: 13, scheduler })), boundary, trace,
      value => value).pipe(finalize(() => { settledAtMs = trace.elapsed(); }));
    const promise = boundary.endsWith('LAST') ? lastValueFrom(bounded$) : firstValueFrom(bounded$);
    // Attach both handlers before flushing; no rejection is left unobserved.
    pending.push(promise.then(
      value => { trace.record(`${boundary}:${value}`, 'resolve', settledAtMs); },
      (error: unknown) => {
        trace.record(boundary, error instanceof EmptyError ? 'reject-empty'
          : error instanceof TimeoutError ? 'reject-timeout' : 'error', settledAtMs);
      }
    ));
  }
  scheduler.flush();
  await Promise.all(pending);
  return trace.snapshot();
}
