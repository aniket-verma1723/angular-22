import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { demoAdminGuard, safeReturnUrl, sessionGuard } from './session.guard';
import type { DemoRole } from './session.models';
import { SessionStore } from './session.store';

@Component({ selector: 'app-guard-test-page', template: '<h1>Isolated guard route</h1>' })
class GuardTestPage {}

describe('session navigation guards', () => {
  // No feature components: guarded screens must not accidentally issue real HTTP in these tests.
  const routes: Routes = [
    { path: 'login', component: GuardTestPage },
    { path: 'forbidden', component: GuardTestPage },
    { path: 'dashboard', component: GuardTestPage },
    { path: 'cart', component: GuardTestPage },
    { path: 'checkout', component: GuardTestPage, canActivate: [sessionGuard] },
    { path: 'products/new', component: GuardTestPage, canActivate: [demoAdminGuard] },
    { path: 'products/:id/edit', component: GuardTestPage, canActivate: [demoAdminGuard] },
    { path: 'products/:id', component: GuardTestPage },
    { path: 'products', component: GuardTestPage },
    { path: 'restricted', component: GuardTestPage, canActivate: [sessionGuard] }
  ];
  let store: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(), provideHttpClientTesting()
    ] });
    store = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    store.logout();
    TestBed.inject(HttpTestingController).verify();
  });

  function establish(role: DemoRole): void {
    store.establish({ id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner', role },
      crypto.randomUUID(), Date.now() + 30 * 60_000);
  }

  for (const path of ['/checkout', '/products/new', '/products/1/edit']) {
    it(`redirects a guest from ${path} to login with a safe return path`, async () => {
      await RouterTestingHarness.create(path);
      const result = router.parseUrl(router.url);
      expect(result.root.children['primary']?.segments.map(segment => segment.path)).toEqual(['login']);
      expect(result.queryParams).toEqual({ returnUrl: path });
    });
  }

  it('removes query parameters from a guest return path rather than forwarding nested redirects', async () => {
    await RouterTestingHarness.create('/checkout?returnUrl=https%3A%2F%2Fexternal.example.test&userId=999');
    expect(router.parseUrl(router.url).queryParams).toEqual({ returnUrl: '/checkout' });
  });

  it('uses the dashboard fallback for a guarded path outside the allowlist', async () => {
    await RouterTestingHarness.create('/restricted');
    expect(router.parseUrl(router.url).queryParams).toEqual({ returnUrl: '/dashboard' });
  });

  for (const path of ['/products/new', '/products/1/edit']) {
    it(`redirects a learner to forbidden for ${path}`, async () => {
      establish('learner');
      await RouterTestingHarness.create(path);
      expect(router.url).toBe('/forbidden');
      expect(store.currentUser()?.role).toBe('learner');
    });

    it(`allows locally selected demo-admin practice access to ${path}`, async () => {
      establish('demo-admin');
      await RouterTestingHarness.create(path);
      expect(router.url).toBe(path);
    });
  }

  for (const role of ['learner', 'demo-admin'] as const) {
    it(`allows authenticated checkout for ${role}`, async () => {
      establish(role);
      await RouterTestingHarness.create('/checkout');
      expect(router.url).toBe('/checkout');
    });
  }

  for (const path of ['/dashboard', '/cart', '/products', '/products/1']) {
    it(`allows anonymous browsing of ${path}`, async () => {
      await RouterTestingHarness.create(path);
      expect(router.url).toBe(path);
      expect(store.currentUser()).toBeNull();
    });
  }

  for (const path of ['/checkout', '/products/new']) {
    it(`rejects an expired session at ${path} even when its timer has not run`, async () => {
      establish('demo-admin');
      const expiredTime = Date.now() + 30 * 60_000;
      spyOn(Date, 'now').and.returnValue(expiredTime);
      await RouterTestingHarness.create(path);
      expect(router.parseUrl(router.url).queryParams).toEqual({ returnUrl: path });
      expect(router.url.startsWith('/login?')).toBeTrue();
      expect(store.currentUser()).toBeNull();
      expect(store.notice()).toContain('expired');
    });
  }

  it('requires login again after logout without blocking anonymous browsing', async () => {
    establish('learner');
    const harness = await RouterTestingHarness.create('/checkout');
    store.logout();
    await harness.navigateByUrl('/cart');
    expect(router.url).toBe('/cart');
    await harness.navigateByUrl('/checkout');
    expect(router.url.startsWith('/login?')).toBeTrue();
  });
});

describe('safeReturnUrl restrictive allowlist', () => {
  for (const path of ['/dashboard', '/cart', '/checkout', '/products', '/products/new', '/products/1', '/products/42/edit']) {
    it(`allows ${path}`, () => expect(safeReturnUrl(path)).toBe(path));
  }

  const rejected: readonly unknown[] = [
    null, undefined, 1, {}, [], '', '/', 'checkout', '/login', '/forbidden', '/users', '/unknown',
    'https://external.example.test/checkout', '//external.example.test/checkout', 'javascript:alert(1)',
    '/checkout?userId=2', '/products?returnUrl=/checkout', '/checkout#section',
    '/checkout/', '/Checkout', ' /checkout', '/checkout ', '/checkout\n',
    '/products/0', '/products/01/edit', '/products/-1', '/products/1.5', '/products/1/delete',
    '/products/1;role=demo-admin/edit', '/products/(primary:new)', '/products/../checkout',
    '/%63heckout', '/products%2fnew', '/%2fexternal.example.test', '/%252fexternal.example.test',
    '/\\external.example.test', '/products/1%3FuserId=2', `/products/${'1'.repeat(1001)}`
  ];
  for (const [index, value] of rejected.entries()) {
    it(`rejects non-allowlisted input ${index + 1} without preserving queries or encoding`, () => {
      expect(safeReturnUrl(value)).toBe('/dashboard');
    });
  }
});
