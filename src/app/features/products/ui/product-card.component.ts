import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../data/product.models';
import { ProductImageComponent } from './product-image.component';
import { StockLevelDirective } from './stock-level.directive';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe, DecimalPipe, MatButton, MatCard, MatCardActions, MatCardContent, RouterLink, ProductImageComponent, StockLevelDirective],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  readonly product = input.required<ProductSummary>();
  readonly queryParams = input<Record<string, string>>({});
  readonly priority = input(false);
  readonly inCart = input(0);
  readonly limit = input(99);
  readonly add = output<ProductSummary>();
  protected readonly canAdd = computed(() => this.product().stock > 0 && this.inCart() < Math.min(this.product().stock, this.limit()));
}
