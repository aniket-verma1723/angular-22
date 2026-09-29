import { Component, input } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';

@Component({
  selector: 'app-forms-lesson',
  imports: [MatCard, MatCardContent],
  template: `
    <mat-card appearance="outlined"><mat-card-content>
      <h2>Concept</h2><p>{{ concept() }}</p>
      <h2>Try it</h2><p>{{ exercise() }}</p>
      <h2>What Angular does</h2><p>{{ mechanism() }}</p>
      <h2>Common mistake</h2><p>{{ mistake() }}</p>
      <h2>Revision question</h2><p>{{ question() }}</p>
      <p><strong>Observation:</strong> Invalid and pending forms cannot save. Fail keeps the draft;
        Complete success and Reset clear it. Every save is a local simulator with no network or persistence.</p>
      <p>Leaving or reloading loses the draft. Router stay/discard protection requires FormsLabGuard on this route;
        browser reload protection is best-effort only.</p>
    </mat-card-content></mat-card>
  `,
  styles: `:host { display: block; } h2 { font-size: 1.05rem; margin-bottom: 4px; } p { line-height: 1.6; overflow-wrap: anywhere; }`
})
export class FormsLessonComponent {
  readonly concept = input.required<string>();
  readonly exercise = input.required<string>();
  readonly mechanism = input.required<string>();
  readonly mistake = input.required<string>();
  readonly question = input.required<string>();
}
