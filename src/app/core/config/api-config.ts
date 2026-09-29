import { InjectionToken } from '@angular/core';

export type DataMode = 'remote' | 'mock';

export interface ApiConfig {
  readonly baseUrl: string;
  readonly mode: DataMode;
}

export function createApiConfig(mode: DataMode, baseUrl = 'https://dummyjson.com'): ApiConfig {
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('API configuration requires an HTTP(S) base URL without credentials, query or fragment.');
  }
  return Object.freeze({ mode, baseUrl: url.href.replace(/\/+$/, '') });
}

// Public configuration only. No API key, browser secret, or runtime mode toggle.
export const API_CONFIG = new InjectionToken<ApiConfig>('Learning API configuration', {
  providedIn: 'root',
  factory: () => createApiConfig('remote')
});
