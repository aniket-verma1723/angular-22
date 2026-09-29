import { Subscription, map, share, shareReplay, take, timer } from 'rxjs';
import type { SchedulerLike } from 'rxjs';
import { ExperimentTrace, traceStream } from './experiment-trace';

export function startSharingExperiment(scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const owner = new Subscription();
  for (const strategy of ['SHARE', 'REPLAY']) {
    const source$ = traceStream(timer(5, 10, scheduler).pipe(take(2), map(index => index === 0 ? 'A' : 'B')),
      `${strategy}-SOURCE`, trace, value => value);
    const shared$ = strategy === 'SHARE' ? source$.pipe(share())
      : source$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
    for (const fixture of [
      { id: '1', start: 0, stop: 11 }, { id: '2', start: 8, stop: 13 },
      { id: '3', start: 20, stop: null }, { id: '4', start: 47, stop: null }
    ]) {
      const subscriber = new Subscription();
      owner.add(subscriber);
      owner.add(scheduler.schedule(() => subscriber.add(
        traceStream(shared$, `${strategy}-${fixture.id}`, trace, value => value).subscribe()
      ), fixture.start));
      if (fixture.stop !== null) {
        owner.add(scheduler.schedule(() => subscriber.unsubscribe(), fixture.stop));
      }
    }
  }
  return owner;
}
