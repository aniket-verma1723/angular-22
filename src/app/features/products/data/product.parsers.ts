import { ApiError } from '../../../core/http/api-error';
import type { ApiErrorKind } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import type { ProductCategory, ProductDeletion, ProductDetail, ProductDraft, ProductPatch,
  ProductSummary, ProductWriteResult } from './product.models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, kind: ApiErrorKind = 'format'): Record<string, unknown> {
  if (!isRecord(value)) throw new ApiError(kind, 'Expected a data object.');
  return value;
}

function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new ApiError('format', 'Expected a data list.');
  return value;
}

function text(value: unknown, kind: ApiErrorKind = 'format', allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new ApiError(kind, 'Expected a text value.');
  }
  return value;
}

function nonnegative(value: unknown, kind: ApiErrorKind = 'format'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ApiError(kind, 'Expected a finite nonnegative number.');
  }
  return value;
}

function integer(value: unknown, kind: ApiErrorKind = 'format'): number {
  const number = nonnegative(value, kind);
  if (!Number.isSafeInteger(number)) throw new ApiError(kind, 'Expected a nonnegative safe integer.');
  return number;
}

export function parseProductId(value: unknown, kind: ApiErrorKind = 'validation'): number {
  const id = integer(value, kind);
  if (id === 0) throw new ApiError(kind, 'A positive product ID is required.');
  return id;
}

export function parseCategorySlug(value: unknown, kind: ApiErrorKind = 'validation'): string {
  const slug = text(value, kind);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ApiError(kind, 'A valid category slug is required.');
  }
  return slug;
}

function rating(value: unknown): number {
  const result = nonnegative(value);
  if (result > 5) throw new ApiError('format', 'Rating must be between zero and five.');
  return result;
}

function imageUrl(value: unknown): string {
  const url = text(value);
  if (url !== url.trim() || /[\\\u0000-\u001f\u007f]/.test(url)) {
    throw new ApiError('format', 'Invalid image URL.');
  }
  // Root-relative assets keep local mock mode independent from image CDNs.
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* Untrusted URL parsing errors become a safe data-format error. */ }
  throw new ApiError('format', 'Only HTTPS or root-relative image URLs are allowed.');
}

function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new ApiError('format', 'Expected an ISO date-time.');
  }
  return result;
}

export function parseProductSummary(value: unknown): ProductSummary {
  const data = record(value);
  const brand = data['brand'];
  return {
    id: parseProductId(data['id'], 'format'), title: text(data['title']),
    category: parseCategorySlug(data['category'], 'format'), price: nonnegative(data['price']),
    stock: integer(data['stock']), rating: rating(data['rating']), thumbnail: imageUrl(data['thumbnail']),
    ...(brand === undefined ? {} : { brand: text(brand) })
  };
}

export function parseProductPage(value: unknown): Page<ProductSummary> {
  const data = record(value);
  const items = array(data['products']).map(parseProductSummary);
  const total = integer(data['total']);
  const skip = integer(data['skip']);
  const limit = integer(data['limit']);
  if (items.length > total || (limit !== 0 && items.length > limit) ||
      items.length > Math.max(0, total - skip) || new Set(items.map(item => item.id)).size !== items.length) {
    throw new ApiError('format', 'Product page metadata or identities are inconsistent.');
  }
  return { items, total, skip, limit };
}

export function parseProductDetail(value: unknown): ProductDetail {
  const data = record(value);
  return {
    ...parseProductSummary(data), description: text(data['description'], 'format', true),
    images: array(data['images']).map(imageUrl),
    reviews: array(data['reviews']).map(value => {
      const review = record(value);
      return { rating: rating(review['rating']), comment: text(review['comment'], 'format', true),
        author: text(review['reviewerName']), createdAt: date(review['date']) };
    })
  };
}

export function parseProductCategories(value: unknown): readonly ProductCategory[] {
  const categories = array(value).map(value => {
    const data = record(value);
    // Discard the response URL; requests are constructed from the trusted base and validated slug.
    return { slug: parseCategorySlug(data['slug'], 'format'), name: text(data['name']) };
  });
  if (new Set(categories.map(category => category.slug)).size !== categories.length) {
    throw new ApiError('format', 'Category slugs must be unique.');
  }
  return categories;
}

export function parseProductDraft(value: unknown): ProductDraft {
  const data = record(value, 'validation');
  const price = nonnegative(data['price'], 'validation');
  if (price === 0) throw new ApiError('validation', 'Product price must be greater than zero.');
  return { title: text(data['title'], 'validation').trim(),
    description: text(data['description'], 'validation', true).trim(), price,
    stock: integer(data['stock'], 'validation'), category: parseCategorySlug(data['category']) };
}

export function parseProductPatch(value: unknown): ProductPatch {
  const data = record(value, 'validation');
  const draft = parseProductDraft({ title: 'Unchanged', description: '', price: 1, stock: 0,
    category: 'unchanged', ...data });
  const patch: ProductPatch = {
    ...(data['title'] === undefined ? {} : { title: draft.title }),
    ...(data['description'] === undefined ? {} : { description: draft.description }),
    ...(data['price'] === undefined ? {} : { price: draft.price }),
    ...(data['stock'] === undefined ? {} : { stock: draft.stock }),
    ...(data['category'] === undefined ? {} : { category: draft.category })
  };
  if (Object.keys(patch).length === 0) throw new ApiError('validation', 'At least one editable field is required.');
  return patch;
}

export function parseProductWriteResult(value: unknown): ProductWriteResult {
  const data = record(value);
  return { id: parseProductId(data['id'], 'format'), title: text(data['title']),
    description: text(data['description'], 'format', true), price: nonnegative(data['price']),
    stock: integer(data['stock']), category: parseCategorySlug(data['category'], 'format') };
}

export function parseProductDeletion(value: unknown): ProductDeletion {
  const data = record(value);
  if (data['isDeleted'] !== true) throw new ApiError('format', 'Deletion was not confirmed.');
  return { id: parseProductId(data['id'], 'format'), isDeleted: true, deletedOn: date(data['deletedOn']) };
}
