import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';
import type { Task, TaskQuery } from '../../features/tasks/data/task.models';
import { TasksApiService } from '../../features/tasks/data/tasks-api.service';
import { UsersApiService } from '../../features/users/data/users-api.service';
import { provideAppData } from '../config/app-data.providers.mock';
import { readRecord } from '../http/read-parsers';
import { SessionService } from '../session/session.service';
import { SessionStore } from '../session/session.store';
import { MockProductBackend } from './mock-product-backend.service';

describe('Mock tasks through the real provider stack', () => {
  const base = 'https://dummyjson.com';
  const query: TaskQuery = { userId: null, pageIndex: 0, pageSize: 10 };
  const first: Task = { id: 1, userId: 1, todo: 'Practice task 1 for learner 1', completed: false };
  let api: TasksApiService;
  let mock: MockProductBackend;
  let client: HttpClient;
  let store: SessionStore;
  const operations = [
    { name: 'list', send: (): Observable<unknown> => api.list(query) },
    { name: 'user list', send: (): Observable<unknown> => api.list({ ...query, userId: 1 }) },
    { name: 'get', send: (): Observable<unknown> => api.get(1) },
    { name: 'create', send: (): Observable<unknown> => api.create({ todo: 'New practice task', userId: 30 }) },
    { name: 'complete', send: (): Observable<unknown> => api.setCompleted(first, true) },
    { name: 'delete', send: (): Observable<unknown> => api.delete(first) }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(TasksApiService);
    mock = TestBed.inject(MockProductBackend);
    client = TestBed.inject(HttpClient);
    store = TestBed.inject(SessionStore);
  });
  afterEach(() => { store.logout(); TestBed.inject(HttpTestingController).verify(); });

  it('seeds 42 tasks related to the 30 existing public users with paged and empty relationships', async () => {
    const users = await firstValueFrom(TestBed.inject(UsersApiService).list({ q: '', pageIndex: 0, pageSize: 50 }));
    const all = await firstValueFrom(api.list({ ...query, pageSize: 50 }));
    expect(all.total).toBe(42);
    expect(all.items.map(task => task.id)).toEqual(Array.from({ length: 42 }, (_, index) => index + 1));
    expect(all.items.every(task => users.items.some(user => user.id === task.userId))).toBeTrue();
    const firstPage = await firstValueFrom(api.list({ ...query, userId: 1 }));
    const lastPage = await firstValueFrom(api.list({ ...query, userId: 1, pageIndex: 1 }));
    expect(firstPage.items.length).toBe(10);
    expect(firstPage.total).toBe(12);
    expect(lastPage.items.map(task => task.id)).toEqual([11, 12]);
    expect(lastPage.limit).toBe(2);
    expect([...firstPage.items, ...lastPage.items].every(task => task.userId === 1)).toBeTrue();
    expect((await firstValueFrom(api.list({ ...query, userId: 2 }))).total).toBe(3);
    expect(await firstValueFrom(api.list({ ...query, userId: 30 }))).toEqual({ items: [], total: 0, skip: 0, limit: 0 });
    expect((await firstValueFrom(api.list({ ...query, pageIndex: 1, pageSize: 25 }))).items.length).toBe(17);
    expect(await firstValueFrom(api.list({ ...query, pageIndex: 1, pageSize: 50 })))
      .toEqual({ items: [], total: 42, skip: 50, limit: 0 });
    expect(await firstValueFrom(api.get(1))).toEqual(first);
  });

  it('supports every mock user as an owner and persists CRUD only until reset', async () => {
    for (let userId = 1; userId <= 30; userId++) {
      const created = await firstValueFrom(api.create({ todo: `  Task for ${userId}  `, userId }));
      expect(created.persistence).toBe('session');
      expect(created.value).toEqual({ id: 42 + userId, todo: `Task for ${userId}`, userId, completed: false });
      expect(await firstValueFrom(api.get(created.value.id))).toEqual(created.value);
      const updated = await firstValueFrom(api.setCompleted(created.value, true));
      expect(updated).toEqual({ value: { ...created.value, completed: true }, persistence: 'session' });
      const reopened = await firstValueFrom(api.setCompleted(updated.value, false));
      expect(reopened.value).toEqual(created.value);
      const deleted = await firstValueFrom(api.delete(reopened.value));
      expect(deleted.persistence).toBe('session');
      expect(deleted.value.id).toBe(created.value.id);
      expect(deleted.value.isDeleted).toBeTrue();
      await expectAsync(firstValueFrom(api.get(created.value.id))).toBeRejectedWith(jasmine.objectContaining({ kind: 'not-found' }));
    }
    mock.reset();
    expect((await firstValueFrom(api.list(query))).total).toBe(42);
    expect((await firstValueFrom(api.create({ todo: 'After reset', userId: 30 }))).value.id).toBe(43);
  });

  it('does not share mutable task storage across injectors', async () => {
    await firstValueFrom(api.delete(first));
    expect((await firstValueFrom(api.list(query))).total).toBe(41);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    api = TestBed.inject(TasksApiService);
    mock = TestBed.inject(MockProductBackend);
    client = TestBed.inject(HttpClient);
    store = TestBed.inject(SessionStore);
    expect(await firstValueFrom(api.get(1))).toEqual(first);
    expect((await firstValueFrom(api.create({ todo: 'Fresh injector', userId: 1 }))).value.id).toBe(43);
  });

  it('does not expose database references through raw detail or list bodies', async () => {
    const detail = readRecord(await firstValueFrom(client.get<unknown>(base + '/todos/1')));
    detail['todo'] = 'Mutated response';
    const page = readRecord(await firstValueFrom(client.get<unknown>(base + '/todos')));
    const rows: unknown = page['todos'];
    if (!Array.isArray(rows)) throw new Error('Expected mock tasks');
    const records: readonly unknown[] = rows;
    readRecord(records[0])['completed'] = true;
    expect(await firstValueFrom(api.get(1))).toEqual(first);
  });

  it('omits bearer and cookies during a verified session and does not log out on public 401s', async () => {
    await firstValueFrom(TestBed.inject(SessionService).login({ username: 'learner', password: 'practice-only' }, 'learner'));
    const handle = spyOn(mock, 'handle').and.callThrough();
    for (const operation of operations) {
      mock.enqueue({ outcome: 401 });
      await expectAsync(firstValueFrom(operation.send())).toBeRejectedWith(jasmine.objectContaining({ kind: 'unauthorized' }));
      expect(store.currentUser()?.id).toBe(2);
      await firstValueFrom(operation.send());
    }
    expect(handle.calls.count()).toBe(12);
    for (const [request] of handle.calls.allArgs()) {
      expect(request.headers.has('Authorization')).toBeFalse();
      expect(request.withCredentials).toBeFalse();
      expect(request.credentials).toBe('omit');
    }
    expect(store.currentUser()?.id).toBe(2);
  });

  for (const operation of operations) {
    it(`keeps ${operation.name} cold and consumes queued scenarios only on subscription`, () => {
      mock.enqueue({ outcome: 503 });
      const pending$ = operation.send();
      const error = jasmine.createSpy('first request');
      api.get(1).subscribe({ error });
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'server' }));
      const next = jasmine.createSpy('deferred success');
      pending$.subscribe({ next });
      expect(next).toHaveBeenCalledTimes(1);
      mock.enqueue({ outcome: 404 });
      const repeated = jasmine.createSpy('uncached error');
      pending$.subscribe({ error: repeated });
      expect(repeated).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'not-found' }));
    });

    it(`delays ${operation.name} until response time and does not commit on cancellation`, fakeAsync(() => {
      mock.enqueue({ outcome: 'success', delayMs: 25 });
      mock.enqueue({ outcome: 503 });
      const next = jasmine.createSpy('cancelled response');
      const error = jasmine.createSpy('cancelled error');
      const subscription = operation.send().subscribe({ next, error });
      tick(24);
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      subscription.unsubscribe();
      tick(1);
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      const queued = jasmine.createSpy('next scenario');
      api.get(1).subscribe({ error: queued });
      expect(queued).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'server' }));
      api.get(1).subscribe(task => expect(task).toEqual(first));
      api.list(query).subscribe(page => expect(page.total).toBe(42));
      api.create({ todo: 'Unconsumed ID', userId: 30 }).subscribe(result => expect(result.value.id).toBe(43));
    }));

    it(`rejects stale ${operation.name} after reset without changing the new generation`, fakeAsync(() => {
      mock.enqueue({ outcome: 'success', delayMs: 25 });
      const next = jasmine.createSpy('stale success');
      const error = jasmine.createSpy('reset conflict');
      operation.send().subscribe({ next, error });
      mock.enqueue({ outcome: 503 });
      mock.reset();
      api.create({ todo: 'New generation', userId: 30 }).subscribe(result => expect(result.value.id).toBe(43));
      tick(25);
      expect(next).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'conflict', status: 409 }));
      api.list(query).subscribe(page => expect(page.total).toBe(43));
      api.get(1).subscribe(task => expect(task).toEqual(first));
      api.get(43).subscribe(task => expect(task.todo).toBe('New generation'));
    }));

    for (const [outcome, kind] of [['malformed', 'format'], ['network', 'network'], [400, 'validation'],
      [401, 'unauthorized'], [403, 'forbidden'], [404, 'not-found'], [409, 'conflict'],
      [422, 'validation'], [429, 'rate-limit'], [500, 'server'], [503, 'server']] as const) {
      it(`does not commit ${operation.name} on delayed ${outcome}, and permits explicit recovery`, fakeAsync(() => {
        mock.enqueue({ outcome, delayMs: 25 });
        const next = jasmine.createSpy('unexpected success');
        const error = jasmine.createSpy('expected failure');
        operation.send().subscribe({ next, error });
        tick(24);
        expect(error).not.toHaveBeenCalled();
        tick(1);
        expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind }));
        expect(next).not.toHaveBeenCalled();
        api.get(1).subscribe(task => expect(task).toEqual(first));
        api.list(query).subscribe(page => expect(page.total).toBe(42));
        api.create({ todo: 'First committed ID', userId: 30 }).subscribe(result => expect(result.value.id).toBe(43));
        const recovered = jasmine.createSpy('explicit recovery');
        operation.send().subscribe({ next: recovered });
        expect(recovered).toHaveBeenCalledTimes(1);
      }));
    }
  }

  it('commits a successful delayed write only when the response is delivered', fakeAsync(() => {
    mock.enqueue({ outcome: 'success', delayMs: 25 });
    const next = jasmine.createSpy('delayed completion');
    api.setCompleted(first, true).subscribe({ next });
    api.get(1).subscribe(task => expect(task.completed).toBeFalse());
    tick(24);
    expect(next).not.toHaveBeenCalled();
    tick(1);
    expect(next).toHaveBeenCalledOnceWith({ value: { ...first, completed: true }, persistence: 'session' });
    api.get(1).subscribe(task => expect(task.completed).toBeTrue());
  }));

  it('returns consistent empty pages and 404 details without committing empty-scenario mutations', async () => {
    mock.setScenario({ outcome: 'empty' });
    expect(await firstValueFrom(api.list({ ...query, pageIndex: 1 }))).toEqual({ items: [], total: 0, skip: 10, limit: 0 });
    expect((await firstValueFrom(api.list({ ...query, userId: 1 }))).items).toEqual([]);
    await expectAsync(firstValueFrom(api.get(1))).toBeRejectedWith(jasmine.objectContaining({ kind: 'not-found' }));
    for (const operation of operations.slice(3)) {
      await expectAsync(firstValueFrom(operation.send())).toBeRejectedWith(jasmine.objectContaining({ kind: 'validation' }));
    }
    mock.setScenario({ outcome: 'success' });
    expect(await firstValueFrom(api.get(1))).toEqual(first);
    expect((await firstValueFrom(api.create({ todo: 'Unconsumed ID', userId: 1 }))).value.id).toBe(43);
  });

  it('validates direct HTTP bodies and rejects foreign owners without committing', async () => {
    for (const body of [null, {}, { todo: ' ', userId: 1, completed: false },
      { todo: 'x'.repeat(201), userId: 1, completed: false }, { todo: 'Task', userId: 31, completed: false },
      { todo: 'Task', userId: '1', completed: false }, { todo: 'Task', userId: 0, completed: false },
      { todo: 'Task', userId: 1, completed: true }, { todo: 'Task', userId: 1 },
      { todo: 'Task', userId: 1, completed: false, id: 99 }]) {
      await expectAsync(firstValueFrom(client.post(base + '/todos/add', body)))
        .toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
    }
    for (const body of [null, {}, { completed: 'true' }, { completed: true, todo: 'Changed' },
      { completed: true, userId: 30 }, { completed: true, id: 2 }]) {
      await expectAsync(firstValueFrom(client.patch(base + '/todos/1', body)))
        .toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
    }
    await expectAsync(firstValueFrom(client.delete(base + '/todos/1', { body: { id: 1 } })))
      .toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
    expect(await firstValueFrom(api.get(1))).toEqual(first);
    expect((await firstValueFrom(api.create({ todo: 'Valid task', userId: 30 }))).value.id).toBe(43);
  });

  for (const path of ['/todos/999', '/todos/user/31']) {
    it(`returns a local 404 for ${path}`, async () => {
      await expectAsync(firstValueFrom(client.get(base + path))).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
    });
  }

  for (const path of ['/todos?limit=0', '/todos?limit=12', '/todos?limit=51', '/todos?skip=-1',
    '/todos?skip=1.5', '/todos?skip=9007199254740990', '/todos?skip=0%0A', '/todos?limit=%2010',
    '/todos?skip=0&skip=10', '/todos?limit=10&limit=25', '/todos?unknown=1', '/todos?select=password',
    '/todos/1?limit=10', '/todos/user/1?q=Task', '/todos/0', '/todos/-1', '/todos/1.5',
    '/todos/01', '/todos/9007199254740992', '/todos/user/0']) {
    it(`rejects invalid task parameters ${path}`, async () => {
      await expectAsync(firstValueFrom(client.get(base + path))).toBeRejectedWith(jasmine.objectContaining({ status: 400 }));
    });
  }

  for (const [path, methods] of [
    ['/todos', ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'OPTIONS']],
    ['/todos/user/1', ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'OPTIONS']],
    ['/todos/1', ['POST', 'PUT', 'HEAD', 'OPTIONS']],
    ['/todos/add', ['GET', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'OPTIONS']],
    ['/todos/random', ['GET', 'POST']], ['/todos/1/extra', ['GET', 'PATCH']], ['/recipes', ['GET']]
  ] as const) {
    it(`returns local 501 for unsupported routes or methods on ${path}`, async () => {
      for (const method of methods) {
        await expectAsync(firstValueFrom(client.request(method, base + path)))
          .toBeRejectedWith(jasmine.objectContaining({ status: 501 }));
      }
    });
  }
});
