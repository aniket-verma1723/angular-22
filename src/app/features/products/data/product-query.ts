import { HttpParams } from '@angular/common/http';
import { ApiError } from '../../../core/http/api-error';
import type { ProductQuery } from './product.models';
import { parseCategorySlug } from './product.parsers';

export function buildProductRequest(query: ProductQuery): { readonly path: string; readonly params: HttpParams } {
  const skip = query.pageIndex * query.pageSize;
  if (!Number.isSafeInteger(query.pageIndex) || query.pageIndex < 0 || !Number.isSafeInteger(skip) ||
      ![12, 24, 48].includes(query.pageSize) || !['title', 'price', 'rating'].includes(query.sortBy) ||
      !['asc', 'desc'].includes(query.order)) {
    throw new ApiError('validation', 'Invalid product paging or sorting values.');
  }
  let path = '/products';
  let params = new HttpParams({ fromObject: { skip, limit: query.pageSize, sortBy: query.sortBy, order: query.order } });
  switch (query.filter.kind) {
    case 'all': break;
    case 'search': {
      const term = query.filter.term.trim();
      if (term) {
        path += '/search';
        params = params.set('q', term);
      }
      break;
    }
    case 'category': path += `/category/${encodeURIComponent(parseCategorySlug(query.filter.slug))}`; break;
    default: throw new ApiError('validation', 'Invalid product filter.');
  }
  return { path, params };
}
