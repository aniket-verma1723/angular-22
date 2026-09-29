import { DestroyRef, Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, of, scan, switchMap, throwError } from 'rxjs';

export const LOCAL_DEBOUNCE_MS = 250;

/** Stable alternative: Angular 22.1.7 debounced is experimental (core.d.ts ~9544). */
export function localDebouncedText(source: Signal<string>): Signal<string> {
  const destroyRef = inject(DestroyRef);
  return toSignal(toObservable(source).pipe(
    debounceTime(LOCAL_DEBOUNCE_MS), distinctUntilChanged(),
    // toObservable completes on destroy; debounceTime would otherwise flush pending text.
    filter(() => !destroyRef.destroyed)
  ), { initialValue: '' });
}

export interface ComputationObservation {
  readonly result: number;
  readonly executions: number;
  readonly rawQuantity: number;
}

@Injectable()
export class StateExperiment {
  private readonly enabledState = signal(true);
  readonly enabled = this.enabledState.asReadonly();
  // Deliberately mutable nested fixture for the mutation lesson only; never exposed for writes.
  private readonly quantityState = signal({ quantity: 1 }, { equal: (a, b) => a.quantity === b.quantity });
  private executions = 0;
  private readonly total = computed(() => {
    // Plain instrumentation, not another reactive dependency. Read only by explicit inspect().
    this.executions++;
    return this.enabledState() ? this.quantityState().quantity * 10 : 0;
  });
  private readonly observationState = signal<ComputationObservation | null>(null);
  readonly observation = this.observationState.asReadonly();
  private readonly choicesState = signal<readonly string[]>(['Violet', 'Blue']);
  readonly choices = this.choicesState.asReadonly();
  private readonly selectionState = linkedSignal(() => this.choicesState()[0] ?? null);
  readonly selection = this.selectionState.asReadonly();
  readonly radius = computed(() => this.selectionState() === 'Blue' ? 24 : 8);
  private readonly batchState = signal(0);
  readonly batch = this.batchState.asReadonly();
  readonly emissions = toSignal(toObservable(this.batchState).pipe(
    scan((values: readonly number[], value) => [...values.slice(-7), value], [])
  ), { initialValue: [] as readonly number[] });
  private readonly intents$ = new Subject<'success' | 'error'>();
  readonly result = toSignal(this.intents$.pipe(
    switchMap(intent => (intent === 'error' ? throwError(() => new Error('fixture')) : of('success: local value')).pipe(
      catchError(() => of('error: recovered locally; try success'))
    ))
  ), { initialValue: 'idle: no event yet' });
  private readonly textState = signal('');
  readonly text = this.textState.asReadonly();
  readonly debouncedText = localDebouncedText(this.textState);

  constructor() { inject(DestroyRef).onDestroy(() => this.intents$.complete()); }

  inspect(): void {
    const result = this.total();
    this.observationState.set({ result, executions: this.executions, rawQuantity: this.quantityState().quantity });
  }
  toggleDependency(): void { this.enabledState.update(value => !value); }
  increment(): void { this.quantityState.update(value => ({ quantity: Math.min(99, value.quantity + 1) })); }
  equalReplacement(): void { this.quantityState.set({ quantity: this.quantityState().quantity }); }
  mutateWithoutNotification(): void { this.quantityState().quantity = Math.min(99, this.quantityState().quantity + 1); }
  replaceChoices(): void {
    this.choicesState.update(values => values.includes('Blue') ? ['Green', 'Amber'] : ['Violet', 'Blue']);
  }
  choose(value: string): void { if (this.choicesState().includes(value)) this.selectionState.set(value); }
  batchThree(): void { this.batchState.set(1); this.batchState.set(2); this.batchState.set(3); }
  resetBatch(): void { this.batchState.set(0); }
  emit(intent: 'success' | 'error'): void { this.intents$.next(intent); }
  setText(value: string): void { this.textState.set(value.slice(0, 40)); }
}
