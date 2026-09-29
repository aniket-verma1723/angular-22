import { Injectable, signal } from '@angular/core';
import { Observable, Subject, defer, finalize, of, tap, throwError, timeout } from 'rxjs';
import type { Subscriber } from 'rxjs';

export const ROUTING_LAB_BASE = '/labs/routing';
export interface RouteFixture { readonly id: number; readonly name: string; }
const fixtures: readonly RouteFixture[] = [
  { id: 1, name: 'Signal notebook' }, { id: 2, name: 'Injector notebook' }
];

export function parseLabId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || value.trim() !== value) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export type ResolverMode = 'immediate' | 'controlled' | 'error';

/** Route-config scoped, intentionally no standing subscriptions/timers. Views own active work. */
@Injectable()
export class RoutingLabSession {
  private readonly permissionState = signal(true);
  readonly permission = this.permissionState.asReadonly();
  private readonly matchState = signal(true);
  readonly matchAllowed = this.matchState.asReadonly();
  private readonly modeState = signal<ResolverMode>('immediate');
  readonly mode = this.modeState.asReadonly();
  private readonly statusState = signal('idle');
  readonly status = this.statusState.asReadonly();
  private readonly callsState = signal(0);
  readonly calls = this.callsState.asReadonly();
  private readonly activeState = signal(0);
  readonly active = this.activeState.asReadonly();
  private readonly destroyedState = signal(0);
  readonly destroyedDetails = this.destroyedState.asReadonly();
  private nextInstance = 0;
  private pending: { readonly subscriber: Subscriber<RouteFixture>; readonly fixture: RouteFixture } | null = null;
  private readonly startedSubject = new Subject<void>();
  readonly started$ = this.startedSubject.asObservable();

  togglePermission(): void { this.permissionState.update(value => !value); }
  toggleMatch(): void { this.matchState.update(value => !value); }
  setMode(value: string): void {
    if (value === 'immediate' || value === 'controlled' || value === 'error') this.modeState.set(value);
  }
  attachDetail(): number { this.activeState.update(value => value + 1); return ++this.nextInstance; }
  detachDetail(): void {
    this.activeState.update(value => value - 1);
    this.destroyedState.update(value => value + 1);
  }

  read(id: number): Observable<RouteFixture> {
    return defer(() => {
      this.callsState.update(value => value + 1);
      const fixture = fixtures.find(item => item.id === id);
      if (!fixture) {
        this.statusState.set('failed');
        return throwError(() => new Error('Missing local fixture'));
      }
      this.statusState.set('resolving');
      const source$ = this.modeState() === 'immediate' ? of(fixture)
        : this.modeState() === 'error' ? throwError(() => new Error('Controlled resolver failure'))
          : new Observable<RouteFixture>(subscriber => {
            const pending = { subscriber, fixture };
            this.pending = pending;
            this.startedSubject.next();
            return () => { if (this.pending === pending) this.pending = null; };
          });
      return source$.pipe(
        timeout({ first: 15000 }),
        tap({ next: () => this.statusState.set('resolved'), error: () => this.statusState.set('failed') }),
        finalize(() => { if (this.statusState() === 'resolving') this.statusState.set('cancelled'); })
      );
    });
  }
  release(): void {
    const pending = this.pending;
    if (!pending) return;
    pending.subscriber.next(pending.fixture);
    pending.subscriber.complete();
  }
  fail(): void { this.pending?.subscriber.error(new Error('Controlled resolver failure')); }
  cancel(): void { this.pending?.subscriber.complete(); }

  resetConfiguration(): void {
    this.cancel();
    this.permissionState.set(true);
    this.matchState.set(true);
    this.modeState.set('immediate');
  }
}
