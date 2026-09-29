import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAppData } from '../../core/config/app-data.providers';
import { SessionStore } from '../../core/session/session.store';
import { DashboardWidgetsComponent } from './dashboard-widgets.component';
import type { WidgetId, WidgetStrategy } from './widget-composition';

const BASE = 'https://dummyjson.com';
const STRATEGIES: readonly WidgetStrategy[] = ['independent', 'combineLatest', 'forkJoin'];
const users = Array.from({ length: 4 }, (_, index) => ({ id: index + 1,
  firstName: `Person${index + 1}`, lastName: 'Example', image: null, email: 'not-rendered@example.test' }));
const tasks = Array.from({ length: 10 }, (_, index) => ({ id: index + 1,
  userId: index + 1, todo: `Public task ${index + 1}`, completed: index % 2 === 0 }));
const posts = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, userId: 1,
  title: `Public title ${index + 1}`, body: 'Body omitted from dashboard' }));
// Short pages have matching totals; a larger total is used only with a full ten-row page.
const responses = {
  users: { users, total: 4, skip: 0, limit: 10 },
  tasks: { todos: tasks, total: 42, skip: 0, limit: 10 },
  posts: { posts, total: 4, skip: 0, limit: 10 }
};

describe('DashboardWidgetsComponent public HTTP behavior', () => {
  let fixture: ComponentFixture<DashboardWidgetsComponent>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DashboardWidgetsComponent],
      providers: [provideRouter([]), provideAppData(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    fixture = TestBed.createComponent(DashboardWidgetsComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });
  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    session.logout();
    http.verify();
  });

  function button(label: string): HTMLButtonElement {
    const match = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
    if (!match) throw new Error(`Missing button: ${label}`);
    return match;
  }

  function click(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  function select(strategy: string): void {
    const control = element.querySelector('select');
    if (!control) throw new Error('Missing strategy select');
    control.value = strategy;
    control.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function card(id: WidgetId): HTMLElement {
    const match = element.querySelector<HTMLElement>(`[data-widget="${id}"]`);
    if (!match) throw new Error(`Missing widget: ${id}`);
    return match;
  }

  function requests(): Record<WidgetId, TestRequest> {
    const group = {
      users: http.expectOne(req => req.url === `${BASE}/users`),
      tasks: http.expectOne(req => req.url === `${BASE}/todos`),
      posts: http.expectOne(req => req.url === `${BASE}/posts/user/1`)
    };
    http.expectNone(() => true);
    return group;
  }

  function flush(group: Record<WidgetId, TestRequest>): void {
    group.users.flush(responses.users);
    group.tasks.flush(responses.tasks);
    group.posts.flush(responses.posts);
    fixture.detectChanges();
  }

  it('starts idle and never sends HTTP on creation or strategy changes before Load widgets', () => {
    expect(element.querySelector('select')?.value).toBe('independent');
    expect(element.querySelector('label')?.htmlFor).toBe('widget-strategy');
    expect(element.querySelector('select')?.getAttribute('aria-describedby')).toBe('strategy-help');
    expect(element.querySelectorAll('[role="status"]').length).toBe(1);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Widgets idle');
    expect(element.querySelectorAll('article[aria-busy="false"]').length).toBe(3);
    expect(button('Load widgets').disabled).toBeFalse();
    for (const strategy of STRATEGIES) select(strategy);
    select('invalid');
    http.expectNone(() => true);
    expect(element.textContent).toContain('only on request');
    expect(element.querySelectorAll('a').length).toBe(0);
  });

  it('renders all five learning labels and accurate composition and public-scope guidance', () => {
    expect(Array.from(element.querySelectorAll('dt')).map(item => item.textContent?.trim())).toEqual([
      'Concept', 'Try it', 'Angular mechanism', 'Common mistake', 'Revision question'
    ]);
    for (const text of ['None is universally better', 'never-completing input', 'EMPTY', '15-second response timeout',
      'not a global post total', 'Not the authenticated user', 'not recent posts', 'only the first 10 tasks',
      'No automatic caching, polling or refresh']) {
      expect(element.textContent).toContain(text);
    }
    expect(element.querySelectorAll('h2').length).toBe(1);
    expect(element.querySelectorAll('h3').length).toBe(3);
    expect(element.querySelectorAll('button:not([type="button"])').length).toBe(0);
  });

  for (const strategy of STRATEGIES) {
    it(`${strategy} keeps healthy results when a pending domain reaches the service timeout`, fakeAsync(() => {
      select(strategy);
      click('Load widgets');
      const group = requests();
      group.users.flush(responses.users);
      group.posts.flush(responses.posts);
      tick(14_999);
      fixture.detectChanges();
      expect(card('tasks').getAttribute('aria-busy')).toBe('true');
      tick(1);
      fixture.detectChanges();
      expect(group.tasks.cancelled).toBeTrue();
      expect(card('tasks').textContent).toContain('This public data could not be loaded');
      expect(card('users').textContent).toContain('Total: 4');
      expect(card('posts').textContent).toContain('Total: 4');
      expect(element.querySelector('[role="status"]')?.textContent).toContain('2 loaded · 0 empty · 1 failed');
      http.expectNone(() => true);
    }));

    it(`${strategy} sends exactly one public first-page request per domain and renders bounded previews`, () => {
      session.establish({ id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner', role: 'learner' },
        crypto.randomUUID(), Date.now() + 60_000);
      select(strategy);
      const load = button('Load widgets');
      load.click();
      load.click(); // Before the DOM's disabled binding updates, the component still guards admission.
      fixture.detectChanges();
      const group = requests();
      for (const req of Object.values(group)) {
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('skip')).toBe('0');
        expect(req.request.params.get('limit')).toBe('10');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        expect(req.request.withCredentials).toBeFalse();
        expect(req.request.credentials).toBe('omit');
      }
      expect(group.users.request.params.keys().sort()).toEqual(['limit', 'select', 'skip']);
      expect(group.users.request.params.get('select')).toBe('id,firstName,lastName,image');
      expect(group.tasks.request.params.keys().sort()).toEqual(['limit', 'skip']);
      expect(group.posts.request.params.keys().sort()).toEqual(['limit', 'select', 'skip']);
      expect(group.posts.request.params.get('select')).toBe('id,title,body,userId');
      expect(element.querySelectorAll('article[aria-busy="true"]').length).toBe(3);
      expect(load.disabled).toBeTrue();
      flush(group);
      expect(card('users').textContent).toContain('Total: 4');
      expect(card('posts').textContent).toContain('Total: 4');
      expect(card('tasks').textContent).toContain('Total: 42');
      expect(card('tasks').textContent).toContain('10 returned of the first 10 tasks');
      expect(card('tasks').textContent).toContain('5 completed · 5 incomplete');
      expect(card('users').querySelectorAll('li a').length).toBe(3);
      expect(card('posts').querySelectorAll('li a').length).toBe(3);
      for (const id of [1, 2, 3]) {
        expect(card('users').querySelector(`a[href="/users/${id}"]`)?.textContent).toBe(`Person${id} Example`);
        expect(card('posts').querySelector(`a[href="/posts/${id}"]`)?.textContent).toBe(`Public title ${id}`);
      }
      expect(card('tasks').querySelector('a')?.getAttribute('href')).toBe('/tasks');
      expect(element.textContent).not.toContain('Person4 Example');
      expect(element.textContent).not.toContain('Public title 4');
      expect(element.textContent).not.toContain('not-rendered@example.test');
      expect(element.textContent).not.toContain('Body omitted from dashboard');
      expect(element.querySelector('[role="status"]')?.textContent).toContain('0 loading · 3 loaded');
      expect(session.currentUser()?.id).toBe(2);
      click('Load widgets');
      select(strategy); // Reselecting the same strategy is not an implicit refresh.
      http.expectNone(() => true);
    });

    it(`${strategy} renders valid zero-total pages as empty rather than errors`, () => {
      select(strategy);
      click('Load widgets');
      const group = requests();
      group.users.flush({ users: [], total: 0, skip: 0, limit: 10 });
      group.tasks.flush({ todos: [], total: 0, skip: 0, limit: 10 });
      group.posts.flush({ posts: [], total: 0, skip: 0, limit: 10 });
      fixture.detectChanges();
      for (const id of ['users', 'tasks', 'posts'] as const) {
        expect(card(id).textContent).toContain(`Total: 0. No ${id} found`);
        expect(card(id).getAttribute('aria-busy')).toBe('false');
      }
      expect(element.querySelector('[role="status"]')?.textContent).toContain('3 empty · 0 failed');
      expect(element.querySelectorAll('li a').length).toBe(0);
      http.expectNone(() => true);
    });

    it(`${strategy} cancels all outstanding requests on component destruction`, () => {
      select(strategy);
      click('Load widgets');
      const group = requests();
      fixture.destroy();
      for (const req of Object.values(group)) expect(req.cancelled).toBeTrue();
      http.expectNone(() => true);
    });

    for (const next of STRATEGIES.filter(value => value !== strategy)) {
      it(`cancels ${strategy} when changing to ${next}, with no hidden duplicate variants`, () => {
        select(strategy);
        click('Load widgets');
        const old = requests();
        select(next);
        for (const req of Object.values(old)) expect(req.cancelled).toBeTrue();
        const fresh = requests();
        flush(fresh);
        expect(element.querySelector('[role="status"]')?.textContent).toContain('3 loaded');
        http.expectNone(() => true);
      });
    }
  }

  for (const strategy of ['independent', 'combineLatest'] as const) {
    it(`${strategy} cancels an individual retry on destruction`, () => {
      select(strategy);
      click('Load widgets');
      const group = requests();
      group.users.flush(responses.users);
      group.posts.flush(responses.posts);
      group.tasks.flush({}, { status: 503, statusText: 'Unavailable' });
      fixture.detectChanges();
      click('Retry tasks');
      const retry = http.expectOne(req => req.url === `${BASE}/todos`);
      fixture.destroy();
      expect(retry.cancelled).toBeTrue();
      http.expectNone(() => true);
    });

    it(`${strategy} renders partial progress and repeatedly retries only a failed widget`, () => {
      select(strategy);
      click('Load widgets');
      const group = requests();
      group.users.flush(responses.users);
      fixture.detectChanges();
      expect(card('users').textContent).toContain('Total: 4');
      expect(card('tasks').getAttribute('aria-busy')).toBe('true');
      expect(card('posts').getAttribute('aria-busy')).toBe('true');
      group.tasks.flush({ message: 'Untrusted upstream details' }, { status: 503, statusText: 'Unavailable' });
      fixture.detectChanges();
      expect(card('tasks').textContent).toContain('temporarily unavailable');
      expect(element.textContent).not.toContain('Untrusted upstream details');
      const retry = button('Retry tasks');
      retry.click();
      retry.click();
      fixture.detectChanges();
      const firstRetry = http.expectOne(req => req.url === `${BASE}/todos`);
      http.expectNone(() => true);
      expect(card('users').textContent).toContain('Total: 4');
      expect(card('tasks').getAttribute('aria-busy')).toBe('true');
      expect(group.posts.cancelled).toBeFalse();
      group.posts.flush(responses.posts);
      firstRetry.error(new ProgressEvent('error'));
      fixture.detectChanges();
      expect(card('tasks').textContent).toContain('Unable to reach the service');
      click('Retry tasks');
      const secondRetry = http.expectOne(req => req.url === `${BASE}/todos`);
      http.expectNone(() => true);
      secondRetry.flush(responses.tasks);
      fixture.detectChanges();
      expect(element.querySelector('[role="status"]')?.textContent).toContain('3 loaded');
      expect(element.textContent).not.toContain('Retry tasks');
      http.expectNone(() => true);
    });

    it(`${strategy} cancels an in-flight individual retry and healthy pending siblings on strategy change`, () => {
      select(strategy);
      click('Load widgets');
      const group = requests();
      group.tasks.flush({}, { status: 500, statusText: 'Unavailable' });
      fixture.detectChanges();
      click('Retry tasks');
      const retry = http.expectOne(req => req.url === `${BASE}/todos`);
      select('forkJoin');
      expect(retry.cancelled).toBeTrue();
      expect(group.users.cancelled).toBeTrue();
      expect(group.posts.cancelled).toBeTrue();
      flush(requests());
    });
  }

  it('forkJoin waits for every response, preserves partial errors, and reloads the entire snapshot only once', () => {
    select('forkJoin');
    click('Load widgets');
    const group = requests();
    group.users.flush(responses.users);
    group.tasks.flush({}, { status: 500, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.querySelectorAll('article[aria-busy="true"]').length).toBe(3);
    expect(card('users').textContent).not.toContain('Total: 4');
    expect(button('Reload snapshot').disabled).toBeTrue();
    click('Reload snapshot');
    http.expectNone(() => true);
    group.posts.flush(responses.posts);
    fixture.detectChanges();
    expect(card('users').textContent).toContain('Total: 4');
    expect(card('tasks').textContent).toContain('temporarily unavailable');
    expect(card('posts').textContent).toContain('Total: 4');
    expect(card('tasks').querySelector('button')).toBeNull();
    const reload = button('Reload snapshot');
    reload.click();
    reload.click();
    fixture.detectChanges();
    flush(requests());
    expect(element.querySelector('[role="status"]')?.textContent).toContain('3 loaded');
    click('Reload snapshot'); // A completed snapshot is not silently cached.
    const another = requests();
    fixture.destroy();
    for (const req of Object.values(another)) expect(req.cancelled).toBeTrue();
  });

  it('forkJoin keeps all three failures visible and can recover through Reload snapshot', () => {
    select('forkJoin');
    click('Load widgets');
    for (const req of Object.values(requests())) req.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('3 failed');
    expect(element.querySelectorAll('.error').length).toBe(3);
    click('Reload snapshot');
    flush(requests());
    expect(element.querySelector('[role="status"]')?.textContent).toContain('3 loaded');
  });

  for (const id of ['users', 'tasks', 'posts'] as const) {
    for (const fault of ['total', 'skip', 'count'] as const) {
      it(`rejects inconsistent ${id} ${fault} metadata without discarding healthy sections`, () => {
        click('Load widgets');
        const group = requests();
        const response = responses[id];
        const invalid = fault === 'total' ? { ...response, total: 0 }
          : fault === 'skip' ? { ...response, skip: 1 }
          : { ...response, [id === 'tasks' ? 'todos' : id]: [] };
        group[id].flush(invalid);
        for (const other of ['users', 'tasks', 'posts'] as const) {
          if (other !== id) group[other].flush(responses[other]);
        }
        fixture.detectChanges();
        expect(card(id).textContent).toContain('The service returned an invalid response.');
        expect(element.querySelector('[role="status"]')?.textContent).toContain('2 loaded · 0 empty · 1 failed');
        click(`Retry ${id}`);
        const retry = http.expectOne(() => true);
        retry.flush(response);
        fixture.detectChanges();
        expect(element.querySelector('[role="status"]')?.textContent).toContain('3 loaded');
        http.expectNone(() => true);
      });
    }
  }

  it('does not treat a public 401 as a session/logout operation or reveal its body', () => {
    session.establish({ id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner', role: 'learner' },
      crypto.randomUUID(), Date.now() + 60_000);
    click('Load widgets');
    const group = requests();
    group.users.flush({}, { status: 401, statusText: 'Unauthorized' });
    group.tasks.flush(responses.tasks);
    group.posts.flush({ message: 'Untrusted upstream details' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(session.currentUser()?.id).toBe(2);
    expect(card('posts').textContent).toContain('This public data could not be loaded');
    expect(element.textContent).not.toContain('Untrusted upstream details');
    http.expectNone(() => true);
  });

  it('renders short task pages with page-local counts based on returned rows, not a fixed ten', () => {
    click('Load widgets');
    const group = requests();
    group.users.flush(responses.users);
    group.tasks.flush({ todos: tasks.slice(0, 1), total: 1, skip: 0, limit: 10 });
    group.posts.flush(responses.posts);
    fixture.detectChanges();
    expect(card('tasks').textContent).toContain('Total: 1');
    expect(card('tasks').textContent).toContain('1 returned of the first 10 tasks');
    expect(card('tasks').textContent).toContain('1 completed · 0 incomplete');
  });
});
