import { Component, input } from '@angular/core';

export interface ComponentLesson {
  readonly title: string;
  readonly coverage: string;
  readonly concept: string;
  readonly tryIt: string;
  readonly mechanism: string;
  readonly mistake: string;
  readonly revision: string;
  readonly observation: string;
}

@Component({
  selector: 'app-component-experiment-card',
  template: `
    <article [attr.aria-label]="lesson().title">
      <header><p>{{ lesson().coverage }}</p><h2>{{ lesson().title }}</h2></header>
      <h3>Concept</h3><p>{{ lesson().concept }}</p>
      <h3>Try it</h3><p>{{ lesson().tryIt }}</p>
      <ng-content />
      <h3>What Angular does</h3><p>{{ lesson().mechanism }}</p>
      <h3>Common mistake</h3><p>{{ lesson().mistake }}</p>
      <h3>Revision question</h3><p>{{ lesson().revision }}</p>
      <h3>Test observation</h3><p>{{ lesson().observation }}</p>
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    article { padding: clamp(1rem, 3vw, 1.5rem); border: 1px solid var(--mat-sys-outline-variant, #777);
      border-radius: 1rem; background: var(--mat-sys-surface-container-low, Canvas);
      color: var(--mat-sys-on-surface, CanvasText); overflow-wrap: anywhere; }
    header p { font-size: .85rem; margin: 0; }
    h2 { margin: .4rem 0 1rem; font-size: 1.4rem; }
    h3 { margin: 1rem 0 .3rem; font-size: 1rem; }
    p { margin: .3rem 0 .7rem; line-height: 1.55; }
  `
})
export class ExperimentCardComponent {
  readonly lesson = input.required<ComponentLesson>();
}
