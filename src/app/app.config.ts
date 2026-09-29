import { provideZonelessChangeDetection } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';

import { routes } from './app.routes';
import { provideAppData } from './core/config/app-data.providers';
import { PerformancePreloadingStrategy } from './core/routing/performance-preloading.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideAppData(),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PerformancePreloadingStrategy), withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled'
    }))
  ]
};
