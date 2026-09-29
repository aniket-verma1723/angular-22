import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { catchError, defer, map, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import { readId, readPageRequest, readRecord } from '../../../core/http/read-parsers';
import type { Task, TaskDeletion, TaskDraft, TaskMutation, TaskQuery } from './task.models';
import { parseTask, parseTaskCompleted, parseTaskDeletion, parseTaskDraft, parseTaskPage,
  parseTaskReference, parseTaskWriteResult } from './task.parsers';

const PUBLIC_REQUEST = { withCredentials: false, credentials: 'omit' } as const;

@Service()
export class TasksApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  list(query: TaskQuery): Observable<Page<Task>> {
    return this.request(() => {
      const data = readRecord(query, 'validation');
      const page = readPageRequest(data['pageIndex'], data['pageSize']);
      const userId = data['userId'] === null ? undefined : readId(data['userId'], 'validation');
      const path = userId === undefined ? '/todos' : `/todos/user/${userId}`;
      const params = new HttpParams().set('skip', page.skip).set('limit', page.limit);
      return this.http.get<unknown>(this.config.baseUrl + path, { ...PUBLIC_REQUEST, params })
        .pipe(map(value => parseTaskPage(value, page, userId)));
    });
  }

  get(id: number): Observable<Task> {
    return this.request(() => this.http.get<unknown>(this.taskUrl(id), PUBLIC_REQUEST)
      .pipe(map(value => parseTask(value, id))));
  }

  create(draft: TaskDraft): Observable<TaskMutation<Task>> {
    return this.request(() => {
      const body = { ...parseTaskDraft(draft), completed: false };
      return this.http.post<unknown>(`${this.config.baseUrl}/todos/add`, body, PUBLIC_REQUEST)
        .pipe(map(value => this.mutation(parseTaskWriteResult(value, body))));
    });
  }

  setCompleted(task: Task, completed: boolean): Observable<TaskMutation<Task>> {
    return this.request(() => {
      const reference = parseTaskReference(task);
      const body = { completed: parseTaskCompleted(completed) };
      return this.http.patch<unknown>(this.taskUrl(reference.id), body, PUBLIC_REQUEST)
        .pipe(map(value => this.mutation(parseTaskWriteResult(value, { ...reference, ...body }, reference.id))));
    });
  }

  delete(task: Task): Observable<TaskMutation<TaskDeletion>> {
    return this.request(() => {
      const reference = parseTaskReference(task);
      return this.http.delete<unknown>(this.taskUrl(reference.id), PUBLIC_REQUEST)
        .pipe(map(value => this.mutation(parseTaskDeletion(value, reference.id))));
    });
  }

  private taskUrl(id: number): string {
    return `${this.config.baseUrl}/todos/${readId(id, 'validation')}`;
  }

  private mutation<T>(value: T): TaskMutation<T> {
    return { value, persistence: this.config.mode === 'mock' ? 'session' : 'simulated' };
  }

  private request<T>(send: () => Observable<T>): Observable<T> {
    return defer(send).pipe(timeout({ first: 15_000 }),
      catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
