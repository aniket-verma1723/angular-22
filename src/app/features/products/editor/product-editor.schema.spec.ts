import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { productDraftFixture } from '../../../testing/product-fixtures';
import { editorModel, emptyProductEditor, productEditorSchema } from './product-editor.schema';
import type { ProductEditorModel } from './product-editor.schema';

describe('Product editor schema', () => {
  function valid(value: ProductEditorModel): boolean {
    return TestBed.runInInjectionContext(() => form(signal(value), productEditorSchema)().valid());
  }
  it('requires all fields while allowing zero stock', () => {
    expect(valid(emptyProductEditor())).toBeFalse();
    expect(valid({ ...productDraftFixture(), stock: 0 })).toBeTrue();
  });
  for (const patch of [
    { title: '   ' }, { title: 'x'.repeat(121) }, { description: '\n ' }, { description: 'x'.repeat(2001) },
    { price: null }, { price: 0 }, { price: -1 }, { price: Infinity }, { price: NaN }, { price: 1.001 }, { price: 1_000_001 },
    { stock: null }, { stock: -1 }, { stock: 1.1 }, { stock: Infinity }, { stock: 1_000_001 },
    { category: '' }, { category: 'invalid category' }
  ]) {
    it(`rejects ${JSON.stringify(patch)}`, () => expect(valid({ ...productDraftFixture(), ...patch })).toBeFalse());
  }
  it('projects only editable fields from a loaded product', () => {
    expect(Object.keys(editorModel({ ...productDraftFixture() })).sort()).toEqual(['category', 'description', 'price', 'stock', 'title']);
    expect(valid({ ...productDraftFixture(), price: 0.01, stock: 1_000_000 })).toBeTrue();
  });
});
