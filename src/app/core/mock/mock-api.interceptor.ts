import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../config/api-config';
import { MockProductBackend } from './mock-product-backend.service';

export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const backend = inject(MockProductBackend);
  if (config.mode !== 'mock') return next(request);
  let url: URL;
  try {
    url = new URL(request.urlWithParams);
  } catch {
    return next(request); // Relative application assets are not API requests.
  }
  const base = new URL(config.baseUrl);
  const prefix = base.pathname.replace(/\/+$/, '');
  if (url.origin !== base.origin || (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`))) {
    return next(request);
  }
  // Every request under this API base is local, including unsupported endpoints (501).
  return backend.handle(request, url.pathname.slice(prefix.length), url);
};
