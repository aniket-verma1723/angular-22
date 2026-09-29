import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, concatMap, defer, finalize, switchMap, tap } from 'rxjs';
import type { Observable } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import type { Page } from '../../core/http/page';
import type { Task, TaskDraft, TaskMutation, TaskQuery } from './data/task.models';
import { TasksApiService } from './data/tasks-api.service';

export const TASK_QUEUE_CAPACITY = 10;
export type TaskPhase = 'queued' | 'in-flight' | null;
export interface TaskRow {
  readonly task: Task;
  readonly phase: TaskPhase;
  readonly error: string;
  readonly persistence: 'simulated' | 'session' | null;
}
interface TaskColumn {
  readonly name: 'OPEN' | 'DONE';
  readonly completed: boolean;
  readonly rows: readonly TaskRow[];
}
type Operation = { readonly kind: 'create'; readonly draft: TaskDraft } |
  { readonly kind: 'complete'; readonly before: Task; readonly completed: boolean } |
  { readonly kind: 'delete'; readonly before: Task };

// One owner per routed board. Neither snapshots nor queued writes outlive the view.
@Injectable()
export class TaskBoardService {
  private readonly api = inject(TasksApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads$ = new Subject<TaskQuery | null>();
  private readonly operations$ = new Subject<Operation>();
  private readonly createdEvents$ = new Subject<void>();
  private readonly rollbackEvents$ = new Subject<number>();
  readonly created$ = this.createdEvents$.asObservable();
  readonly rollingBack$ = this.rollbackEvents$.asObservable();
  private readonly pendingState = signal(0);
  private readonly rowsState = signal<readonly TaskRow[]>([]);
  private readonly snapshotState = signal<Page<Task> | null>(null);
  private readonly queryState = signal<TaskQuery | null>(null);
  private readonly loadingState = signal(false);
  private readonly loadErrorState = signal('');
  private readonly createPhaseState = signal<TaskPhase>(null);
  private readonly createErrorState = signal('');
  private readonly createdState = signal<TaskMutation<Task> | null>(null);
  private readonly confirmingState = signal(false);
  private readonly messageState = signal('');
  private readonly changedState = signal(false);
  readonly rows = this.rowsState.asReadonly();
  readonly snapshot = this.snapshotState.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();
  readonly createPhase = this.createPhaseState.asReadonly();
  readonly createError = this.createErrorState.asReadonly();
  readonly created = this.createdState.asReadonly();
  readonly confirming = this.confirmingState.asReadonly();
  readonly message = this.messageState.asReadonly();
  readonly changed = this.changedState.asReadonly();
  readonly pending = this.pendingState.asReadonly();
  readonly busy = computed(() => this.pending() > 0);
  readonly locked = computed(() => this.busy() || this.confirming());
  readonly full = computed(() => this.pending() >= TASK_QUEUE_CAPACITY);
  readonly columns = computed<readonly TaskColumn[]>(() => [
    { name: 'OPEN', completed: false, rows: this.rows().filter(row => !row.task.completed) },
    { name: 'DONE', completed: true, rows: this.rows().filter(row => row.task.completed) }
  ]);

  constructor() {
    this.loads$.pipe(switchMap(query => {
      this.rowsState.set([]); this.snapshotState.set(null); this.loadErrorState.set('');
      this.changedState.set(false); this.createdState.set(null); this.createErrorState.set('');
      if (query === null) return EMPTY;
      return defer(() => {
        this.loadingState.set(true);
        return this.api.list(query);
      }).pipe(
        tap(page => {
          this.snapshotState.set(page);
          this.rowsState.set(page.items.map(task => ({ task: { ...task }, phase: null, error: '', persistence: null })));
        }),
        catchError((error: unknown) => { this.loadErrorState.set(this.errorMessage(error)); return EMPTY; }),
        finalize(() => this.loadingState.set(false))
      );
    }), takeUntilDestroyed()).subscribe();

    this.operations$.pipe(
      concatMap(operation => defer(() => {
        this.phase(operation, 'in-flight');
        return this.execute(operation);
      }).pipe(
        // Recover inside concatMap: a failed write must not kill later user actions.
        catchError((error: unknown) => { this.failed(operation, error); return EMPTY; }),
        finalize(() => { this.phase(operation, null); this.pendingState.update(count => count - 1); })
      )),
      // Cancels the active request AND drops concatMap's unstarted buffer.
      takeUntilDestroyed()
    ).subscribe();
    this.destroyRef.onDestroy(() => {
      this.pendingState.set(0); this.createPhaseState.set(null);
      this.rowsState.update(rows => rows.map(row => ({ ...row, phase: null })));
      this.operations$.complete(); this.loads$.complete(); this.createdEvents$.complete(); this.rollbackEvents$.complete();
    });
  }

  load(query: TaskQuery | null): boolean {
    if (this.destroyRef.destroyed) return false;
    if (this.locked()) return this.reject('Finish queued writes or close the confirmation before reloading or changing pages.');
    this.queryState.set(query); this.messageState.set(''); this.loads$.next(query);
    return true;
  }

  setConfirming(value: boolean): void { this.confirmingState.set(value); }
  notify(message: string): void { this.messageState.set(message); }

  create(draft: TaskDraft): boolean {
    if (this.createPhase() !== null) return this.reject('A creation is already queued or in flight. Wait before submitting again.');
    if (!this.admit()) return false;
    this.createErrorState.set(''); this.createdState.set(null);
    this.createPhaseState.set('queued');
    this.operations$.next({ kind: 'create', draft: { ...draft } });
    return true;
  }

  setCompleted(id: number, completed: boolean): boolean {
    const row = this.available(id);
    if (!row || row.task.completed === completed || !this.admit()) return false;
    const before = { ...row.task };
    this.updateRow(id, current => ({ ...current, task: { ...before, completed }, phase: 'queued', error: '' }));
    this.messageState.set(`Task #${id} moved to ${completed ? 'DONE' : 'OPEN'} optimistically; write admitted to the queue.`);
    this.operations$.next({ kind: 'complete', before, completed });
    return true;
  }

  delete(id: number): boolean {
    const row = this.available(id);
    if (!row || !this.admit()) return false;
    this.updateRow(id, current => ({ ...current, phase: 'queued', error: '' }));
    this.operations$.next({ kind: 'delete', before: { ...row.task } });
    return true;
  }

  move(id: number, direction: -1 | 1): boolean {
    if (direction !== -1 && direction !== 1) return false;
    const row = this.available(id);
    if (!row || this.confirming()) return false;
    const column = this.rows().filter(item => item.task.completed === row.task.completed);
    if (!this.moveToIndex(id, column.findIndex(item => item.task.id === id) + direction)) return false;
    this.messageState.set(`Task #${id} moved ${direction === -1 ? 'up' : 'down'} in ${row.task.completed ? 'DONE' : 'OPEN'}. Local order only; no request sent.`);
    return true;
  }

  /** Index is column-local; an optional captured board snapshot rejects stale gestures. */
  moveToIndex(id: number, targetIndex: number, expectedRows: readonly TaskRow[] = this.rows()): boolean {
    const rows = this.rows();
    if (this.destroyRef.destroyed || this.confirming() || this.loading() || this.snapshot() === null || expectedRows !== rows) return false;
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(targetIndex)) return false;
    const row = this.available(id);
    if (!row) return false;
    const column = rows.filter(item => item.task.completed === row.task.completed);
    const sourceIndex = column.indexOf(row);
    if (targetIndex < 0 || targetIndex >= column.length || targetIndex === sourceIndex) return false;
    // Every displaced row must be available, not only the source and destination.
    if (column.slice(Math.min(sourceIndex, targetIndex), Math.max(sourceIndex, targetIndex) + 1)
      .some(item => item.phase !== null)) return this.reject('That local move is unavailable. Wait for pending rows to finish.');
    const reordered = [...column];
    reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, row);
    let columnIndex = 0;
    this.rowsState.set(rows.map(item => item.task.completed === row.task.completed ? reordered[columnIndex++] ?? item : item));
    this.messageState.set(`Task #${id} moved to position ${targetIndex + 1} in ${row.task.completed ? 'DONE' : 'OPEN'}. Local order only; no request sent.`);
    return true;
  }

  private available(id: number): TaskRow | undefined {
    const row = this.rows().find(item => item.task.id === id);
    if (row && row.phase !== null) {
      this.reject(`Task #${id} is already queued or in flight.`); return undefined;
    }
    return row;
  }

  private admit(): boolean {
    if (this.destroyRef.destroyed) return false;
    if (this.confirming()) return this.reject('Close the confirmation before adding another operation.');
    if (this.loading() || this.snapshot() === null) return this.reject('Load a valid task page before making changes.');
    if (this.full()) return this.reject('The queue is full (10 operations). Wait for a write to finish, then try again.');
    this.messageState.set('');
    this.pendingState.update(count => count + 1);
    return true;
  }

  private execute(operation: Operation): Observable<unknown> {
    if (operation.kind === 'create') {
      return this.api.create(operation.draft).pipe(tap(result => {
        // Remote IDs are echoes, not safe identities for subsequent board actions.
        this.createdState.set(result); this.createdEvents$.next();
      }));
    }
    if (operation.kind === 'delete') {
      return this.api.delete(operation.before).pipe(tap(result => {
        this.rowsState.update(rows => rows.filter(row => row.task.id !== operation.before.id));
        this.changedState.set(true);
        this.messageState.set(`Task #${operation.before.id} removed from this local snapshot. ${result.persistence === 'simulated' ? 'Remote deletion simulated; reload rereads the server.' : 'Session mock deletion; reload for a fresh page.'}`);
      }));
    }
    return this.api.setCompleted(operation.before, operation.completed).pipe(tap(result => {
      this.updateRow(operation.before.id, row => ({ ...row, task: { ...result.value }, persistence: result.persistence }));
      this.changedState.set(true);
    }));
  }

  private failed(operation: Operation, error: unknown): void {
    const message = `${this.errorMessage(error)} No automatic retry. Check the service state, then use the action again or reload after the queue drains.`;
    if (operation.kind === 'create') { this.createErrorState.set(message); return; }
    // Replace only this row, at its existing local position; never restore a whole page.
    this.rollbackEvents$.next(operation.before.id);
    this.updateRow(operation.before.id, row => ({ ...row, task: operation.before, error: message }));
    this.messageState.set(`Task #${operation.before.id} failed. Its previous state and local position are restored; other rows are unchanged.`);
  }

  private phase(operation: Operation, phase: TaskPhase): void {
    if (operation.kind === 'create') this.createPhaseState.set(phase);
    else this.updateRow(operation.before.id, row => ({ ...row, phase }));
  }

  private updateRow(id: number, update: (row: TaskRow) => TaskRow): void {
    this.rowsState.update(rows => rows.map(row => row.task.id === id ? update(row) : row));
  }

  private reject(message: string): false { this.messageState.set(message); return false; }
  private errorMessage(error: unknown): string {
    // Do not surface response bodies, task text, or arbitrary exception messages.
    return `Task request failed (${toApiError(error).kind}).`;
  }
}
