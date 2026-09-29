import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_CONFIG } from '../config/api-config';
import { SessionStore } from './session.store';

// Candidate token is private to login verification; never publish an unverified session.
export const LOGIN_ACCESS = new HttpContextToken<string | null>(() => null);

export const sessionAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const store = inject(SessionStore);
  const endpoint = new URL(`${config.baseUrl}/auth/me`);
  let allowed = false;
  try {
    const url = new URL(request.urlWithParams);
    allowed = request.method === 'GET' && url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
      !url.search && !url.hash && !url.username && !url.password;
  } catch { /* Relative and malformed URLs are not approved auth endpoints. */ }
  if (!allowed) return next(request);
  const token = request.context.get(LOGIN_ACCESS) ?? store.accessToken();
  const headers = token ? request.headers.set('Authorization', `Bearer ${token}`) : request.headers.delete('Authorization');
  return next(request.clone({ headers, withCredentials: false, credentials: 'omit' })).pipe(catchError((error: unknown) => {
    if (token && error instanceof HttpErrorResponse && error.status === 401) store.rejectToken(token);
    return throwError(() => error);
  }));
};
