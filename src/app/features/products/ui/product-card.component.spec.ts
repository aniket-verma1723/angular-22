import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { productFixture } from '../../../testing/product-fixtures';
import { ProductCardComponent } from './product-card.component';

describe('ProductCardComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  it('emits add intent, preserves detail query and highlights low stock without color alone', async () => {
    const fixture = TestBed.createComponent(ProductCardComponent);
    const product = productFixture({ stock: 2 });
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('queryParams', { page: '2' });
    const added = jasmine.createSpy('add'); fixture.componentInstance.add.subscribe(added);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('button')?.click();
    expect(added).toHaveBeenCalledOnceWith(product);
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/products/1?page=2');
    expect(element.querySelector('.low-stock')?.textContent).toContain('2 in stock');
    fixture.componentRef.setInput('inCart', 2); await fixture.whenStable();
    expect(element.querySelector('button')?.disabled).toBeTrue();
    expect(element.textContent).toContain('Cart limit reached');
    fixture.componentRef.setInput('product', productFixture({ stock: 0 })); await fixture.whenStable();
    expect(element.querySelector('button')?.disabled).toBeTrue();
    fixture.componentRef.setInput('product', productFixture({ stock: 10 })); await fixture.whenStable();
    expect(element.querySelector('.low-stock')).toBeNull();
  });
});
