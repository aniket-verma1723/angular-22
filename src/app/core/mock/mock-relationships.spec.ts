import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';
import { PostsApiService } from '../../features/posts/data/posts-api.service';
import { UsersApiService } from '../../features/users/data/users-api.service';
import { provideAppData } from '../config/app-data.providers.mock';
import { readRecord } from '../http/read-parsers';
import { SessionService } from '../session/session.service';
import { SessionStore } from '../session/session.store';
import { MockProductBackend } from './mock-product-backend.service';

describe('Mock public relationships through the real provider stack', () => {
  const base = 'https://dummyjson.com';
  let client: HttpClient;
  let mock: MockProductBackend;
  let users: UsersApiService;
  let posts: PostsApiService;
  let store: SessionStore;
  const endpoints = [
    { name: 'users', path: '/users', read: (): Observable<unknown> => users.list({ q: '', pageIndex: 0, pageSize: 10 }) },
    { name: 'search', path: '/users/search?q=Emily', read: (): Observable<unknown> => users.list({ q: 'Emily', pageIndex: 0, pageSize: 10 }) },
    { name: 'user', path: '/users/1', read: (): Observable<unknown> => users.get(1) },
    { name: 'by-user', path: '/posts/user/1', read: (): Observable<unknown> => posts.byUser(1) },
    { name: 'post', path: '/posts/1', read: (): Observable<unknown> => posts.get(1) },
    { name: 'comments', path: '/posts/1/comments', read: (): Observable<unknown> => posts.comments(1) }
  ];

  beforeEach(() => {
    // A missed mock route would hit this testing backend, never the network.
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    client = TestBed.inject(HttpClient);
    mock = TestBed.inject(MockProductBackend);
    users = TestBed.inject(UsersApiService);
    posts = TestBed.inject(PostsApiService);
    store = TestBed.inject(SessionStore);
  });
  afterEach(() => { store.logout(); TestBed.inject(HttpTestingController).verify(); });

  function expectStatus(path: string, status: number, method = 'GET'): void {
    const next = jasmine.createSpy('unexpected mock success');
    let actual: number | undefined;
    client.request(method, base + path).subscribe({ next,
      error: (error: unknown) => { actual = error instanceof HttpErrorResponse ? error.status : undefined; } });
    expect(next).not.toHaveBeenCalled();
    expect(actual).toBe(status);
  }

  it('provides 30 deterministic fictional users, preserving both demo identities', async () => {
    const ids: number[] = [];
    for (const pageIndex of [0, 1, 2]) {
      const page = await firstValueFrom(users.list({ q: '', pageIndex, pageSize: 10 }));
      expect(page.total).toBe(30);
      expect(page.skip).toBe(pageIndex * 10);
      expect(page.limit).toBe(10);
      expect(page.items.length).toBe(10);
      ids.push(...page.items.map(user => user.id));
    }
    expect(ids).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(await firstValueFrom(users.get(1))).toEqual({ id: 1, firstName: 'Emily', lastName: 'Johnson', image: null });
    expect(await firstValueFrom(users.get(2))).toEqual({ id: 2, firstName: 'Demo', lastName: 'Learner', image: null });
  });

  it('supports 25/50 page sizes, reduced limits and beyond-end pages', async () => {
    const last = await firstValueFrom(users.list({ q: '', pageIndex: 1, pageSize: 25 }));
    expect(last.items.map(user => user.id)).toEqual([26, 27, 28, 29, 30]);
    expect(last.limit).toBe(5);
    const all = await firstValueFrom(users.list({ q: '', pageIndex: 0, pageSize: 50 }));
    expect(all.items.length).toBe(30);
    expect(all.limit).toBe(30);
    expect(await firstValueFrom(users.list({ q: '', pageIndex: 1, pageSize: 50 })))
      .toEqual({ items: [], total: 30, skip: 50, limit: 0 });
  });

  it('searches display names case-insensitively with trimmed terms and paged metadata', async () => {
    const match = await firstValueFrom(users.list({ q: '  DEMO LEARNER  ', pageIndex: 0, pageSize: 10 }));
    expect(match.items.map(user => user.id)).toEqual([2]);
    expect(match.total).toBe(1);
    expect(match.limit).toBe(1);
    const missing = await firstValueFrom(users.list({ q: 'not-a-fictional-name & limit=50', pageIndex: 0, pageSize: 10 }));
    expect(missing).toEqual({ items: [], total: 0, skip: 0, limit: 0 });
    const beyond = await firstValueFrom(users.list({ q: 'Emily', pageIndex: 1, pageSize: 10 }));
    expect(beyond).toEqual({ items: [], total: 1, skip: 10, limit: 0 });
  });

  it('pages posts and comments independently and includes empty relationships', async () => {
    const first = await firstValueFrom(posts.byUser(1));
    const last = await firstValueFrom(posts.byUser(1, 1));
    expect(first.total).toBe(12);
    expect(first.items.length).toBe(10);
    expect(last.items.map(post => post.id)).toEqual([11, 12]);
    expect(last.limit).toBe(2);
    expect([...first.items, ...last.items].every(post => post.userId === 1)).toBeTrue();
    expect((await firstValueFrom(posts.byUser(2))).items.length).toBe(3);
    expect((await firstValueFrom(posts.byUser(30))).items).toEqual([]);
    const comments = await firstValueFrom(posts.comments(1));
    const remaining = await firstValueFrom(posts.comments(1, 1));
    expect(comments.total).toBe(12);
    expect(comments.items.length).toBe(10);
    expect(remaining.items.map(comment => comment.id)).toEqual([11, 12]);
    expect(remaining.items.every(comment => comment.postId === 1)).toBeTrue();
    expect((await firstValueFrom(posts.comments(2))).items).toEqual([]);
  });

  it('keeps every seeded post, comment and commenter related to an existing public record', async () => {
    const people = await firstValueFrom(users.list({ q: '', pageIndex: 0, pageSize: 50 }));
    const postIds = new Set<number>();
    const commentIds = new Set<number>();
    for (const person of people.items) {
      const notes = await firstValueFrom(posts.byUser(person.id, 0, 50));
      for (const note of notes.items) {
        expect(note.userId).toBe(person.id);
        expect(postIds.has(note.id)).toBeFalse();
        postIds.add(note.id);
        expect(await firstValueFrom(posts.get(note.id))).toEqual(note);
        const replies = await firstValueFrom(posts.comments(note.id, 0, 50));
        for (const reply of replies.items) {
          expect(reply.postId).toBe(note.id);
          expect(commentIds.has(reply.id)).toBeFalse();
          commentIds.add(reply.id);
          const author = await firstValueFrom(users.get(reply.user.id));
          expect(reply.user.fullName).toBe(`${author.firstName} ${author.lastName}`);
        }
      }
    }
    expect(postIds.size).toBe(42);
    expect(commentIds.size).toBe(14);
  });

  it('exposes only public fields even without select, and implements safe field projection', async () => {
    const user = readRecord(await firstValueFrom(client.get<unknown>(`${base}/users/1`)));
    expect(Object.keys(user).sort()).toEqual(['firstName', 'id', 'image', 'lastName']);
    expect(await firstValueFrom(client.get<unknown>(`${base}/users/1?select=firstName`)))
      .toEqual({ id: 1, firstName: 'Emily' });
    const post = readRecord(await firstValueFrom(client.get<unknown>(`${base}/posts/1`)));
    expect(Object.keys(post).sort()).toEqual(['body', 'id', 'title', 'userId']);
    const page = await firstValueFrom(posts.comments(1));
    for (const comment of page.items) {
      expect(Object.keys(comment).sort()).toEqual(['body', 'id', 'postId', 'user']);
      expect(Object.keys(comment.user).sort()).toEqual(['fullName', 'id']);
    }
  });

  it('does not expose mutable nested seed references to raw HttpClient consumers', async () => {
    const body = readRecord(await firstValueFrom(client.get<unknown>(`${base}/posts/1/comments`)));
    const raw: unknown = body['comments'];
    if (!Array.isArray(raw)) throw new Error('Expected comment list');
    const items: readonly unknown[] = raw;
    const first = readRecord(items[0]);
    readRecord(first['user'])['fullName'] = 'Changed response only';
    first['body'] = 'Changed response only';
    const fresh = await firstValueFrom(posts.comments(1));
    expect(fresh.items[0]?.user.fullName).toBe('Emily Johnson');
    expect(fresh.items[0]?.body).not.toBe('Changed response only');
    mock.reset();
    expect((await firstValueFrom(posts.comments(1))).items).toEqual(fresh.items);
  });

  it('keeps all public requests free of bearer tokens and cookies with a verified demo session', async () => {
    await firstValueFrom(TestBed.inject(SessionService).login({ username: 'learner', password: 'practice-only' }, 'learner'));
    expect(store.currentUser()?.id).toBe(2);
    const handle = spyOn(mock, 'handle').and.callThrough();
    for (const endpoint of endpoints) await firstValueFrom(endpoint.read());
    expect(handle.calls.count()).toBe(6);
    for (const [request] of handle.calls.allArgs()) {
      expect(request.headers.has('Authorization')).toBeFalse();
      expect(request.withCredentials).toBeFalse();
      expect(request.credentials).toBe('omit');
    }
    expect(store.currentUser()?.id).toBe(2);
  });

  for (const path of ['/users/999', '/posts/999', '/posts/user/999', '/posts/999/comments']) {
    it(`returns a local 404 for missing record ${path}`, () => expectStatus(path, 404));
  }

  for (const path of ['/users/0', '/users/-1', '/users/1.5', '/users/9007199254740992', '/posts/0',
    '/posts/user/0', '/posts/0/comments', '/users?limit=0', '/users?limit=12', '/users?limit=10&limit=25',
    '/users?skip=-1', '/users?skip=1.2', '/users?skip=9007199254740990', '/users?unknown=1',
    '/users?limit=10%0A', '/users?skip=0%0D', '/users?limit=%2010',
    '/users?select=password', '/users?select=id,id', '/users?select=', '/users?select=id&select=image',
    '/users/search', '/users/search?q=Emily&q=Demo', '/users/1?limit=10', '/users/1?q=Emily',
    '/posts/user/1?limit=100', '/posts/user/1?skip=NaN', '/posts/1?skip=0',
    '/posts/1/comments?select=likes', '/posts/1/comments?limit=10&limit=25']) {
    it(`rejects invalid mock request parameters ${path}`, () => expectStatus(path, 400));
  }

  for (const path of ['/posts', '/posts/search', '/posts/add', '/posts/1/extra', '/users/add',
    '/users/me', '/users/1/posts', '/users/filter', '/comments', '/comments/1']) {
    it(`returns local 501 for unsupported route ${path}`, () => expectStatus(path, 501));
  }

  for (const endpoint of endpoints) {
    it(`rejects every unsupported method on ${endpoint.name} without live fallback`, () => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) expectStatus(endpoint.path, 501, method);
    });

    it(`keeps ${endpoint.name} behind the existing delayed scenario path`, fakeAsync(() => {
      for (const [outcome, kind] of [['network', 'network'], ['malformed', 'format'], [429, 'rate-limit'], [503, 'server']] as const) {
        mock.enqueue({ outcome, delayMs: 25 });
        const error = jasmine.createSpy('scenario error');
        const next = jasmine.createSpy('scenario success');
        endpoint.read().subscribe({ next, error });
        tick(24);
        expect(error).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
        tick(1);
        expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind }));
        expect(next).not.toHaveBeenCalled();
        const recovery = jasmine.createSpy('explicit recovery');
        endpoint.read().subscribe({ next: recovery });
        expect(recovery).toHaveBeenCalledTimes(1);
      }
    }));

    it(`cancels delayed ${endpoint.name} without emitting or consuming another queued scenario`, fakeAsync(() => {
      mock.enqueue({ outcome: 'success', delayMs: 25 });
      mock.enqueue({ outcome: 404 });
      const next = jasmine.createSpy('cancelled response');
      const error = jasmine.createSpy('cancelled error');
      const subscription = endpoint.read().subscribe({ next, error });
      subscription.unsubscribe();
      tick(25);
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      const queued = jasmine.createSpy('next queued failure');
      endpoint.read().subscribe({ error: queued });
      expect(queued).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'not-found' }));
      const recovery = jasmine.createSpy('recovery');
      endpoint.read().subscribe({ next: recovery });
      expect(recovery).toHaveBeenCalledTimes(1);
    }));

    it(`invalidates a delayed ${endpoint.name} generation on reset without disturbing newer reads`, fakeAsync(() => {
      mock.enqueue({ outcome: 'success', delayMs: 25 });
      const next = jasmine.createSpy('stale response');
      const error = jasmine.createSpy('reset conflict');
      endpoint.read().subscribe({ next, error });
      mock.reset();
      const fresh = jasmine.createSpy('fresh generation');
      endpoint.read().subscribe({ next: fresh });
      expect(fresh).toHaveBeenCalledTimes(1);
      tick(25);
      expect(next).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'conflict', status: 409 }));
      expect(fresh).toHaveBeenCalledTimes(1);
    }));
  }

  it('returns consistent empty pages and 404 details for the empty scenario', async () => {
    mock.setScenario({ outcome: 'empty' });
    expect(await firstValueFrom(users.list({ q: '', pageIndex: 1, pageSize: 10 })))
      .toEqual({ items: [], total: 0, skip: 10, limit: 0 });
    expect((await firstValueFrom(users.list({ q: 'Emily', pageIndex: 0, pageSize: 10 }))).items).toEqual([]);
    expect((await firstValueFrom(posts.byUser(1))).items).toEqual([]);
    expect((await firstValueFrom(posts.comments(1))).items).toEqual([]);
    expectStatus('/users/1', 404);
    expectStatus('/posts/1', 404);
    expectStatus('/posts/add', 501, 'POST');
    mock.reset();
    expect((await firstValueFrom(users.get(1))).id).toBe(1);
  });

  it('does not consume scenarios before subscription and never retains cached successes', () => {
    mock.enqueue({ outcome: 404 });
    const deferred$ = users.get(1);
    const other = jasmine.createSpy('first subscribed request');
    users.get(2).subscribe({ error: other });
    expect(other).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'not-found' }));
    const next = jasmine.createSpy('deferred response');
    deferred$.subscribe({ next });
    expect(next).toHaveBeenCalledTimes(1);
    mock.enqueue({ outcome: 503 });
    const repeated = jasmine.createSpy('fresh subscription failure');
    deferred$.subscribe({ error: repeated });
    expect(repeated).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'server' }));
  });
});
