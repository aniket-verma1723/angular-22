import type { SchedulerLike, Subscription } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { ExperimentTrace, MAX_TRACE_EVENTS, MAX_VIRTUAL_MS, runVirtualExperiment } from './experiment-trace';
import type { TraceEvent } from './experiment-trace';
import { startSharingExperiment } from './sharing-experiment';
import { startSourceExperiment, startSubjectExperiment } from './source-experiments';
import { startCombinationExperiment, startErrorExperiment, startTimingExperiment, startTransformExperiment } from './stream-experiments';

type Setup = (scheduler: SchedulerLike, trace: ExperimentTrace) => Subscription;

function experiment(setup: Setup): readonly TraceEvent[] {
  const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  const trace = new ExperimentTrace(scheduler);
  scheduler.run(({ flush }) => {
    const owner = setup(scheduler, trace);
    flush();
    owner.unsubscribe();
  });
  return trace.snapshot();
}

function next(events: readonly TraceEvent[], prefix: string): readonly (readonly [string, number])[] {
  return events.filter(event => event.kind === 'next' && event.operationId.startsWith(`${prefix}:`))
    .map(event => [event.operationId.slice(prefix.length + 1), event.atMs]);
}

describe('RxJS source recipes', () => {
  it('runs of/from synchronously and defer separately only when subscribed', () => {
    const events = experiment(startSourceExperiment);
    expect(next(events, 'OF')).toEqual([['A', 0], ['B', 0]]);
    expect(next(events, 'FROM')).toEqual([['A', 0], ['B', 0]]);
    expect(events.filter(event => event.kind === 'factory').map(event => event.atMs)).toEqual([5, 17]);
    expect(next(events, 'COLD1')).toEqual([['C', 5]]);
    expect(next(events, 'COLD2')).toEqual([['C', 17]]);
  });

  it('bounds interval with take and removes the local fromEvent listener before a later event', () => {
    const events = experiment(startSourceExperiment);
    expect(next(events, 'TIMER')).toEqual([['A', 10]]);
    expect(next(events, 'INTERVAL')).toEqual([['0', 6], ['1', 12], ['2', 18]]);
    expect(next(events, 'EVENT-VIEW')).toEqual([['A', 4], ['A', 9]]);
    expect(events.some(event => event.operationId === 'EVENT-SOURCE' && event.kind === 'cancel' && event.atMs === 12)).toBeTrue();
    expect(events.some(event => event.operationId === 'EVENT-VIEW' && event.kind === 'complete' && event.atMs === 12)).toBeTrue();
    expect(events.some(event => event.operationId === 'LOCAL-EVENT' && event.kind === 'trigger' && event.atMs === 19)).toBeTrue();
  });

  it('actually unregisters fromEvent and cancels scheduled local dispatch on owner unsubscribe', () => {
    const remove = spyOn(EventTarget.prototype, 'removeEventListener').and.callThrough();
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    const trace = new ExperimentTrace(scheduler);
    scheduler.run(() => {
      const owner = startSourceExperiment(scheduler, trace);
      scheduler.schedule(() => owner.unsubscribe(), 10);
    });
    expect(remove.calls.allArgs().some(args => args[0] === 'fixture')).toBeTrue();
    expect(trace.snapshot().every(event => event.atMs <= 10)).toBeTrue();
  });

  it('contrasts hot live delivery, a current seed and a two-item replay buffer', () => {
    const events = experiment(startSubjectExperiment);
    expect(next(events, 'SUBJECT:0')).toEqual([['A', 1], ['B', 5], ['C', 11]]);
    expect(next(events, 'BEHAVIOR:0')).toEqual([['D', 0], ['A', 1], ['B', 5], ['C', 11]]);
    expect(next(events, 'SUBJECT:8')).toEqual([['C', 11]]);
    expect(next(events, 'BEHAVIOR:8')).toEqual([['B', 8], ['C', 11]]);
    expect(next(events, 'REPLAY:8')).toEqual([['A', 8], ['B', 8], ['C', 11]]);
    expect(next(events, 'SUBJECT:15')).toEqual([]);
    expect(next(events, 'BEHAVIOR:15')).toEqual([]);
    expect(next(events, 'REPLAY:15')).toEqual([['B', 15], ['C', 15]]);
    for (const source of ['SUBJECT', 'BEHAVIOR', 'REPLAY']) {
      expect(events.some(event => event.operationId === `${source}:15` && event.kind === 'complete')).toBeTrue();
    }
  });
});

describe('RxJS transformation and timing recipes', () => {
  it('maps, filters, observes without transforming, scans, and supplies an initial value', () => {
    const events = experiment(startTransformExperiment);
    expect(next(events, 'TAP')).toEqual([['6', 0], ['8', 0]]);
    expect(next(events, 'SCAN')).toEqual([['0', 0], ['6', 0], ['14', 0]]);
  });

  it('compares exact quiet/leading/audit windows and suppresses the repeated debounced B', () => {
    const events = experiment(startTimingExperiment);
    expect(next(events, 'DEBOUNCE')).toEqual([['B', 9], ['C', 28], ['D', 41]]);
    expect(next(events, 'THROTTLE')).toEqual([['A', 0], ['B', 11], ['C', 22], ['D', 35]]);
    expect(next(events, 'AUDIT')).toEqual([['B', 6], ['B', 17], ['C', 28], ['D', 41]]);
    expect(events.filter(event => event.kind === 'trigger').map(event => event.atMs)).toEqual([0, 3, 11, 22, 35]);
  });
});

describe('RxJS combination recipe', () => {
  it('demonstrates initial emissions, primary-only triggers and final completion differences', () => {
    const events = experiment(startCombinationExperiment);
    expect(next(events, 'COMBINE')).toEqual([['A+B', 6], ['C+B', 9], ['C+C', 15], ['D+C', 21]]);
    expect(next(events, 'SEEDED')).toEqual([['S+S', 0], ['A+S', 2], ['A+B', 6], ['C+B', 9], ['C+C', 15], ['D+C', 21]]);
    expect(next(events, 'JOIN')).toEqual([['D+C', 24]]);
    expect(next(events, 'LATEST')).toEqual([['C+B', 9], ['D+C', 21]]);
    expect(next(events, 'LATEST-SEED')).toEqual([['A+S', 2], ['C+B', 9], ['D+C', 21]]);
    for (const id of ['COMBINE', 'SEEDED', 'JOIN', 'LATEST', 'LATEST-SEED']) {
      expect(events.some(event => event.operationId === id && event.kind === 'complete' && event.atMs === 24)).toBeTrue();
    }
  });

  it('does not confuse empty completion or a never-completing input with successful data', () => {
    const events = experiment(startCombinationExperiment);
    for (const id of ['JOIN-EMPTY', 'COMBINE-EMPTY']) {
      expect(next(events, id)).toEqual([]);
      expect(events.some(event => event.operationId === id && event.kind === 'complete' && event.atMs === 0)).toBeTrue();
    }
    expect(next(events, 'JOIN-NEVER')).toEqual([]);
    expect(events.some(event => event.operationId === 'JOIN-NEVER' && event.kind === 'cancel' && event.atMs === 30)).toBeTrue();
    expect(events.some(event => event.operationId === 'JOIN-NEVER' && event.kind === 'complete')).toBeFalse();
    expect(next(events, 'JOIN-RECOVER')).toEqual([['A+E', 0]]);
    expect(events.some(event => event.operationId === 'WIDGET-B' && event.kind === 'error')).toBeTrue();
  });
});

describe('RxJS failure and sharing recipes', () => {
  it('only retries eligible transient failures, with a finite count and virtual delay', () => {
    const events = experiment(startErrorExperiment);
    for (const policy of ['TRANSIENT', 'EXHAUSTED']) {
      expect(events.filter(event => event.kind === 'factory' && event.operationId.startsWith(policy))
        .map(event => event.atMs)).toEqual([0, 12, 24]);
    }
    expect(events.filter(event => event.kind === 'factory' && event.operationId.startsWith('VALIDATION'))
      .map(event => event.atMs)).toEqual([0]);
    expect(next(events, 'TRANSIENT')).toEqual([['A', 31]]);
    expect(next(events, 'EXHAUSTED')).toEqual([]);
    expect(next(events, 'VALIDATION')).toEqual([]);
    expect(events.some(event => event.operationId === 'EXHAUSTED' && event.kind === 'complete' && event.atMs === 31)).toBeTrue();
    expect(events.some(event => event.operationId === 'TIMEOUT' && event.kind === 'error' && event.atMs === 13)).toBeTrue();
    expect(events.some(event => event.operationId === 'TIMEOUT' && event.kind === 'finalize' && event.atMs === 13)).toBeTrue();
  });

  it('shares overlapping subscriptions and resets unfinished sources at refCount zero', () => {
    const events = experiment(startSharingExperiment);
    expect(next(events, 'SHARE-2')).toEqual([]);
    expect(next(events, 'REPLAY-2')).toEqual([['A', 8]]);
    for (const strategy of ['SHARE', 'REPLAY']) {
      expect(events.some(event => event.operationId === `${strategy}-SOURCE` && event.kind === 'cancel' && event.atMs === 13)).toBeTrue();
      expect(next(events, `${strategy}-3`)).toEqual([['A', 25], ['B', 35]]);
    }
  });

  it('restarts completed share but retains completed shareReplay, demonstrating that refCount is not TTL', () => {
    const events = experiment(startSharingExperiment);
    expect(events.filter(event => event.operationId === 'SHARE-SOURCE' && event.kind === 'subscribe')
      .map(event => event.atMs)).toEqual([0, 20, 47]);
    expect(events.filter(event => event.operationId === 'REPLAY-SOURCE' && event.kind === 'subscribe')
      .map(event => event.atMs)).toEqual([0, 20]);
    expect(next(events, 'SHARE-4')).toEqual([['A', 52], ['B', 62]]);
    expect(next(events, 'REPLAY-4')).toEqual([['B', 47]]);
    expect(events.some(event => event.operationId === 'REPLAY-4' && event.kind === 'complete' && event.atMs === 47)).toBeTrue();
  });
});

describe('recipe boundaries and scheduler parity', () => {
  const recipes = [startSourceExperiment, startSubjectExperiment, startTransformExperiment, startTimingExperiment,
    startCombinationExperiment, startErrorExperiment, startSharingExperiment];
  for (const recipe of recipes) {
    it(`${recipe.name} agrees with the production virtual scheduler, is bounded and resets per run`, () => {
      const events = experiment(recipe);
      expect(events).toEqual(runVirtualExperiment(recipe));
      expect(events).toEqual(experiment(recipe));
      expect(events.length).toBeLessThan(MAX_TRACE_EVENTS);
      expect(events.every(event => Number.isSafeInteger(event.atMs) && event.atMs >= 0 && event.atMs <= MAX_VIRTUAL_MS)).toBeTrue();
    });
  }
});
