import { EMPTY, NEVER, of, throwError } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { ExperimentTrace, MAX_TRACE_EVENTS, MAX_VIRTUAL_MS, fixtureStream, runVirtualExperiment, traceStream } from './experiment-trace';

describe('ExperimentTrace', () => {
  it('caps observations, validates IDs/times and returns independent snapshots', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    const trace = new ExperimentTrace(scheduler);
    const empty = trace.snapshot();
    for (let index = 0; index < MAX_TRACE_EVENTS + 10; index++) trace.record('A', 'next');
    expect(trace.snapshot().length).toBe(MAX_TRACE_EVENTS);
    expect(empty).toEqual([]);
    for (const bad of ['<img src=x>', 'token=value', 'A'.repeat(41), 'A\n', '']) {
      expect(() => trace.record(bad, 'next')).toThrowError('Invalid synthetic trace event.');
    }
    for (const bad of [-1, NaN, Infinity, 1.5, MAX_VIRTUAL_MS + 1]) {
      expect(() => trace.record('A', 'next', bad)).toThrowError('Invalid synthetic trace event.');
    }
  });

  it('distinguishes completion/error from unsubscribe, and finalizes each subscription', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    const trace = new ExperimentTrace(scheduler);
    traceStream(of('A'), 'SUCCESS', trace, value => value).subscribe();
    traceStream(EMPTY, 'EMPTY', trace, () => 'A').subscribe();
    traceStream(throwError(() => new Error('must not be logged')), 'ERROR', trace, () => 'A').subscribe({ error: () => undefined });
    const subscription = traceStream(NEVER, 'CANCEL', trace, () => 'A').subscribe();
    subscription.unsubscribe();
    const events = trace.snapshot();
    expect(events.filter(event => event.operationId === 'CANCEL').map(event => event.kind)).toEqual(['subscribe', 'cancel', 'finalize']);
    expect(events.filter(event => event.operationId === 'ERROR').map(event => event.kind)).toEqual(['subscribe', 'error', 'finalize']);
    expect(events.filter(event => event.operationId === 'EMPTY').map(event => event.kind)).toEqual(['subscribe', 'complete', 'finalize']);
    expect(JSON.stringify(events)).not.toContain('must not be logged');
  });

  it('cancels fixture notifications with the owning subscription', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ expectObservable }) => {
      expectObservable(fixtureStream([{ atMs: 2, value: 'A' }, { atMs: 10, value: 'B' }], 11, scheduler), '5ms !')
        .toBe('2ms a', { a: 'A' });
    });
  });

  it('disposes unfinished subscriptions even if the virtual horizon is reached', () => {
    const events = runVirtualExperiment((scheduler, trace) => traceStream(
      fixtureStream([{ atMs: 600, value: 'A' }], 700, scheduler), 'BOUND', trace, value => value
    ).subscribe());
    expect(events.map(event => event.kind)).toEqual(['subscribe', 'cancel', 'finalize']);
    expect(events.some(event => event.kind === 'next')).toBeFalse();
  });
});
