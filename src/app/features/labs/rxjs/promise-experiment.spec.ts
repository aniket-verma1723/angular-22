import { runPromiseExperiment } from './promise-experiment';
import { MAX_TRACE_EVENTS } from './experiment-trace';

describe('bounded observable-to-promise boundaries', () => {
  it('firstValueFrom resolves at the first value and cancels; lastValueFrom waits for completion', async () => {
    const events = await runPromiseExperiment();
    expect(events.filter(event => event.kind === 'resolve').map(event => [event.operationId, event.atMs]))
      .toEqual([['FIRST:A', 7], ['LAST:B', 19]]);
    expect(events.some(event => event.operationId === 'FIRST' && event.kind === 'cancel' && event.atMs === 7)).toBeTrue();
    expect(events.some(event => event.operationId === 'FIRST' && event.kind === 'complete')).toBeFalse();
    expect(events.some(event => event.operationId === 'FIRST:B')).toBeFalse();
    expect(events.some(event => event.operationId === 'LAST' && event.kind === 'complete' && event.atMs === 19)).toBeTrue();
  });

  it('explicitly handles EMPTY and bounds NEVER for both conversion functions without real timers', async () => {
    const events = await runPromiseExperiment();
    expect(events.filter(event => event.kind === 'reject-empty').map(event => [event.operationId, event.atMs]))
      .toEqual([['EMPTY-FIRST', 0], ['EMPTY-LAST', 0]]);
    expect(events.filter(event => event.kind === 'reject-timeout').map(event => [event.operationId, event.atMs]))
      .toEqual([['NEVER-FIRST', 13], ['NEVER-LAST', 13]]);
    expect(events.filter(event => event.kind === 'finalize').length).toBe(6);
    expect(events.length).toBeLessThan(MAX_TRACE_EVENTS);
    expect(events.every(event => event.atMs <= 19)).toBeTrue();
    expect(await runPromiseExperiment()).toEqual(events);
  });
});
