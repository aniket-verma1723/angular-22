import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { RoutingLabSession, parseLabId } from './routing-lab-session.service';
import type { RouteFixture } from './routing-lab-session.service';

function readFixture(value: unknown): RouteFixture | null {
  if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value)) return null;
  return typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0 && typeof value.name === 'string'
    ? { id: value.id, name: value.name } : null;
}

function readRevision(value: unknown): string {
  return typeof value === 'string' && value.length === 1 && /^[1-9]$/.test(value) ? value : '1';
}

@Component({
  selector: 'app-routing-detail',
  template: `
    <h2 id="route-detail">Resolved notebook {{ id() }}</h2>
    <p>{{ fixture()?.name ?? 'No fixture' }} · component instance {{ instance }}</p>
    <p>Route title: {{ title() }} · fragment: {{ fragment() ?? '(none)' }} · revision: {{ revision() }}</p>
    <label for="route-draft">Instance-local note (40 characters)</label>
    <input id="route-draft" #draft maxlength="40" [value]="note()" (input)="setNote(draft.value)">
    <label><input type="checkbox" [checked]="leaveBlocked()" (change)="toggleLeave()"> Block departure (local canDeactivate)</label>
    <p>Changing :id reuses this instance and note; leaving destroys both. Uncheck the departure block to leave or rerun guards.</p>
  `,
  styles: `:host { display: block; } p { overflow-wrap: anywhere; line-height: 1.6; } label { display: block; margin-block: .75rem; } input { font: inherit; max-width: 100%; box-sizing: border-box; min-height: 44px; color: inherit; background: var(--mat-sys-surface); } input:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 3px; }`
})
export class RoutingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(RoutingLabSession);
  readonly instance = this.session.attachDetail();
  readonly id = input<number | null, unknown>(null, { transform: parseLabId });
  readonly fixture = input<RouteFixture | null, unknown>(null, { transform: readFixture });
  readonly title = toSignal(this.route.title, { initialValue: '' });
  readonly fragment = toSignal(this.route.fragment, { initialValue: null });
  readonly revision = input<string, unknown>('1', { transform: readRevision });
  private readonly noteState = signal('');
  readonly note = this.noteState.asReadonly();
  private readonly leaveState = signal(false);
  readonly leaveBlocked = this.leaveState.asReadonly();
  constructor() { inject(DestroyRef).onDestroy(() => this.session.detachDetail()); }
  setNote(value: string): void { this.noteState.set(value.slice(0, 40)); }
  toggleLeave(): void { this.leaveState.update(value => !value); }
}
