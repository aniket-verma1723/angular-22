import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { API_CONFIG, createApiConfig } from './api-config';
import { mockApiInterceptor } from '../mock/mock-api.interceptor';
import { MockProductBackend } from '../mock/mock-product-backend.service';
import { sessionAuthInterceptor } from '../session/session-auth.interceptor';

export function provideAppData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: API_CONFIG, useValue: createApiConfig('mock') },
    MockProductBackend,
    provideHttpClient(withInterceptors([sessionAuthInterceptor, mockApiInterceptor]))
  ]);
}
