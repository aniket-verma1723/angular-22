import type { ParamMap } from '@angular/router';
import type { UserQuery } from './user.models';

export const USER_SEARCH_MAX_LENGTH = 200;

export function normalizeUserSearch(value: string): string {
  return value.trim().slice(0, USER_SEARCH_MAX_LENGTH).trimEnd();
}

function single(params: ParamMap, key: string): string {
  return params.getAll(key).length === 1 ? params.get(key) ?? '' : '';
}

export function parseUserUrl(params: ParamMap): UserQuery {
  const size = single(params, 'pageSize');
  const pageSize = size === '25' ? 25 : size === '50' ? 50 : 10;
  const text = single(params, 'page');
  const page = /^[0-9]+$/.test(text) && text.trim() === text ? Number(text) : 1;
  const pageIndex = Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(page * pageSize) ? page - 1 : 0;
  return { q: normalizeUserSearch(single(params, 'q')), pageIndex, pageSize };
}

export function userUrlParams(query: UserQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.q) params['q'] = query.q;
  if (query.pageIndex > 0) params['page'] = String(query.pageIndex + 1);
  if (query.pageSize !== 10) params['pageSize'] = String(query.pageSize);
  return params;
}

export function sameUserQuery(a: UserQuery, b: UserQuery): boolean {
  return a.q === b.q && a.pageIndex === b.pageIndex && a.pageSize === b.pageSize;
}

export function isCanonicalUserUrl(params: ParamMap, query: UserQuery): boolean {
  const canonical = userUrlParams(query);
  return params.keys.length === Object.keys(canonical).length &&
    params.keys.every(key => params.getAll(key).length === 1 && params.get(key) === canonical[key]);
}
