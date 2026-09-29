import { ApiError } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import { parseReadPage, readId, readRecord, readText, requireReadIdentity } from '../../../core/http/read-parsers';
import type { ReadPageRequest } from '../../../core/http/read-parsers';
import { TASK_TEXT_MAX_LENGTH } from './task.models';
import type { Task, TaskDeletion, TaskDraft } from './task.models';

export function parseTaskCompleted(value: unknown, kind: 'validation' | 'format' = 'validation'): boolean {
  if (typeof value !== 'boolean') throw new ApiError(kind, 'Expected a completion flag.');
  return value;
}

export function parseTask(value: unknown, expectedId?: number, expectedUserId?: number): Task {
  const data = readRecord(value);
  const id = readId(data['id']);
  const userId = readId(data['userId']);
  requireReadIdentity(id, expectedId);
  requireReadIdentity(userId, expectedUserId);
  return { id, todo: readText(data['todo']), completed: parseTaskCompleted(data['completed'], 'format'), userId };
}

export function parseTaskPage(value: unknown, request: ReadPageRequest, userId?: number): Page<Task> {
  return parseReadPage(value, 'todos', request, item => parseTask(item, undefined, userId));
}

export function parseTaskDraft(value: unknown): TaskDraft {
  const data = readRecord(value, 'validation');
  const todo = data['todo'];
  if (typeof todo !== 'string' || !todo.trim() || todo.trim().length > TASK_TEXT_MAX_LENGTH) {
    throw new ApiError('validation', `Task text must contain 1 to ${TASK_TEXT_MAX_LENGTH} characters.`);
  }
  return { todo: todo.trim(), userId: readId(data['userId'], 'validation') };
}

// Existing remote text is not subject to this application's creation-only length limit.
export function parseTaskReference(value: unknown): Task {
  const data = readRecord(value, 'validation');
  if (typeof data['todo'] !== 'string' || !data['todo'].trim()) {
    throw new ApiError('validation', 'Expected task text.');
  }
  return { id: readId(data['id'], 'validation'), userId: readId(data['userId'], 'validation'),
    todo: data['todo'], completed: parseTaskCompleted(data['completed']) };
}

function mutationId(value: unknown): number {
  // DummyJSON PATCH may echo the URL ID as a string. Never coerce read IDs or user IDs.
  if (typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && value === value.trim()) {
    return readId(Number(value));
  }
  return readId(value);
}

export function parseTaskWriteResult(
  value: unknown, expected: TaskDraft & { readonly completed: boolean }, expectedId?: number
): Task {
  const data = readRecord(value);
  const task = parseTask({ ...data, id: mutationId(data['id']) }, expectedId, expected.userId);
  if (task.todo !== expected.todo || task.completed !== expected.completed) {
    throw new ApiError('format', 'The response does not match the requested task change.');
  }
  return task;
}

export function parseTaskDeletion(value: unknown, expectedId: number): TaskDeletion {
  const data = readRecord(value);
  const id = mutationId(data['id']);
  requireReadIdentity(id, expectedId);
  const deletedOn = data['deletedOn'];
  if (data['isDeleted'] !== true || typeof deletedOn !== 'string' ||
      !Number.isFinite(Date.parse(deletedOn)) || new Date(deletedOn).toISOString() !== deletedOn) {
    throw new ApiError('format', 'The service returned an invalid task deletion.');
  }
  return { id, isDeleted: true, deletedOn };
}
