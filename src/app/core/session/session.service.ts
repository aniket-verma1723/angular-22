import { HttpClient, HttpContext } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { catchError, defer, finalize, map, switchMap, takeUntil, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api-config';
import { ApiError, toApiError } from '../http/api-error';
import { LOGIN_ACCESS } from './session-auth.interceptor';
import { SESSION_MINUTES } from './session.models';
import type { DemoCredentials, DemoRole, DemoUser } from './session.models';
import { parseCredentials, parseLogin, parseProfile } from './session.parsers';
import { SessionStore } from './session.store';

@Service()
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly store = inject(SessionStore);
  private readonly active = signal(false);
  readonly busy = this.active.asReadonly();

  login(credentials: DemoCredentials, role: DemoRole): Observable<DemoUser> {
    return defer(() => {
      if (this.active() || this.store.currentUser()) throw new ApiError('conflict', 'Finish the current session operation or sign out first.');
      if (role !== 'learner' && role !== 'demo-admin') throw new ApiError('validation', 'Choose a local practice role.');
      const body = { ...parseCredentials(credentials), expiresInMins: SESSION_MINUTES };
      const expiresAt = Date.now() + SESSION_MINUTES * 60_000;
      this.active.set(true);
      return this.http.post<unknown>(`${this.config.baseUrl}/auth/login`, body, { credentials: 'omit' }).pipe(
        map(parseLogin),
        switchMap(candidate => this.http.get<unknown>(`${this.config.baseUrl}/auth/me`, {
          context: new HttpContext().set(LOGIN_ACCESS, candidate.accessToken), credentials: 'omit'
        }).pipe(map(parseProfile), map(profile => {
          if (profile.id !== candidate.profile.id || profile.username !== candidate.profile.username) throw new ApiError('format', 'Login and profile identities do not match.');
          return { user: { ...profile, role }, accessToken: candidate.accessToken };
        }))),
        timeout(15000), takeUntil(this.store.ended$),
        map(result => { this.store.establish(result.user, result.accessToken, expiresAt); return result.user; }),
        finalize(() => this.active.set(false))
      );
    }).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }

  verify(): Observable<DemoUser> {
    return defer(() => {
      const user = this.store.currentUser(); const token = this.store.accessToken();
      if (!user || !token) throw new ApiError('unauthorized', 'Sign in before checking your session.');
      if (this.active()) throw new ApiError('conflict', 'A session operation is already running.');
      this.active.set(true);
      return this.http.get<unknown>(`${this.config.baseUrl}/auth/me`, { credentials: 'omit' }).pipe(
        timeout(15000), map(parseProfile), map(profile => {
          if (profile.id !== user.id || profile.username !== user.username) {
            this.store.rejectToken(token); throw new ApiError('format', 'The service returned a different demo identity. Sign in again.');
          }
          return { ...profile, role: user.role };
        }), takeUntil(this.store.ended$), finalize(() => this.active.set(false))
      );
    }).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
