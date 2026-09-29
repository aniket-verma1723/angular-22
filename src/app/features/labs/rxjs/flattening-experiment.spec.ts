import { EMPTY, catchError, takeUntil } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { ExperimentTrace, MAX_TRACE_EVENTS } from './experiment-trace';
import { DEFAULT_FLATTENING_SCENARIO, flattenOperations, runFlatteningExperiment, startFlatteningExperiment } from './flattening-experiment';
import type { FlatteningStrategy, OperationId } from './flattening-experiment';

interface MarbleCase {
  readonly strategy: FlatteningStrategy;
  readonly output: string;
  readonly errorId: OperationId;
  readonly errorOutput: string;
  readonly cutoffOutput: string;
  readonly windows: Readonly<Record<OperationId, readonly string[]>>;
  readonly cutoffWindows: Readonly<Record<OperationId, readonly string[]>>;
}

const CASES: readonly MarbleCase[] = [
  {
    strategy: 'switchMap', output: '34ms c 21ms (d|)', errorId: 'C', errorOutput: '56ms (d|)',
    cutoffOutput: '25ms |',
    windows: { A: ['^ 6ms !'], B: ['7ms ^ 3ms !'], C: ['11ms ^ 22ms !'], D: ['47ms ^ 8ms !'] },
    cutoffWindows: { A: ['^ 6ms !'], B: ['7ms ^ 3ms !'], C: ['11ms ^ 13ms !'], D: [] }
  },
  {
    strategy: 'concatMap', output: '31ms a 12ms b 22ms c 8ms (d|)', errorId: 'B',
    errorOutput: '31ms a 35ms c 8ms (d|)', cutoffOutput: '25ms |',
    windows: { A: ['^ 30ms !'], B: ['31ms ^ 12ms !'], C: ['44ms ^ 22ms !'], D: ['67ms ^ 8ms !'] },
    cutoffWindows: { A: ['^ 24ms !'], B: [], C: [], D: [] }
  },
  {
    strategy: 'mergeMap', output: '20ms b 10ms a 11ms c 12ms (d|)', errorId: 'B',
    errorOutput: '31ms a 11ms c 12ms (d|)', cutoffOutput: '20ms b 4ms |',
    windows: { A: ['^ 30ms !'], B: ['7ms ^ 12ms !'], C: ['20ms ^ 22ms !'], D: ['47ms ^ 8ms !'] },
    cutoffWindows: { A: ['^ 24ms !'], B: ['7ms ^ 12ms !'], C: ['20ms ^ 4ms !'], D: [] }
  },
  {
    strategy: 'exhaustMap', output: '31ms a 24ms (d|)', errorId: 'A', errorOutput: '56ms (d|)',
    cutoffOutput: '25ms |',
    windows: { A: ['^ 30ms !'], B: [], C: [], D: ['47ms ^ 8ms !'] },
    cutoffWindows: { A: ['^ 24ms !'], B: [], C: [], D: [] }
  }
];

describe('flattenOperations emission and inner subscription windows', () => {
  for (const scenario of CASES) {
    for (const variant of ['success', 'error', 'teardown']) {
      it(`${scenario.strategy}: ${variant} has the expected emissions AND inner lifetimes`, () => {
        const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
        scheduler.run(({ cold, hot, expectObservable, expectSubscriptions }) => {
          const failure = new Error('Synthetic failure');
          const inner = (id: OperationId, duration: number) => cold<OperationId>(
            `${duration}ms ${variant === 'error' && scenario.errorId === id ? '#' : '(x|)'}`, { x: id }, failure
          );
          const inners = { A: inner('A', 31), B: inner('B', 13), C: inner('C', 23), D: inner('D', 9) };
          const clicks$ = hot<OperationId>('a 6ms b 3ms c 35ms d 1ms |', { a: 'A', b: 'B', c: 'C', d: 'D' });
          const cutoff$ = variant === 'teardown' ? hot('25ms x') : EMPTY;
          const result$ = flattenOperations(clicks$, scenario.strategy, id => inners[id].pipe(catchError(() => EMPTY)))
            .pipe(takeUntil(cutoff$));
          expectObservable(result$).toBe(variant === 'teardown' ? scenario.cutoffOutput
            : variant === 'error' ? scenario.errorOutput : scenario.output, { a: 'A', b: 'B', c: 'C', d: 'D' });
          const windows = variant === 'teardown' ? scenario.cutoffWindows : scenario.windows;
          for (const id of ['A', 'B', 'C', 'D'] satisfies readonly OperationId[]) {
            expectSubscriptions(inners[id].subscriptions).toBe([...windows[id]]);
          }
          expectSubscriptions(clicks$.subscriptions).toBe(variant === 'teardown' ? '^ 24ms !' : '^ 48ms !');
        });
      });
    }
  }
});

describe('four-click trace engine', () => {
  const expected: Readonly<Record<FlatteningStrategy, readonly (readonly [OperationId, number])[]>> = {
    switchMap: [['C', 34], ['D', 56]],
    concatMap: [['A', 31], ['B', 44], ['C', 67], ['D', 76]],
    mergeMap: [['B', 20], ['A', 31], ['C', 43], ['D', 56]],
    exhaustMap: [['A', 31], ['D', 56]]
  };

  for (const scenario of CASES) {
    it(`${scenario.strategy} records actual outcomes in chronological bounded relative time`, () => {
      const events = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO, strategy: scenario.strategy });
      expect(events.filter(event => event.kind === 'next').map(event => [event.operationId, event.atMs]))
        .toEqual(expected[scenario.strategy].map(([id, atMs]) => [id, atMs]));
      expect(events.filter(event => event.kind === 'trigger').map(event => event.atMs)).toEqual([0, 7, 11, 47]);
      expect(events.length).toBeLessThanOrEqual(MAX_TRACE_EVENTS);
      expect(events.every((event, index) => index === 0 || event.atMs >= events[index - 1].atMs)).toBeTrue();
      for (const event of events.filter(event => event.kind === 'subscribe')) {
        const terminal = events.filter(item => item.operationId === event.operationId
          && ['complete', 'error', 'cancel'].includes(item.kind));
        expect(terminal.length).toBe(1);
        expect(events.filter(item => item.operationId === event.operationId && item.kind === 'finalize').length).toBe(1);
      }
    });

    it(`${scenario.strategy} recovers an admitted inner error and still processes D`, () => {
      const events = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO,
        strategy: scenario.strategy, error: scenario.errorId });
      expect(events.filter(event => event.kind === 'error').map(event => event.operationId)).toEqual([scenario.errorId]);
      expect(events.some(event => event.operationId === 'D' && event.kind === 'next')).toBeTrue();
      expect(events.some(event => event.operationId === scenario.errorId && event.kind === 'complete')).toBeFalse();
      expect(events.some(event => event.operationId === scenario.errorId && event.kind === 'cancel')).toBeFalse();
    });

    it(`${scenario.strategy} cancels all admitted work at early teardown and never starts D`, () => {
      const events = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO,
        strategy: scenario.strategy, teardown: 'early' });
      expect(events.some(event => event.operationId === 'VIEW' && event.atMs === 25 && event.kind === 'teardown')).toBeTrue();
      expect(events.every(event => event.atMs <= 25)).toBeTrue();
      expect(events.some(event => event.operationId === 'D')).toBeFalse();
      expect(events.some(event => event.kind === 'cancel' && event.atMs === 25)).toBeTrue();
    });

    it(`${scenario.strategy} combines inner error recovery with late navigation cleanup`, () => {
      const events = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO,
        strategy: scenario.strategy, error: scenario.errorId, teardown: 'late' });
      expect(events.some(event => event.kind === 'error' && event.operationId === scenario.errorId)).toBeTrue();
      expect(events.some(event => event.kind === 'cancel' && event.atMs === 50)).toBeTrue();
      expect(events.every(event => event.atMs <= 50)).toBeTrue();
      expect(events.some(event => event.kind === 'next' && event.operationId === 'D')).toBeFalse();
    });

    it(`${scenario.strategy} handles spaced clicks without competition`, () => {
      const events = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO,
        strategy: scenario.strategy, clicks: 'spaced' });
      expect(events.filter(event => event.kind === 'next').map(event => [event.operationId, event.atMs]))
        .toEqual([['A', 31], ['B', 51], ['C', 94], ['D', 118]]);
      expect(events.some(event => ['queue', 'ignore', 'cancel'].includes(event.kind))).toBeFalse();
    });
  }

  it('derives queue, ignore and dropped entries from admission, not a prewritten expected timeline', () => {
    const concat = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO, strategy: 'concatMap', teardown: 'early' });
    expect(concat.filter(event => event.kind === 'queue').map(event => event.operationId)).toEqual(['B', 'C']);
    expect(concat.filter(event => event.kind === 'drop').map(event => event.operationId)).toEqual(['B', 'C']);
    expect(concat.some(event => event.operationId === 'B' && event.kind === 'finalize')).toBeFalse();
    const merge = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO, strategy: 'mergeMap' });
    expect(merge.filter(event => event.kind === 'queue').map(event => event.operationId)).toEqual(['C']);
    const exhaust = runFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO, strategy: 'exhaustMap', error: 'B' });
    expect(exhaust.filter(event => event.kind === 'ignore').map(event => event.operationId)).toEqual(['B', 'C']);
    expect(exhaust.some(event => event.kind === 'error')).toBeFalse();
  });

  it('creates an isolated trace for every run', () => {
    const first = runFlatteningExperiment(DEFAULT_FLATTENING_SCENARIO);
    const second = runFlatteningExperiment(DEFAULT_FLATTENING_SCENARIO);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('supports an injected scheduler and external unsubscribe with a nonzero clock origin', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(() => {
      scheduler.schedule(() => {
        const trace = new ExperimentTrace(scheduler);
        const subscription = startFlatteningExperiment({ ...DEFAULT_FLATTENING_SCENARIO, strategy: 'concatMap' }, scheduler, trace);
        scheduler.schedule(() => {
          subscription.unsubscribe();
          expect(trace.snapshot().filter(event => event.kind === 'trigger').map(event => event.atMs)).toEqual([0, 7, 11]);
          expect(trace.snapshot().some(event => event.kind === 'cancel' && event.atMs === 25)).toBeTrue();
        }, 25);
      }, 100);
    });
  });
});
