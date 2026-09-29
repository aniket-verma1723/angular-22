import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import type { Page } from '../../core/http/page';
import type { Task, TaskDeletion, TaskMutation, TaskQuery } from './data/task.models';
import { TasksApiService } from './data/tasks-api.service';
import { TaskBoardService } from './task-board.service';

describe('Component-owned task board queue', () => {
  const query: TaskQuery = { userId: null, pageIndex: 0, pageSize: 25 };
  const task = (id: number, completed = false): Task => ({ id, completed, todo: `Task ${id}`, userId: 1 });
  const mutation = (id: number, completed = true): TaskMutation<Task> => ({ value: task(id, completed), persistence: 'simulated' });
  const deletion = (id: number): TaskMutation<TaskDeletion> => ({ value: { id, isDeleted: true, deletedOn: '2026-09-27T00:00:00.000Z' }, persistence: 'simulated' });
  let api: jasmine.SpyObj<TasksApiService>;
  let board: TaskBoardService;

  beforeEach(() => {
    api = jasmine.createSpyObj<TasksApiService>('TasksApiService', ['list', 'get', 'create', 'setCompleted', 'delete']);
    api.list.and.returnValue(of({ items: Array.from({ length: 12 }, (_, index) => task(index + 1)), total: 100, skip: 0, limit: 25 }));
    TestBed.configureTestingModule({ providers: [TaskBoardService, { provide: TasksApiService, useValue: api }] });
    board = TestBed.inject(TaskBoardService); board.load(query);
  });

  it('admits rows immediately, serializes subscriptions, and recovers inside the queue after errors', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ cold, expectSubscriptions, flush }) => {
      const first$ = cold<TaskMutation<Task>>('---a|', { a: mutation(1) });
      const second$ = cold<TaskMutation<Task>>('--#', {}, new Error('private response'));
      const third$ = cold<TaskMutation<Task>>('-a|', { a: mutation(3) });
      api.setCompleted.and.returnValues(first$, second$, third$);
      expect(board.setCompleted(1, true)).toBeTrue();
      expect(board.setCompleted(2, true)).toBeTrue();
      expect(board.setCompleted(3, true)).toBeTrue();
      expect(board.rows().slice(0, 3).map(row => row.phase)).toEqual(['in-flight', 'queued', 'queued']);
      expect(board.rows().slice(0, 3).every(row => row.task.completed)).toBeTrue();
      expect(api.setCompleted.calls.count()).toBe(1);
      expect(board.setCompleted(2, false)).toBeFalse(); expect(board.delete(2)).toBeFalse();
      expectSubscriptions(first$.subscriptions).toBe('^---!');
      expectSubscriptions(second$.subscriptions).toBe('----^-!');
      expectSubscriptions(third$.subscriptions).toBe('------^-!');
      flush();
      expect(board.rows().slice(0, 3).map(row => row.task.completed)).toEqual([true, false, true]);
      expect(board.rows()[1]?.error).toContain('No automatic retry');
      expect(board.rows()[1]?.error).not.toContain('private response');
      expect(board.rows()[0]?.persistence).toBe('simulated');
      expect(board.pending()).toBe(0); expect(board.rows().every(row => row.phase === null)).toBeTrue();
      api.setCompleted.and.returnValue(of(mutation(2)));
      expect(board.setCompleted(2, true)).toBeTrue();
      expect(board.rows()[1]?.error).toBe('');
      expect(api.setCompleted.calls.count()).toBe(4);
    });
  });

  it('enforces a global capacity of ten including creation and forbids duplicate creation', () => {
    const active$ = new Subject<TaskMutation<Task>>();
    api.setCompleted.and.returnValue(active$); api.create.and.returnValue(of(mutation(99, false)));
    for (let id = 1; id <= 9; id++) expect(board.setCompleted(id, true)).toBeTrue();
    expect(board.create({ todo: 'Draft', userId: 1 })).toBeTrue();
    expect(board.createPhase()).toBe('queued');
    expect(board.create({ todo: 'Duplicate', userId: 2 })).toBeFalse();
    expect(board.setCompleted(10, true)).toBeFalse(); expect(board.delete(11)).toBeFalse();
    expect(board.rows()[9]?.task.completed).toBeFalse(); expect(board.rows()[9]?.phase).toBeNull();
    expect(board.pending()).toBe(10); expect(board.full()).toBeTrue();
    expect(api.create).not.toHaveBeenCalled(); expect(api.setCompleted.calls.count()).toBe(1);
    expect(board.message()).toContain('queue is full');
  });

  it('drops queued writes and cancels the active subscription when its owner is destroyed', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ cold, expectSubscriptions, flush }) => {
      const active$ = cold<TaskMutation<Task>>('-----a|', { a: mutation(1) });
      api.setCompleted.and.returnValue(active$);
      board.setCompleted(1, true); board.setCompleted(2, true); board.create({ todo: 'Never send', userId: 1 });
      scheduler.schedule(() => TestBed.resetTestingModule(), 2);
      expectSubscriptions(active$.subscriptions).toBe('^-!');
      flush();
      expect(api.setCompleted.calls.count()).toBe(1); expect(api.create).not.toHaveBeenCalled();
      expect(board.pending()).toBe(0);
      expect(board.create({ todo: 'After destruction', userId: 1 })).toBeFalse();
    });
  });

  it('rolls back only the failing row at its local position, preserving successful deletion and another success', () => {
    expect(board.move(3, -1)).toBeTrue();
    const remove$ = new Subject<TaskMutation<TaskDeletion>>();
    const complete$ = new Subject<TaskMutation<Task>>();
    api.delete.and.returnValue(remove$);
    api.setCompleted.and.returnValues(of(mutation(1)), complete$);
    board.delete(4); board.setCompleted(1, true); board.setCompleted(3, true);
    remove$.next(deletion(4)); remove$.complete();
    complete$.error(new Error('failed'));
    expect(board.rows().slice(0, 3).map(row => row.task.id)).toEqual([1, 3, 2]);
    expect(board.rows().find(row => row.task.id === 1)?.task.completed).toBeTrue();
    expect(board.rows().find(row => row.task.id === 3)?.task.completed).toBeFalse();
    expect(board.rows().find(row => row.task.id === 4)).toBeUndefined();
    expect(board.snapshot()?.total).toBe(100); expect(board.changed()).toBeTrue();
  });

  it('keeps navigation/reload locked through deletion emission until request completion', () => {
    const remove$ = new Subject<TaskMutation<TaskDeletion>>(); api.delete.and.returnValue(remove$);
    board.delete(1); remove$.next(deletion(1));
    expect(board.rows().some(row => row.task.id === 1)).toBeFalse();
    expect(board.pending()).toBe(1); expect(board.load(query)).toBeFalse();
    remove$.complete(); expect(board.load(query)).toBeTrue();
    expect(api.list.calls.count()).toBe(2);
  });

  it('keeps creation results separate, never treating remote echoed IDs as actionable rows', () => {
    api.create.and.returnValue(of(mutation(99, false)));
    board.create({ todo: 'Draft', userId: 1 });
    expect(board.created()?.value.id).toBe(99); expect(board.rows().length).toBe(12);
    expect(board.delete(99)).toBeFalse(); expect(board.setCompleted(99, true)).toBeFalse();
    expect(board.snapshot()?.total).toBe(100);
  });

  it('recovers creation failures without killing queued row actions or automatically retrying', () => {
    const create$ = new Subject<TaskMutation<Task>>(); api.create.and.returnValue(create$);
    api.setCompleted.and.returnValue(of(mutation(1)));
    board.create({ todo: 'Draft', userId: 1 }); board.setCompleted(1, true);
    create$.error(new Error('body containing secrets'));
    expect(board.createError()).toContain('No automatic retry');
    expect(board.createError()).not.toContain('secrets');
    expect(board.rows()[0]?.task.completed).toBeTrue(); expect(board.createPhase()).toBeNull();
    expect(api.create.calls.count()).toBe(1); expect(board.pending()).toBe(0);
  });

  it('recovers a synchronous API exception and permits a later explicit retry', () => {
    api.setCompleted.and.callFake(() => { throw new Error('sync'); });
    expect(board.setCompleted(1, true)).toBeTrue(); expect(board.pending()).toBe(0);
    expect(board.rows()[0]?.task.completed).toBeFalse();
    api.setCompleted.and.returnValue(of(mutation(1)));
    expect(board.setCompleted(1, true)).toBeTrue(); expect(board.rows()[0]?.task.completed).toBeTrue();
  });

  it('blocks mutation admission and page changes during confirmation', () => {
    board.setConfirming(true);
    expect(board.setCompleted(1, true)).toBeFalse(); expect(board.create({ todo: 'Draft', userId: 1 })).toBeFalse();
    expect(board.delete(1)).toBeFalse(); expect(board.load(query)).toBeFalse();
    expect(board.move(1, 1)).toBeFalse(); expect(board.pending()).toBe(0);
    expect(api.setCompleted).not.toHaveBeenCalled();
  });

  it('reorders only within a column without HTTP and does not move pending neighbors', () => {
    api.list.and.returnValue(of({ items: [task(1), task(2, true), task(3)], total: 3, skip: 0, limit: 25 }));
    board.load(query); api.list.calls.reset();
    expect(board.move(1, 1)).toBeTrue();
    expect(board.columns()[0]?.rows.map(row => row.task.id)).toEqual([3, 1]);
    expect(board.columns()[1]?.rows.map(row => row.task.id)).toEqual([2]);
    expect(board.message()).toContain('no request sent');
    expect(api.list).not.toHaveBeenCalled(); expect(api.setCompleted).not.toHaveBeenCalled();
    api.setCompleted.and.returnValue(new Subject<TaskMutation<Task>>()); board.setCompleted(2, false);
    expect(board.move(3, 1)).toBeFalse(); expect(board.move(2, -1)).toBeFalse();
  });

  it('moves arbitrary distances immutably in either column without HTTP or changing the loaded totals', () => {
    api.list.and.returnValue(of({ items: [task(1), task(2, true), task(3), task(4), task(5, true), task(6), task(7, true)], total: 7, skip: 0, limit: 25 }));
    board.load(query); api.list.calls.reset();
    const before = board.rows();
    const snapshot = board.snapshot();
    expect(board.moveToIndex(1, 3, before)).toBeTrue();
    expect(board.rows()).not.toBe(before);
    expect(before.map(row => row.task.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(board.rows().map(row => row.task.id)).toEqual([3, 2, 4, 6, 5, 1, 7]);
    expect(board.rows()[5]).toBe(before[0]);
    expect(board.moveToIndex(1, 0)).toBeTrue();
    expect(board.rows()).toEqual(before);
    expect(board.moveToIndex(7, 0)).toBeTrue();
    expect(board.columns()[1]?.rows.map(row => row.task.id)).toEqual([7, 2, 5]);
    expect(board.columns()[0]?.rows.map(row => row.task.id)).toEqual([1, 3, 4, 6]);
    expect(board.snapshot()).toBe(snapshot); expect(board.snapshot()?.total).toBe(7);
    expect(board.changed()).toBeFalse(); expect(board.pending()).toBe(0);
    expect(board.message()).toContain('Local order only; no request sent');
    for (const method of [api.list, api.get, api.create, api.setCompleted, api.delete]) expect(method).not.toHaveBeenCalled();
  });

  it('rejects no-ops, invalid IDs and column-local indices without publishing a new array', () => {
    const before = board.rows();
    for (const index of [-1, 12, 999, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(board.moveToIndex(1, index)).withContext(`index ${index}`).toBeFalse();
    }
    for (const id of [0, -1, 999, 1.5, NaN, Infinity]) expect(board.moveToIndex(id, 1)).toBeFalse();
    expect(board.moveToIndex(1, 0)).toBeFalse();
    expect(board.rows()).toBe(before); expect(board.pending()).toBe(0);
    expect(api.setCompleted).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
  });

  it('rejects stale captured snapshots after reordering or reloading even when IDs still match', () => {
    const beforeMove = board.rows();
    expect(board.moveToIndex(4, 1)).toBeTrue();
    const beforeReload = board.rows();
    expect(board.moveToIndex(1, 3, beforeMove)).toBeFalse();
    expect(board.rows()).toBe(beforeReload);
    board.load(query);
    const reloaded = board.rows();
    expect(board.moveToIndex(1, 3, beforeReload)).toBeFalse();
    expect(board.rows()).toBe(reloaded);
  });

  it('blocks pending sources, destinations and intervening rows but allows unrelated unlocked moves', () => {
    api.delete.and.returnValue(new Subject<TaskMutation<TaskDeletion>>());
    board.delete(3); board.delete(5);
    const before = board.rows();
    expect(board.rows()[2]?.phase).toBe('in-flight'); expect(board.rows()[4]?.phase).toBe('queued');
    for (const [id, index] of [[3, 0], [5, 0], [1, 2], [1, 4], [1, 5], [7, 0]]) {
      expect(board.moveToIndex(id, index)).withContext(`${id} to ${index}`).toBeFalse();
    }
    expect(board.rows()).toBe(before);
    expect(board.moveToIndex(7, 9)).toBeTrue();
    expect(board.rows()[2]).toBe(before[2]); expect(board.rows()[4]).toBe(before[4]);
    expect(board.pending()).toBe(2); expect(api.delete.calls.count()).toBe(1);
    expect(api.setCompleted).not.toHaveBeenCalled();
  });

  it('preserves arbitrary local order through a queued completion failure and later success', () => {
    board.moveToIndex(1, 5);
    const order = board.rows().map(row => row.task.id);
    const active$ = new Subject<TaskMutation<Task>>();
    api.setCompleted.and.returnValues(active$, of(mutation(2)));
    board.setCompleted(1, true); board.setCompleted(2, true);
    expect(board.moveToIndex(1, 1)).toBeFalse();
    active$.error(new Error('failed'));
    expect(board.rows().map(row => row.task.id)).toEqual(order);
    expect(board.rows().find(row => row.task.id === 1)?.task.completed).toBeFalse();
    expect(board.rows().find(row => row.task.id === 2)?.task.completed).toBeTrue();
    expect(board.pending()).toBe(0); expect(board.snapshot()?.total).toBe(100);
  });

  it('rejects indexed moves during confirmation, loading, invalid-page state and after destruction', () => {
    const before = board.rows();
    board.setConfirming(true);
    expect(board.moveToIndex(1, 3)).toBeFalse(); expect(board.rows()).toBe(before);
    board.setConfirming(false);
    api.list.and.returnValue(new Subject<Page<Task>>()); board.load(query);
    expect(board.moveToIndex(1, 3)).toBeFalse();
    board.load(null); expect(board.moveToIndex(1, 3)).toBeFalse();
    api.list.and.returnValue(of({ items: [task(1), task(2)], total: 2, skip: 0, limit: 25 }));
    board.load(query); TestBed.resetTestingModule();
    const destroyed = board.rows();
    expect(board.moveToIndex(1, 1)).toBeFalse(); expect(board.rows()).toBe(destroyed);
  });

  it('cancels stale page reads and never reads for an invalid filter', () => {
    const read$ = new Subject<Page<Task>>(); api.list.and.returnValue(read$);
    board.load(query); expect(read$.observed).toBeTrue();
    board.load(null); expect(read$.observed).toBeFalse(); expect(board.loading()).toBeFalse();
    expect(board.snapshot()).toBeNull(); expect(board.rows()).toEqual([]); expect(api.list.calls.count()).toBe(2);
  });

  it('shows read failures and permits explicit reload without retaining the previous page', () => {
    api.list.and.returnValue(throwError(() => new Error('not shown')));
    board.load({ ...query, pageIndex: 1 });
    expect(board.rows()).toEqual([]); expect(board.snapshot()).toBeNull(); expect(board.loadError()).toContain('failed');
    expect(board.create({ todo: 'No snapshot', userId: 1 })).toBeFalse();
    api.list.and.returnValue(of({ items: [], total: 0, skip: 0, limit: 25 }));
    expect(board.load(query)).toBeTrue(); expect(board.loadError()).toBe(''); expect(board.loading()).toBeFalse();
  });
});
