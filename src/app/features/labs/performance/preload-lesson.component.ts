import { Component, computed } from '@angular/core';
import { FICTIONAL_MEASUREMENTS, summarizeMeasurements } from './performance-measurements';

@Component({
  selector: 'app-preload-lesson',
  template: `
    <article aria-labelledby="preload-heading">
      <h3 id="preload-heading">Preload candidate route lesson</h3>
      <p>This component is now activated. Opt-in metadata does not prove its code was preloaded.</p>
      <p data-route-summary>{{ summary().count }} fictional measurements;
        total {{ summary().totalMs }} ms; average {{ summary().averageMs }} ms.</p>
      <p>The computation matches the on-demand lesson. Inspect actual download timing separately.</p>
    </article>
  `
})
export class PreloadLessonComponent {
  protected readonly summary = computed(() => summarizeMeasurements(FICTIONAL_MEASUREMENTS));
}
