import { Component, signal } from '@angular/core';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { ComposedToggleComponent, InheritedToggleComponent } from './toggle-examples.component';

@Component({
  selector: 'app-composition-experiment',
  imports: [ExperimentCardComponent, ComposedToggleComponent, InheritedToggleComponent],
  template: `
    <app-component-experiment-card [lesson]="lesson">
      <label><input #block type="checkbox" [checked]="blocked()" (change)="blocked.set(block.checked)">Disable composed toggle</label>
      <div class="controls">
        <button appInheritedToggle type="button" [(pressed)]="inherited">Inherited toggle</button>
        <button appComposedToggle type="button" [(pressed)]="composed" [disabled]="blocked()"
          (activated)="lastActivation.set($event)">Composed toggle</button>
        <button type="button" (click)="reset()">Reset parent models</button>
      </div>
      <p class="observation">Parent models — inherited: <strong data-inherited>{{ inherited() }}</strong>;
        composed: <strong data-composed>{{ composed() }}</strong>;
        last semantic activation: <strong data-activation>{{ lastActivation() ?? 'none' }}</strong>.</p>
    </app-component-experiment-card>
  `,
  styleUrl: './experiment-controls.css'
})
export class CompositionExperimentComponent {
  protected readonly inherited = signal(false);
  protected readonly composed = signal(false);
  protected readonly blocked = signal(false);
  protected readonly lastActivation = signal<boolean | null>(null);
  protected readonly lesson: ComponentLesson = {
    title: 'Compose a behavior, or inherit one?', coverage: 'C01 · C05–C08 · C13 · C15 · C20',
    concept: 'A native toggle button has a genuine two-way pressed contract. One example inherits a tiny base; the other composes a directive without a class hierarchy.',
    tryIt: 'Use Space or Enter on either button. Disable only the composed button, then reset both models from the parent. Predict which operation emits semantic activation.',
    mechanism: 'hostDirectives explicitly exposes pressed/pressedChange, aliases blocked to disabled and toggled to activated. booleanAttribute handles boolean attributes; host metadata binds native disabled and aria-pressed. Inheritance reuses the base host listener and model.',
    mistake: 'Host directive inputs/outputs are not public automatically. Native disabled is a property, not an attribute string. Avoid large UI base classes; prefer independently reusable composition.',
    revision: 'Why does a parent reset update aria-pressed without emitting activated? What is hidden unless hostDirectives explicitly exposes it?',
    observation: 'Specs exercise real host clicks, input/output aliases, model propagation, disabled string transforms, projection fallback and independent inherited/composed state.'
  };

  protected reset(): void {
    this.inherited.set(false);
    this.composed.set(false);
  }
}
