import { NgOptimizedImage } from '@angular/common';
import { Component, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-product-image',
  imports: [NgOptimizedImage],
  template: `
    @if (failed()) {
      <div class="fallback" role="img" [attr.aria-label]="'Image unavailable for ' + description()">Image unavailable</div>
    } @else if (priority()) {
      <img [ngSrc]="source()" [alt]="description()" width="400" height="300" priority (error)="markFailed()">
    } @else {
      <img [ngSrc]="source()" [alt]="description()" width="400" height="300" (error)="markFailed()">
    }
  `,
  styles: `
    :host { display: block; overflow: hidden; border-radius: 16px; background: var(--mat-sys-surface-container); }
    img, .fallback { display: block; width: 100%; aspect-ratio: 4 / 3; height: auto; object-fit: contain; }
    .fallback { display: grid; place-items: center; color: var(--mat-sys-on-surface-variant); }
  `
})
export class ProductImageComponent {
  readonly source = input.required<string>();
  readonly description = input.required<string>();
  // Reordering can change priority; each template branch keeps the directive's input static.
  readonly priority = input(false);
  private readonly failedState = linkedSignal({ source: this.source, computation: () => false });
  protected readonly failed = this.failedState.asReadonly();
  protected markFailed(): void { this.failedState.set(true); }
}
