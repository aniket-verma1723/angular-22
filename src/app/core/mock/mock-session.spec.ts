import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { CheckoutApiService } from '../../features/checkout/data/checkout-api.service';
import { provideAppData } from '../config/app-data.providers.mock';
import { LOGIN_ACCESS } from '../session/session-auth.interceptor';
import type { DemoCredentials } from '../session/session.models';
import { parseLogin } from '../session/session.parsers';
import { SessionService } from '../session/session.service';
import { SessionStore } from '../session/session.store';
import { MockProductBackend } from './mock-product-backend.service';

describe('Mock session through the real HTTP provider stack', () => {
  const baseUrl = 'https://dummyjson.com';
  // Documented public practice accounts, not application secrets.
  const accounts = [
    { credentials: { username: 'emilys', password: 'emilyspass' },
      profile: { id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson' } },
    { credentials: { username: 'learner', password: 'practice-only' },
      profile: { id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner' } }
  ] as const;
  let client: HttpClient;
  let mock: MockProductBackend;
  let service: SessionService;
  let store: SessionStore;

  beforeEach(() => {
    // Anything not intercepted hits a test backend, never the real network.
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    client = TestBed.inject(HttpClient);
    mock = TestBed.inject(MockProductBackend);
    service = TestBed.inject(SessionService);
    store = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    store.logout();
    TestBed.inject(HttpTestingController).verify();
  });

  function login(credentials: DemoCredentials = accounts[0].credentials): string {
    let token: string | undefined;
    client.post<unknown>(`${baseUrl}/auth/login`, { ...credentials, expiresInMins: 30 }).subscribe({
      next: value => { token = parseLogin(value).accessToken; },
      error: () => fail('Expected public mock login to succeed')
    });
    if (!token) throw new Error('Expected synchronous mock login');
    return token;
  }

  function me(token?: string): Observable<unknown> {
    return client.get<unknown>(`${baseUrl}/auth/me`, {
      context: token ? new HttpContext().set(LOGIN_ACCESS, token) : new HttpContext()
    });
  }

  function expectStatus(response$: Observable<unknown>, status: number): void {
    let receivedStatus: number | undefined;
    let emitted = false;
    response$.subscribe({
      next: () => { emitted = true; },
      error: (error: unknown) => { receivedStatus = error instanceof HttpErrorResponse ? error.status : undefined; }
    });
    // Only status/booleans enter matcher diagnostics, never a successful token response.
    expect(emitted).toBeFalse();
    expect(receivedStatus).toBe(status);
  }

  for (const account of accounts) {
    it(`logs in public account ${account.credentials.username} and verifies identity ${account.profile.id}`, () => {
      const token = login(account.credentials);
      expect(typeof token === 'string' && token.length > 0).toBeTrue();
      const next = jasmine.createSpy('public profile');
      me(token).subscribe({ next });
      expect(next).toHaveBeenCalledOnceWith(account.profile);
      const user = jasmine.createSpy('verified local user');
      service.login(account.credentials, 'learner').subscribe({ next: user });
      expect(user).toHaveBeenCalledOnceWith({ ...account.profile, role: 'learner' });
      expect(store.currentUser()).toEqual({ ...account.profile, role: 'learner' });
    });
  }

  it('returns 401 for wrong public credentials without creating a client session', () => {
    expectStatus(client.post(`${baseUrl}/auth/login`, {
      username: 'emilys', password: 'incorrect-public-demo-password', expiresInMins: 30
    }), 401);
    expect(store.currentUser()).toBeNull();
    expectStatus(me(), 401);
  });

  it('requires a recognized bearer for /me', () => {
    expectStatus(me(), 401);
    expectStatus(me(crypto.randomUUID()), 401);
    const token = login();
    // The interceptor removes a caller header when no session/candidate is approved.
    expectStatus(client.get(`${baseUrl}/auth/me`, { headers: { Authorization: `Basic ${token}` } }), 401);
    const next = jasmine.createSpy('recognized bearer profile');
    me(token).subscribe({ next });
    expect(next).toHaveBeenCalledOnceWith(accounts[0].profile);
  });

  it('generates a replacement token and invalidates the previous token for the same account', () => {
    const previous = login();
    const current = login();
    expect(current !== previous).toBeTrue();
    expectStatus(me(previous), 401);
    const next = jasmine.createSpy('replacement profile');
    me(current).subscribe({ next });
    expect(next).toHaveBeenCalledOnceWith(accounts[0].profile);
  });

  it('keeps tokens for different public accounts independent', () => {
    const first = login(accounts[0].credentials);
    const second = login(accounts[1].credentials);
    expect(first !== second).toBeTrue();
    me(first).subscribe(value => expect(value).toEqual(accounts[0].profile));
    me(second).subscribe(value => expect(value).toEqual(accounts[1].profile));
  });

  it('reset invalidates backend tokens and verification logs out the rejected current session', () => {
    service.login(accounts[0].credentials, 'demo-admin').subscribe();
    const token = store.accessToken();
    if (!token) throw new Error('Expected verified mock session');
    mock.reset();
    expect(store.currentUser()?.id).toBe(1);
    const next = jasmine.createSpy('rejected verification');
    service.verify().subscribe({ next, error: () => { /* ended$ may complete before error delivery. */ } });
    expect(next).not.toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expect(store.notice()).toContain('rejected');
    expect(service.busy()).toBeFalse();
    expectStatus(me(token), 401);
  });

  it('logout clears only the in-memory client session and does not implement a server logout or refresh', () => {
    service.login(accounts[0].credentials, 'learner').subscribe();
    store.logout();
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expectStatus(me(), 401);
    expectStatus(client.post(`${baseUrl}/auth/refresh`, {}), 501);
    expectStatus(client.post(`${baseUrl}/auth/logout`, {}), 501);
  });

  it('expires backend tokens at exactly 30 minutes', fakeAsync(() => {
    const token = login();
    tick(30 * 60_000 - 1);
    me(token).subscribe(value => expect(value).toEqual(accounts[0].profile));
    tick(1);
    expectStatus(me(token), 401);
  }));

  it('cancels delayed login before it can replace a previously issued token', fakeAsync(() => {
    const previous = login();
    mock.enqueue({ outcome: 'success', delayMs: 50 });
    let emitted = false;
    const pending = client.post(`${baseUrl}/auth/login`, { ...accounts[0].credentials, expiresInMins: 30 })
      .subscribe(() => { emitted = true; });
    pending.unsubscribe();
    tick(50);
    expect(emitted).toBeFalse();
    me(previous).subscribe(value => expect(value).toEqual(accounts[0].profile));
  }));

  for (const stage of ['login', 'me'] as const) {
    it(`logout cancels a delayed mock ${stage} and prevents a late session`, fakeAsync(() => {
      if (stage === 'me') mock.enqueue({ outcome: 'success' });
      mock.enqueue({ outcome: 'success', delayMs: 50 });
      const next = jasmine.createSpy('cancelled login');
      service.login(accounts[0].credentials, 'learner').subscribe({ next });
      expect(service.busy()).toBeTrue();
      expect(store.currentUser()).toBeNull();
      store.logout();
      tick(50);
      expect(next).not.toHaveBeenCalled();
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      expect(service.busy()).toBeFalse();
      service.login(accounts[1].credentials, 'learner').subscribe();
      expect(store.currentUser()?.id).toBe(2);
      store.logout();
    }));

    it(`reset invalidates a pending ${stage} generation without damaging a newer session`, fakeAsync(() => {
      const token = stage === 'me' ? login() : undefined;
      mock.enqueue({ outcome: 'success', delayMs: 50 });
      let status: number | undefined;
      let emitted = false;
      const pending$ = stage === 'me' ? me(token) : client.post(`${baseUrl}/auth/login`, {
        ...accounts[0].credentials, expiresInMins: 30
      });
      pending$.subscribe({
        next: () => { emitted = true; },
        error: (error: unknown) => { status = error instanceof HttpErrorResponse ? error.status : undefined; }
      });
      mock.reset();
      service.login(accounts[0].credentials, 'learner').subscribe();
      const current = store.accessToken();
      tick(50);
      expect(emitted).toBeFalse();
      expect(status).toBe(409);
      expect(store.accessToken() === current && current !== null).toBeTrue();
      service.verify().subscribe(value => expect(value.id).toBe(1));
      store.logout();
    }));
  }

  it('keeps login atomic when both mock stages are delayed and cancels at the total 15-second limit', fakeAsync(() => {
    mock.enqueue({ outcome: 'success', delayMs: 8_000 });
    mock.enqueue({ outcome: 'success', delayMs: 8_000 });
    const next = jasmine.createSpy('slow user');
    const error = jasmine.createSpy('login timeout');
    service.login(accounts[0].credentials, 'learner').subscribe({ next, error });
    tick(8_000);
    expect(store.currentUser()).toBeNull();
    expect(service.busy()).toBeTrue();
    tick(7_000);
    expect(error).toHaveBeenCalledTimes(1);
    expect(service.busy()).toBeFalse();
    tick(1_000);
    expect(next).not.toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
  }));

  for (const outcome of [401, 403, 503, 'network', 'malformed', 'empty'] as const) {
    it(`recovers from a queued ${outcome} login scenario without committing a session`, () => {
      mock.enqueue({ outcome });
      const error = jasmine.createSpy('scenario failure');
      service.login(accounts[0].credentials, 'learner').subscribe({ error });
      expect(error).toHaveBeenCalledTimes(1);
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      expect(service.busy()).toBeFalse();
      service.login(accounts[0].credentials, 'learner').subscribe();
      expect(store.currentUser()?.id).toBe(1);
    });
  }

  it('does not publish a candidate when the mock /me response is malformed', () => {
    mock.enqueue({ outcome: 'success' });
    mock.enqueue({ outcome: 'malformed' });
    const error = jasmine.createSpy('malformed profile');
    service.login(accounts[0].credentials, 'learner').subscribe({ error });
    expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'format' }));
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
  });

  it('uses the authenticated learner identity 2 for a mock checkout receipt', () => {
    service.login(accounts[1].credentials, 'learner').subscribe();
    const user = store.currentUser();
    if (!user) throw new Error('Expected a verified learner session');
    const next = jasmine.createSpy('checkout receipt');
    TestBed.inject(CheckoutApiService).create({ userId: user.id, products: [{ id: 4, quantity: 2 }] })
      .subscribe({ next });
    expect(next).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      source: 'mock', receipt: jasmine.objectContaining({ userId: 2, subtotalCents: 2000 })
    }));
    expect(store.currentUser()?.id).toBe(2);
  });
});
