import { Component, signal } from '@angular/core';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { EmulatedSampleComponent, NoneSampleComponent, ShadowSampleComponent } from './encapsulation-samples.component';

@Component({
  selector: 'app-encapsulation-experiment',
  imports: [ExperimentCardComponent, EmulatedSampleComponent, NoneSampleComponent, ShadowSampleComponent],
  template: `
    <app-component-experiment-card [lesson]="lesson">
      <div class="controls">
        <button type="button" (click)="visible.set(!visible())" [attr.aria-expanded]="visible()">
          {{ visible() ? 'Destroy' : 'Create' }} encapsulation samples
        </button>
        <button type="button" (click)="alternate.set(!alternate())" [attr.aria-pressed]="alternate()">Alternate theme token</button>
      </div>
      <p class="sample" data-sentinel>Outside sentinel: no sample border.</p>
      <div data-samples [style.--lab-edge]="alternate() ? 'var(--mat-sys-tertiary, currentColor)' : 'var(--mat-sys-primary, currentColor)'"
        [style.--lab-surface]="'var(--mat-sys-surface, Canvas)'" [style.--lab-ink]="'var(--mat-sys-on-surface, CanvasText)'">
        @if (visible()) {
          <app-emulated-sample />
          <app-shadow-sample />
          <app-none-sample />
        }
      </div>
    </app-component-experiment-card>
  `,
  styleUrl: './experiment-controls.css'
})
export class EncapsulationExperimentComponent {
  protected readonly visible = signal(false);
  protected readonly alternate = signal(false);
  protected readonly lesson: ComponentLesson = {
    title: 'Style boundaries and theme delivery', coverage: 'C01 · C19',
    concept: 'Emulated scopes selectors, ShadowDom creates a native shadow root, and None leaves CSS global. Border patterns and text identify each mode without relying on color.',
    tryIt: 'Create the samples and inspect their DOM. Tab to the native shadow button and activate it. Switch the theme token; destroy and recreate the samples.',
    mechanism: 'CSS custom properties inherit through hosts into shadow content. Angular 22 ShadowDom also receives Angular shared styles; not every external stylesheet is automatically delivered. Material controls need their appropriate theme styles/tokens inside that boundary. This sample uses explicitly styled native controls.',
    mistake: 'Do not assume Emulated blocks incoming global CSS or ShadowDom makes every theme work automatically. None rules must retain the app-none-sample.components-lab-none prefix; no global element rules or deep-selector overrides.',
    revision: 'Why does the shadow button inherit theme variables while an outside sentinel avoids all three sample borders?',
    observation: 'Specs inspect the real shadow root, native focus/activation, inherited computed CSS colors and border styles, outside-style noninterference, and new shadow state after recreation. No experimental isolation mode is used.'
  };
}
