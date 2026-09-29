import { Component, input } from '@angular/core';

export interface MaterialLesson {
  readonly title: string;
  readonly concept: string;
  readonly tryIt: string;
  readonly mechanism: string;
  readonly mistake: string;
  readonly question: string;
  readonly observation: string;
}

@Component({
  selector: 'app-material-lesson',
  template: `
    <article [attr.aria-label]="lesson().title">
      <h2>{{ lesson().title }}</h2>
      <h3>Concept</h3><p>{{ lesson().concept }}</p>
      <h3>Try it</h3><p>{{ lesson().tryIt }}</p>
      <ng-content />
      <h3>What Angular does</h3><p>{{ lesson().mechanism }}</p>
      <h3>Common mistake</h3><p>{{ lesson().mistake }}</p>
      <h3>Revision question</h3><p>{{ lesson().question }}</p>
      <h3>Test observation</h3><p>{{ lesson().observation }}</p>
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; max-width: 100%; }
    article { padding: clamp(.75rem, 3vw, 1.5rem); border-radius: 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low); color: var(--mat-sys-on-surface);
      overflow-wrap: anywhere; }
    h2 { font-size: 1.4rem; margin-top: 0; }
    h3 { font-size: 1rem; margin-bottom: .25rem; }
    p { line-height: 1.6; margin-top: .25rem; }
  `
})
export class MaterialLessonComponent {
  readonly lesson = input.required<MaterialLesson>();
}
