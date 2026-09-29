import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import type { PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect, MatOption } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { productLoadState } from '../data/product-load-state';
import type { ProductQuery, ProductSummary } from '../data/product.models';
import { CartService } from '../../cart/data/cart.service';
import { ProductsApiService } from '../data/products-api.service';
import { isCanonicalProductUrl, normalizeSearch, parseProductUrl, productUrlParams, sameProductQuery, SEARCH_MAX_LENGTH } from '../data/product-url';
import { ProductErrorComponent } from '../ui/product-error.component';
import { ProductCardComponent } from '../ui/product-card.component';

@Component({
  selector: 'app-product-catalogue',
  imports: [RouterLink, MatButton, MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatPaginator, MatProgressBar, ProductErrorComponent, ProductCardComponent],
  templateUrl: './product-catalogue.component.html',
  styleUrl: './product-catalogue.component.css'
})
export class ProductCatalogueComponent {
  protected readonly cart = inject(CartService);
  protected readonly cartMessage = signal('');
  private readonly api = inject(ProductsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchEdits$ = new Subject<string | null>();
  private readonly retryProducts$ = new Subject<void>();
  private readonly retryCategories$ = new Subject<void>();
  private readonly navigationErrorState = signal(false);
  private readonly query$ = this.route.queryParamMap.pipe(map(parseProductUrl), distinctUntilChanged(sameProductQuery));
  protected readonly query = toSignal(this.query$, { initialValue: parseProductUrl(this.route.snapshot.queryParamMap) });
  private readonly searchDraftState = linkedSignal({ source: this.query, computation: query => query.filter.kind === 'search' ? query.filter.term : '' });
  protected readonly searchDraft = this.searchDraftState.asReadonly();
  protected readonly navigationError = this.navigationErrorState.asReadonly();
  protected readonly maxSearchLength = SEARCH_MAX_LENGTH;
  protected readonly pageSizes = [12, 24, 48];
  protected readonly mode = inject(API_CONFIG).mode;
  protected readonly linkParams = computed(() => productUrlParams(this.query()));
  protected readonly category = computed(() => { const filter = this.query().filter; return filter.kind === 'category' ? filter.slug : ''; });
  protected readonly products = toSignal(combineLatest([this.query$, this.retryProducts$.pipe(startWith(undefined))]).pipe(
    switchMap(([query]) => productLoadState(this.api.list(query)))
  ), { initialValue: { status: 'loading' } });
  protected readonly categories = toSignal(this.retryCategories$.pipe(startWith(undefined),
    switchMap(() => productLoadState(this.api.categories()))), { initialValue: { status: 'loading' } });
  protected readonly categoryOptions = computed(() => { const state = this.categories(); return state.status === 'success' ? state.value : []; });
  protected readonly missingCategory = computed(() => this.category() && !this.categoryOptions().some(option => option.slug === this.category()));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const query = parseProductUrl(params);
      if (!isCanonicalProductUrl(params, query)) this.navigate(query, true);
    });
    // A route change cancels an uncommitted search, including Back/Forward and category selection.
    this.route.queryParamMap.pipe(
      switchMap(() => this.searchEdits$.pipe(map(value => value === null ? null : normalizeSearch(value)), debounceTime(300), distinctUntilChanged())),
      takeUntilDestroyed()
    ).subscribe(term => {
      if (term === null) return;
      const query = this.query();
      const filter: ProductQuery['filter'] = term ? { kind: 'search', term } : { kind: 'all' };
      if (query.filter.kind === filter.kind && (filter.kind !== 'search' ||
          (query.filter.kind === 'search' && query.filter.term === filter.term))) return;
      this.navigate({ ...query, pageIndex: 0, filter });
    });
  }

  protected search(value: string): void {
    this.searchDraftState.set(value);
    this.searchEdits$.next(value);
  }

  protected addToCart(product: ProductSummary): void {
    const result = this.cart.add(product);
    this.cartMessage.set(result.ok ? `${product.title} added. Cart now has ${this.cart.itemCount()} items.` : result.message);
  }

  protected selectCategory(value: string): void {
    this.navigate({ ...this.query(), pageIndex: 0, filter: value ? { kind: 'category', slug: value } : { kind: 'all' } });
  }

  protected sort(value: string): void {
    if (value === 'title' || value === 'price' || value === 'rating') this.navigate({ ...this.query(), sortBy: value, pageIndex: 0 });
  }

  protected order(value: string): void {
    if (value === 'asc' || value === 'desc') this.navigate({ ...this.query(), order: value, pageIndex: 0 });
  }

  protected paginate(event: PageEvent): void {
    if (event.pageSize !== 12 && event.pageSize !== 24 && event.pageSize !== 48) return;
    this.navigate({ ...this.query(), pageSize: event.pageSize,
      pageIndex: event.pageSize === this.query().pageSize ? event.pageIndex : 0 });
  }

  protected clearFilters(): void {
    this.searchEdits$.next(null);
    this.searchDraftState.set('');
    this.navigate({ ...this.query(), pageIndex: 0, filter: { kind: 'all' } });
  }
  protected firstPage(): void { this.navigate({ ...this.query(), pageIndex: 0 }); }
  protected retryProducts(): void { this.retryProducts$.next(); }
  protected retryCategories(): void { this.retryCategories$.next(); }

  private navigate(query: ProductQuery, replaceUrl = false): void {
    this.navigationErrorState.set(false);
    const target = this.router.createUrlTree([], { relativeTo: this.route, queryParams: productUrlParams(query) });
    if (this.router.serializeUrl(target) === this.router.url) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: productUrlParams(query), replaceUrl })
      .then(success => { if (!success) this.navigationErrorState.set(true); })
      .catch(() => this.navigationErrorState.set(true));
  }
}
