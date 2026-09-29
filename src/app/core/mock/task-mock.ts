import { HttpErrorResponse } from '@angular/common/http';
import type { HttpRequest } from '@angular/common/http';
import { readRecord } from '../http/read-parsers';
import type { Task } from '../../features/tasks/data/task.models';
import { parseTaskCompleted, parseTaskDraft } from '../../features/tasks/data/task.parsers';
import { MOCK_TIMESTAMP } from './product-seeds';

function failure(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Mock response', error: { message: 'Simulated API failure.' } });
}

function numberParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (value !== value.trim() || !/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw failure(400);
  }
  return Number(value);
}

function idParam(value: string | undefined): number {
  const id = numberParam(value ?? '', 0);
  if (id === 0) throw failure(400);
  return id;
}

function validateParams(params: URLSearchParams, paged: boolean): void {
  params.forEach((_, key) => {
    if (!paged || !['skip', 'limit'].includes(key) || params.getAll(key).length !== 1) throw failure(400);
  });
}

// All 30 relationship users are valid owners, including initially empty user 30.
function hasUser(id: number): boolean { return id >= 1 && id <= 30; }

function seeds(): Task[] {
  let id = 1;
  return Array.from({ length: 30 }, (_, index) => index + 1).flatMap(userId => {
    const count = userId === 1 ? 12 : userId === 2 ? 3 : userId === 30 ? 0 : 1;
    return Array.from({ length: count }, (_, index) => ({ id: id++, userId,
      todo: `Practice task ${index + 1} for learner ${userId}`, completed: index % 3 === 2 }));
  });
}

// Owned by one MockProductBackend injector; dispatch must run only at response time.
export class TaskMock {
  private tasks = seeds();
  private nextId = this.tasks.length + 1;

  reset(): void {
    this.tasks = seeds();
    this.nextId = this.tasks.length + 1;
  }

  dispatch(request: HttpRequest<unknown>, path: string, params: URLSearchParams, empty: boolean): { readonly body: unknown; readonly status?: number } {
    const byUser = /^\/todos\/user\/([\d.+-]+)$/.exec(path);
    if (path === '/todos' || byUser) {
      if (request.method !== 'GET') throw failure(501);
      validateParams(params, true);
      const userId = byUser ? idParam(byUser[1]) : null;
      if (userId !== null && !hasUser(userId)) throw failure(404);
      const skip = numberParam(params.get('skip'), 0);
      const limit = numberParam(params.get('limit'), 10);
      if (![10, 25, 50].includes(limit) || !Number.isSafeInteger(skip + limit)) throw failure(400);
      const rows = empty ? [] : this.tasks.filter(task => userId === null || task.userId === userId);
      const todos = rows.slice(skip, skip + limit);
      return { body: { todos, total: rows.length, skip, limit: todos.length } };
    }
    if (path === '/todos/add') {
      if (request.method !== 'POST') throw failure(501);
      validateParams(params, false);
      if (empty) throw failure(400);
      const data = readRecord(request.body, 'validation');
      if (Object.keys(data).some(key => !['todo', 'userId', 'completed'].includes(key)) || data['completed'] !== false) {
        throw failure(422);
      }
      const draft = parseTaskDraft(data);
      if (!hasUser(draft.userId)) throw failure(422);
      const task: Task = { ...draft, completed: false, id: this.nextId++ };
      this.tasks = [...this.tasks, task];
      return { body: task, status: 201 };
    }
    const match = /^\/todos\/([\d.+-]+)$/.exec(path);
    if (!match || !['GET', 'PATCH', 'DELETE'].includes(request.method)) throw failure(501);
    validateParams(params, false);
    const id = idParam(match[1]);
    const task = this.tasks.find(item => item.id === id);
    if (!task || (empty && request.method === 'GET')) throw failure(404);
    if (empty) throw failure(400);
    if (request.method === 'GET') return { body: task };
    if (request.method === 'PATCH') {
      const data = readRecord(request.body, 'validation');
      if (Object.keys(data).some(key => key !== 'completed')) throw failure(422);
      const updated = { ...task, completed: parseTaskCompleted(data['completed']) };
      this.tasks = this.tasks.map(item => item.id === id ? updated : item);
      return { body: updated };
    }
    if (request.body !== null) throw failure(422);
    this.tasks = this.tasks.filter(item => item.id !== id);
    return { body: { id, isDeleted: true, deletedOn: MOCK_TIMESTAMP } };
  }
}
