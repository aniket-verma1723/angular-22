import { ApiError } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import { parseReadPage, readId, readRecord, readText, requireReadIdentity } from '../../../core/http/read-parsers';
import type { ReadPageRequest } from '../../../core/http/read-parsers';
import type { PublicUser } from './user.models';

function avatar(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || /[\\\u0000-\u0020\u007f-\u009f]/.test(value)) {
    throw new ApiError('format', 'Invalid avatar URL.');
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Do not expose untrusted URL parsing errors. */ }
  throw new ApiError('format', 'Only HTTPS or root-relative avatar URLs are allowed.');
}

export function parsePublicUser(value: unknown, expectedId?: number): PublicUser {
  const data = readRecord(value);
  const id = readId(data['id']);
  requireReadIdentity(id, expectedId);
  return { id, firstName: readText(data['firstName']), lastName: readText(data['lastName']), image: avatar(data['image']) };
}

export function parseUserPage(value: unknown, request: ReadPageRequest): Page<PublicUser> {
  return parseReadPage(value, 'users', request, item => parsePublicUser(item));
}
