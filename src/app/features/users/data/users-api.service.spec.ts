import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom, Subject, switchMap } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { provideAppData } from '../../../core/config/app-data.providers';
import { SessionStore } from '../../../core/session/session.store';
import { publicUserFixture } from '../../../testing/relationship-fixtures';
import type { UserQuery } from './user.models';
import { UsersApiService } from './users-api.service';

describe('UsersApiService public HTTP reads', () => {
  const base = 'https://dummyjson.com';
  const query: UserQuery = { q: '', pageIndex: 0, pageSize: 10 };
  const body = { users: [publicUserFixture()], total: 1, skip: 0, limit: 1 };
  let api: UsersApiService;
  let http: HttpTestingController;
  let store: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(UsersApiService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
  });
  afterEach(() => { store.logout(); http.verify(); });

  it('is cold, selects only public fields, and makes a fresh request for each subscription', async () => {
    const users$ = api.list(query);
    http.expectNone(() => true);
    for (let index = 0; index < 2; index++) {
      const result = firstValueFrom(users$);
      const req = http.expectOne(request => request.url === `${base}/users`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().sort()).toEqual(['limit', 'select', 'skip']);
      expect(req.request.params.get('select')).toBe('id,firstName,lastName,image');
      expect(req.request.params.get('skip')).toBe('0');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.withCredentials).toBeFalse();
      expect(req.request.credentials).toBe('omit');
      req.flush(body);
      expect((await result).items).toEqual([publicUserFixture()]);
    }
  });

  it('trims search text and keeps special characters inside q rather than interpolating a URL', async () => {
    const result = firstValueFrom(api.list({ ...query, q: '  Emily & limit=50 / ? # +  ' }));
    const req = http.expectOne(request => request.url === `${base}/users/search`);
    expect(req.request.params.get('q')).toBe('Emily & limit=50 / ? # +');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('select')).toBe('id,firstName,lastName,image');
    expect(req.request.urlWithParams).toContain('%26');
    req.flush(body);
    expect((await result).total).toBe(1);
  });

  it('uses the unfiltered endpoint for whitespace-only search', async () => {
    const result = firstValueFrom(api.list({ ...query, q: ' \t ' }));
    http.expectOne(req => req.url === `${base}/users` && !req.params.has('q')).flush(body);
    expect((await result).total).toBe(1);
  });

  it('supports page sizes 25 and 50 with short and empty response limits', async () => {
    for (const pageSize of [25, 50] as const) {
      const result = firstValueFrom(api.list({ ...query, pageIndex: 1, pageSize }));
      const req = http.expectOne(request => request.url === `${base}/users`);
      expect(req.request.params.get('skip')).toBe(String(pageSize));
      expect(req.request.params.get('limit')).toBe(String(pageSize));
      req.flush({ users: [], total: 1, skip: pageSize, limit: 0 });
      expect((await result).items).toEqual([]);
    }
  });

  it('selects and validates single users without publishing response extras', async () => {
    const result = firstValueFrom(api.get(1));
    const req = http.expectOne(request => request.url === `${base}/users/1`);
    expect(req.request.params.get('select')).toBe('id,firstName,lastName,image');
    req.flush({ ...publicUserFixture(), private: { hidden: true }, role: 'admin' });
    expect(await result).toEqual(publicUserFixture());
  });

  it('omits cookies and bearer tokens for list, search and details during an active session', async () => {
    store.establish({ id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson', role: 'learner' },
      crypto.randomUUID(), Date.now() + 60_000);
    for (const [request$, path, response] of [
      [api.list(query), '/users', body], [api.list({ ...query, q: 'Emily' }), '/users/search', body],
      [api.get(1), '/users/1', publicUserFixture()]
    ] as const) {
      const result = firstValueFrom<unknown>(request$);
      const req = http.expectOne(request => request.url === base + path);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      expect(req.request.withCredentials).toBeFalse();
      expect(req.request.credentials).toBe('omit');
      req.flush(response);
      await result;
    }
    expect(store.currentUser()?.id).toBe(1);
  });

  it('uses the configured API base path without a global URL assumption', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('remote', 'https://example.test/api/') }] });
    api = TestBed.inject(UsersApiService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    const result = firstValueFrom(api.get(1));
    http.expectOne(req => req.url === 'https://example.test/api/users/1').flush(publicUserFixture());
    expect((await result).id).toBe(1);
  });

  it('reports invalid IDs and unsafe pages through the observable without sending HTTP', async () => {
    for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const user$ = api.get(id);
      await expectAsync(firstValueFrom(user$)).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    for (const pageIndex of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      await expectAsync(firstValueFrom(api.list({ ...query, pageIndex })))
        .toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    http.expectNone(() => true);
  });

  it('rejects mismatched detail IDs, unsafe images and mismatched page metadata', async () => {
    for (const response of [publicUserFixture({ id: 2 }), { ...publicUserFixture(), image: '//untrusted.test/a' }]) {
      const result = firstValueFrom(api.get(1));
      const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
      http.expectOne(req => req.url === `${base}/users/1`).flush(response);
      await assertion;
    }
    const result = firstValueFrom(api.list({ ...query, pageIndex: 1 }));
    const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
    http.expectOne(req => req.url === `${base}/users`).flush(body);
    await assertion;
  });

  for (const [status, kind] of [[400, 'validation'], [401, 'unauthorized'], [403, 'forbidden'],
    [404, 'not-found'], [429, 'rate-limit'], [503, 'server']] as const) {
    it(`converts ${status} safely without retrying or ending the unrelated current session`, async () => {
      store.establish({ id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson', role: 'learner' },
        crypto.randomUUID(), Date.now() + 60_000);
      const result = firstValueFrom(api.list(query));
      const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind, status }));
      http.expectOne(req => req.url === `${base}/users`).flush({ message: 'Private server diagnostic' },
        { status, statusText: 'Private server diagnostic', headers: { 'Retry-After': '2' } });
      await assertion;
      expect(store.currentUser()?.id).toBe(1);
      http.expectNone(() => true);
    });
  }

  it('converts network errors and permits an explicit fresh request', async () => {
    const result = firstValueFrom(api.get(1));
    const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'network' }));
    http.expectOne(req => req.url === `${base}/users/1`).error(new ProgressEvent('error'));
    await assertion;
    const retry = firstValueFrom(api.get(1));
    http.expectOne(req => req.url === `${base}/users/1`).flush(publicUserFixture());
    expect((await retry).id).toBe(1);
  });

  for (const detail of [false, true]) {
    it(`cancels a ${detail ? 'detail' : 'list'} read at exactly 15 seconds with a safe error`, fakeAsync(() => {
      const error = jasmine.createSpy('timeout');
      const next = jasmine.createSpy('late response');
      const request$: Observable<unknown> = detail ? api.get(1) : api.list(query);
      request$.subscribe({ next, error });
      const req = http.expectOne(() => true);
      tick(14_999);
      expect(error).not.toHaveBeenCalled();
      tick(1);
      expect(req.cancelled).toBeTrue();
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'unexpected', message: 'The request could not be completed.' }));
      expect(next).not.toHaveBeenCalled();
      http.expectNone(() => true);
    }));
  }

  it('cancels stale search and destroyed detail requests without emitting an error', () => {
    const search$ = new Subject<string>();
    const received: number[] = [];
    const error = jasmine.createSpy('cancel error');
    const subscription = search$.pipe(switchMap(q => api.list({ ...query, q })))
      .subscribe({ next: page => received.push(page.total), error });
    search$.next('Emily');
    const previous = http.expectOne(req => req.params.get('q') === 'Emily');
    search$.next('Demo');
    expect(previous.cancelled).toBeTrue();
    http.expectOne(req => req.params.get('q') === 'Demo').flush(body);
    subscription.unsubscribe();
    const detail = api.get(1).subscribe({ error });
    const pending = http.expectOne(req => req.url === `${base}/users/1`);
    detail.unsubscribe();
    expect(pending.cancelled).toBeTrue();
    expect(received).toEqual([1]);
    expect(error).not.toHaveBeenCalled();
  });
});
