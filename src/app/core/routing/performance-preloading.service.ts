import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, catchError, defer, timeout } from 'rxjs';
import type { Observable } from 'rxjs';

const PRELOAD_TIMEOUT_MS = 15_000;

/**
 * Opts in only the performance lab's `preloaded` child, not its lazy parent.
 * Register with withPreloading(PerformancePreloadingStrategy).
 * This route-local policy cannot inspect ancestor guards and is not authorization.
 */
@Injectable({ providedIn: 'root' })
export class PerformancePreloadingStrategy implements PreloadingStrategy {
  private readonly destroyRef = inject(DestroyRef);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (
      route.path !== 'preloaded' ||
      route.data?.['performancePreload'] !== true ||
      route.canMatch !== undefined ||
      route.canActivate !== undefined ||
      route.canActivateChild !== undefined ||
      // Still declared (deprecated) by the installed Angular 22 router.
      route.canLoad !== undefined
    ) {
      return EMPTY;
    }

    return defer(load).pipe(
      timeout({ first: PRELOAD_TIMEOUT_MS }),
      // Only speculative failures are silent; navigation retains its own error handling.
      // No retry or failure cache: a subsequent navigation can attempt loading again.
      catchError(() => EMPTY),
      // Unsubscription cannot cancel an already-started dynamic import's network work.
      takeUntilDestroyed(this.destroyRef)
    );
  }
}
