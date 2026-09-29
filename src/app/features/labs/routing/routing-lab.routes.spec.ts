import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, afterNextRender } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, take } from 'rxjs';
import { RoutingDetailComponent } from './routing-detail.component';
import { RoutingLabComponent } from './routing-lab.component';
import { RoutingLabSession, parseLabId } from './routing-lab-session.service';
import { routes } from './routing-lab.routes';
import { RoutingHelpComponent } from './routing-pages.component';

@Component({ selector: 'app-routing-outside-test', template: '<h1>Outside lab</h1>' })
class OutsideComponent {}

describe('Routing lab lazy routes', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let session: RoutingLabSession;
  let previousTitle: string;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([
        { path: 'labs/routing', loadChildren: () => Promise.resolve(routes) },
        { path: 'outside', component: OutsideComponent }
      ], withComponentInputBinding()), provideLocationMocks()
    ] });
    router = TestBed.inject(Router);
    previousTitle = TestBed.inject(Title).getTitle();
    router.setUpLocationChangeListener();
    harness = await RouterTestingHarness.create('/labs/routing');
    const owner = harness.routeDebugElement?.injector.get(RoutingLabSession);
    if (!owner) throw new Error('Missing local route provider');
    session = owner;
  });
  afterEach(() => { session.cancel(); TestBed.inject(Title).setTitle(previousTitle); });

  function detail(): RoutingDetailComponent {
    const instance = harness.routeDebugElement?.query(By.directive(RoutingDetailComponent))?.injector.get(RoutingDetailComponent);
    if (!instance) throw new Error('Missing detail outlet');
    return instance;
  }
  function text(): string { return harness.routeNativeElement?.textContent ?? ''; }

  it('redirects the empty path locally and renders a lazy resolved detail without HTTP providers', () => {
    expect(router.url).toBe('/labs/routing/workspace/1');
    expect(detail().id()).toBe(1);
    expect(detail().fixture()?.name).toBe('Signal notebook');
    expect(session.calls()).toBe(1);
    expect(session.active()).toBe(1);
    expect(harness.routeNativeElement?.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
  });

  it('retains the default component instance across IDs, but destroys it on departure', async () => {
    const first = detail(); first.setNote('retained note');
    await harness.navigateByUrl('/labs/routing/workspace/2', RoutingLabComponent);
    expect(detail()).toBe(first); expect(detail().id()).toBe(2); expect(detail().note()).toBe('retained note');
    expect(session.active()).toBe(1); expect(session.destroyedDetails()).toBe(0);
    await harness.navigateByUrl('/labs/routing/matched');
    expect(session.active()).toBe(0); expect(session.destroyedDetails()).toBe(1);
    await harness.navigateByUrl('/labs/routing/workspace/1');
    expect(detail()).not.toBe(first); expect(detail().note()).toBe('');
    // A destroyed component must not receive later route input bindings.
    expect(first.id()).toBe(2);
  });

  it('reruns on path/query changes but not fragments', async () => {
    await harness.navigateByUrl('/labs/routing/workspace/1?revision=2#route-detail');
    expect(session.calls()).toBe(2); expect(detail().revision()).toBe('2');
    expect(detail().fragment()).toBe('route-detail');
    await harness.navigateByUrl('/labs/routing/workspace/1?revision=2#other');
    expect(session.calls()).toBe(2); expect(detail().fragment()).toBe('other');
    await harness.navigateByUrl('/labs/routing/workspace/2?revision=2');
    expect(session.calls()).toBe(3);
    await harness.navigateByUrl('/labs/routing/workspace/2?revision=2&revision=3');
    expect(detail().revision()).toBe('1');
  });

  it('binds the real detail inputs, validates query values and resets removed inputs on the reused instance', async () => {
    const first = detail();
    await harness.navigateByUrl('/labs/routing/workspace/2?revision=9&id=999&fixture=untrusted');
    expect(detail()).toBe(first);
    expect(first.id()).toBe(2);
    expect(first.fixture()).toEqual({ id: 2, name: 'Injector notebook' });
    expect(first.revision()).toBe('9');
    for (const query of ['revision=', 'revision=0', 'revision=10', 'revision=1%0A', 'revision=2&revision=2', '']) {
      await harness.navigateByUrl(`/labs/routing/workspace/2${query ? '?' + query : ''}`);
      expect(detail()).toBe(first);
      expect(first.revision()).withContext(query || 'removed query').toBe('1');
    }
  });

  it('keeps the old detail while pending and activates the next fixture on controlled completion', async () => {
    session.setMode('controlled');
    const started = firstValueFrom(session.started$.pipe(take(1)));
    const navigation = harness.navigateByUrl('/labs/routing/workspace/2');
    await started;
    expect(session.status()).toBe('resolving'); expect(detail().id()).toBe(1);
    session.release(); await navigation;
    expect(session.status()).toBe('resolved'); expect(detail().id()).toBe(2);
    expect(session.mode()).toBe('controlled');
  });

  it('resets persistent route configuration on real parent departure before the revisit resolver starts', async () => {
    session.setMode('controlled');
    session.toggleMatch();
    const started = firstValueFrom(session.started$.pipe(take(1)));
    const pending = harness.navigateByUrl('/labs/routing/workspace/2');
    await started;
    await harness.navigateByUrl('/outside', OutsideComponent);
    await pending;
    expect(session.status()).toBe('cancelled');
    expect(session.mode()).toBe('immediate');
    expect(session.matchAllowed()).toBeTrue();
    await harness.navigateByUrl('/labs/routing');
    expect(harness.routeDebugElement?.injector.get(RoutingLabSession)).toBe(session);
    expect(detail().id()).toBe(1);
    expect(session.status()).toBe('resolved');
    session.togglePermission();
    await harness.navigateByUrl('/labs/routing/workspace/2');
    expect(router.url).toContain('reason=permission');
    expect(session.permission()).toBeFalse();
    await harness.navigateByUrl('/outside');
    await harness.navigateByUrl('/labs/routing');
    expect(session.permission()).toBeTrue();
    expect(detail().fixture()?.id).toBe(1);
  });

  it('recovers from a controlled resolver error through a redirect and allows a deliberate retry', async () => {
    session.setMode('controlled');
    const started = firstValueFrom(session.started$.pipe(take(1)));
    const navigation = harness.navigateByUrl('/labs/routing/workspace/2');
    await started; session.fail(); await navigation;
    expect(router.url).toBe('/labs/routing/recovery?reason=resolver');
    expect(session.status()).toBe('failed'); expect(text()).toContain('Resolver failed');
    session.setMode('immediate');
    await harness.navigateByUrl('/labs/routing/workspace/2');
    expect(detail().fixture()?.id).toBe(2);
  });

  it('recovers from immediate errors and missing fixtures without leaking errors to navigation', async () => {
    session.setMode('error');
    await harness.navigateByUrl('/labs/routing/workspace/2');
    expect(router.url).toContain('reason=resolver');
    session.setMode('immediate');
    await harness.navigateByUrl('/labs/routing/workspace/999');
    expect(router.url).toContain('reason=resolver');
    expect(text()).toContain('fixture was missing');
  });

  it('cancels navigation for empty completion and for a superseding navigation', async () => {
    session.setMode('controlled');
    let started = firstValueFrom(session.started$.pipe(take(1)));
    let navigation = harness.navigateByUrl('/labs/routing/workspace/2');
    await started; session.cancel(); await navigation;
    expect(router.url).toBe('/labs/routing/workspace/1'); expect(session.status()).toBe('cancelled');
    started = firstValueFrom(session.started$.pipe(take(1)));
    navigation = harness.navigateByUrl('/labs/routing/workspace/2');
    await started;
    await harness.navigateByUrl('/outside', OutsideComponent); await navigation;
    expect(session.status()).toBe('cancelled'); expect(session.active()).toBe(0);
    session.release(); expect(router.url).toBe('/outside');
  });

  it('returns child and match guard redirects, with no resolver call while denied', async () => {
    session.togglePermission();
    await harness.navigateByUrl('/labs/routing/workspace/2');
    expect(router.url).toContain('reason=permission'); expect(session.calls()).toBe(1);
    session.toggleMatch();
    await harness.navigateByUrl('/labs/routing/matched');
    expect(router.url).toContain('reason=match');
    session.toggleMatch();
    await harness.navigateByUrl('/labs/routing/matched'); expect(text()).toContain('canMatch admitted');
    session.togglePermission();
    await harness.navigateByUrl('/labs/routing/workspace/1'); expect(detail().id()).toBe(1);
  });

  it('rejects malformed path IDs before resolving and preserves local wildcard recovery', async () => {
    for (const id of ['0', '-1', '01', '1.5', '9007199254740992', 'bad']) {
      await harness.navigateByUrl(`/labs/routing/workspace/${id}`);
      expect(router.url).toContain('reason=invalid');
    }
    expect(session.calls()).toBe(1);
    await harness.navigateByUrl('/labs/routing/unknown/path');
    expect(text()).toContain('Unknown local URL');
    expect(router.url).toBe('/labs/routing/unknown/path');
  });

  it('blocks departure through canDeactivate until the control is released', async () => {
    const first = detail(); first.toggleLeave();
    await harness.navigateByUrl('/labs/routing/matched');
    expect(router.url).toBe('/labs/routing/workspace/1'); expect(detail()).toBe(first);
    expect(text()).toContain('Navigation cancelled or redirected');
    first.toggleLeave(); await harness.navigateByUrl('/labs/routing/matched');
    expect(session.active()).toBe(0);
    expect(text()).not.toContain('Navigation cancelled or redirected');
    expect(text()).toContain('NavigationCancel');
  });

  it('opens and closes the named help outlet without replacing the primary instance or title', async () => {
    const first = detail();
    await harness.navigateByUrl('/labs/routing/(workspace/1//help:help)');
    expect(harness.routeDebugElement?.query(By.directive(RoutingHelpComponent))).not.toBeNull();
    expect(detail()).toBe(first);
    expect(TestBed.inject(Title).getTitle()).toBe('Notebook 1 | Routing lab | Angular 22 Learning Store');
    await harness.navigateByUrl('/labs/routing/workspace/1');
    expect(harness.routeDebugElement?.query(By.directive(RoutingHelpComponent))).toBeNull();
    expect(detail()).toBe(first);
  });

  it('matches only the static recipe allowlist, rejecting extras and matrix parameters', async () => {
    for (const topic of ['signals', 'di']) {
      await harness.navigateByUrl(`/labs/routing/recipe/${topic}`);
      expect(text()).toContain(`Validated recipe: ${topic}`);
    }
    for (const path of ['recipe/unknown', 'recipe/signals/extra', 'recipe/di;unexpected=1']) {
      await harness.navigateByUrl(`/labs/routing/${path}`); expect(text()).toContain('Unknown local URL');
    }
  });

  it('uses the actual help control and restores its focus on close', async () => {
    harness.fixture.autoDetectChanges();
    const button = harness.routeNativeElement?.querySelector<HTMLButtonElement>('button[aria-controls="routing-help"]');
    if (!button) throw new Error('Missing help button');
    const first = detail();
    let ended = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    button.click(); await ended; harness.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(harness.routeDebugElement?.query(By.directive(RoutingHelpComponent))).not.toBeNull();
    button.blur();
    ended = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    button.click(); await ended; await harness.fixture.whenStable();
    const injector = harness.routeDebugElement?.injector;
    if (!injector) throw new Error('Missing routing parent injector');
    // Read after the component's focus callback, not merely after NavigationEnd or a timer.
    const focused = new Promise<boolean>(resolve => afterNextRender({
      read: () => resolve(button.ownerDocument.activeElement === button)
    }, { injector }));
    harness.detectChanges();
    expect(await focused).toBeTrue();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(harness.routeDebugElement?.query(By.directive(RoutingHelpComponent))).toBeNull();
    expect(detail()).toBe(first);
  });

  it('keeps every primary routing title consistent with the shell suffix', async () => {
    for (const [path, title] of [
      ['workspace/2', 'Notebook 2'], ['matched', 'Matched route'],
      ['recipe/signals', 'Recipe matcher'], ['recovery', 'Recovery'], ['unknown', 'Unknown local route']
    ]) {
      await harness.navigateByUrl(`/labs/routing/${path}`);
      expect(TestBed.inject(Title).getTitle()).toBe(`${title} | Routing lab | Angular 22 Learning Store`);
    }
  });

  it('restores query, fragment and allowlisted navigation state using mock history', async () => {
    const location = TestBed.inject(Location);
    await router.navigateByUrl('/labs/routing/workspace/1?revision=2#route-detail', { state: { labMarker: 'sample', ignored: 'not rendered' } });
    harness.detectChanges();
    expect(detail().revision()).toBe('2'); expect(text()).toContain('History marker (allowlisted): sample');
    expect(text()).not.toContain('not rendered');
    await harness.navigateByUrl('/labs/routing/workspace/2');
    const ended = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    location.back(); await ended; harness.detectChanges();
    expect(detail().id()).toBe(1); expect(detail().revision()).toBe('2'); expect(detail().fragment()).toBe('route-detail');
    expect(text()).toContain('History marker (allowlisted): sample');
    const forward = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    location.forward(); await forward; harness.detectChanges(); expect(detail().id()).toBe(2);
  });

  it('bounds router observations, stops them on departure and includes all five learning labels', async () => {
    for (let revision = 2; revision <= 9; revision++) await harness.navigateByUrl(`/labs/routing/workspace/1?revision=${revision}`);
    const list = harness.routeNativeElement?.querySelector('ol');
    expect(list?.children.length).toBe(12);
    const detachedText = list?.textContent;
    for (const section of Array.from(harness.routeNativeElement?.querySelectorAll('section') ?? [])) {
      for (const label of ['Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question']) expect(section.textContent).toContain(label);
    }
    await harness.navigateByUrl('/outside');
    expect(list?.textContent).toBe(detachedText);
    expect(session.active()).toBe(0);
  });
});

describe('parseLabId', () => {
  it('rejects unsafe, noncanonical, whitespace and non-string values', () => {
    for (const value of [null, undefined, 1, '', '0', '+1', '01', '1e2', '1\n', ' 1', '9007199254740992']) expect(parseLabId(value)).toBeNull();
    expect(parseLabId('1')).toBe(1); expect(parseLabId('9007199254740991')).toBe(9007199254740991);
  });
});
