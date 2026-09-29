import {
  BehaviorSubject, ReplaySubject, Subject, Subscription, defer, from, fromEvent,
  interval, of, take, takeUntil, timer
} from 'rxjs';
import type { SchedulerLike } from 'rxjs';
import { ExperimentTrace, traceStream } from './experiment-trace';
import type { OperationId } from './flattening-experiment';

export function startSourceExperiment(scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const owner = new Subscription();
  owner.add(traceStream(of('A', 'B'), 'OF', trace, value => value).subscribe());
  owner.add(traceStream(from(['A', 'B']), 'FROM', trace, value => value).subscribe());
  const cold$ = defer(() => {
    trace.record('COLD', 'factory');
    return of('C');
  });
  owner.add(scheduler.schedule(() => owner.add(traceStream(cold$, 'COLD1', trace, value => value).subscribe()), 5));
  owner.add(scheduler.schedule(() => owner.add(traceStream(cold$, 'COLD2', trace, value => value).subscribe()), 17));
  owner.add(traceStream(timer(10, scheduler), 'TIMER', trace, () => 'A').subscribe());
  owner.add(traceStream(interval(6, scheduler).pipe(take(3)), 'INTERVAL', trace, String).subscribe());

  // Deliberately local: no global DOM listener and no user event content is retained.
  const target = new EventTarget();
  const events$ = traceStream(fromEvent(target, 'fixture'), 'EVENT-SOURCE', trace, () => 'A');
  owner.add(traceStream(events$.pipe(takeUntil(timer(12, scheduler))), 'EVENT-VIEW', trace, () => 'A').subscribe());
  for (const atMs of [4, 9, 19]) {
    owner.add(scheduler.schedule(() => {
      trace.record('LOCAL-EVENT', 'trigger');
      target.dispatchEvent(new Event('fixture'));
    }, atMs));
  }
  return owner;
}

export function startSubjectExperiment(scheduler: SchedulerLike, trace: ExperimentTrace): Subscription {
  const owner = new Subscription();
  const subject = new Subject<OperationId>();
  const behavior = new BehaviorSubject<OperationId>('D');
  const replay = new ReplaySubject<OperationId>(2);
  const sources = [
    { id: 'SUBJECT', source: subject }, { id: 'BEHAVIOR', source: behavior }, { id: 'REPLAY', source: replay }
  ];
  for (const { id, source } of sources) {
    for (const atMs of [0, 8, 15]) {
      owner.add(scheduler.schedule(() => owner.add(
        traceStream(source.asObservable(), `${id}:${atMs}`, trace, value => value).subscribe()
      ), atMs));
    }
  }
  for (const item of [{ atMs: 1, id: 'A' }, { atMs: 5, id: 'B' }, { atMs: 11, id: 'C' }] satisfies
    readonly { atMs: number; id: OperationId }[]) {
    owner.add(scheduler.schedule(() => {
      trace.record(item.id, 'trigger');
      for (const { source } of sources) source.next(item.id);
    }, item.atMs));
  }
  owner.add(scheduler.schedule(() => {
    for (const { source } of sources) source.complete();
  }, 13));
  owner.add(() => { for (const { source } of sources) source.complete(); });
  return owner;
}
