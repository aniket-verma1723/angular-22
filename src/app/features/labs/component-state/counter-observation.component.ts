import { Component, inject } from '@angular/core';
import { LabCounter } from './lab-counter.service';

@Component({
  selector: 'app-counter-observation',
  template: `
    <p>Experiment count: <strong data-total>{{ counter.count() }}</strong></p>
    <p>Active probes: <strong data-active>{{ counter.activeProbes() }}</strong></p>
    <p>Lifecycle observations (most recent 12):</p>
    <ol aria-label="Lifecycle observations">
      @for (event of counter.events(); track event.id) {
        <li>{{ event.message }}</li>
      } @empty {
        <li>No lifecycle events yet.</li>
      }
    </ol>
  `
})
export class CounterObservationComponent {
  protected readonly counter = inject(LabCounter);
}
