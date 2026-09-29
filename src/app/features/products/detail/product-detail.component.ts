import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, combineLatest, distinctUntilChanged, map, startWith, switchMap, throwError } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { ApiError } from '../../../core/http/api-error';
import { productLoadState } from '../data/product-load-state';
import { parseProductUrl, productIdFromUrl, productUrlParams } from '../data/product-url';
import { ProductsApiService } from '../data/products-api.service';
import { ProductErrorComponent } from '../ui/product-error.component';
import { ProductImageComponent } from '../ui/product-image.component';
import { CartService } from '../../cart/data/cart.service';
import { StockLevelDirective } from '../ui/stock-level.directive';

@Component({
  selector: 'app-product-detail',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, MatButton, MatCard, MatCardContent,
    MatProgressBar, ProductErrorComponent, ProductImageComponent, StockLevelDirective],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent {
  protected readonly cart = inject(CartService);
  protected readonly cartMessage = signal('');
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProductsApiService);
  private readonly retry$ = new Subject<void>();
  protected readonly mode = inject(API_CONFIG).mode;
  protected readonly backParams = toSignal(this.route.queryParamMap.pipe(map(params => productUrlParams(parseProductUrl(params)))),
    { initialValue: productUrlParams(parseProductUrl(this.route.snapshot.queryParamMap)) });
  protected readonly product = toSignal(combineLatest([
    this.route.paramMap.pipe(map(params => productIdFromUrl(params.get('id'))), distinctUntilChanged()),
    this.retry$.pipe(startWith(undefined))
  ]).pipe(switchMap(([id]) => productLoadState(id === null
    ? throwError(() => new ApiError('validation', 'Use a positive whole-number product ID.')) : this.api.get(id)))),
  { initialValue: { status: 'loading' } });
  protected readonly images = computed(() => {
    const state = this.product();
    return state.status === 'success' ? [...new Set(state.value.images.length ? state.value.images : [state.value.thumbnail])] : [];
  });
  protected retry(): void { this.retry$.next(); }
  protected readonly canAdd = computed(() => {
    const state = this.product();
    if (state.status !== 'success') return false;
    const product = state.value;
    return product.stock > 0 && (this.cart.quantityById().get(product.id) ?? 0) < Math.min(product.stock, this.cart.limitsById().get(product.id) ?? 99);
  });
  protected addToCart(): void {
    const state = this.product();
    if (state.status !== 'success') return;
    const result = this.cart.add(state.value);
    this.cartMessage.set(result.ok ? `${state.value.title} added. Cart now has ${this.cart.itemCount()} items.` : result.message);
  }
}
