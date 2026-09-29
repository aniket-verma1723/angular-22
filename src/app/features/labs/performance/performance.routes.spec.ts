import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import type { Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, take } from 'rxjs';
import { PayloadLifetime } from './payload-lifetime.service';
import { PerformanceLabComponent } from './performance-lab.component';
import { routes } from './performance.routes';

@Component({ selector: 'app-performance-outside-test', template: '<h1>All labs fixture</h1>' })
class OutsideComponent {}

describe('Performance lab local routes', () => {
  let harness: RouterTestingHarness;
  let previousTitle: string;
  let demandLoad: jasmine.Spy;
  let preloadLoad: jasmine.Spy;

  beforeEach(async () => {
    const parent = routes[0];
    const demand = parent?.children?.find(route => route.path === 'demand');
    const preloaded = parent?.children?.find(route => route.path === 'preloaded');
    if (!parent || !demand?.loadComponent || !preloaded?.loadComponent) {
      throw new Error('Missing performance route loaders');
    }
    demandLoad = jasmine.createSpy('demand loader').and.callFake(demand.loadComponent);
    preloadLoad = jasmine.createSpy('preload loader').and.callFake(preloaded.loadComponent);
    const localRoutes: Routes = [{
      ...parent,
      children: [
        { ...demand, loadComponent: demandLoad },
        { ...preloaded, loadComponent: preloadLoad }
      ]
    }];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'labs/performance', loadChildren: () => Promise.resolve(localRoutes) },
          { path: 'labs', component: OutsideComponent }
        ]),
        provideHttpClient(), provideHttpClientTesting()
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual
    });
    previousTitle = TestBed.inject(Title).getTitle();
    harness = await RouterTestingHarness.create('/labs/performance');
    harness.fixture.autoDetectChanges();
    await harness.fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
    TestBed.inject(Title).setTitle(previousTitle);
  });

  function root(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) throw new Error('Missing routed performance lab');
    return element;
  }

  function owner(): PayloadLifetime {
    const lifetime = harness.routeDebugElement?.injector.get(PayloadLifetime);
    if (!lifetime) throw new Error('Missing performance component provider');
    return lifetime;
  }

  async function follow(label: string): Promise<void> {
    const link = Array.from(root().querySelectorAll('a')).find(item => item.textContent?.trim() === label);
    if (!link) throw new Error(`Missing route link: ${label}`);
    const ended = firstValueFrom(TestBed.inject(Router).events.pipe(
      filter(event => event instanceof NavigationEnd), take(1)
    ));
    link.click();
    await ended;
    await harness.fixture.whenStable();
  }

  it('exports only the empty parent and two distinct lazy children with one preload opt-in', () => {
    expect(routes.length).toBe(1);
    const parent = routes[0];
    expect(parent?.path).toBe('');
    expect(parent?.component).toBe(PerformanceLabComponent);
    expect(parent?.data?.['performancePreload']).toBeUndefined();
    expect(parent?.children?.map(child => child.path)).toEqual(['demand', 'preloaded']);
    for (const child of parent?.children ?? []) {
      expect(child.component).toBeUndefined();
      expect(child.redirectTo).toBeUndefined();
      expect(child.loadComponent).toEqual(jasmine.any(Function));
      expect(child.data?.['performancePreload']).toBe(child.path === 'preloaded' ? true : undefined);
    }
  });

  it('enters without a default child, loader call, HTTP request or eager deferred instance', () => {
    expect(TestBed.inject(Router).url).toBe('/labs/performance');
    expect(root().querySelector('h1')?.textContent).toBe('Performance lab');
    expect(root().querySelector('app-demand-lesson, app-preload-lesson, app-deferred-summary')).toBeNull();
    expect(demandLoad).not.toHaveBeenCalled();
    expect(preloadLoad).not.toHaveBeenCalled();
    expect(owner().snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
    expect(root().querySelector('a[href="/labs/performance/demand"]')?.textContent).toBe('Load on demand');
    expect(root().querySelector('a[href="/labs/performance/preloaded"]')?.textContent).toBe('Open preload candidate');
  });

  it('follows both native router links and computes identical fixtures in distinct child components', async () => {
    const parent = root();
    await follow('Load on demand');
    expect(TestBed.inject(Router).url).toBe('/labs/performance/demand');
    expect(demandLoad).toHaveBeenCalledTimes(1);
    expect(preloadLoad).not.toHaveBeenCalled();
    const demandSummary = root().querySelector('[data-route-summary]')?.textContent;
    expect(demandSummary).toContain('200 fictional measurements');
    expect(demandSummary).toContain('total 20100 ms; average 100.5 ms');
    expect(root().querySelector('app-demand-lesson')).not.toBeNull();
    await follow('Open preload candidate');
    expect(TestBed.inject(Router).url).toBe('/labs/performance/preloaded');
    expect(preloadLoad).toHaveBeenCalledTimes(1);
    expect(root()).toBe(parent);
    expect(root().querySelector('app-demand-lesson')).toBeNull();
    expect(root().querySelector('app-preload-lesson')).not.toBeNull();
    expect(root().querySelector('[data-route-summary]')?.textContent).toBe(demandSummary);
    expect(root().querySelector('app-deferred-summary')).toBeNull();
  });

  it('supports direct child URLs and keeps the parent empty again on returning to its URL', async () => {
    await harness.navigateByUrl('/labs/performance/preloaded', PerformanceLabComponent);
    expect(root().querySelector('app-preload-lesson')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Preload candidate | Performance lab | Angular 22 Learning Store');
    await harness.navigateByUrl('/labs/performance/demand', PerformanceLabComponent);
    expect(root().querySelector('app-demand-lesson')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('On-demand lesson | Performance lab | Angular 22 Learning Store');
    await harness.navigateByUrl('/labs/performance', PerformanceLabComponent);
    expect(root().querySelector('app-demand-lesson, app-preload-lesson')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Performance lab | Angular 22 Learning Store');
  });

  it('reuses loaded route code on repeat navigation without claiming a second download', async () => {
    await harness.navigateByUrl('/labs/performance/demand');
    const first = root().querySelector('app-demand-lesson');
    await harness.navigateByUrl('/labs/performance/preloaded');
    await harness.navigateByUrl('/labs/performance/demand');
    expect(root().querySelector('app-demand-lesson')).not.toBe(first);
    expect(demandLoad).toHaveBeenCalledTimes(1);
    expect(preloadLoad).toHaveBeenCalledTimes(1);
    // Loader invocation counts are not network measurements of the emitted production chunks.
  });

  it('destroys the payload on All labs navigation and gives a revisit a fresh component owner', async () => {
    const lifetime = owner();
    const blocks = await harness.fixture.getDeferBlocks();
    expect(blocks.length).toBe(1);
    const current = blocks[0];
    if (!current) throw new Error('Missing routed defer block');
    await current.render(DeferBlockState.Complete);
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 0, active: 1 });
    await follow('All labs');
    expect(TestBed.inject(Router).url).toBe('/labs');
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 1, active: 0 });
    await harness.navigateByUrl('/labs/performance', PerformanceLabComponent);
    expect(owner()).not.toBe(lifetime);
    expect(owner().snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
    expect(root().querySelector<HTMLSelectElement>('#performance-trigger')?.value).toBe('interaction');
    expect(root().querySelector('app-deferred-summary')).toBeNull();
  });
});
