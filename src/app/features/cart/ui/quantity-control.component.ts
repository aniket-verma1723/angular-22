import { Component, computed, input, model, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-quantity-control',
  imports: [MatButton],
  template: `
    <div role="group" [attr.aria-label]="label()">
      <button mat-stroked-button type="button" [disabled]="unavailable() || quantity() <= 1"
        [attr.aria-label]="'Decrease ' + label()" (click)="change(quantity() - 1)">−</button>
      <input #entry type="number" min="1" [max]="limit()" step="1" [value]="quantity()" [disabled]="unavailable()"
        [attr.aria-label]="label()" (change)="enter(entry)" [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-description]="error() || 'Whole quantity, 1 to ' + limit()">
      <button mat-stroked-button type="button" [disabled]="unavailable() || quantity() >= limit()"
        [attr.aria-label]="'Increase ' + label()" (click)="change(quantity() + 1)">+</button>
    </div>
    @if (error()) { <p role="alert">{{ error() }}</p> }
  `,
  styles: `
    :host { display: inline-block; }
    div { display: flex; align-items: center; gap: 12px; }
    input { width: 4.5rem; min-height: 44px; box-sizing: border-box; text-align: center; font: inherit;
      color: var(--mat-sys-on-surface); background: var(--mat-sys-surface); border: 1px solid var(--mat-sys-outline); border-radius: 8px; }
    p { max-width: 30ch; font-size: .85rem; }
    button { min-width: 44px; min-height: 44px; padding: 0 10px; }
  `
})
export class QuantityControlComponent {
  readonly quantity = model(1);
  readonly max = input(99);
  readonly label = input('Quantity');
  readonly disabled = input(false);
  protected readonly error = signal('');
  protected readonly unavailable = computed(() => this.disabled() || !Number.isSafeInteger(this.max()) || this.max() < 1);
  protected readonly limit = computed(() => Number.isSafeInteger(this.max()) ? Math.max(1, Math.min(99, this.max())) : 1);

  protected change(quantity: number): void {
    if (!this.unavailable() && Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= this.limit()) {
      this.error.set('');
      this.quantity.set(quantity);
    }
  }

  protected enter(entry: HTMLInputElement): void {
    const quantity = entry.valueAsNumber;
    if (!this.unavailable() && Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= this.limit()) {
      this.change(quantity);
    } else {
      entry.value = String(this.quantity());
      this.error.set(`Enter a whole quantity from 1 to ${this.limit()}. The previous quantity was kept.`);
    }
  }
}
