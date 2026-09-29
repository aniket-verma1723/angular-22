import { HttpErrorResponse } from '@angular/common/http';

export type ApiErrorKind = 'validation' | 'unauthorized' | 'forbidden' | 'not-found' |
  'conflict' | 'rate-limit' | 'server' | 'network' | 'format' | 'unexpected';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
  }
}

export function toApiError(error: unknown, now = Date.now()): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError('unexpected', 'The request could not be completed.');
  }
  const status = error.status;
  if (status === 0) {
    return new ApiError('network', 'Unable to reach the service. Check your connection and try again.', status);
  }
  if (status >= 200 && status < 300) {
    return new ApiError('format', 'The service returned an invalid response.', status);
  }
  switch (status) {
    case 400:
    case 422: return new ApiError('validation', 'Some request values are invalid.', status);
    case 401: return new ApiError('unauthorized', 'A demo session is required.', status);
    case 403: return new ApiError('forbidden', 'This action is not allowed.', status);
    case 404: return new ApiError('not-found', 'The requested record was not found.', status);
    case 409: return new ApiError('conflict', 'The data changed. Reload before trying again.', status);
    case 429: return new ApiError('rate-limit', 'Too many requests. Please try again later.', status,
      parseRetryAfter(error.headers.get('Retry-After'), now));
    default: return status >= 500
      ? new ApiError('server', 'The service is temporarily unavailable.', status)
      : new ApiError('unexpected', 'The request could not be completed.', status);
  }
}

function parseRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null;
  if (/^\d+$/.test(value.trim())) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const normalized = value.trim();
  const date = Date.parse(normalized);
  // Accept canonical HTTP dates, not Date.parse's permissive numeric/invalid-calendar inputs.
  if (!Number.isFinite(date) || new Date(date).toUTCString() !== normalized) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}
