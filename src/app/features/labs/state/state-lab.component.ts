import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EventSourceComponent } from './event-source.component';
import { NotificationPreviewComponent } from './notification-preview.component';
import { StateExperiment } from './state-experiment.service';
import { PreviewLedger, StylePreviewComponent } from './style-preview.component';
import type { PreviewObservation } from './style-preview.component';

@Component({
  selector: 'app-state-lab',
  imports: [RouterLink, EventSourceComponent, StylePreviewComponent, NotificationPreviewComponent],
  providers: [StateExperiment, PreviewLedger],
  templateUrl: './state-lab.component.html',
  styleUrl: './state-lab.component.css'
})
export class StateLabComponent {
  protected readonly state = inject(StateExperiment);
  private readonly ledger = inject(PreviewLedger);
  private readonly source = viewChild(EventSourceComponent);
  private readonly showState = signal(true);
  protected readonly show = this.showState.asReadonly();
  private readonly noteState = signal(0);
  protected readonly note = this.noteState.asReadonly();
  private readonly previewState = signal<PreviewObservation | null>(null);
  protected readonly preview = this.previewState.asReadonly();
  private readonly templateEventsState = signal<readonly number[]>([]);
  protected readonly templateEvents = this.templateEventsState.asReadonly();
  private readonly observableEventsState = signal<readonly number[]>([]);
  protected readonly observableEvents = this.observableEventsState.asReadonly();

  constructor() {
    // Imperative subscription ownership follows the queried child's presence, not a copied signal.
    effect(onCleanup => {
      const source = this.source();
      if (!source) return;
      const subscription = outputToObservable(source.counted).subscribe(value => {
        this.observableEventsState.update(values => [...values.slice(-7), value]);
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected toggle(): void { this.showState.update(value => !value); }
  protected changeNote(): void { this.noteState.update(value => value + 1); }
  protected inspectPreview(): void { this.previewState.set(this.ledger.inspect()); }
  protected recordTemplate(value: number): void { this.templateEventsState.update(values => [...values.slice(-7), value]); }
}
