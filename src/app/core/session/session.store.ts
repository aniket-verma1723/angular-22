import { DestroyRef, NgZone, Service, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { DemoUser } from './session.models';

interface Session { readonly user: DemoUser; readonly accessToken: string; readonly expiresAt: number; }

@Service()
export class SessionStore {
  private readonly state = signal<Session | null>(null);
  private readonly ended = new Subject<void>();
  private readonly zone = inject(NgZone);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly reason = signal('Sign in with a public demo account.');
  readonly user = computed(() => this.state()?.user ?? null);
  readonly notice = this.reason.asReadonly();
  readonly ended$ = this.ended.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => { clearTimeout(this.expiryTimer); this.ended.next(); this.ended.complete(); });
  }

  currentUser(): DemoUser | null { this.checkExpiry(); return this.user(); }
  accessToken(): string | null { this.checkExpiry(); return this.state()?.accessToken ?? null; }
  isAdmin(): boolean { return this.currentUser()?.role === 'demo-admin'; }

  establish(user: DemoUser, accessToken: string, expiresAt: number): void {
    clearTimeout(this.expiryTimer);
    this.state.set({ user: Object.freeze({ ...user }), accessToken, expiresAt });
    this.reason.set('Demo session active. Reload, logout or expiry ends it.');
    // A session timer must not keep Angular stability waiting for 30 minutes.
    this.zone.runOutsideAngular(() => {
      this.expiryTimer = setTimeout(() => this.zone.run(() => this.logout('Demo session expired. Sign in again.')), Math.max(0, expiresAt - Date.now()));
    });
  }

  logout(message = 'Signed out. Your anonymous cart is kept; no tokens were stored.'): void {
    clearTimeout(this.expiryTimer); this.expiryTimer = undefined;
    this.state.set(null); this.reason.set(message); this.ended.next();
  }

  rejectToken(token: string): void {
    if (this.state()?.accessToken === token) this.logout('The service rejected this session. Sign in again.');
  }

  private checkExpiry(): void {
    const state = this.state();
    if (state && Date.now() >= state.expiresAt) this.logout('Demo session expired. Sign in again.');
  }
}
