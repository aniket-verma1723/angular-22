import { Component, inject, signal } from '@angular/core';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { RenderMeasurements } from './render-measurements.service';
import type { RenderMeasurementSnapshot } from './render-measurements.service';
import { RenderProbeComponent } from './render-probe.component';

@Component({
  selector: 'app-render-experiment',
  imports: [ExperimentCardComponent, RenderProbeComponent],
  providers: [RenderMeasurements],
  templateUrl: './render-experiment.component.html',
  styleUrl: './experiment-controls.css'
})
export class RenderExperimentComponent {
  private readonly measurements = inject(RenderMeasurements);
  protected readonly visible = signal(false);
  protected readonly padding = signal<8 | 24>(8);
  protected readonly report = signal<RenderMeasurementSnapshot | null>(null);
  protected readonly lesson: ComponentLesson = {
    title: 'Measure after render, without a feedback loop', coverage: 'C05 · C08 · C11 · C12 · §8.4',
    concept: 'Lifecycle hooks describe instance/input/content/view timing; browser render callbacks are for DOM integration after rendering. Measurement is not application state.',
    tryIt: 'Create the probe, then Read measurements. Change padding and read again. Destroy it and read twice: its callback counters should stop. Recreate to observe a new lifetime.',
    mechanism: 'afterNextRender measures once and installs ResizeObserver. afterEveryRender reads after application renders. afterRenderEffect writes padding only when its tracked input changes, then measures in a separate read phase. Cleanup removes the owned style and disconnects the observer; Angular disposes render registrations.',
    mistake: 'Never write a render-count signal from afterEveryRender: displaying it can schedule the next render forever. These callbacks record plain data; only the explicit Read measurements event publishes a readonly snapshot. No timers, manual change detection or root Eager/Zone migration.',
    revision: 'Why can every-render reads increase while effect reads stay unchanged? Why does Read measurements show the prior completed measurements, not the render it is about to cause?',
    observation: 'The snapshot shows actual callback counts and dimensions, never hard-coded observations. Hook history is bounded to 16. Render hooks measure border boxes; ResizeObserver reports content boxes. Specs control layout reads, verify hook order, phased writes, snapshots and disposal. Browser-only callbacks do not establish SSR/hydration coverage.'
  };

  protected readMeasurements(): void { this.report.set(this.measurements.snapshot()); }
  protected changePadding(): void { this.padding.update(value => value === 8 ? 24 : 8); }
}
