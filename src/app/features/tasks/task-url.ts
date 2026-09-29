import type { ParamMap } from '@angular/router';
import type { TaskQuery } from './data/task.models';

export type TaskUrl = { readonly valid: true; readonly query: TaskQuery } |
  { readonly valid: false; readonly message: string };

export function taskUserId(value: string): number | null {
  const number = Number(value);
  return /^[1-9][0-9]*$/.test(value) && value.trim() === value && Number.isSafeInteger(number) ? number : null;
}

export function parseTaskUrl(params: ParamMap): TaskUrl {
  const userValues = params.getAll('userId');
  const userId = userValues.length === 1 ? taskUserId(userValues[0] ?? '') : null;
  if (userValues.length > 0 && (userValues.length !== 1 || userId === null)) {
    return { valid: false, message: 'Invalid userId filter. Enter one positive whole-number public user ID, or explicitly choose All users.' };
  }
  const size = params.getAll('pageSize').length === 1 ? params.get('pageSize') : null;
  const pageSize = size === '25' ? 25 : size === '50' ? 50 : 10;
  const raw = params.getAll('page').length === 1 ? params.get('page') ?? '' : '';
  const page = /^[0-9]+$/.test(raw) && raw.trim() === raw ? Number(raw) : 1;
  const pageIndex = Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(page * pageSize) ? page - 1 : 0;
  return { valid: true, query: { userId, pageIndex, pageSize } };
}

export function taskUrlParams(query: TaskQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.userId !== null) params['userId'] = String(query.userId);
  if (query.pageIndex > 0) params['page'] = String(query.pageIndex + 1);
  if (query.pageSize !== 10) params['pageSize'] = String(query.pageSize);
  return params;
}

export function isCanonicalTaskUrl(params: ParamMap, query: TaskQuery): boolean {
  const canonical = taskUrlParams(query);
  return params.keys.length === Object.keys(canonical).length &&
    params.keys.every(key => params.getAll(key).length === 1 && params.get(key) === canonical[key]);
}
