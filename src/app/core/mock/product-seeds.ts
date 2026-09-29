import type { ProductCategory, ProductDto } from '../../features/products/data/product.models';

export const MOCK_CATEGORIES: readonly ProductCategory[] = [
  { slug: 'stationery', name: 'Stationery' },
  { slug: 'home-decoration', name: 'Home decoration' },
  { slug: 'groceries', name: 'Groceries' }
];

export const MOCK_TIMESTAMP = '2026-01-01T00:00:00.000Z';
export const MOCK_IMAGE = '/mock-product.svg';

export function createProductSeeds(): readonly ProductDto[] {
  return Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    title: `P02 Mock Product ${String(index + 1).padStart(2, '0')}`,
    description: 'Fictional learning product. In-memory data resets when the application reloads.',
    category: MOCK_CATEGORIES[index % MOCK_CATEGORIES.length]?.slug ?? 'stationery',
    price: (index + 1) * 2.5, stock: index % 9, rating: 3 + (index % 5) * 0.5,
    thumbnail: MOCK_IMAGE, images: [MOCK_IMAGE],
    reviews: [{ rating: 4, comment: 'A fictional review for the learning app.',
      date: MOCK_TIMESTAMP, reviewerName: 'Demo reviewer' }]
  }));
}
