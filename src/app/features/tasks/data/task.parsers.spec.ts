import { ApiError } from '../../../core/http/api-error';
import { TASK_TEXT_MAX_LENGTH } from './task.models';
import type { Task } from './task.models';
import { parseTask, parseTaskCompleted, parseTaskDeletion, parseTaskDraft, parseTaskPage,
  parseTaskReference, parseTaskWriteResult } from './task.parsers';

describe('Task boundary parsers', () => {
  const task: Task = { id: 1, todo: 'Read a learning note', completed: false, userId: 2 };
  const deletedOn = '2026-01-01T00:00:00.000Z';
  const request = { skip: 0, limit: 10 };
  const page = { todos: [task], total: 1, skip: 0, limit: 1 };

  function rejects(parse: () => unknown, kind: 'validation' | 'format' = 'format'): void {
    expect(parse).toThrowMatching(error => error instanceof ApiError && error.kind === kind);
  }

  it('projects only minimal fields without mutating the source or trimming remote text', () => {
    const source = { ...task, todo: '  Original text  ', privateData: { secret: true } };
    expect(parseTask(source)).toEqual({ ...task, todo: source.todo });
    expect(source.privateData).toEqual({ secret: true });
    const long = { ...task, todo: 'x'.repeat(TASK_TEXT_MAX_LENGTH + 1) };
    expect(parseTask(long)).toEqual(long);
    expect(parseTaskReference(long)).toEqual(long);
    expect(parseTaskWriteResult(long, long, 1)).toEqual(long);
  });

  for (const value of [null, undefined, [], true, 'task', {}, { ...task, id: '1' }, { ...task, userId: '2' },
    { ...task, id: 0 }, { ...task, id: -1 }, { ...task, id: 1.5 }, { ...task, id: Infinity },
    { ...task, id: Number.MAX_SAFE_INTEGER + 1 }, { ...task, userId: 0 }, { ...task, userId: NaN },
    { ...task, todo: '' }, { ...task, todo: ' \t\n' }, { ...task, todo: null },
    { ...task, completed: 1 }, { ...task, completed: 'false' }, { ...task, completed: undefined }]) {
    it(`rejects malformed read ${JSON.stringify(value)}`, () => rejects(() => parseTask(value)));
  }

  it('validates both record and relation identities', () => {
    expect(parseTask(task, 1, 2)).toEqual(task);
    rejects(() => parseTask(task, 2));
    rejects(() => parseTask(task, 1, 3));
    rejects(() => parseTaskPage(page, request, 3));
  });

  it('accepts full, reduced, empty and beyond-end page metadata', () => {
    expect(parseTaskPage(page, request, 2)).toEqual({ items: [task], total: 1, skip: 0, limit: 1 });
    expect(parseTaskPage({ ...page, limit: 10 }, request).limit).toBe(10);
    expect(parseTaskPage({ todos: [], total: 0, skip: 0, limit: 0 }, request).items).toEqual([]);
    expect(parseTaskPage({ todos: [], total: 1, skip: 10, limit: 0 }, { skip: 10, limit: 10 }).items).toEqual([]);
  });

  for (const invalid of [{ ...page, todos: null }, { ...page, total: '1' }, { ...page, total: -1 },
    { ...page, skip: 10 }, { ...page, limit: 11 }, { ...page, limit: 0 }, { ...page, total: 2 },
    { ...page, todos: [task, task], total: 2, limit: 2 }, { ...page, total: 0 },
    { ...page, todos: [{ ...task, id: '1' }] }]) {
    it(`rejects inconsistent pages ${JSON.stringify(invalid)}`, () => rejects(() => parseTaskPage(invalid, request)));
  }

  it('trims creation text, accepts the exact maximum and discards every extra input field', () => {
    expect(TASK_TEXT_MAX_LENGTH).toBe(200);
    expect(parseTaskDraft({ todo: '  Learn  ', userId: 30, id: 900, completed: true, token: 'discard' }))
      .toEqual({ todo: 'Learn', userId: 30 });
    expect(parseTaskDraft({ todo: ` ${'x'.repeat(200)} `, userId: 1 }).todo.length).toBe(200);
  });

  for (const draft of [null, [], {}, { todo: ' ', userId: 1 }, { todo: 123, userId: 1 },
    { todo: 'x'.repeat(201), userId: 1 }, { todo: 'Learn', userId: '1' },
    { todo: 'Learn', userId: 0 }, { todo: 'Learn', userId: 1.5 }, { todo: 'Learn', userId: Number.MAX_SAFE_INTEGER + 1 }]) {
    it(`rejects invalid draft ${JSON.stringify(draft)}`, () => rejects(() => parseTaskDraft(draft), 'validation'));
  }

  it('validates local task references and flags without applying the draft limit', () => {
    expect(parseTaskReference({ ...task, extra: true })).toEqual(task);
    expect(parseTaskCompleted(false)).toBeFalse();
    expect(parseTaskCompleted(true)).toBeTrue();
    for (const value of ['true', 1, null, undefined]) rejects(() => parseTaskCompleted(value), 'validation');
    for (const value of [{ ...task, id: '1' }, { ...task, userId: 0 }, { ...task, todo: ' ' },
      { ...task, completed: 'true' }, null]) rejects(() => parseTaskReference(value), 'validation');
  });

  it('normalizes only mutation echo IDs and discards mutation response extras', () => {
    expect(parseTaskWriteResult({ ...task, id: '1', token: 'discard' }, task, 1)).toEqual(task);
    expect(parseTaskDeletion({ id: '1', isDeleted: true, deletedOn, todo: 'discard' }, 1))
      .toEqual({ id: 1, isDeleted: true, deletedOn });
    rejects(() => parseTask({ ...task, id: '1' }));
    rejects(() => parseTaskWriteResult({ ...task, userId: '2' }, task, 1));
  });

  for (const id of ['01', '0', '+1', '-1', '1.0', '1e0', ' 1', '1 ', '1\n', '1\r', '1\t', '',
    '9007199254740992', 0, 1.5, NaN, null]) {
    it(`rejects noncanonical mutation ID ${JSON.stringify(id)}`, () => {
      rejects(() => parseTaskWriteResult({ ...task, id }, task, 1));
      rejects(() => parseTaskDeletion({ id, isDeleted: true, deletedOn }, 1));
    });
  }

  for (const value of [{ ...task, id: 2 }, { ...task, userId: 1 }, { ...task, todo: 'Changed' },
    { ...task, todo: ` ${task.todo}` }, { ...task, completed: true }]) {
    it(`rejects a mismatched mutation echo ${JSON.stringify(value)}`, () => rejects(() => parseTaskWriteResult(value, task, 1)));
  }

  for (const value of [{ id: 2, isDeleted: true, deletedOn }, { id: 1, isDeleted: false, deletedOn },
    { id: 1, isDeleted: 'true', deletedOn }, { id: 1, isDeleted: true },
    ...['2026-01-01', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000+00:00',
      '2026-02-30T00:00:00.000Z', `${deletedOn}\n`, 'invalid', null, 0]
      .map(date => ({ id: 1, isDeleted: true, deletedOn: date }))]) {
    it(`rejects invalid deletion ${JSON.stringify(value)}`, () => rejects(() => parseTaskDeletion(value, 1)));
  }
});
