export interface ProductSummary {
  readonly id: number;
  readonly title: string;
  readonly category: string;
  readonly price: number;
  readonly thumbnail: string;
  readonly stock: number;
  readonly rating: number;
  readonly brand?: string;
}

export interface ProductReview {
  readonly rating: number;
  readonly comment: string;
  readonly author: string;
  readonly createdAt: string;
}

export interface ProductDetail extends ProductSummary {
  readonly description: string;
  readonly images: readonly string[];
  readonly reviews: readonly ProductReview[];
}

// Only consumed transport fields are modeled; reviewerEmail/meta are deliberately not retained.
export interface ProductDto extends ProductSummary {
  readonly description: string;
  readonly images: readonly string[];
  readonly reviews: readonly {
    readonly rating: number;
    readonly comment: string;
    readonly date: string;
    readonly reviewerName: string;
  }[];
}

export interface ProductPageDto {
  readonly products: readonly ProductDto[];
  readonly total: number;
  readonly skip: number;
  readonly limit: number;
}

export interface ProductCategory {
  readonly slug: string;
  readonly name: string;
}

export interface ProductDraft {
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly stock: number;
  readonly category: string;
}

export type ProductPatch = Partial<ProductDraft>;

// POST returns echoed fields and an ID, not necessarily images, reviews or a fetchable record.
export interface ProductWriteResult extends ProductDraft {
  readonly id: number;
}

export interface ProductDeletion {
  readonly id: number;
  readonly isDeleted: true;
  readonly deletedOn: string;
}

export interface ProductMutation<T> {
  readonly value: T;
  readonly persistence: 'simulated' | 'session';
}

export type ProductFilter = { readonly kind: 'all' } |
  { readonly kind: 'search'; readonly term: string } |
  { readonly kind: 'category'; readonly slug: string };

export interface ProductQuery {
  readonly pageIndex: number;
  readonly pageSize: 12 | 24 | 48;
  readonly sortBy: 'title' | 'price' | 'rating';
  readonly order: 'asc' | 'desc';
  readonly filter: ProductFilter;
}

export const DEFAULT_PRODUCT_QUERY: ProductQuery = {
  pageIndex: 0, pageSize: 12, sortBy: 'title', order: 'asc', filter: { kind: 'all' }
};
