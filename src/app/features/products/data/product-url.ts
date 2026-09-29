import type { ParamMap } from '@angular/router';
import type { ProductQuery } from './product.models';

export const SEARCH_MAX_LENGTH = 200;

function single(params: ParamMap, key: string): string {
  return params.getAll(key).length === 1 ? params.get(key) ?? '' : '';
}

export function normalizeSearch(value: string): string {
  return value.trim().slice(0, SEARCH_MAX_LENGTH);
}

export function parseProductUrl(params: ParamMap): ProductQuery {
  const size = single(params, 'pageSize');
  const pageSize = size === '24' ? 24 : size === '48' ? 48 : 12;
  const pageText = single(params, 'page');
  const page = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  const pageIndex = Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger((page - 1) * pageSize) ? page - 1 : 0;
  const sort = single(params, 'sort');
  const sortBy = sort === 'price' || sort === 'rating' ? sort : 'title';
  const order = single(params, 'order') === 'desc' ? 'desc' : 'asc';
  const term = normalizeSearch(single(params, 'q'));
  const category = single(params, 'category');
  // Search wins an ambiguous URL; the serializer removes the unused category.
  const filter: ProductQuery['filter'] = term ? { kind: 'search', term }
    : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category) ? { kind: 'category', slug: category } : { kind: 'all' };
  return { pageIndex, pageSize, sortBy, order, filter };
}

export function productUrlParams(query: ProductQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.filter.kind === 'search') params['q'] = query.filter.term;
  if (query.filter.kind === 'category') params['category'] = query.filter.slug;
  if (query.pageIndex > 0) params['page'] = String(query.pageIndex + 1);
  if (query.pageSize !== 12) params['pageSize'] = String(query.pageSize);
  if (query.sortBy !== 'title') params['sort'] = query.sortBy;
  if (query.order !== 'asc') params['order'] = query.order;
  return params;
}

export function sameProductQuery(a: ProductQuery, b: ProductQuery): boolean {
  return JSON.stringify(productUrlParams(a)) === JSON.stringify(productUrlParams(b));
}

export function isCanonicalProductUrl(params: ParamMap, query: ProductQuery): boolean {
  const canonical = productUrlParams(query);
  return params.keys.length === Object.keys(canonical).length &&
    params.keys.every(key => params.getAll(key).length === 1 && params.get(key) === canonical[key]);
}

export function productIdFromUrl(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
