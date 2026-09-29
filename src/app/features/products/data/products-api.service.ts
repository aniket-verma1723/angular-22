import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { catchError, defer, map, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { ApiError, toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import { DEFAULT_PRODUCT_QUERY } from './product.models';
import type { ProductCategory, ProductDeletion, ProductDetail, ProductDraft, ProductMutation,
  ProductPatch, ProductQuery, ProductSummary, ProductWriteResult } from './product.models';
import { buildProductRequest } from './product-query';
import { parseProductCategories, parseProductDeletion, parseProductDetail, parseProductDraft,
  parseProductId, parseProductPage, parseProductPatch, parseProductWriteResult } from './product.parsers';

@Service()
export class ProductsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  list(query: ProductQuery = DEFAULT_PRODUCT_QUERY): Observable<Page<ProductSummary>> {
    return this.request(() => {
      const { path, params } = buildProductRequest(query);
      return this.http.get<unknown>(this.config.baseUrl + path, { params });
    }, parseProductPage);
  }

  get(id: number): Observable<ProductDetail> {
    return this.request(() => this.http.get<unknown>(this.productUrl(id)), value => {
      const product = parseProductDetail(value);
      this.requireMatchingId(product.id, id);
      return product;
    });
  }

  categories(): Observable<readonly ProductCategory[]> {
    return this.request(() => this.http.get<unknown>(`${this.config.baseUrl}/products/categories`), parseProductCategories);
  }

  create(draft: ProductDraft): Observable<ProductMutation<ProductWriteResult>> {
    return this.request(() => this.http.post<unknown>(`${this.config.baseUrl}/products/add`, parseProductDraft(draft)),
      value => this.mutation(parseProductWriteResult(value)));
  }

  update(id: number, patch: ProductPatch): Observable<ProductMutation<ProductWriteResult>> {
    return this.request(() => this.http.patch<unknown>(this.productUrl(id), parseProductPatch(patch)), value => {
      const result = parseProductWriteResult(value);
      this.requireMatchingId(result.id, id);
      return this.mutation(result);
    });
  }

  delete(id: number): Observable<ProductMutation<ProductDeletion>> {
    return this.request(() => this.http.delete<unknown>(this.productUrl(id)), value => {
      const result = parseProductDeletion(value);
      this.requireMatchingId(result.id, id);
      return this.mutation(result);
    });
  }

  private productUrl(id: number): string {
    return `${this.config.baseUrl}/products/${parseProductId(id)}`;
  }

  private requireMatchingId(actual: number, expected: number): void {
    if (actual !== expected) throw new ApiError('format', 'The response has an unexpected product ID.');
  }

  private mutation<T>(value: T): ProductMutation<T> {
    return { value, persistence: this.config.mode === 'mock' ? 'session' : 'simulated' };
  }

  private request<T>(send: () => Observable<unknown>, parse: (value: unknown) => T): Observable<T> {
    // Validate on subscription too, so failures use the same observable error channel as HTTP.
    return defer(send).pipe(map(parse), catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
