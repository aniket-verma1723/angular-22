import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { catchError, defer, map, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { toApiError } from '../../../core/http/api-error';
import type { CheckoutRequest, CheckoutResult } from './checkout.models';
import { parseCheckoutReceipt, parseCheckoutRequest } from './checkout.parsers';

@Service()
export class CheckoutApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  create(request: CheckoutRequest): Observable<CheckoutResult> {
    return defer(() => {
      const body = parseCheckoutRequest(request);
      return this.http.post<unknown>(`${this.config.baseUrl}/carts/add`, body).pipe(
        timeout(15000),
        map(value => ({ receipt: parseCheckoutReceipt(value, body), source: this.config.mode }))
      );
    }).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
