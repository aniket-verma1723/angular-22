import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import type { Subscriber } from 'rxjs';
import { localNameAvailable } from './forms-lab.model';

export interface AvailabilityRequest { readonly id: number; readonly title: string; }

// Deliberately component-provided, never a root cache or a real endpoint.
@Injectable()
export class LocalAvailabilityService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly waiting = new Map<number, { title: string; subscriber: Subscriber<boolean> }>();
  private readonly requestsState = signal<readonly AvailabilityRequest[]>([]);
  private readonly cancellationsState = signal(0);
  private nextId = 0;
  readonly requests = this.requestsState.asReadonly();
  readonly cancellations = this.cancellationsState.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const request of this.waiting.values()) request.subscriber.complete();
      this.waiting.clear();
      this.requestsState.set([]);
    });
  }

  check(title: string): Observable<boolean> {
    return new Observable(subscriber => {
      if (this.destroyRef.destroyed) { subscriber.complete(); return; }
      const id = ++this.nextId;
      this.waiting.set(id, { title, subscriber });
      this.requestsState.update(requests => [...requests, { id, title }]);
      return () => {
        if (this.waiting.delete(id)) this.cancellationsState.update(count => count + 1);
        this.requestsState.update(requests => requests.filter(request => request.id !== id));
      };
    });
  }

  resolve(id: number): boolean {
    const request = this.waiting.get(id);
    if (!request) return false;
    this.waiting.delete(id);
    request.subscriber.next(localNameAvailable(request.title));
    request.subscriber.complete();
    return true;
  }

  fail(id: number): boolean {
    const request = this.waiting.get(id);
    if (!request) return false;
    this.waiting.delete(id);
    request.subscriber.error(new Error('Local validation fixture failure'));
    return true;
  }
}
