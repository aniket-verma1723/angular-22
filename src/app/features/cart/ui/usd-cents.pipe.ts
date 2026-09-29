import { formatCurrency } from '@angular/common';
import { LOCALE_ID, Pipe, inject } from '@angular/core';
import type { PipeTransform } from '@angular/core';

@Pipe({ name: 'usdCents' })
export class UsdCentsPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  transform(cents: number): string {
    return Number.isSafeInteger(cents) && cents >= 0 ? formatCurrency(cents / 100, this.locale, '$', 'USD', '1.2-2') : '—';
  }
}
