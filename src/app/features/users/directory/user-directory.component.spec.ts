import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { userUiFixture, userUiPage } from '../../../testing/user-ui-fixtures';

describe('User directory UI', () => {
  const base = 'https://dummyjson.com/users';
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let initial: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting(), provideLocationMocks()] });
    http = TestBed.inject(HttpTestingController);
    // Harness navigation does not bootstrap the application's browser-history listener.
    TestBed.inject(Router).setUpLocationChangeListener();
    harness = await RouterTestingHarness.create('/users');
    harness.fixture.autoDetectChanges();
    initial = http.expectOne(req => req.url === base);
  });
  afterEach(() => http.verify());

  function element(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) throw new Error('Directory is not routed');
    return element;
  }
  function input(): HTMLInputElement {
    const input = element().querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('Search input missing');
    return input;
  }
  function search(value: string): void { input().value = value; input().dispatchEvent(new Event('input')); }
  function ready(): void { initial.flush(userUiPage([userUiFixture()], 60)); harness.detectChanges(); }
  function click(text: string): void {
    const button = [...element().querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text));
    if (!button) throw new Error(`Missing button: ${text}`);
    button.click();
  }

  it('loads once and renders minimal names, avatar fallback, counts and links', () => {
    expect(element().textContent).toContain('Loading users');
    initial.flush(userUiPage([userUiFixture()], 60)); harness.detectChanges();
    expect(element().querySelector('table')?.getAttribute('aria-label')).toBe('Public users');
    expect(element().textContent).toContain('Ada Reader');
    expect(element().textContent).toContain('60 users · 10 on this page · offset 0');
    expect(element().querySelector('td a')?.getAttribute('href')).toBe('/users/1');
    expect(element().querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('Ada Reader');
    expect(element().querySelector('[aria-label="User results"]')?.getAttribute('aria-busy')).toBe('false');
    http.expectNone(req => req.url === base);
  });

  it('debounces for 300 ms, normalizes terms and avoids equivalent-query requests', fakeAsync(() => {
    ready(); search('A'); tick(150); search(' Ada '); tick(299);
    http.expectNone(req => req.url.endsWith('/search'));
    tick(1);
    const request = http.expectOne(req => req.url === `${base}/search`);
    expect(request.request.params.get('q')).toBe('Ada');
    expect(TestBed.inject(Router).url).toBe('/users?q=Ada');
    request.flush(userUiPage());
    search('Ada  '); tick(300);
    http.expectNone(req => req.url.startsWith(base));
    expect(input().value).toBe('Ada');
  }));

  it('keeps the mounted search control focused through a query navigation', fakeAsync(() => {
    ready(); const field = input(); field.focus(); search('Grace'); tick(300);
    http.expectOne(req => req.url === `${base}/search`).flush(userUiPage());
    tick();
    expect(input()).toBe(field);
    expect(field.ownerDocument.activeElement).toBe(field);
  }));

  it('cancels stale requests when newer queries arrive', async () => {
    await harness.navigateByUrl('/users?q=Grace');
    expect(initial.cancelled).toBeTrue();
    http.expectOne(req => req.url === `${base}/search`).flush(userUiPage([userUiFixture({ firstName: 'Grace' })]));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('Grace Reader');
    expect(element().textContent).not.toContain('Ada Reader');
  });

  it('canonicalizes duplicate/default/unknown query keys without reloading an equivalent query', async () => {
    ready();
    await harness.navigateByUrl('/users?q=Ada&q=Grace&page=2&page=3&pageSize=10&extra=x');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/users');
    http.expectNone(req => req.url.startsWith(base));
  });

  it('canonicalizes a new initial query before reusing its single HTTP read', async () => {
    initial.flush(userUiPage());
    await harness.navigateByUrl('/dashboard');
    await harness.navigateByUrl('/users?q=%20Ada%20&page=02&pageSize=25&unknown=1');
    const request = http.expectOne(req => req.url === `${base}/search`);
    expect(request.request.params.get('q')).toBe('Ada');
    expect(request.request.params.get('skip')).toBe('25');
    request.flush(userUiPage([], 0, 25, 25));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/users?q=Ada&page=2&pageSize=25');
    expect(input().value).toBe('Ada');
    http.expectNone(req => req.url.startsWith(base));
  });

  it('paginates on the server, resets size changes and preserves the query on profile links', fakeAsync(() => {
    ready();
    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    void loader.getHarness(MatPaginatorHarness).then(paginator => paginator.goToNextPage()); tick();
    const second = http.expectOne(req => req.url === base);
    expect(second.request.params.get('skip')).toBe('10');
    second.flush(userUiPage([userUiFixture({ id: 11 })], 60, 10));
    tick();
    void loader.getHarness(MatPaginatorHarness).then(paginator => paginator.setPageSize(25)); tick();
    const resized = http.expectOne(req => req.url === base);
    expect(resized.request.params.get('skip')).toBe('0');
    expect(resized.request.params.get('limit')).toBe('25');
    resized.flush(userUiPage([userUiFixture()], 60, 0, 25));
    tick();
    expect(TestBed.inject(Router).url).toBe('/users?pageSize=25');
    expect(element().querySelector('td a')?.getAttribute('href')).toBe('/users/1?pageSize=25');
  }));

  for (const page of ['9007199254740992', '900719925474100']) {
    it(`requests the safe first page when directory URL page ${page} overflows`, async () => {
      ready();
      await harness.navigateByUrl('/users?q=Ada&page=2');
      http.expectOne(req => req.url === `${base}/search`).flush(userUiPage([userUiFixture()], 60, 10));
      await harness.navigateByUrl(`/users?page=${page}`);
      const request = http.expectOne(req => req.url === base);
      expect(request.request.params.get('skip')).toBe('0');
      expect(request.request.params.get('limit')).toBe('10');
      request.flush(userUiPage());
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/users');
      expect(element().textContent).toContain('1 users · 1 on this page · offset 0');
      expect(element().textContent).not.toContain('Invalid service response');
      http.expectNone(() => true);
    });
  }

  it('cancels pending search on pagination rather than applying it later', fakeAsync(() => {
    ready(); search('stale'); tick(100);
    const next = element().querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    if (!next) throw new Error('Next page missing');
    next.click(); tick();
    http.expectOne(req => req.url === base).flush(userUiPage([userUiFixture()], 60, 10));
    tick(300);
    expect(TestBed.inject(Router).url).toBe('/users?page=2');
    expect(input().value).toBe('');
    http.expectNone(req => req.url.endsWith('/search'));
  }));

  it('cancels a pending draft when clear keeps the same URL, then accepts new edits', fakeAsync(() => {
    ready(); search('stale'); tick(100); click('Clear search'); tick(400);
    expect(input().value).toBe('');
    expect(TestBed.inject(Router).url).toBe('/users');
    http.expectNone(req => req.url.startsWith(base));
    search('fresh'); tick(300);
    http.expectOne(req => req.url.endsWith('/search')).flush(userUiPage());
  }));

  for (const url of ['/users', '/users?q=Ada&page=2']) {
    it(`restores search input focus when clearing from ${url}`, async () => {
      ready();
      if (url !== '/users') {
        await harness.navigateByUrl(url);
        http.expectOne(req => req.url === `${base}/search`).flush(userUiPage([userUiFixture()], 60, 10));
      }
      const field = input();
      const loader = TestbedHarnessEnvironment.loader(harness.fixture);
      const clear = await loader.getHarness(MatButtonHarness.with({ text: 'Clear search' }));
      await clear.focus();
      expect(await clear.isFocused()).toBeTrue();
      await clear.click();
      if (url !== '/users') http.expectOne(req => req.url === base).flush(userUiPage());
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/users');
      expect(input()).toBe(field);
      expect(field.value).toBe('');
      expect(field.ownerDocument.activeElement).toBe(field);
      http.expectNone(() => true);
    });
  }

  it('restores Back/Forward query state and cancels an uncommitted draft', fakeAsync(() => {
    ready();
    void TestBed.inject(Router).navigateByUrl('/users?q=Ada&page=2&pageSize=25'); tick();
    http.expectOne(req => req.url.endsWith('/search')).flush(userUiPage([userUiFixture()], 60, 25, 25));
    search('stale'); tick(100);
    TestBed.inject(Location).back(); tick();
    http.expectOne(req => req.url === base).flush(userUiPage());
    tick(300);
    expect(input().value).toBe('');
    expect(TestBed.inject(Router).url).toBe('/users');
    TestBed.inject(Location).forward(); tick();
    const restored = http.expectOne(req => req.url.endsWith('/search'));
    expect(restored.request.params.get('q')).toBe('Ada');
    expect(restored.request.params.get('skip')).toBe('25');
    restored.flush(userUiPage([userUiFixture()], 60, 25, 25)); tick();
    expect(input().value).toBe('Ada');
    http.expectNone(req => req.params.get('q') === 'stale');
  }));

  it('recovers from a read error on explicit retry without a navigation', async () => {
    initial.error(new ProgressEvent('error')); harness.detectChanges();
    expect(element().textContent).toContain('Connection problem');
    click('Retry users');
    http.expectOne(req => req.url === base).flush(userUiPage());
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('Ada Reader');
  });

  it('keeps searches alive after a malformed response', fakeAsync(() => {
    initial.flush({ users: [{ id: 'wrong' }], total: 1, skip: 0, limit: 10 }); tick();
    expect(element().textContent).toContain('Invalid service response');
    search('Ada'); tick(300);
    http.expectOne(req => req.url.endsWith('/search')).flush(userUiPage()); tick();
    expect(element().textContent).toContain('Ada Reader');
  }));

  it('renders an empty result without pretending it is an error', () => {
    initial.flush(userUiPage([])); harness.detectChanges();
    expect(element().textContent).toContain('No users found');
    expect(element().textContent).toContain('0 users');
    expect(element().querySelector('[role="alert"]')).toBeNull();
  });

  it('offers first-page recovery from an out-of-range URL', fakeAsync(() => {
    ready(); void TestBed.inject(Router).navigateByUrl('/users?page=99'); tick();
    http.expectOne(req => req.url === base).flush(userUiPage([], 60, 980));
    tick(); click('Go to first page'); tick();
    http.expectOne(req => req.url === base).flush(userUiPage());
    tick();
    expect(TestBed.inject(Router).url).toBe('/users');
  }));

  it('cancels outstanding reads on destruction', async () => {
    await harness.navigateByUrl('/dashboard');
    expect(initial.cancelled).toBeTrue();
  });

  it('does not revive an abandoned debounce after leaving and returning', fakeAsync(() => {
    ready(); search('abandoned'); tick(100);
    void TestBed.inject(Router).navigateByUrl('/dashboard'); tick();
    void TestBed.inject(Router).navigateByUrl('/users'); tick();
    http.expectOne(req => req.url === base).flush(userUiPage()); tick(400);
    http.expectNone(req => req.url.endsWith('/search'));
    expect(input().value).toBe('');
  }));
});
