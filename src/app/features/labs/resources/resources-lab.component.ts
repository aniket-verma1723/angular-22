import { Component, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../../core/config/api-config';
import { ResourceExperimentComponent } from './resource-experiment.component';
import type { ResourceVariant } from './resource-readers';

const COMPARISONS = {
  rxjs: {
    title: 'HttpClient + RxJS / toSignal',
    mechanism: 'Each Load is an event. switchMap subscribes to the cold ProductsApiService.get read and cancels the previous inner subscription. Inner catchError keeps later loads alive; one toSignal owns teardown.',
    use: 'Choose this for explicit event composition, concurrency rules, or richer RxJS workflows. The stream explicitly models loading and same-ID refresh states.',
    mistake: 'Subscribing twice to a cold HTTP observable sends two requests. Catching outside switchMap can end future interactions.',
    question: 'Why does error recovery belong inside switchMap, and who unsubscribes when this view is destroyed?'
  },
  httpResource: {
    title: 'httpResource',
    mechanism: 'httpResource from @angular/common/http sends a direct GET through the existing Angular HTTP pipeline. Its request callback reads the selected-ID signal: new IDs change the request on the same resource instance; undefined stays idle. parse validates the unknown product shape.',
    use: 'Choose this for HTTP reads with built-in status, error and reload signals. New requests invalidate the previous value synchronously; Angular cancels and replaces HTTP in its resource effect. The guarded UI state checks identity before publishing a product. An identity mismatch is a UI validation error, not the underlying resource error signal. Same-ID reads use reload(); only validated values get a stale preview. Clear explicitly destroys and recreates the idle resource to guarantee cancellation in Angular 22.1.7.',
    mistake: 'Reading the current selected ID inside parse can validate an older response against a newer selection. A TypeScript generic is not validation.',
    question: 'Why check loading before reading the value, and validate identity before publishing it rather than reading the selected ID inside parse?'
  },
  rxResource: {
    title: 'rxResource',
    mechanism: 'rxResource from @angular/core/rxjs-interop uses params and a stream factory returning ProductsApiService.get(params). Angular owns the subscription and replaces it when parameters change.',
    use: 'Choose this when an existing observable data service should expose resource state. The stream must emit a value or error; completing without either is not a successful empty product.',
    mistake: 'Returning EMPTY from error recovery does not produce a valid resource value. Do not call an observable factory three times just to read three state properties.',
    question: 'What happens to the old observable when params changes, and why is EMPTY different from idle?'
  },
  resource: {
    title: 'resource with an abort-aware promise loader',
    mechanism: 'resource from @angular/core uses params and loader({ params, abortSignal }). A local firstValueFrom adapter wraps the existing HttpClient service, not fetch. takeUntil(fromEvent(abortSignal, "abort")) releases the HTTP subscription and listener.',
    use: 'Choose this for a genuine promise-based read boundary. Here the adapter is intentionally educational; rxResource is simpler for an existing observable. Already-aborted signals never start the reader.',
    mistake: 'A promise alone cannot cancel HTTP. Ignoring abortSignal leaves old work running; cancellation is not a successful empty response.',
    question: 'Which resource owns the abort signal, and what stops both the subscription and abort listener?'
  }
} satisfies Record<ResourceVariant, { title: string; mechanism: string; use: string; mistake: string; question: string }>;

@Component({
  selector: 'app-resources-lab',
  imports: [ResourceExperimentComponent],
  templateUrl: './resources-lab.component.html',
  styleUrl: './resources-lab.component.css'
})
export class ResourcesLabComponent {
  private readonly variantState = signal<ResourceVariant>('rxjs');
  private readonly selectionErrorState = signal(false);
  protected readonly variant = this.variantState.asReadonly();
  protected readonly selectionError = this.selectionErrorState.asReadonly();
  protected readonly lesson = computed(() => COMPARISONS[this.variant()]);
  protected readonly mode = inject(API_CONFIG).mode;

  protected choose(value: string): void {
    if (value !== 'rxjs' && value !== 'httpResource' && value !== 'rxResource' && value !== 'resource') {
      this.selectionErrorState.set(true);
      return;
    }
    this.selectionErrorState.set(false);
    this.variantState.set(value);
  }
}
