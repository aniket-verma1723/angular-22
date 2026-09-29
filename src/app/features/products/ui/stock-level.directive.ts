import { Directive, input } from '@angular/core';

@Directive({
  selector: '[appStockLevel]',
  host: { '[class.low-stock]': 'appStockLevel() <= 5', '[style.font-weight]': 'appStockLevel() <= 5 ? 700 : null' }
})
export class StockLevelDirective {
  readonly appStockLevel = input.required<number>();
}
