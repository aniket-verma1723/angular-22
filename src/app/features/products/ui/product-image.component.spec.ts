import { TestBed } from '@angular/core/testing';
import { ProductImageComponent } from './product-image.component';

describe('Product image', () => {
  it('recreates the image when list reordering changes its priority', async () => {
    const fixture = TestBed.createComponent(ProductImageComponent);
    fixture.componentRef.setInput('source', '/mock-product.svg');
    fixture.componentRef.setInput('description', 'Reordered product');
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const lazyImage = element.querySelector('img');
    expect(lazyImage?.getAttribute('loading')).toBe('lazy');
    fixture.componentRef.setInput('priority', true);
    await fixture.whenStable();
    expect(element.querySelector('img')).not.toBe(lazyImage);
    expect(element.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
    fixture.componentRef.setInput('priority', false);
    await fixture.whenStable();
    expect(element.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  });

  it('provides a named failure fallback and resets it when the image changes', async () => {
    const fixture = TestBed.createComponent(ProductImageComponent);
    fixture.componentRef.setInput('source', '/mock-product.svg');
    fixture.componentRef.setInput('description', 'Demo product');
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Image unavailable for Demo product');
    fixture.componentRef.setInput('source', '/mock-product.svg?v=2');
    await fixture.whenStable();
    expect(element.querySelector('img')?.alt).toBe('Demo product');
    expect(element.querySelector('[role="img"]')).toBeNull();
  });
});
