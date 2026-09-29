import { Component, InjectionToken, inject, input } from '@angular/core';
import { DiCounter } from './di-experiment';

export const ELEMENT_SCOPE = new InjectionToken<string>('element scope');
export const VIEW_SCOPE = new InjectionToken<string>('view visibility');
export const ABSENT_SCOPE = new InjectionToken<string>('deliberately absent');
export const OUTER_SCOPE = new InjectionToken<string>('outer host boundary probe');

@Component({
  selector: 'app-scope-probe',
  providers: [{ provide: ELEMENT_SCOPE, useValue: 'child' }],
  template: `
    <h4>{{ label() }}</h4>
    <dl>
      <dt>self</dt><dd>{{ self }}</dd>
      <dt>skipSelf</dt><dd>{{ parent }}</dd>
      <dt>view token</dt><dd>{{ view }}</dd>
      <dt>host view token</dt><dd>{{ hostView ?? 'null' }}</dd>
      <dt>self + optional view token</dt><dd>{{ selfView ?? 'null' }}</dd>
      <dt>optional absent</dt><dd>{{ absent ?? 'null' }}</dd>
      <dt>outer token, unrestricted</dt><dd>{{ outer }}</dd>
      <dt>outer token, host + optional</dt><dd>{{ hostOuter ?? 'null' }}</dd>
    </dl>
    <p>Shared component counter: {{ counter.count() }}</p>
    <button type="button" (click)="counter.increment()">Increment {{ label() }} counter</button>
  `,
  styles: `:host { display: block; padding: .75rem; border: 1px solid currentColor; border-radius: .5rem; } dl { margin: 0; } dt { font-weight: 600; } dd { margin: 0 0 .5rem; } button { min-height: 44px; font: inherit; color: inherit; background: var(--mat-sys-surface); border: 1px solid currentColor; border-radius: .5rem; } button:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 3px; }`
})
export class ScopeProbeComponent {
  readonly label = input.required<string>();
  readonly self = inject(ELEMENT_SCOPE, { self: true });
  readonly parent = inject(ELEMENT_SCOPE, { skipSelf: true });
  readonly view = inject(VIEW_SCOPE);
  readonly hostView = inject(VIEW_SCOPE, { host: true, optional: true });
  readonly selfView = inject(VIEW_SCOPE, { self: true, optional: true });
  readonly absent = inject(ABSENT_SCOPE, { optional: true });
  readonly outer = inject(OUTER_SCOPE);
  readonly hostOuter = inject(OUTER_SCOPE, { host: true, optional: true });
  readonly counter = inject(DiCounter);
}

@Component({
  selector: 'app-scope-panel',
  imports: [ScopeProbeComponent],
  providers: [DiCounter, { provide: ELEMENT_SCOPE, useValue: 'component' }],
  viewProviders: [{ provide: VIEW_SCOPE, useValue: 'panel-view' }],
  template: `<app-scope-probe label="Panel view child" /><ng-content />`,
  styles: `:host { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }`
})
export class ScopePanelComponent {}
