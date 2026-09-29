import { ApiError } from './api-error';
import type { Page } from './page';

type ReadErrorKind = 'validation' | 'format';

export interface ReadPageRequest {
  readonly skip: number;
  readonly limit: number;
}

export function readRecord(value: unknown, kind: ReadErrorKind = 'format'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(kind, 'Expected a data object.');
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, kind: ReadErrorKind): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ApiError(kind, 'Expected a nonnegative safe integer.');
  }
  return value;
}

export function readId(value: unknown, kind: ReadErrorKind = 'format'): number {
  const id = integer(value, kind);
  if (id === 0) throw new ApiError(kind, 'A positive record ID is required.');
  return id;
}

export function readText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError('format', 'Expected a text value.');
  return value;
}

export function requireReadIdentity(actual: number, expected: number | undefined): void {
  if (expected !== undefined && actual !== expected) {
    throw new ApiError('format', 'The response contains an unexpected record or relation.');
  }
}

export function readPageRequest(pageIndex: unknown, pageSize: unknown): ReadPageRequest {
  const index = integer(pageIndex, 'validation');
  if (pageSize !== 10 && pageSize !== 25 && pageSize !== 50) {
    throw new ApiError('validation', 'Choose a page size of 10, 25 or 50.');
  }
  const skip = index * pageSize;
  if (!Number.isSafeInteger(skip) || !Number.isSafeInteger(skip + pageSize)) {
    throw new ApiError('validation', 'The requested page is outside the supported range.');
  }
  return { skip, limit: pageSize };
}

export function parseReadPage<T extends { readonly id: number }>(
  value: unknown, key: string, request: ReadPageRequest, parse: (item: unknown) => T
): Page<T> {
  const data = readRecord(value);
  const list: unknown = data[key];
  if (!Array.isArray(list)) throw new ApiError('format', 'Expected a data list.');
  const items = list.map((item: unknown) => parse(item));
  const total = integer(data['total'], 'format');
  const skip = integer(data['skip'], 'format');
  const limit = integer(data['limit'], 'format');
  const expectedCount = Math.min(request.limit, Math.max(0, total - skip));
  // A reduced limit is valid only when all remaining records still fit in the response.
  if (skip !== request.skip || limit > request.limit ||
      items.length !== expectedCount || items.length > limit ||
      new Set(items.map(item => item.id)).size !== items.length) {
    throw new ApiError('format', 'Page metadata or record identities are inconsistent.');
  }
  return { items, total, skip, limit };
}
