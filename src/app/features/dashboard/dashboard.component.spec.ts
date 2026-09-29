import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { API_CONFIG, createApiConfig } from '../../core/config/api-config';
import { learningModuleList } from '../../core/learning/learning-modules';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [DashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  }));

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(() => true);
    http.verify();
  });

  it('links to every feature and distinguishes ready core labs from deferred settings and advanced lessons', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const previews = await loader.getAllHarnesses(MatButtonHarness.with({ text: /View module/ }));
    expect(previews.length).toBe(learningModuleList.length);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('mat-card .status-label').length).toBe(learningModuleList.length);
    expect(element.textContent).toContain('Browsing & editing ready');
    expect(element.textContent).toContain('Simulated checkout ready');
    const cards = Array.from(element.querySelectorAll('mat-card'));
    expect(cards.find(card => card.querySelector('.module-number')?.textContent === 'M05')
      ?.querySelector('.status-label')?.textContent).toBe('Demo session ready');
    expect(cards.find(card => card.querySelector('.module-number')?.textContent === 'M06')
      ?.querySelector('.status-label')?.textContent).toBe('Public reads ready');
    expect(cards.find(card => card.querySelector('.module-number')?.textContent === 'M07')
      ?.querySelector('.status-label')?.textContent).toBe('Tasks ready · P10 local drag/drop');
    expect(cards.find(card => card.querySelector('.module-number')?.textContent === 'M08')
      ?.querySelector('.status-label')?.textContent).toBe('Planned');
    expect(cards.find(card => card.querySelector('.module-number')?.textContent === 'M09')
      ?.querySelector('.status-label')?.textContent).toBe('P10–P12 labs implemented · advanced lessons later');
    expect(learningModuleList.find(module => module.id === 'M09')?.description)
      .toContain('P10 adds local Material interactions, independent date/time fixtures and CDK overlay, virtual selection and utilities.');
    expect(learningModuleList.find(module => module.id === 'M09')?.description)
      .toContain('P11 full follow-up delivers animation, profiling and image lessons alongside defer, opt-in preloading and quality tooling, not full curriculum completion or certification.');
    expect(learningModuleList.find(module => module.id === 'M09')?.description)
      .toContain('P13 SSR, settings/P14 and advanced lessons remain deferred.');
    expect(learningModuleList.find(module => module.id === 'M09')?.topics).toEqual([
      'Components, DI, state, resources & RxJS', 'Independent forms & Material date/time',
      'Material interactions & owned CDK experiments', 'Defer, preloading, animation, profiling & images',
      'Quality tooling & bounded measurements', 'Zoneless notifications & callback cleanup'
    ]);
    expect(learningModuleList.find(module => module.id === 'M08')?.description)
      .toContain('deferred to settings/P14');
    for (const module of learningModuleList) {
      expect(element.querySelector(`a[href="${module.path}"]`)).not.toBeNull();
    }
  });

  it('describes the P11 full follow-up, keeping certification limits, deferred milestones and public API boundaries explicit', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('No API requests are made before you select Load widgets; the RxJS recipes run locally.');
    expect(element.textContent).toContain('Remote demo · simulated writes');
    expect(element.querySelector('.page-heading .status-label')?.textContent)
      .toBe('P12 · zoneless application & notification lab');
    expect(element.textContent).toContain('P10 adds snapshot-validated same-column pointer drag/drop.');
    expect(element.textContent).toContain('P08 dashboard widgets and nine local RxJS recipes are implemented and verified within the recorded scope.');
    expect(element.textContent).not.toContain('verification pending');
    expect(element.textContent).not.toContain('verification of this slice is pending');
    expect(element.textContent).not.toContain('M06 verification is pending');
    expect(element.textContent).not.toContain('tasks awaiting verification');
    expect(element.querySelector('.next-step .eyebrow')?.textContent).toBe('Later milestones');
    expect(element.textContent).not.toContain('Up next · P11');
    expect(element.textContent).not.toContain('Up next · P12');
    expect(element.textContent).not.toContain('no automatic lint, E2E or accessibility-tool installs.');
    expect(element.textContent).toContain('P11 full follow-up delivers animation, profiling and image lessons alongside defer and opt-in preloading.');
    expect(element.textContent).toContain('Explore reduced-motion cleanup, method versus computed work and reserved fill-image fallbacks.');
    expect(element.textContent).toContain('Selected local tools are configured: ESLint, Playwright, axe, bundle auditing and browser measurements.');
    expect(element.textContent).toContain('This is not full curriculum completion or accessibility, security or performance certification.');
    expect(element.textContent).toContain('P09 core labs are delivered:');
    expect(element.textContent).toContain('P10 adds three lazy labs:');
    expect(element.textContent).toContain('Inputs are local experiments, not saved settings.');
    expect(element.textContent).toContain('this is not full curriculum completion.');
    expect(element.textContent).toContain('Settings remain a placeholder:');
    expect(element.textContent).toContain('deferred to settings/P14.');
    expect(element.textContent).toContain('Advanced lessons remain deferred;');
    expect(element.textContent).toContain('assignment and user filters are not session identity');
    expect(element.textContent).toContain('Profile task links open the board, not a nested tab.');
    expect(element.textContent).toContain('Drag and native Move up/down send no HTTP for order; Completed still uses the PATCH queue.');
    expect(element.textContent).toContain('CDK does not supply keyboard dragging.');
    expect(element.textContent).toContain('P13 SSR is next, followed by P14 settings.');
    expect(element.textContent).toContain('P12 enables zoneless application scheduling.');
    expect(element.querySelector('.next-step a[href="/labs/zoneless"]')?.textContent).toBe('Open zoneless lab');
    expect(element.textContent).toContain('not server authorization');
    expect(element.textContent).toContain('not a real shop');
    expect(element.querySelectorAll('h1').length).toBe(1);
  });

  it('promotes the Angular labs index and existing labs with idle widgets and no initial HTTP', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.hero-actions a').length).toBe(4);
    expect(element.querySelector('.hero-actions a[href="/labs"]')?.textContent).toBe('Open Angular labs');
    expect(element.querySelector('.hero-actions a[href="/products"]')).not.toBeNull();
    expect(element.querySelector('.hero-actions a[href="/labs/rxjs"]')?.textContent)
      .toContain('Try the RxJS recipes lab');
    expect(element.querySelector('.hero-actions a[href="/labs/component-state"]')).not.toBeNull();
    expect(element.querySelector('.next-step a[href="/labs/performance"]')?.textContent)
      .toBe('Open performance lab');
    const widgets = element.querySelector('.foundation + app-dashboard-widgets');
    expect(widgets).not.toBeNull();
    expect(element.querySelector('app-dashboard-widgets + section[aria-labelledby="modules-heading"]')).not.toBeNull();
    expect(widgets?.querySelector('h2')?.textContent).toBe('Public API widgets');
    expect(widgets?.querySelectorAll('[data-widget]').length).toBe(3);
    expect(widgets?.querySelector('button')?.textContent).toBe('Load widgets');
    expect(widgets?.textContent).toContain('Widgets idle. No data requested.');
    expect(widgets?.textContent).toContain('only the first 10 tasks, not global counts.');
    expect(widgets?.textContent).toContain('Not the authenticated user, not recent posts, and not a global post total.');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('describes delivered M06 topics without claiming nested tab routes', () => {
    const users = learningModuleList.find(module => module.id === 'M06');
    expect(users?.path).toBe('/users');
    expect(users?.topics).toEqual(['URL search & server pagination', 'Parallel reads & dependent author',
      'Scoped sharing, section retries & cancellation']);
  });

  it('describes P10 same-column local ordering separately from verified P08 writes', () => {
    const tasks = learningModuleList.find(module => module.id === 'M07');
    expect(tasks?.path).toBe('/tasks');
    expect(tasks?.description).toContain('retains its P08 verification');
    expect(tasks?.description).toContain('Assignment is not session identity');
    expect(tasks?.description).toContain('same-column pointer drag/drop alongside native Move up/down, with no HTTP for order.');
    expect(tasks?.description).toContain('completion still uses the PATCH queue.');
    expect(tasks?.topics).toEqual(['URL paging & public user filter',
      'Bounded concatMap queue & row-only rollback', 'Snapshot-validated CDK ordering & native Move up/down']);
  });

  it('labels the configured mock mode without offering a runtime mode switch', async () => {
    TestBed.overrideProvider(API_CONFIG, { useValue: createApiConfig('mock') });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Local mock · session-only data');
    expect(element.querySelectorAll('select').length).toBe(1);
    expect(element.querySelector('select')?.id).toBe('widget-strategy');
    expect(element.querySelector('app-dashboard-widgets')?.textContent).toContain('Widgets idle. No data requested.');
  });
});
