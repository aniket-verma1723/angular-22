import { Component, computed, DestroyRef, inject } from '@angular/core';
import { PayloadLifetime } from './payload-lifetime.service';
import { FICTIONAL_MEASUREMENTS, summarizeMeasurements } from './performance-measurements';

@Component({
  selector: 'app-deferred-summary',
  templateUrl: './deferred-summary.component.html',
  styleUrl: './deferred-summary.component.css'
})
export class DeferredSummaryComponent {
  private readonly lifetime = inject(PayloadLifetime);
  protected readonly instanceId = this.lifetime.recordCreation();
  protected readonly summary = computed(() => summarizeMeasurements(FICTIONAL_MEASUREMENTS));
  protected readonly samples = computed(() => FICTIONAL_MEASUREMENTS.slice(0, 10));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.lifetime.recordDestruction(this.instanceId));
  }
}
