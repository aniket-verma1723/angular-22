import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import type { ApiError, ApiErrorKind } from '../../../core/http/api-error';

const headings: Record<ApiErrorKind, string> = {
  validation: 'Invalid product link or request', unauthorized: 'Demo session required', forbidden: 'Access denied',
  'not-found': 'Product not found', conflict: 'Data changed', 'rate-limit': 'Too many requests',
  server: 'Service unavailable', network: 'Connection problem', format: 'Invalid service response', unexpected: 'Unable to load data'
};

@Component({
  selector: 'app-product-error',
  imports: [MatButton],
  template: `
    <div role="alert"><h2>{{ heading() }}</h2><p>{{ error().message }}</p>
      @if (error().retryAfterSeconds !== null) {
        <p>The service asks you to wait {{ error().retryAfterSeconds }} seconds before trying again.</p>
      }
    </div>
    @if (canRetry()) { <button mat-stroked-button type="button" (click)="retry.emit()">Try again</button> }
  `,
  styles: `:host { display: block; padding: 1.5rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: 16px; } h2 { margin-top: 0; }`
})
export class ProductErrorComponent {
  readonly error = input.required<ApiError>();
  readonly retry = output<void>();
  protected readonly heading = computed(() => headings[this.error().kind]);
  protected readonly canRetry = computed(() => !['validation', 'unauthorized', 'forbidden', 'not-found'].includes(this.error().kind));
}
