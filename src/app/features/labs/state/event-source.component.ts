import { Component, DestroyRef, inject } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { Subject, scan } from 'rxjs';

@Component({
  selector: 'app-lab-event-source',
  template: `<button type="button" (click)="send()">Emit child event</button>`,
  styles: `button { font: inherit; min-height: 44px; padding: .5rem; color: inherit; background: var(--mat-sys-surface); border: 1px solid currentColor; border-radius: .5rem; } button:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 3px; }`
})
export class EventSourceComponent {
  private readonly clicks$ = new Subject<void>();
  readonly counted = outputFromObservable(this.clicks$.pipe(scan(count => Math.min(99, count + 1), 0)));
  constructor() { inject(DestroyRef).onDestroy(() => this.clicks$.complete()); }
  send(): void { this.clicks$.next(); }
}
