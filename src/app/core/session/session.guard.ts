import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { SessionStore } from './session.store';

// Small allowlist: no schemes, outlets, matrix params, fragments, encoded separators or nested return URLs.
export function safeReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000 || /\s/.test(value)) return '/dashboard';
  return /^\/(?:dashboard|cart|checkout|products(?:\/new|\/[1-9]\d*(?:\/edit)?)?)$/.test(value) ? value : '/dashboard';
}

export const sessionGuard: CanActivateFn = (_route, state) => {
  if (inject(SessionStore).currentUser()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: safeReturnUrl(state.url.split('?')[0]) } });
};

export const demoAdminGuard: CanActivateFn = (route, state) => {
  const authenticated = sessionGuard(route, state);
  if (authenticated !== true) return authenticated;
  return inject(SessionStore).isAdmin() || inject(Router).createUrlTree(['/forbidden']);
};
