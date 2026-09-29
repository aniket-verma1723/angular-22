import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

describe('API error mapping', () => {
  for (const [status, kind] of [[0, 'network'], [200, 'format'], [400, 'validation'], [422, 'validation'],
    [401, 'unauthorized'], [403, 'forbidden'], [404, 'not-found'], [409, 'conflict'],
    [429, 'rate-limit'], [500, 'server'], [503, 'server'], [418, 'unexpected']] as const) {
    it(`maps status ${status} to ${kind} without reflecting untrusted messages`, () => {
      const result = toApiError(new HttpErrorResponse({ status, error: { message: 'Untrusted internal detail' } }));
      expect(result.kind).toBe(kind);
      expect(result.status).toBe(status);
      expect(result.message).not.toContain('Untrusted');
    });
  }

  it('preserves domain errors and normalizes unknown failures', () => {
    const error = new ApiError('format', 'Invalid product response.');
    expect(toApiError(error)).toBe(error);
    expect(toApiError('raw failure').kind).toBe('unexpected');
  });

  it('parses Retry-After seconds or dates without automatically retrying', () => {
    const mapRetry = (value: string) => toApiError(new HttpErrorResponse({
      status: 429, headers: new HttpHeaders({ 'Retry-After': value })
    }), Date.parse('2026-01-01T00:00:00Z')).retryAfterSeconds;
    expect(mapRetry('12')).toBe(12);
    expect(mapRetry('0')).toBe(0);
    expect(mapRetry('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
    expect(mapRetry('9007199254740992')).toBeNull();
    expect(mapRetry('Thu, 01 Jan 2026 00:00:30 GMT')).toBe(30);
    expect(mapRetry('Wed, 31 Dec 2025 23:59:59 GMT')).toBe(0);
    expect(mapRetry('-1')).toBeNull();
    expect(mapRetry('1.5')).toBeNull();
    expect(mapRetry('invalid')).toBeNull();
  });
});
