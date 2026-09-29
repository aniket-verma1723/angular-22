import { Component, computed } from '@angular/core';
import { FICTIONAL_MEASUREMENTS, summarizeMeasurements } from './performance-measurements';

@Component({
  selector: 'app-demand-lesson',
  template: `
    <article aria-labelledby="demand-heading">
      <h3 id="demand-heading">On-demand route lesson</h3>
      <p>This component is now activated. It is not opted into performance preloading.</p>
      <p data-route-summary>{{ summary().count }} fictional measurements;
        total {{ summary().totalMs }} ms; average {{ summary().averageMs }} ms.</p>
      <p>The computation matches the preload candidate. These are not benchmark results.</p>
    </article>
  `
})
export class DemandLessonComponent {
  protected readonly summary = computed(() => summarizeMeasurements(FICTIONAL_MEASUREMENTS));
}
