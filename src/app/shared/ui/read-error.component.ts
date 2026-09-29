import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import type { ApiError, ApiErrorKind } from '../../core/http/api-error';

const labels: Record<ApiErrorKind, string> = {
  validation: 'Invalid link or request', unauthorized: 'Authentication required', forbidden: 'Access denied',
  'not-found': 'Not found', conflict: 'Data changed', 'rate-limit': 'Too many requests',
  server: 'Service unavailable', network: 'Connection problem', format: 'Invalid service response', unexpected: 'Unable to load'
};

@Component({
  selector: 'app-read-error',
  imports: [MatButton],
  templateUrl: './read-error.component.html',
  styleUrl: './read-error.component.css'
})
export class ReadErrorComponent {
  readonly error = input.required<ApiError>();
  readonly section = input.required<string>();
  readonly retry = output<void>();
  protected readonly label = computed(() => labels[this.error().kind]);
  protected readonly retryable = computed(() => !['validation', 'not-found', 'forbidden', 'unauthorized'].includes(this.error().kind));
}
