import type { ProductDto, ProductDraft, ProductPageDto } from '../features/products/data/product.models';

export function productFixture(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 1, title: 'Test notebook', description: 'Fictional test product', category: 'stationery',
    price: 12.5, stock: 8, rating: 4.5, thumbnail: '/mock-product.svg', images: ['/mock-product.svg'],
    reviews: [{ rating: 4, comment: 'Useful', date: '2026-01-01T00:00:00.000Z', reviewerName: 'Demo reviewer' }],
    ...overrides
  };
}

export function productPageFixture(): ProductPageDto {
  return { products: [productFixture()], total: 1, skip: 0, limit: 12 };
}

export function productDraftFixture(): ProductDraft {
  return { title: 'New notebook', description: 'Practice product', price: 9.5, stock: 4, category: 'stationery' };
}
