import { Component, EnvironmentInjector, InjectionToken, createEnvironmentInjector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterPreloader, provideRouter, withNavigationErrorHandler, withPreloading } from '@angular/router';
import type { Route, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMPTY, NEVER, Observable, finalize, firstValueFrom, of, throwError } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { PerformancePreloadingStrategy } from './performance-preloading.service';

const ON_CONSTRUCT = new InjectionToken<() => void>('preload fixture construction');

@Component({ selector: 'app-preload-outside-test', template: '<p>Outside</p>' })
class OutsideComponent {}

@Component({ selector: 'app-preload-candidate-test', template: '<p>Candidate</p>' })
class CandidateComponent {
  constructor() {
    inject(ON_CONSTRUCT)();
  }
}

const candidate: Route = { path: 'preloaded', data: { performancePreload: true } };

describe('PerformancePreloadingStrategy', () => {
  function expectSkipped(route: Route): void {
    const load = jasmine.createSpy<() => Observable<unknown>>('load').and.returnValue(of('loaded'));
    const result$ = TestBed.inject(PerformancePreloadingStrategy).preload(route, load);
    expect(result$).toBe(EMPTY);
    const next = jasmine.createSpy('next');
    const complete = jasmine.createSpy('complete');
    result$.subscribe({ next, complete, error: fail });
    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
  }

  it('skips missing, false and merely truthy opt-ins without invoking the loader', () => {
    expectSkipped({ path: 'preloaded' });
    expectSkipped({ path: 'preloaded', data: {} });
    for (const value of [false, undefined, null, 'true', 1, {}]) {
      expectSkipped({ path: 'preloaded', data: { performancePreload: value } });
    }
  });

  it('requires the exact child path even when another route opts in', () => {
    for (const path of [undefined, '', 'performance', 'demand', 'products/new', 'preloaded/child', 'Preloaded']) {
      expectSkipped({ path, data: { performancePreload: true } });
    }
  });

  it('denies declared guards without evaluating them or resolving their injected dependencies', () => {
    const dependency = new InjectionToken<boolean>('guard dependency');
    const factory = jasmine.createSpy('guard dependency factory').and.returnValue(true);
    const guard = jasmine.createSpy('guard').and.callFake(() => inject(dependency));
    TestBed.configureTestingModule({ providers: [{ provide: dependency, useFactory: factory }] });
    for (const guards of [
      { canMatch: [guard] }, { canActivate: [guard] },
      { canActivateChild: [guard] }, { canLoad: [guard] },
      { canMatch: [] }, { canActivate: [] }, { canActivateChild: [] }, { canLoad: [] }
    ]) {
      expectSkipped({ ...candidate, ...guards });
    }
    expect(guard).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it('defers the selected loader and subscribes exactly once, forwarding its result', () => {
    const subscribed = jasmine.createSpy('subscribed');
    const load = jasmine.createSpy<() => Observable<unknown>>('load').and.returnValue(
      new Observable<unknown>(subscriber => {
        subscribed();
        subscriber.next('loaded');
        subscriber.complete();
      })
    );
    const result$ = TestBed.inject(PerformancePreloadingStrategy).preload(candidate, load);
    expect(load).not.toHaveBeenCalled();
    expect(subscribed).not.toHaveBeenCalled();
    const next = jasmine.createSpy('next');
    const complete = jasmine.createSpy('complete');
    result$.subscribe({ next, complete, error: fail });
    expect(load).toHaveBeenCalledTimes(1);
    expect(subscribed).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledOnceWith('loaded');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('completes silently on observable errors without retrying or caching failure', () => {
    const strategy = TestBed.inject(PerformancePreloadingStrategy);
    const load = jasmine.createSpy<() => Observable<unknown>>('load')
      .and.returnValue(throwError(() => new Error('chunk unavailable')));
    const next = jasmine.createSpy('next');
    const complete = jasmine.createSpy('complete');
    strategy.preload(candidate, load).subscribe({ next, complete, error: fail });
    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    load.and.returnValue(of('recovered'));
    strategy.preload(candidate, load).subscribe({ next, error: fail });
    expect(next).toHaveBeenCalledOnceWith('recovered');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('also catches synchronous loader throws at subscription time', () => {
    const load = jasmine.createSpy<() => Observable<unknown>>('load').and.callFake(() => {
      throw new Error('synchronous loader failure');
    });
    const result$ = TestBed.inject(PerformancePreloadingStrategy).preload(candidate, load);
    expect(load).not.toHaveBeenCalled();
    const next = jasmine.createSpy('next');
    const complete = jasmine.createSpy('complete');
    result$.subscribe({ next, complete, error: fail });
    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('silently times out a stalled load after 15 seconds and unsubscribes without retry', () => {
    const strategy = TestBed.inject(PerformancePreloadingStrategy);
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    const load = jasmine.createSpy<() => Observable<unknown>>('load');
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const source$ = cold<unknown>('-');
      load.and.returnValue(source$);
      expectObservable(strategy.preload(candidate, load)).toBe('15000ms |');
      expectSubscriptions(source$.subscriptions).toBe('^ 14999ms !');
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('completes and tears down an active load when its owning injector is destroyed', () => {
    const injector = createEnvironmentInjector(
      [PerformancePreloadingStrategy], TestBed.inject(EnvironmentInjector)
    );
    const teardown = jasmine.createSpy('teardown');
    const complete = jasmine.createSpy('complete');
    const subscription = injector.get(PerformancePreloadingStrategy)
      .preload(candidate, () => NEVER.pipe(finalize(teardown)))
      .subscribe({ complete, error: fail });
    expect(subscription.closed).toBeFalse();
    expect(teardown).not.toHaveBeenCalled();
    injector.destroy();
    expect(subscription.closed).toBeTrue();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('preloads only the candidate after navigating into the untagged lazy parent, without constructing it', async () => {
    const constructed = jasmine.createSpy('constructed');
    const selected = jasmine.createSpy('selected loader').and.callFake(() => Promise.resolve(CandidateComponent));
    const demand = jasmine.createSpy('demand loader').and.callFake(() => Promise.resolve(OutsideComponent));
    const children: Routes = [
      { path: '', component: OutsideComponent },
      { ...candidate, loadComponent: selected },
      { path: 'demand', loadComponent: demand }
    ];
    const parent = jasmine.createSpy('parent loader').and.callFake(() => Promise.resolve(children));
    TestBed.configureTestingModule({
      providers: [
        { provide: ON_CONSTRUCT, useValue: constructed },
        provideRouter([
          { path: '', component: OutsideComponent },
          { path: 'labs/performance', loadChildren: parent }
        ], withPreloading(PerformancePreloadingStrategy))
      ]
    });
    const harness = await RouterTestingHarness.create('/');
    const preloader = TestBed.inject(RouterPreloader);
    // The harness does not bootstrap the app's preloading listener; drive real passes explicitly.
    await firstValueFrom(preloader.preload(), { defaultValue: undefined });
    expect(parent).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    expect(demand).not.toHaveBeenCalled();
    await harness.navigateByUrl('/labs/performance');
    await firstValueFrom(preloader.preload(), { defaultValue: undefined });
    expect(parent).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledTimes(1);
    expect(demand).not.toHaveBeenCalled();
    expect(constructed).not.toHaveBeenCalled();
    await firstValueFrom(preloader.preload(), { defaultValue: undefined });
    expect(selected).toHaveBeenCalledTimes(1);
    await harness.navigateByUrl('/labs/performance/preloaded', CandidateComponent);
    expect(constructed).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledTimes(1);
    expect(demand).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Candidate');
    // Callback counts demonstrate router behavior, not network timings or authorization.
  });

  it('allows navigation to retry a failed preload and exposes real navigation errors', async () => {
    const constructed = jasmine.createSpy('constructed');
    const navigationError = new Error('chunk unavailable');
    const navigationErrors: unknown[] = [];
    const load = jasmine.createSpy('candidate loader').and.callFake(() =>
      Promise.reject(navigationError)
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: ON_CONSTRUCT, useValue: constructed },
        provideRouter([
          { path: '', component: OutsideComponent },
          { ...candidate, loadComponent: load }
        ], withPreloading(PerformancePreloadingStrategy),
        withNavigationErrorHandler(error => { navigationErrors.push(error.error); }))
      ]
    });
    const harness = await RouterTestingHarness.create('/');
    await firstValueFrom(TestBed.inject(RouterPreloader).preload(), { defaultValue: undefined });
    expect(load).toHaveBeenCalledTimes(1);
    expect(constructed).not.toHaveBeenCalled();
    expect(navigationErrors).toEqual([]);
    await expectAsync(harness.navigateByUrl('/preloaded')).toBeRejectedWithError('chunk unavailable');
    expect(navigationErrors).toEqual([navigationError]);
    expect(load).toHaveBeenCalledTimes(2);
    load.and.callFake(() => Promise.resolve(CandidateComponent));
    await harness.navigateByUrl('/preloaded', CandidateComponent);
    expect(load).toHaveBeenCalledTimes(3);
    expect(constructed).toHaveBeenCalledTimes(1);
    expect(navigationErrors).toEqual([navigationError]);
  });
});
