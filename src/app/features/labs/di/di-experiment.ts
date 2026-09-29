import { DestroyRef, EnvironmentInjector, Injectable, InjectionToken, createEnvironmentInjector, inject, provideEnvironmentInitializer, runInInjectionContext, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NEVER, firstValueFrom, map, timeout, timer } from 'rxjs';

export const DI_LABEL = new InjectionToken<string>('lab public configuration');
export const DI_STEPS = new InjectionToken<readonly string[]>('lab multi steps');
export const DI_SUMMARY = new InjectionToken<string>('lab factory summary');
export const DI_ALIAS = new InjectionToken<DiCounter>('lab existing alias');
export const DI_CLASS = new InjectionToken<DiCounter>('lab separate class instance');

@Injectable()
export class DiCounter {
  private readonly countState = signal(0);
  readonly count = this.countState.asReadonly();
  private readonly destroyedState = signal(false);
  readonly destroyed = this.destroyedState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroyedState.set(true));
  }

  increment(): void {
    if (!this.destroyed()) this.countState.update(value => Math.min(99, value + 1));
  }
}

export type ConfigOutcome = 'success' | 'failure' | 'timeout';
export const CONFIG_OUTCOME = new InjectionToken<ConfigOutcome>('local configuration outcome');
export const CONFIG_LIMIT_MS = 600;

@Injectable()
export class IsolatedConfig {
  private readonly destroyRef = inject(DestroyRef);
  private readonly outcome = inject(CONFIG_OUTCOME);
  private readonly label = inject(DI_LABEL);
  private readonly stateValue = signal('idle');
  readonly state = this.stateValue.asReadonly();
  private completion: Promise<void> = Promise.resolve();

  start(): void {
    if (this.destroyRef.destroyed || this.stateValue() !== 'idle') return;
    this.stateValue.set('loading');
    const source$ = this.outcome === 'timeout' ? NEVER : timer(150).pipe(
      map(() => {
        if (this.outcome === 'failure') throw new Error('Local fixture rejected');
        return `ready: ${this.label}`;
      })
    );
    // Capture DI now; the promise continuation has no injection context.
    this.completion = firstValueFrom(source$.pipe(
      timeout({ first: CONFIG_LIMIT_MS }), takeUntilDestroyed(this.destroyRef)
    )).then(
      value => { if (!this.destroyRef.destroyed) this.stateValue.set(value); },
      () => { if (!this.destroyRef.destroyed) this.stateValue.set('failed: retry with a new injector'); }
    );
    this.destroyRef.onDestroy(() => this.stateValue.set('destroyed'));
  }

  settled(): Promise<void> { return this.completion; }
}

export interface DiExperiment {
  readonly injector: EnvironmentInjector;
  readonly counter: DiCounter;
  readonly alias: DiCounter;
  readonly separate: DiCounter;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly config: IsolatedConfig;
}

export function createDiExperiment(parent: EnvironmentInjector, outcome: ConfigOutcome): DiExperiment {
  const injector = createEnvironmentInjector([
    { provide: DI_LABEL, useValue: 'local-config' },
    DiCounter,
    { provide: DI_ALIAS, useExisting: DiCounter },
    { provide: DI_CLASS, useClass: DiCounter },
    { provide: DI_STEPS, useValue: 'validate', multi: true },
    { provide: DI_STEPS, useValue: 'preview', multi: true },
    { provide: DI_SUMMARY, useFactory: () => `${inject(DI_LABEL)}: ${inject(DI_STEPS).join(' → ')}` },
    { provide: CONFIG_OUTCOME, useValue: outcome }, IsolatedConfig,
    provideEnvironmentInitializer(() => inject(IsolatedConfig).start())
  ], parent, 'DI lab owned environment');
  return {
    injector, counter: injector.get(DiCounter), alias: injector.get(DI_ALIAS),
    separate: injector.get(DI_CLASS), summary: injector.get(DI_SUMMARY),
    steps: injector.get(DI_STEPS), config: injector.get(IsolatedConfig)
  };
}

export interface ContextObservation {
  readonly captured: string;
  readonly afterAwait: 'NG0203 caught' | 'unexpected context';
}

export async function inspectContext(injector: EnvironmentInjector): Promise<ContextObservation> {
  return runInInjectionContext(injector, async () => {
    const captured = inject(DI_LABEL);
    await Promise.resolve();
    try {
      inject(DI_LABEL);
      return { captured, afterAwait: 'unexpected context' };
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('NG0203')) {
        return { captured, afterAwait: 'NG0203 caught' };
      }
      throw error;
    }
  });
}
