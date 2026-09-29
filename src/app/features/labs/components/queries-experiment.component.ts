import { Component, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { QueryPanelComponent } from './query-panel.component';
import { QueryTargetDirective } from './query-target.directive';

@Component({
  selector: 'app-queries-experiment',
  imports: [ExperimentCardComponent, QueryPanelComponent, QueryTargetDirective],
  template: `
    <app-component-experiment-card [lesson]="lesson">
      <div class="controls">
        <button type="button" (click)="reverse()">Reverse projected targets</button>
        <button type="button" (click)="rows.set([])">Clear projected targets</button>
        <button type="button" (click)="rows.set(initialRows)">Reset projected targets</button>
      </div>
      <app-query-panel>
        <p query-heading>Caller-owned targets — activate one to move it last and retain focus.</p>
        @for (row of rows(); track row; let position = $index) {
          <button type="button" [appQueryTarget]="row" (click)="moveLast(row)">{{ row }} ({{ position + 1 }})</button>
        } @empty { <p data-empty>No projected targets.</p> }
      </app-query-panel>
    </app-component-experiment-card>
  `,
  styleUrl: './experiment-controls.css'
})
export class QueriesExperimentComponent {
  private readonly injector = inject(Injector);
  private readonly panel = viewChild(QueryPanelComponent);
  protected readonly initialRows: readonly string[] = ['Projected A', 'Projected B', 'Projected C'];
  protected readonly rows = signal(this.initialRows);
  protected readonly lesson: ComponentLesson = {
    title: 'Content is not the view', coverage: 'C03 · C08 · C10 · C12',
    concept: 'Content queries see caller-supplied directives; view queries see the panel’s own template. Both update when conditional views change.',
    tryIt: 'Show and focus view targets, then focus or move a projected target. Reverse and clear the projected list and compare the two query reports.',
    mechanism: 'contentChild/contentChildren and viewChild/viewChildren query the same marker in different ownership scopes. Stable @for keys move existing DOM nodes; afterNextRender restores the moved target’s focus in a write phase.',
    mistake: 'A query can be absent. Do not assert it exists before a conditional view renders, or use index tracking for reorderable data.',
    revision: 'Why do the panel’s own targets never appear in its content query? Does reordering create new buttons?',
    observation: 'Specs verify separate query results, empty queries, preserved node identity, focus after conditional creation and tracked movement, and new nodes after clear/reset.'
  };

  protected reverse(): void {
    this.rows.update(rows => [...rows].reverse());
  }

  protected moveLast(key: string): void {
    this.rows.update(rows => [...rows.filter(row => row !== key), key]);
    afterNextRender({ write: () => this.panel()?.focusProjected(key) }, { injector: this.injector });
  }
}
