import { HttpClient, HttpContext, HttpParams, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG, createApiConfig } from '../config/api-config';
import { LOGIN_ACCESS, sessionAuthInterceptor } from './session-auth.interceptor';
import { SessionStore } from './session.store';

describe('sessionAuthInterceptor', () => {
  const baseUrl = 'https://api.example.test/v1';
  const endpoint = `${baseUrl}/auth/me`;
  const user = { id: 1, username: 'demo', firstName: 'Demo', lastName: 'User', role: 'learner' } as const;
  let client: HttpClient;
  let http: HttpTestingController;
  let store: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: API_CONFIG, useValue: createApiConfig('remote', baseUrl) },
      provideHttpClient(withInterceptors([sessionAuthInterceptor])),
      provideHttpClientTesting()
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    store.logout();
    http.verify();
  });

  function establish(): string {
    const token = crypto.randomUUID();
    store.establish(user, token, Date.now() + 30 * 60_000);
    return token;
  }

  it('attaches bearer only to the configured origin and base-path GET /auth/me and omits cookies', () => {
    const token = establish();
    client.get(endpoint, { withCredentials: true, credentials: 'include' }).subscribe();
    const request = http.expectOne(endpoint);
    // Compare booleans so a failing assertion cannot print token contents.
    expect(request.request.headers.get('Authorization') === `Bearer ${token}`).toBeTrue();
    expect(request.request.withCredentials).toBeFalse();
    expect(request.request.credentials).toBe('omit');
    request.flush(user);
  });

  it('uses the unpublished login candidate rather than an existing session token', () => {
    establish();
    const candidate = crypto.randomUUID();
    client.get(endpoint, { context: new HttpContext().set(LOGIN_ACCESS, candidate) }).subscribe();
    const request = http.expectOne(endpoint);
    expect(request.request.headers.get('Authorization') === `Bearer ${candidate}`).toBeTrue();
    expect(request.request.credentials).toBe('omit');
    request.flush(user);
  });

  it('removes caller-supplied authorization on approved anonymous reads and omits cookies', () => {
    client.get(endpoint, {
      headers: { Authorization: `Bearer ${crypto.randomUUID()}` }, withCredentials: true, credentials: 'include'
    }).subscribe();
    const request = http.expectOne(endpoint);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.withCredentials).toBeFalse();
    expect(request.request.credentials).toBe('omit');
    request.flush(user);
  });

  const excluded = [
    ['login', 'POST', `${baseUrl}/auth/login`],
    ['refresh', 'POST', `${baseUrl}/auth/refresh`],
    ['products read', 'GET', `${baseUrl}/products`],
    ['product mutation', 'POST', `${baseUrl}/products/add`],
    ['carts read', 'GET', `${baseUrl}/carts/1`],
    ['checkout write', 'POST', `${baseUrl}/carts/add`],
    ['external origin', 'GET', 'https://external.example.test/v1/auth/me'],
    ['lookalike hostname', 'GET', 'https://api.example.test.evil.test/v1/auth/me'],
    ['different scheme', 'GET', 'http://api.example.test/v1/auth/me'],
    ['different port', 'GET', 'https://api.example.test:444/v1/auth/me'],
    ['missing base path', 'GET', 'https://api.example.test/auth/me'],
    ['lookalike base path', 'GET', 'https://api.example.test/v10/auth/me'],
    ['lookalike endpoint', 'GET', `${baseUrl}/auth/me-extra`],
    ['trailing slash', 'GET', `${endpoint}/`],
    ['query string', 'GET', `${endpoint}?view=public`],
    ['fragment', 'GET', `${endpoint}#profile`],
    ['userinfo', 'GET', 'https://demo@api.example.test/v1/auth/me'],
    ['relative URL', 'GET', '/v1/auth/me'],
    ['protocol-relative URL', 'GET', '//api.example.test/v1/auth/me'],
    ['malformed URL', 'GET', 'http://[invalid'],
    ['POST me', 'POST', endpoint], ['PUT me', 'PUT', endpoint],
    ['PATCH me', 'PATCH', endpoint], ['DELETE me', 'DELETE', endpoint],
    ['HEAD me', 'HEAD', endpoint], ['OPTIONS me', 'OPTIONS', endpoint]
  ] as const;

  for (const [label, method, url] of excluded) {
    it(`never adds a token to ${label}, including a login context token`, () => {
      establish();
      client.request(method, url, { context: new HttpContext().set(LOGIN_ACCESS, crypto.randomUUID()) }).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush(null);
    });
  }

  it('never adds a token when HttpParams appends a query to GET /auth/me', () => {
    establish();
    client.get(endpoint, { params: new HttpParams().set('view', 'public') }).subscribe();
    const request = http.expectOne(`${endpoint}?view=public`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(user);
  });

  it('does not attach an expired token even before the expiry timer runs', () => {
    establish();
    const expiredTime = Date.now() + 30 * 60_000;
    spyOn(Date, 'now').and.returnValue(expiredTime);
    client.get(endpoint).subscribe();
    const request = http.expectOne(endpoint);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(store.currentUser()).toBeNull();
    request.flush(user);
  });

  it('rejects a current token on 401 without refresh or replay', () => {
    establish();
    const error = jasmine.createSpy('unauthorized response');
    client.get(endpoint).subscribe({ error });
    http.expectOne(endpoint).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ status: 401 }));
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    http.expectNone(() => true);
  });

  it('does not let a late 401 from an old request invalidate a newer session token', () => {
    const oldToken = establish();
    client.get(endpoint).subscribe({ error: () => { /* The old caller receives its rejection. */ } });
    const oldRequest = http.expectOne(endpoint);
    expect(oldRequest.request.headers.get('Authorization') === `Bearer ${oldToken}`).toBeTrue();
    store.logout();
    const newToken = establish();
    oldRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(store.accessToken() === newToken).toBeTrue();
    expect(store.currentUser()).toEqual(user);
    http.expectNone(() => true);
  });

  for (const status of [0, 403]) {
    it(`keeps the current session on approved-read status ${status}`, () => {
      const token = establish();
      client.get(endpoint).subscribe({ error: () => { /* Non-auth failures do not end sessions. */ } });
      const request = http.expectOne(endpoint);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({}, { status, statusText: 'Forbidden' });
      expect(store.accessToken() === token).toBeTrue();
      expect(store.currentUser()).toEqual(user);
      http.expectNone(() => true);
    });
  }

  it('does not clear the session on an excluded endpoint 401', () => {
    const token = establish();
    client.get(`${baseUrl}/products`).subscribe({ error: () => { /* Unrelated endpoint. */ } });
    http.expectOne(`${baseUrl}/products`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(store.accessToken() === token).toBeTrue();
    expect(store.currentUser()).toEqual(user);
  });
});
