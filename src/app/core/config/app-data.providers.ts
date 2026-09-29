import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { API_CONFIG, createApiConfig } from './api-config';
import { sessionAuthInterceptor } from '../session/session-auth.interceptor';

export function provideAppData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: API_CONFIG, useValue: createApiConfig('remote') },
    provideHttpClient(withInterceptors([sessionAuthInterceptor]))
  ]);
}
