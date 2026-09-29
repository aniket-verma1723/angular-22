import { max, maxLength, min, pattern, required, schema, validate } from '@angular/forms/signals';
import type { ProductDraft, ProductPatch } from '../data/product.models';

export interface ProductEditorModel {
  title: string;
  description: string;
  price: number | null;
  stock: number | null;
  category: string;
}

export function emptyProductEditor(): ProductEditorModel {
  return { title: '', description: '', price: null, stock: null, category: '' };
}

export function editorModel(product: ProductDraft): ProductEditorModel {
  return { title: product.title, description: product.description, price: product.price, stock: product.stock, category: product.category };
}

export function productChanges(original: ProductEditorModel, draft: ProductDraft): ProductPatch {
  return {
    ...(original.title !== draft.title ? { title: draft.title } : {}),
    ...(original.description !== draft.description ? { description: draft.description } : {}),
    ...(original.price !== draft.price ? { price: draft.price } : {}),
    ...(original.stock !== draft.stock ? { stock: draft.stock } : {}),
    ...(original.category !== draft.category ? { category: draft.category } : {})
  };
}

export const productEditorSchema = schema<ProductEditorModel>(path => {
  required(path.title, { message: 'Title is required.' });
  maxLength(path.title, 120, { message: 'Use at most 120 characters.' });
  validate(path.title, ({ value }) => value().trim() ? undefined : { kind: 'blank', message: 'Enter a non-blank title.' });
  required(path.description, { message: 'Description is required.' });
  maxLength(path.description, 2000, { message: 'Use at most 2,000 characters.' });
  validate(path.description, ({ value }) => value().trim() ? undefined : { kind: 'blank', message: 'Enter a non-blank description.' });
  required(path.price, { message: 'Price is required.' });
  min(path.price, 0.01, { message: 'Price must be at least USD 0.01.' });
  max(path.price, 1_000_000, { message: 'Price must not exceed USD 1,000,000.' });
  validate(path.price, ({ value }) => {
    const price = value();
    return price === null || (Number.isFinite(price) && Math.abs(price * 100 - Math.round(price * 100)) < 0.000001)
      ? undefined : { kind: 'money', message: 'Use a finite price with at most two decimal places.' };
  });
  required(path.stock, { message: 'Stock is required.' });
  min(path.stock, 0, { message: 'Stock cannot be negative.' });
  max(path.stock, 1_000_000, { message: 'Stock must not exceed 1,000,000.' });
  validate(path.stock, ({ value }) => value() === null || Number.isSafeInteger(value())
    ? undefined : { kind: 'integer', message: 'Stock must be a whole number.' });
  required(path.category, { message: 'Choose a category.' });
  pattern(path.category, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Choose a valid category.' });
});
