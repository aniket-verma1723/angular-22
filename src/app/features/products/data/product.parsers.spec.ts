import { ApiError } from '../../../core/http/api-error';
import { productDraftFixture, productFixture, productPageFixture } from '../../../testing/product-fixtures';
import { parseProductCategories, parseProductDeletion, parseProductDetail, parseProductDraft,
  parseProductPage, parseProductPatch, parseProductSummary, parseProductWriteResult } from './product.parsers';

describe('Product response parsers', () => {
  it('maps a product envelope without retaining unneeded transport fields', () => {
    const page = parseProductPage(productPageFixture());
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(1);
    expect('products' in page).toBeFalse();
    expect('reviews' in (page.items[0] ?? {})).toBeFalse();
  });

  it('allows zero price/stock/rating, missing brand and empty pages', () => {
    expect(parseProductSummary(productFixture({ price: 0, stock: 0, rating: 0 })).price).toBe(0);
    expect(parseProductPage({ products: [], total: 0, skip: 24, limit: 12 }).items).toEqual([]);
  });

  const badProducts: readonly unknown[] = [
    null, [], {}, { ...productFixture(), id: 0 }, { ...productFixture(), id: 1.5 },
    { ...productFixture(), id: Number.MAX_SAFE_INTEGER + 1 }, { ...productFixture(), title: 7 },
    { ...productFixture(), title: ' ' }, { ...productFixture(), price: NaN },
    { ...productFixture(), price: Infinity }, { ...productFixture(), price: -1 },
    { ...productFixture(), stock: 2.5 }, { ...productFixture(), rating: 5.1 },
    { ...productFixture(), brand: null }, { ...productFixture(), category: '../auth/me' }
  ];
  badProducts.forEach((value, index) => {
    it(`rejects malformed product fixture ${index + 1}`, () => {
      expect(() => parseProductSummary(value)).toThrowError(ApiError);
    });
  });

  for (const thumbnail of ['javascript:alert(1)', 'data:image/svg+xml,abc', '//external.test/image',
    'http://external.test/image', '/\\external.test/image', 'https://user:pass@external.test/image', ' https://example.test/a']) {
    it(`rejects unsafe image URL ${thumbnail}`, () => {
      expect(() => parseProductSummary({ ...productFixture(), thumbnail })).toThrowError(ApiError);
    });
  }

  it('accepts HTTPS images and projects reviews without unrelated fields', () => {
    const value = { ...productFixture(), thumbnail: 'https://example.test/image.png',
      reviews: [{ rating: 5, comment: 'Demo', reviewerName: 'Example', date: '2026-01-01T00:00:00Z', privateField: 'discard' }] };
    const detail = parseProductDetail(value);
    expect(detail.reviews[0]).toEqual({ rating: 5, comment: 'Demo', author: 'Example', createdAt: '2026-01-01T00:00:00Z' });
    expect(detail.thumbnail).toBe('https://example.test/image.png');
  });

  for (const changes of [{ products: [productFixture(), null] }, { total: -1 }, { skip: 0.5 },
    { limit: '12' }, { total: 0 }, { skip: 3 }, { products: [productFixture(), productFixture()], total: 2 }]) {
    it(`rejects inconsistent pages: ${JSON.stringify(changes)}`, () => {
      expect(() => parseProductPage({ ...productPageFixture(), ...changes })).toThrowError(ApiError);
    });
  }

  it('rejects invalid images, reviews and dates in details', () => {
    expect(() => parseProductDetail({ ...productFixture(), images: null })).toThrowError(ApiError);
    expect(() => parseProductDetail({ ...productFixture(), reviews: [{}] })).toThrowError(ApiError);
    expect(() => parseProductDeletion({ id: 1, isDeleted: true, deletedOn: 'yesterday' })).toThrowError(ApiError);
    expect(() => parseProductDeletion({ id: 1, isDeleted: false, deletedOn: '2026-01-01T00:00:00Z' })).toThrowError(ApiError);
  });

  it('ignores external category URLs rather than treating them as request targets', () => {
    expect(parseProductCategories([{ slug: 'stationery', name: 'Stationery', url: 'https://untrusted.test' }]))
      .toEqual([{ slug: 'stationery', name: 'Stationery' }]);
    expect(() => parseProductCategories([{ slug: 'a', name: 'A' }, { slug: 'a', name: 'A' }])).toThrowError(ApiError);
  });

  it('accepts an echoed create response without pretending it is a detail', () => {
    const response = { ...productDraftFixture(), id: 50 };
    expect(parseProductWriteResult(response)).toEqual(response);
    expect(() => parseProductDetail(response)).toThrowError(ApiError);
  });

  it('validates and allowlists drafts and partial updates', () => {
    expect(parseProductDraft({ ...productDraftFixture(), title: '  Notebook  ', admin: true }).title).toBe('Notebook');
    expect(parseProductPatch({ stock: 0, description: '', isAdmin: true })).toEqual({ stock: 0, description: '' });
    for (const value of [{}, { other: true }, { price: 0 }, { price: -1 }, { stock: -1 }, { title: '  ' }]) {
      expect(() => parseProductPatch(value)).toThrowError(ApiError);
    }
  });
});
