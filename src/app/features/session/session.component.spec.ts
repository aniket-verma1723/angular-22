import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, provideZoneChangeDetection } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_CONFIG, createApiConfig } from '../../core/config/api-config';
import { sessionAuthInterceptor } from '../../core/session/session-auth.interceptor';
import { SessionService } from '../../core/session/session.service';
import { SessionStore } from '../../core/session/session.store';
import { productFixture } from '../../testing/product-fixtures';
import { CartService } from '../cart/data/cart.service';
import { routes } from './session.routes';

@Component({ template: '<h1>Destination</h1>' })
class DestinationComponent {}

describe('Demo session screen', () => {
  const base = 'https://dummyjson.com/auth';
  const profile = { id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson' };
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let store: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideZoneChangeDetection(),
      provideRouter([
        { path: 'login', children: routes },
        { path: 'dashboard', component: DestinationComponent },
        { path: 'checkout', component: DestinationComponent }
      ]),
      provideHttpClient(withInterceptors([sessionAuthInterceptor])), provideHttpClientTesting()
    ] });
  });
  afterEach(() => { http.verify(); store.logout(); });

  async function open(url = '/login'): Promise<void> {
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    harness = await RouterTestingHarness.create(url);
    harness.fixture.autoDetectChanges();
    await settle();
  }
  function loader() { return TestbedHarnessEnvironment.loader(harness.fixture); }
  async function button(text: string) { return loader().getHarness(MatButtonHarness.with({ text })); }
  async function input(id: string) { return loader().getHarness(MatInputHarness.with({ selector: `#${id}` })); }
  function element<T extends Element>(selector: string): T {
    const found = harness.routeNativeElement?.querySelector<T>(selector);
    if (!found) throw new Error(`Expected session element: ${selector}`);
    return found;
  }
  function text(): string { return harness.routeNativeElement?.textContent ?? ''; }
  // Harness stabilization waits for the service's 15-second timeout. Use native
  // controls while HTTP is intentionally pending, then settle after flush/cancel.
  function nativeButton(label: string): HTMLButtonElement {
    const found = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? [])
      .find(control => control.textContent?.trim() === label);
    if (!found) throw new Error(`Expected session button: ${label}`);
    return found;
  }
  function click(label: string): void { nativeButton(label).click(); harness.detectChanges(); }
  function send(): void {
    element('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
  }
  async function settle(): Promise<void> { await harness.fixture.whenStable(); harness.detectChanges(); }
  async function fill(): Promise<void> { await (await button('Fill public demo values')).click(); }
  async function signedIn(): Promise<void> {
    await fill(); send();
    http.expectOne(`${base}/login`).flush({ ...profile, accessToken: crypto.randomUUID() });
    http.expectOne(`${base}/me`).flush(profile);
    await settle();
  }

  it('loads the standalone screen lazily with empty inputs, labels and a learner default', async () => {
    await open();
    expect(text()).toContain('Remote demo · DummyJSON');
    expect(text()).toContain('emilys');
    expect(text()).toContain('emilyspass');
    expect(await (await input('demo-username')).getValue()).toBe('');
    expect(await (await input('demo-password')).getValue()).toBe('');
    expect(await (await loader().getHarness(MatSelectHarness)).getValueText()).toBe('Learner');
    expect(element<HTMLInputElement>('#demo-password').type).toBe('password');
    expect(element('form').getAttribute('autocomplete')).toBe('off');
    for (const id of ['demo-username', 'demo-password']) {
      expect(element(`#${id}`).getAttribute('autocomplete')).toBe('off');
      expect(element(`label[for="${id}"]`).textContent).toContain('Public demo');
    }
    expect(text()).toContain('NOT server privileges');
    expect(text()).toContain('30 minutes');
    http.expectNone(() => true);
  });

  it('shows required Material errors and focuses the first invalid control without HTTP', async () => {
    await open(); send(); await settle();
    expect(text()).toContain('Enter the public demo username.');
    expect(text()).toContain('Enter the public demo password.');
    expect(document.activeElement?.id).toBe('demo-username');
    http.expectNone(() => true);
  });

  it('rejects whitespace-only values with rendered errors and permits no request', async () => {
    await open();
    await (await input('demo-username')).setValue('   ');
    await (await input('demo-password')).setValue('   ');
    send(); await settle();
    expect(text()).toContain('Username cannot be blank.');
    expect(text()).toContain('Password cannot be blank.');
    http.expectNone(() => true);
  });

  it('enforces the 100/200 length limits and focuses an invalid password', async () => {
    await open(); await fill();
    await (await input('demo-username')).setValue('u'.repeat(101));
    await (await input('demo-password')).setValue('p'.repeat(201));
    send(); await settle();
    expect(text()).toContain('Username must be at most 100 characters.');
    expect(text()).toContain('Password must be at most 200 characters.');
    await (await input('demo-username')).setValue('emilys'); send(); await settle();
    expect(document.activeElement?.id).toBe('demo-password');
    http.expectNone(() => true);
  });

  it('accepts boundary lengths without trimming the password', async () => {
    await open();
    await (await input('demo-username')).setValue('u'.repeat(100));
    await (await input('demo-password')).setValue(' ' + 'p'.repeat(199)); send();
    const request = http.expectOne(`${base}/login`);
    expect(request.request.body.username.length).toBe(100);
    expect(request.request.body.password.length).toBe(200);
    expect(request.request.body.password.startsWith(' ')).toBeTrue();
    click('Cancel sign in'); await settle();
    expect(request.cancelled).toBeTrue();
  });

  it('toggles visibility accessibly without submitting or changing the value', async () => {
    await open(); await fill();
    await (await button('Show password')).click();
    expect(element<HTMLInputElement>('#demo-password').type).toBe('text');
    expect(element('button[aria-controls="demo-password"]').getAttribute('aria-pressed')).toBe('true');
    await (await button('Hide password')).click();
    expect(element<HTMLInputElement>('#demo-password').type).toBe('password');
    expect(await (await input('demo-password')).getValue()).toBe('emilyspass');
    http.expectNone(() => true);
  });

  it('sends one exact POST without role and publishes no user until the matching /me response', async () => {
    await open('/login?returnUrl=%2Fcheckout'); await fill();
    await (await loader().getHarness(MatSelectHarness)).clickOptions({ text: 'Demo admin' });
    await (await input('demo-username')).setValue('  emilys  ');
    send(); send();
    const request = http.expectOne(`${base}/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'emilys', password: 'emilyspass', expiresInMins: 30 });
    expect(request.request.credentials).toBe('omit');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(element<HTMLInputElement>('#demo-username').disabled).toBeTrue();
    expect(nativeButton('Cancel sign in').disabled).toBeFalse();
    const token = crypto.randomUUID();
    request.flush({ ...profile, accessToken: token });
    expect(store.user()).toBeNull();
    expect(text()).not.toContain('Session summary');
    const me = http.expectOne(`${base}/me`);
    expect(me.request.method).toBe('GET');
    expect(me.request.headers.has('Authorization')).toBeTrue();
    send(); http.expectNone(`${base}/login`);
    me.flush(profile); await settle();
    expect(store.user()).toEqual({ ...profile, role: 'demo-admin' });
    expect(text()).toContain('Emily Johnson');
    expect(text()).toContain('demo-admin');
    expect(text().includes(token)).toBeFalse();
    expect(harness.routeNativeElement?.querySelector('input[type="password"]')).toBeNull();
    expect(document.activeElement?.id).toBe('session-summary-heading');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fcheckout');
    expect(element('a').getAttribute('href')).toBe('/checkout');
    element<HTMLAnchorElement>('a').click(); await settle();
    expect(TestBed.inject(Router).url).toBe('/checkout');
  });

  it('rejects a mismatched candidate/profile atomically and clears the password', async () => {
    await open(); await fill(); send();
    http.expectOne(`${base}/login`).flush({ ...profile, accessToken: crypto.randomUUID() });
    http.expectOne(`${base}/me`).flush({ ...profile, id: 2 }); await settle();
    expect(store.user()).toBeNull();
    expect(text()).toContain('Login and profile identities do not match.');
    expect(await (await input('demo-password')).getValue()).toBe('');
    expect(await (await input('demo-username')).getValue()).toBe('emilys');
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    http.expectNone(() => true);
  });

  for (const phase of ['login', 'me']) {
    it(`clears the password after ${phase} failure and retries only on an explicit valid submission`, async () => {
      await open(); await fill(); await (await button('Show password')).click(); send();
      const login = http.expectOne(`${base}/login`);
      if (phase === 'me') login.flush({ ...profile, accessToken: crypto.randomUUID() });
      const failing = phase === 'login' ? login : http.expectOne(`${base}/me`);
      failing.flush({}, { status: 503, statusText: 'Unavailable' }); await settle();
      expect(store.user()).toBeNull();
      expect(text()).toContain('The service is temporarily unavailable.');
      expect(await (await input('demo-password')).getValue()).toBe('');
      expect(element<HTMLInputElement>('#demo-password').type).toBe('password');
      expect(await (await input('demo-username')).getValue()).toBe('emilys');
      expect(document.activeElement?.getAttribute('role')).toBe('alert');
      send(); await settle(); http.expectNone(() => true);
      await signedIn(); expect(text()).toContain('Session summary');
    });

    it(`cancels pending ${phase} via the store and keeps username and cart`, async () => {
      const cart = TestBed.inject(CartService); cart.add(productFixture());
      await open(); await fill(); send();
      const login = http.expectOne(`${base}/login`);
      if (phase === 'me') login.flush({ ...profile, accessToken: crypto.randomUUID() });
      const pending = phase === 'login' ? login : http.expectOne(`${base}/me`);
      const logout = spyOn(store, 'logout').and.callThrough();
      click('Cancel sign in'); await settle();
      expect(logout).toHaveBeenCalledTimes(1);
      expect(pending.cancelled).toBeTrue();
      expect(store.user()).toBeNull();
      expect(TestBed.inject(SessionService).busy()).toBeFalse();
      expect(await (await input('demo-password')).getValue()).toBe('');
      expect(await (await input('demo-username')).getValue()).toBe('emilys');
      expect(document.activeElement?.id).toBe('demo-username');
      expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
      expect(cart.lines().length).toBe(1);
      http.expectNone(() => true);
    });

    it(`allows route navigation to cancel pending ${phase} without a dirty guard`, async () => {
      await open(); await fill(); send();
      const login = http.expectOne(`${base}/login`);
      if (phase === 'me') login.flush({ ...profile, accessToken: crypto.randomUUID() });
      const pending = phase === 'login' ? login : http.expectOne(`${base}/me`);
      expect(await TestBed.inject(Router).navigateByUrl('/dashboard')).toBeTrue(); await settle();
      expect(pending.cancelled).toBeTrue();
      expect(store.user()).toBeNull();
      expect(TestBed.inject(SessionService).busy()).toBeFalse();
      await harness.navigateByUrl('/login'); await settle();
      expect(await (await input('demo-password')).getValue()).toBe('');
      http.expectNone(() => true);
    });
  }

  it('ends a timed-out sign-in without retry and clears its password', async () => {
    await open(); await fill();
    fakeAsync(() => {
      send(); const pending = http.expectOne(`${base}/login`);
      tick(15001); flushMicrotasks(); harness.detectChanges();
      expect(pending.cancelled).toBeTrue();
      expect(store.user()).toBeNull();
      expect(element<HTMLInputElement>('#demo-password').value).toBe('');
      expect(text()).toContain('Session operation could not finish');
      http.expectNone(() => true);
    })();
  });

  it('verifies explicitly, gates duplicate verification and leaves logout enabled', async () => {
    await open(); await signedIn();
    click('Verify session'); click('Verify session');
    const verification = http.expectOne(`${base}/me`);
    expect(verification.request.method).toBe('GET');
    expect(verification.request.headers.has('Authorization')).toBeTrue();
    expect(nativeButton('Verify session').disabled).toBeTrue();
    expect(nativeButton('Log out').disabled).toBeFalse();
    verification.flush(profile); await settle();
    expect(text()).toContain('Session verified with GET /auth/me.');
    expect(text()).toContain('original expiry is unchanged');
    expect(await (await button('Verify session')).isDisabled()).toBeFalse();
    http.expectNone(() => true);
  });

  it('logs out during verification, cancels it and retains the anonymous cart', async () => {
    const cart = TestBed.inject(CartService); cart.add(productFixture());
    await open(); await signedIn(); click('Verify session');
    const pending = http.expectOne(`${base}/me`);
    click('Log out'); await settle();
    expect(pending.cancelled).toBeTrue();
    expect(store.user()).toBeNull();
    expect(text()).toContain('Your anonymous cart is kept');
    expect(cart.lines().length).toBe(1);
    expect(await (await input('demo-password')).getValue()).toBe('');
    expect(await (await input('demo-username')).getValue()).toBe('emilys');
    expect(text()).not.toContain('Session summary');
    http.expectNone(() => true);
  });

  it('cancels verification on navigation without logging out an established session', async () => {
    await open(); await signedIn(); click('Verify session');
    const pending = http.expectOne(`${base}/me`);
    await harness.navigateByUrl('/dashboard'); await settle();
    expect(pending.cancelled).toBeTrue();
    expect(store.user()?.username).toBe('emilys');
    expect(TestBed.inject(SessionService).busy()).toBeFalse();
  });

  it('reports verification failures without automatic retry', async () => {
    await open(); await signedIn(); click('Verify session');
    http.expectOne(`${base}/me`).flush({}, { status: 503, statusText: 'Unavailable' }); await settle();
    expect(text()).toContain('The service is temporarily unavailable.');
    expect(store.user()?.id).toBe(1);
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    expect(await (await button('Log out')).isDisabled()).toBeFalse();
    http.expectNone(() => true);
  });

  it('reacts to query-only returnUrl changes, allowing exactly one safe path', async () => {
    await open(); await signedIn();
    for (const query of [
      '', '?returnUrl=https%3A%2F%2Fevil.example', '?returnUrl=%2F%2Fevil.example',
      '?returnUrl=%2Fcheckout&returnUrl=%2Fcart', '?returnUrl=%2Fcheckout&returnUrl=%2Fcheckout',
      '?returnUrl=%2Fproducts%3Badmin%3Dtrue', '?returnUrl=%2Fcheckout%3FreturnUrl%3D%2Fcart',
      '?returnUrl=%2Flogin', '?returnUrl=%252Fcheckout', '?returnUrl=%2Fproducts%23fragment'
    ]) {
      await harness.navigateByUrl(`/login${query}`); await settle();
      expect(element('a').getAttribute('href')).withContext(query).toBe('/dashboard');
    }
    await harness.navigateByUrl('/login?returnUrl=%2Fproducts%2F1%2Fedit'); await settle();
    expect(element('a').getAttribute('href')).toBe('/products/1/edit');
    http.expectNone(() => true);
  });

  it('shows mock-specific public hints and fills only after a click', async () => {
    TestBed.overrideProvider(API_CONFIG, { useValue: createApiConfig('mock') });
    await open();
    expect(text()).toContain('Local mock · no remote sign-in');
    expect(text()).toContain('practice-only');
    expect(await (await input('demo-password')).getValue()).toBe('');
    await fill(); send();
    const request = http.expectOne(`${base}/login`);
    expect(request.request.body).toEqual({ username: 'learner', password: 'practice-only', expiresInMins: 30 });
    const learner = { id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner' };
    request.flush({ ...learner, accessToken: crypto.randomUUID() });
    http.expectOne(`${base}/me`).flush(learner); await settle();
    expect(store.user()).toEqual({ ...learner, role: 'learner' });
  });
});
