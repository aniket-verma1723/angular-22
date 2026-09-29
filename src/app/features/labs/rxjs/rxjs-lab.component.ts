import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MAX_TRACE_EVENTS, runVirtualExperiment } from './experiment-trace';
import type { TraceEvent } from './experiment-trace';
import { DEFAULT_FLATTENING_SCENARIO, runFlatteningExperiment } from './flattening-experiment';
import type { ClickScenario, FlatteningScenario, FlatteningStrategy, OperationId, TeardownChoice } from './flattening-experiment';
import { runPromiseExperiment } from './promise-experiment';
import { RXJS_LESSONS } from './rxjs-lessons';
import type { RecipeId } from './rxjs-lessons';
import { startSharingExperiment } from './sharing-experiment';
import { startSourceExperiment, startSubjectExperiment } from './source-experiments';
import { startCombinationExperiment, startErrorExperiment, startTimingExperiment, startTransformExperiment } from './stream-experiments';

type ControlId = 'recipe' | 'clicks' | 'strategy' | 'error' | 'teardown';
type ExperimentState = { readonly kind: 'idle' | 'running' | 'failed' }
  | { readonly kind: 'complete'; readonly events: readonly TraceEvent[] };

function selectedValue<T extends string>(event: Event, choices: readonly T[]): T | undefined {
  const target = event.target;
  return target instanceof HTMLSelectElement ? choices.find(choice => choice === target.value) : undefined;
}

@Component({
  selector: 'app-rxjs-lab',
  templateUrl: './rxjs-lab.component.html',
  styleUrl: './rxjs-lab.component.css'
})
export class RxjsLabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly selectedRecipe = signal<RecipeId>('flattening');
  private readonly selectedScenario = signal<FlatteningScenario>(DEFAULT_FLATTENING_SCENARIO);
  private readonly currentState = signal<ExperimentState>({ kind: 'idle' });
  private readonly invalidSelections = signal<ReadonlySet<ControlId>>(new Set());
  private generation = 0;

  protected readonly recipes = RXJS_LESSONS;
  protected readonly strategies: readonly FlatteningStrategy[] = ['switchMap', 'concatMap', 'mergeMap', 'exhaustMap'];
  protected readonly errors: readonly (OperationId | 'none')[] = ['none', 'A', 'B', 'C', 'D'];
  protected readonly recipe = this.selectedRecipe.asReadonly();
  protected readonly scenario = this.selectedScenario.asReadonly();
  protected readonly state = this.currentState.asReadonly();
  protected readonly invalid = this.invalidSelections.asReadonly();
  protected readonly maxEvents = MAX_TRACE_EVENTS;
  protected readonly lesson = computed(() => this.recipes.find(item => item.id === this.recipe()));
  protected readonly canRun = computed(() => this.invalid().size === 0 && this.state().kind !== 'running');
  protected readonly status = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'idle': return 'Idle. Predict the result, then run the experiment.';
      case 'running': return 'Resolving bounded promise results.';
      case 'complete': return `Complete. ${state.events.length} virtual-time events recorded.`;
      case 'failed': return 'Experiment could not finish. Reset and try again.';
    }
  });

  protected chooseRecipe(event: Event): void {
    const value = selectedValue(event, this.recipes.map(item => item.id));
    if (value === undefined) return this.reject('recipe', event);
    this.selectedRecipe.set(value);
    this.invalidSelections.set(new Set());
    this.accept('recipe');
  }

  protected chooseClicks(event: Event): void {
    const value = selectedValue<ClickScenario>(event, ['burst', 'spaced']);
    if (value === undefined) return this.reject('clicks', event);
    this.selectedScenario.update(scenario => ({ ...scenario, clicks: value }));
    this.accept('clicks');
  }

  protected chooseStrategy(event: Event): void {
    const value = selectedValue(event, this.strategies);
    if (value === undefined) return this.reject('strategy', event);
    this.selectedScenario.update(scenario => ({ ...scenario, strategy: value }));
    this.accept('strategy');
  }

  protected chooseError(event: Event): void {
    const value = selectedValue(event, this.errors);
    if (value === undefined) return this.reject('error', event);
    this.selectedScenario.update(scenario => ({ ...scenario, error: value }));
    this.accept('error');
  }

  protected chooseTeardown(event: Event): void {
    const value = selectedValue<TeardownChoice>(event, ['none', 'early', 'late']);
    if (value === undefined) return this.reject('teardown', event);
    this.selectedScenario.update(scenario => ({ ...scenario, teardown: value }));
    this.accept('teardown');
  }

  protected run(): void {
    if (!this.canRun()) return;
    const generation = ++this.generation;
    this.currentState.set({ kind: 'running' });
    const recipe = this.recipe();
    if (recipe === 'promises') {
      void runPromiseExperiment().then(
        events => {
          if (!this.destroyRef.destroyed && generation === this.generation) {
            this.currentState.set({ kind: 'complete', events });
          }
        },
        () => {
          if (!this.destroyRef.destroyed && generation === this.generation) this.currentState.set({ kind: 'failed' });
        }
      );
      return;
    }
    try {
      let events: readonly TraceEvent[];
      switch (recipe) {
        case 'flattening': events = runFlatteningExperiment(this.scenario()); break;
        case 'subjects': events = runVirtualExperiment(startSubjectExperiment); break;
        case 'sources': events = runVirtualExperiment(startSourceExperiment); break;
        case 'transform': events = runVirtualExperiment(startTransformExperiment); break;
        case 'timing': events = runVirtualExperiment(startTimingExperiment); break;
        case 'combination': events = runVirtualExperiment(startCombinationExperiment); break;
        case 'errors': events = runVirtualExperiment(startErrorExperiment); break;
        case 'sharing': events = runVirtualExperiment(startSharingExperiment); break;
      }
      this.currentState.set({ kind: 'complete', events });
    } catch {
      this.currentState.set({ kind: 'failed' });
    }
  }

  protected reset(): void {
    ++this.generation;
    this.currentState.set({ kind: 'idle' });
    this.invalidSelections.set(new Set());
    // Reset controls as well as observations; no invalid DOM value is retained.
    this.selectedRecipe.set('flattening');
    this.selectedScenario.set({ ...DEFAULT_FLATTENING_SCENARIO });
  }

  private accept(control: ControlId): void {
    this.invalidSelections.update(previous => new Set([...previous].filter(item => item !== control)));
    ++this.generation;
    this.currentState.set({ kind: 'idle' });
  }

  private reject(control: ControlId, event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      event.target.value = control === 'recipe' ? this.recipe() : this.scenario()[control];
    }
    this.invalidSelections.update(previous => new Set([...previous, control]));
    ++this.generation;
    this.currentState.set({ kind: 'idle' });
  }
}
