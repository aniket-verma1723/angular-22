import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom, Subject, switchMap } from 'rxjs';
import type { Observable } from 'rxjs';
import { provideAppData } from '../../../core/config/app-data.providers';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { SessionStore } from '../../../core/session/session.store';
import { publicCommentFixture, publicPostFixture } from '../../../testing/relationship-fixtures';
import { PostsApiService } from './posts-api.service';

describe('PostsApiService public HTTP reads', () => {
  const base = 'https://dummyjson.com';
  let api: PostsApiService;
  let http: HttpTestingController;
  let store: SessionStore;
  const endpoints = [
    { path: '/posts/user/1', read: (): Observable<unknown> => api.byUser(1), select: 'id,title,body,userId',
      body: { posts: [publicPostFixture()], total: 1, skip: 0, limit: 1 } },
    { path: '/posts/1', read: (): Observable<unknown> => api.get(1), select: 'id,title,body,userId', body: publicPostFixture() },
    { path: '/posts/1/comments', read: (): Observable<unknown> => api.comments(1), select: 'id,body,postId,user',
      body: { comments: [publicCommentFixture()], total: 1, skip: 0, limit: 1 } }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(PostsApiService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
  });
  afterEach(() => { store.logout(); http.verify(); });

  for (const endpoint of endpoints) {
    it(`keeps ${endpoint.path} cold, uncached and credential-free during an active session`, async () => {
      store.establish({ id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson', role: 'learner' },
        crypto.randomUUID(), Date.now() + 60_000);
      const response$ = endpoint.read();
      http.expectNone(() => true);
      for (let index = 0; index < 2; index++) {
        const result = firstValueFrom(response$);
        const req = http.expectOne(request => request.url === base + endpoint.path);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('select')).toBe(endpoint.select);
        if (endpoint.path !== '/posts/1') {
          expect(req.request.params.get('skip')).toBe('0');
          expect(req.request.params.get('limit')).toBe('10');
        }
        expect(req.request.headers.has('Authorization')).toBeFalse();
        expect(req.request.withCredentials).toBeFalse();
        expect(req.request.credentials).toBe('omit');
        req.flush(endpoint.body);
        await result;
        http.expectNone(() => true);
      }
    });

    it(`bounds ${endpoint.path} to 15 seconds and cancels the HTTP request`, fakeAsync(() => {
      const next = jasmine.createSpy('response');
      const error = jasmine.createSpy('timeout');
      endpoint.read().subscribe({ next, error });
      const req = http.expectOne(request => request.url === base + endpoint.path);
      tick(14_999);
      expect(error).not.toHaveBeenCalled();
      tick(1);
      expect(req.cancelled).toBeTrue();
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'unexpected', message: 'The request could not be completed.' }));
      expect(next).not.toHaveBeenCalled();
      http.expectNone(() => true);
    }));

    it(`converts malformed ${endpoint.path} bodies into format errors`, async () => {
      const result = firstValueFrom(endpoint.read());
      const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
      http.expectOne(request => request.url === base + endpoint.path).flush({ invalid: true });
      await assertion;
    });

    for (const [status, kind] of [[404, 'not-found'], [429, 'rate-limit'], [503, 'server']] as const) {
      it(`maps ${status} from ${endpoint.path} safely without automatic retry`, async () => {
        const result = firstValueFrom(endpoint.read());
        const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind, status }));
        http.expectOne(request => request.url === base + endpoint.path).flush({ internal: 'Discard this server detail' },
          { status, statusText: 'Failure', headers: { 'Retry-After': '2' } });
        await assertion;
        http.expectNone(() => true);
      });
    }

    it(`converts a network failure and allows explicit retry of ${endpoint.path}`, async () => {
      const result = firstValueFrom(endpoint.read());
      const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'network' }));
      http.expectOne(request => request.url === base + endpoint.path).error(new ProgressEvent('error'));
      await assertion;
      const retry = firstValueFrom(endpoint.read());
      http.expectOne(request => request.url === base + endpoint.path).flush(endpoint.body);
      await retry;
    });

    it(`cancels ${endpoint.path} on unsubscribe without a late emission or error`, fakeAsync(() => {
      const next = jasmine.createSpy('cancelled response');
      const error = jasmine.createSpy('cancelled error');
      const subscription = endpoint.read().subscribe({ next, error });
      const req = http.expectOne(request => request.url === base + endpoint.path);
      subscription.unsubscribe();
      expect(req.cancelled).toBeTrue();
      tick(15_000);
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    }));
  }

  it('sends requested pagination for both relation endpoints and accepts reduced limits', async () => {
    for (const pageSize of [10, 25, 50]) {
      const posts = firstValueFrom(api.byUser(1, 1, pageSize));
      const postReq = http.expectOne(req => req.url === `${base}/posts/user/1`);
      expect(postReq.request.params.get('skip')).toBe(String(pageSize));
      expect(postReq.request.params.get('limit')).toBe(String(pageSize));
      postReq.flush({ posts: [publicPostFixture()], total: pageSize + 1, skip: pageSize, limit: 1 });
      expect((await posts).items.length).toBe(1);
      const comments = firstValueFrom(api.comments(1, 1, pageSize));
      const commentReq = http.expectOne(req => req.url === `${base}/posts/1/comments`);
      expect(commentReq.request.params.get('skip')).toBe(String(pageSize));
      expect(commentReq.request.params.get('limit')).toBe(String(pageSize));
      commentReq.flush({ comments: [], total: 0, skip: pageSize, limit: 0 });
      expect((await comments).items).toEqual([]);
    }
  });

  it('rejects invalid identities and unsafe pagination on subscription before HTTP', async () => {
    const invalid: Observable<unknown>[] = [];
    for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      invalid.push(api.byUser(id), api.get(id), api.comments(id));
    }
    for (const pageIndex of [-1, 0.1, Infinity, Number.MAX_SAFE_INTEGER]) {
      invalid.push(api.byUser(1, pageIndex), api.comments(1, pageIndex));
    }
    for (const pageSize of [0, 12, 100, NaN, Infinity]) {
      invalid.push(api.byUser(1, 0, pageSize), api.comments(1, 0, pageSize));
    }
    for (const request$ of invalid) {
      await expectAsync(firstValueFrom(request$)).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    http.expectNone(() => true);
  });

  it('rejects mismatched single IDs, post authors and comment parent IDs', async () => {
    const responses = [publicPostFixture({ id: 2 }),
      { posts: [publicPostFixture({ userId: 2 })], total: 1, skip: 0, limit: 1 },
      { comments: [publicCommentFixture({ postId: 2 })], total: 1, skip: 0, limit: 1 }];
    const requests: Observable<unknown>[] = [api.get(1), api.byUser(1), api.comments(1)];
    for (const [index, request$] of requests.entries()) {
      const result = firstValueFrom(request$);
      const assertion = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
      const response = responses[index];
      if (!response) throw new Error('Expected a mismatch fixture');
      http.expectOne(() => true).flush(response);
      await assertion;
    }
  });

  it('keeps only public post/comment fields at the service boundary', async () => {
    const post = firstValueFrom(api.get(1));
    http.expectOne(req => req.url === `${base}/posts/1`).flush({ ...publicPostFixture(), tags: [], views: 12,
      reactions: { likes: 1, dislikes: 0 } });
    expect(await post).toEqual(publicPostFixture());
    const comments = firstValueFrom(api.comments(1));
    http.expectOne(req => req.url === `${base}/posts/1/comments`).flush({
      comments: [{ ...publicCommentFixture(), likes: 20, user: { id: 2, fullName: 'Demo Learner', username: 'discarded' } }],
      total: 1, skip: 0, limit: 1
    });
    expect((await comments).items).toEqual([publicCommentFixture()]);
  });

  it('supports a configured API base path for all relations', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('remote', 'https://example.test/api/') }] });
    api = TestBed.inject(PostsApiService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    for (const endpoint of endpoints) {
      const result = firstValueFrom(endpoint.read());
      http.expectOne(req => req.url === 'https://example.test/api' + endpoint.path).flush(endpoint.body);
      await result;
    }
  });

  it('lets switchMap replace a stale post detail without fetching unrelated records', () => {
    const ids$ = new Subject<number>();
    const received: number[] = [];
    const subscription = ids$.pipe(switchMap(id => api.get(id))).subscribe(post => received.push(post.id));
    ids$.next(1);
    const previous = http.expectOne(req => req.url === `${base}/posts/1`);
    ids$.next(2);
    expect(previous.cancelled).toBeTrue();
    http.expectOne(req => req.url === `${base}/posts/2`).flush(publicPostFixture({ id: 2 }));
    expect(received).toEqual([2]);
    http.expectNone(() => true);
    subscription.unsubscribe();
  });
});
