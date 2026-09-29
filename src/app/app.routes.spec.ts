import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from './app.config';
import { provideAppData } from './core/config/app-data.providers.mock';
import { SessionStore } from './core/session/session.store';
import { establishSessionFixture } from './testing/session-fixtures';
import { commentUiPage, postUiFixture, postUiPage, userUiFixture, userUiPage } from './testing/user-ui-fixtures';

describe('Learning routes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [...appConfig.providers, provideAppData(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('redirects the root to the overview and sets the page title', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Understand Angular');
    expect(TestBed.inject(Title).getTitle()).toBe('Overview | Angular 22 Learning Store');
  });

  const previews = [
    ['/settings', 'Settings'], ['/labs/signals', 'Lab preview']
  ] as const;

  for (const [url, heading] of previews) {
    it(`loads the honest placeholder for ${url}`, async () => {
      const harness = await RouterTestingHarness.create(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(harness.routeNativeElement?.textContent).toContain('Not implemented yet');
      expect(TestBed.inject(Title).getTitle()).toContain('Angular 22 Learning Store');
    });
  }

  it('does not allow query parameters to replace the editor route identity', async () => {
    establishSessionFixture(TestBed.inject(SessionStore));
    const harness = await RouterTestingHarness.create('/products/new?heading=Unexpected&plan=invalid');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Create product');
    expect(harness.routeNativeElement?.textContent).toContain('Signal Forms');
  });

  it('loads checkout empty state without sending a request or trusting a query user ID', async () => {
    establishSessionFixture(TestBed.inject(SessionStore));
    const harness = await RouterTestingHarness.create('/checkout?userId=999');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Checkout');
    expect(harness.routeNativeElement?.textContent).toContain('Your cart is empty');
    expect(harness.routeNativeElement?.textContent).toContain('Demo user 1');
    expect(harness.routeNativeElement?.textContent).not.toContain('Not implemented yet');
  });

  for (const [url, heading] of [['/products/new', 'Create product'], ['/products/1/edit', 'Edit product']]) {
    it(`loads the implemented P05 editor for ${url}`, async () => {
      establishSessionFixture(TestBed.inject(SessionStore));
      const harness = await RouterTestingHarness.create(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(harness.routeNativeElement?.textContent).toContain('Signal Forms');
      expect(harness.routeNativeElement?.textContent).not.toContain('Not implemented yet');
    });
  }

  for (const [url, heading] of [['/cart', 'Cart'], ['/labs', 'Angular labs'], ['/labs/component-state', 'Component state lab']]) {
    it(`loads the implemented P04 screen for ${url}`, async () => {
      const harness = await RouterTestingHarness.create(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(harness.routeNativeElement?.textContent).not.toContain('Not implemented yet');
    });
  }

  it('links and lazy-loads the local RxJS lab without public API requests', async () => {
    const harness = await RouterTestingHarness.create('/labs');
    expect(harness.routeNativeElement?.querySelector('a[href="/labs/rxjs"]')).not.toBeNull();
    await harness.navigateByUrl('/labs/rxjs');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('RxJS operator lab');
    expect(TestBed.inject(Title).getTitle()).toBe('RxJS operator lab | Angular 22 Learning Store');
    expect(harness.routeNativeElement?.textContent).toContain('virtual milliseconds');
    TestBed.inject(HttpTestingController).expectNone(() => true);
    await harness.navigateByUrl('/dashboard');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Understand Angular');
  });

  it('links and lazy-loads P12 without HTTP or starting a timer on entry', async () => {
    const harness = await RouterTestingHarness.create('/labs');
    expect(harness.routeNativeElement?.querySelector('a[href="/labs/zoneless"]')).not.toBeNull();
    await harness.navigateByUrl('/labs/zoneless');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Zoneless notification lab');
    expect(harness.routeNativeElement?.querySelector('[data-testid="probe-status"]')?.textContent).toContain('Idle');
    expect(TestBed.inject(Title).getTitle()).toBe('Zoneless lab | Angular 22 Learning Store');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  for (const [url, heading] of [
    ['/labs/components', 'Components lab'],
    ['/labs/di', 'Dependency injection workbench'],
    ['/labs/state', 'Reactive state workbench'],
    ['/labs/routing', 'Routing workbench'],
    ['/labs/resources', 'Resources comparison lab'],
    ['/labs/forms-signal', 'Signal Forms comparison'],
    ['/labs/forms-reactive', 'Typed Reactive Forms comparison'],
    ['/labs/forms-template', 'Template-driven preferences comparison']
  ]) {
    it(`links and lazy-loads P09 ${url} without startup HTTP`, async () => {
      const harness = await RouterTestingHarness.create('/labs');
      expect(harness.routeNativeElement?.querySelector(`a[href="${url}"]`)).not.toBeNull();
      await harness.navigateByUrl(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(TestBed.inject(Title).getTitle()).toContain('Angular 22 Learning Store');
      TestBed.inject(HttpTestingController).expectNone(() => true);
      await harness.navigateByUrl('/dashboard');
      expect(TestBed.inject(Router).url).toBe('/dashboard');
    });
  }

  for (const [url, heading] of [
    ['/labs/material', 'Material interaction lab'],
    ['/labs/material-dates', 'Material dates and time lab'],
    ['/labs/cdk', 'CDK lab']
  ]) {
    it(`links and lazy-loads P10 ${url} without startup HTTP`, async () => {
      const harness = await RouterTestingHarness.create('/labs');
      expect(harness.routeNativeElement?.querySelector(`a[href="${url}"]`)).not.toBeNull();
      await harness.navigateByUrl(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(TestBed.inject(Title).getTitle()).toBe(`${heading} | Angular 22 Learning Store`);
      TestBed.inject(HttpTestingController).expectNone(() => true);
      await harness.navigateByUrl('/dashboard');
      expect(TestBed.inject(Router).url).toBe('/dashboard');
    });
  }

  for (const [url, heading] of [['/products', 'Products'], ['/products/1', 'Product details']]) {
    it(`loads the implemented read screen for ${url}`, async () => {
      const harness = await RouterTestingHarness.create(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(harness.routeNativeElement?.textContent).toContain('P02 Mock Product');
      expect(harness.routeNativeElement?.textContent).not.toContain('Not implemented yet');
    });
  }

  for (const url of ['/unknown-page', '/products/1/unknown', '/posts']) {
    it(`shows recovery for unmatched URL ${url}`, async () => {
      const harness = await RouterTestingHarness.create(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Page not found');
      expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/dashboard');
    });
  }

  it('renders access-denied recovery without pretending to authenticate', async () => {
    const harness = await RouterTestingHarness.create('/forbidden');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Access denied');
  });

  for (const url of ['/checkout', '/products/new', '/products/4/edit']) {
    it(`redirects guests from ${url} without sending protected screen requests`, async () => {
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toContain('/login?returnUrl=');
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Your practice session');
      TestBed.inject(HttpTestingController).expectNone(() => true);
    });
  }

  it('denies learner editing but allows checkout for that same session', async () => {
    establishSessionFixture(TestBed.inject(SessionStore), { id: 2, role: 'learner' });
    const harness = await RouterTestingHarness.create('/products/new');
    expect(TestBed.inject(Router).url).toBe('/forbidden');
    await harness.navigateByUrl('/checkout');
    expect(harness.routeNativeElement?.textContent).toContain('Demo user 2');
  });
});

describe('Public users and posts routes', () => {
  const base = 'https://dummyjson.com';
  beforeEach(() => TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lazy-loads the public task board without a session or a placeholder', async () => {
    const harness = await RouterTestingHarness.create('/tasks');
    harness.fixture.autoDetectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne(req => req.url === `${base}/todos`);
    expect(request.request.params.get('limit')).toBe('10');
    request.flush({ todos: [], total: 0, skip: 0, limit: 10 });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Tasks');
    expect(harness.routeNativeElement?.textContent).toContain('Current page board');
    expect(harness.routeNativeElement?.textContent).not.toContain('Not implemented yet');
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });

  for (const [url, heading] of [['/users', 'Users & posts'], ['/users/1', 'User profile'], ['/posts/11', 'Post & comments']]) {
    it(`lazy-loads ${url} for guests as an implemented public read screen`, async () => {
      const harness = await RouterTestingHarness.create(url);
      harness.fixture.autoDetectChanges();
      const http = TestBed.inject(HttpTestingController);
      if (url === '/users') {
        http.expectOne(req => req.url === `${base}/users`).flush(userUiPage());
      } else if (url === '/users/1') {
        http.expectOne(req => req.url === `${base}/users/1`).flush(userUiFixture());
        http.expectOne(req => req.url === `${base}/posts/user/1`).flush(postUiPage());
      } else {
        http.expectOne(req => req.url === `${base}/posts/11`).flush(postUiFixture());
        http.expectOne(req => req.url === `${base}/users/1`).flush(userUiFixture());
        http.expectOne(req => req.url === `${base}/posts/11/comments`).flush(commentUiPage());
      }
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
      expect(harness.routeNativeElement?.textContent).not.toContain('Not implemented yet');
      expect(TestBed.inject(Title).getTitle()).toContain('Angular 22 Learning Store');
    });
  }

  for (const url of ['/users/0', '/posts/invalid']) {
    it(`renders invalid-link recovery at ${url} without a session or HTTP`, async () => {
      const harness = await RouterTestingHarness.create(url);
      expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain('Invalid');
      TestBed.inject(HttpTestingController).expectNone(() => true);
      expect(TestBed.inject(Router).url).toBe(url);
    });
  }
});
