import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { provideAppData } from '../../../core/config/app-data.providers';
import { ApiError } from '../../../core/http/api-error';
import { SessionStore } from '../../../core/session/session.store';
import type { Task, TaskDeletion, TaskQuery } from './task.models';
import { TasksApiService } from './tasks-api.service';

describe('TasksApiService public HTTP boundary', () => {
  const base = 'https://dummyjson.com';
  const task: Task = { id: 1, userId: 2, todo: 'Practice observables', completed: false };
  const query: TaskQuery = { userId: null, pageIndex: 0, pageSize: 10 };
  const page = { todos: [task], total: 1, skip: 0, limit: 1 };
  const deletion: TaskDeletion = { id: 1, isDeleted: true, deletedOn: '2026-01-01T00:00:00.000Z' };
  let api: TasksApiService;
  let http: HttpTestingController;
  let store: SessionStore;
  const operations = [
    { name: 'list', path: '/todos', method: 'GET', send: (): Observable<unknown> => api.list(query), response: page },
    { name: 'user list', path: '/todos/user/2', method: 'GET', send: (): Observable<unknown> => api.list({ ...query, userId: 2 }), response: page },
    { name: 'get', path: '/todos/1', method: 'GET', send: (): Observable<unknown> => api.get(1), response: task },
    { name: 'create', path: '/todos/add', method: 'POST', send: (): Observable<unknown> => api.create(task), response: task },
    { name: 'complete', path: '/todos/1', method: 'PATCH', send: (): Observable<unknown> => api.setCompleted(task, true), response: { ...task, completed: true } },
    { name: 'delete', path: '/todos/1', method: 'DELETE', send: (): Observable<unknown> => api.delete(task), response: deletion }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(TasksApiService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
  });
  afterEach(() => { store.logout(); http.verify(); });

  function establishSession(): void {
    store.establish({ id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner', role: 'learner' },
      crypto.randomUUID(), Date.now() + 60_000);
  }

  for (const operation of operations) {
    it(`keeps ${operation.name} cold, uncached and private even during an active session`, async () => {
      establishSession();
      const request$ = operation.send();
      http.expectNone(() => true);
      for (let index = 0; index < 2; index++) {
        const result = firstValueFrom(request$);
        const req = http.expectOne(req => req.url === base + operation.path);
        expect(req.request.method).toBe(operation.method);
        expect(req.request.headers.has('Authorization')).toBeFalse();
        expect(req.request.withCredentials).toBeFalse();
        expect(req.request.credentials).toBe('omit');
        req.flush(operation.response);
        await result;
      }
      expect(store.currentUser()?.id).toBe(2);
    });

    it(`times out and cancels ${operation.name} at 15 seconds without retrying`, fakeAsync(() => {
      const next = jasmine.createSpy('unexpected response');
      const error = jasmine.createSpy('safe timeout');
      operation.send().subscribe({ next, error });
      const req = http.expectOne(() => true);
      tick(14_999);
      expect(error).not.toHaveBeenCalled();
      tick(1);
      expect(req.cancelled).toBeTrue();
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'unexpected', message: 'The request could not be completed.' }));
      expect(next).not.toHaveBeenCalled();
      http.expectNone(() => true);
    }));

    it(`tears down ${operation.name} on unsubscribe without emitting`, () => {
      const next = jasmine.createSpy('unexpected response');
      const error = jasmine.createSpy('unexpected error');
      const subscription = operation.send().subscribe({ next, error });
      const req = http.expectOne(() => true);
      subscription.unsubscribe();
      expect(req.cancelled).toBeTrue();
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      http.expectNone(() => true);
    });

    it(`does not log out an active session on a public ${operation.name} 401`, async () => {
      establishSession();
      const result = firstValueFrom(operation.send());
      const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'unauthorized', status: 401 }));
      http.expectOne(() => true).flush({ message: 'Private upstream details' }, { status: 401, statusText: 'Unauthorized' });
      await rejected;
      expect(store.currentUser()?.id).toBe(2);
      http.expectNone(() => true);
    });

    it(`rejects malformed ${operation.name} responses and permits explicit recovery`, async () => {
      const result = firstValueFrom(operation.send());
      const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
      http.expectOne(() => true).flush({ invalid: true });
      await rejected;
      http.expectNone(() => true);
      const recovery = firstValueFrom(operation.send());
      http.expectOne(() => true).flush(operation.response);
      await recovery;
    });
  }

  it('constructs only pagination parameters and supports filtered, unfiltered and beyond-end pages', async () => {
    for (const userId of [null, 2]) {
      for (const pageSize of [10, 25, 50] as const) {
        const result = firstValueFrom(api.list({ userId, pageIndex: 2, pageSize }));
        const req = http.expectOne(() => true);
        expect(req.request.url).toBe(base + (userId === null ? '/todos' : '/todos/user/2'));
        expect(req.request.params.keys().sort()).toEqual(['limit', 'skip']);
        expect(req.request.params.get('skip')).toBe(String(2 * pageSize));
        expect(req.request.params.get('limit')).toBe(String(pageSize));
        req.flush({ todos: [], total: 1, skip: 2 * pageSize, limit: 0 });
        expect((await result).items).toEqual([]);
      }
    }
  });

  it('allowlists creation fields, trims text, forces false, and returns simulated persistence', async () => {
    const source = { ...task, todo: '  Practice observables  ', completed: true, authorization: 'discard', extra: true };
    const result = firstValueFrom(api.create(source));
    const req = http.expectOne(base + '/todos/add');
    expect(req.request.body).toEqual({ todo: task.todo, userId: 2, completed: false });
    expect(source.completed).toBeTrue();
    req.flush({ ...task, extra: true });
    expect(await result).toEqual({ value: task, persistence: 'simulated' });
  });

  it('PATCHes only the requested boolean, normalizes the string echo ID, and never mutates its input', async () => {
    const source = Object.freeze({ ...task, token: 'discard' });
    const result = firstValueFrom(api.setCompleted(source, true));
    const req = http.expectOne(base + '/todos/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ completed: true });
    req.flush({ ...task, id: '1', completed: true, privateData: true });
    expect(await result).toEqual({ value: { ...task, completed: true }, persistence: 'simulated' });
    expect(source.completed).toBeFalse();
  });

  it('sends bodyless DELETE and projects only the deletion acknowledgement', async () => {
    const result = firstValueFrom(api.delete(task));
    const req = http.expectOne(base + '/todos/1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush({ ...deletion, ...task, isDeleted: true, privateData: true });
    expect(await result).toEqual({ value: deletion, persistence: 'simulated' });
  });

  it('reports invalid IDs, drafts and pages through the observable before sending HTTP', async () => {
    for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      for (const request$ of [api.get(id), api.list({ ...query, userId: id }), api.create({ todo: 'Task', userId: id }),
        api.setCompleted({ ...task, id }, true), api.delete({ ...task, id })]) {
        await expectAsync(firstValueFrom<unknown>(request$)).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
      }
    }
    for (const pageIndex of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      await expectAsync(firstValueFrom(api.list({ ...query, pageIndex })))
        .toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    for (const todo of ['', ' \n ', 'x'.repeat(201)]) {
      await expectAsync(firstValueFrom(api.create({ todo, userId: 1 })))
        .toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    http.expectNone(() => true);
  });

  it('rejects string read IDs, unexpected detail IDs, and unrelated filtered tasks', async () => {
    for (const response of [{ ...task, id: '1' }, { ...task, id: 2 }]) {
      const result = firstValueFrom(api.get(1));
      const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
      http.expectOne(() => true).flush(response);
      await rejected;
    }
    const result = firstValueFrom(api.list({ ...query, userId: 1 }));
    const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
    http.expectOne(() => true).flush(page);
    await rejected;
  });

  it('rejects mismatched create and completion echoes before reporting a mutation success', async () => {
    for (const complete of [false, true]) {
      const expected = { ...task, completed: complete };
      for (const response of [{ ...expected, userId: 3 }, { ...expected, todo: 'Different task' },
        { ...expected, completed: !complete }, { ...expected, id: '01' },
        ...(complete ? [{ ...expected, id: 2 }] : [])]) {
        const result = firstValueFrom(complete ? api.setCompleted(task, true) : api.create(task));
        const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'format' }));
        http.expectOne(() => true).flush(response);
        await rejected;
      }
    }
  });

  for (const [status, kind] of [[400, 'validation'], [403, 'forbidden'], [404, 'not-found'],
    [409, 'conflict'], [422, 'validation'], [429, 'rate-limit'], [500, 'server'], [503, 'server']] as const) {
    it(`maps ${status} safely without automatic retry`, async () => {
      const result = firstValueFrom(api.create(task));
      const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind, status,
        retryAfterSeconds: status === 429 ? 2 : null }));
      http.expectOne(() => true).flush({ message: 'Sensitive server information' },
        { status, statusText: 'Sensitive server information', headers: { 'Retry-After': '2' } });
      await rejected;
      await result.catch((error: unknown) => {
        expect(error instanceof ApiError).toBeTrue();
        if (error instanceof ApiError) expect(error.message).not.toContain('Sensitive');
      });
      http.expectNone(() => true);
    });
  }

  it('maps network errors without retrying', async () => {
    const result = firstValueFrom(api.get(1));
    const rejected = expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ kind: 'network' }));
    http.expectOne(() => true).error(new ProgressEvent('error'));
    await rejected;
    http.expectNone(() => true);
  });

  it('respects the configured API base path', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('remote', 'https://example.test/api/') }] });
    api = TestBed.inject(TasksApiService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    const result = firstValueFrom(api.get(1));
    http.expectOne('https://example.test/api/todos/1').flush(task);
    expect(await result).toEqual(task);
  });
});
