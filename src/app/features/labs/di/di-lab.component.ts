import { Component, DestroyRef, EnvironmentInjector, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { createDiExperiment, inspectContext } from './di-experiment';
import type { ConfigOutcome, DiExperiment } from './di-experiment';
import { ELEMENT_SCOPE, OUTER_SCOPE, ScopePanelComponent, ScopeProbeComponent, VIEW_SCOPE } from './scope-probe.component';

@Component({
  selector: 'app-di-lab',
  imports: [RouterLink, ScopePanelComponent, ScopeProbeComponent],
  providers: [{ provide: ELEMENT_SCOPE, useValue: 'parent' }],
  viewProviders: [{ provide: VIEW_SCOPE, useValue: 'parent-view' }, { provide: OUTER_SCOPE, useValue: 'outer-only' }],
  templateUrl: './di-lab.component.html',
  styleUrl: './di-lab.component.css'
})
export class DiLabComponent {
  private readonly parent = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly experimentState = signal<DiExperiment | null>(null);
  protected readonly experiment = this.experimentState.asReadonly();
  private readonly contextState = signal('Not run');
  protected readonly context = this.contextState.asReadonly();
  private readonly scopesState = signal(true);
  protected readonly scopes = this.scopesState.asReadonly();
  private generation = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  protected toggleScopes(): void { this.scopesState.update(value => !value); }

  protected start(outcome: ConfigOutcome): void {
    this.dispose();
    this.contextState.set('Not run');
    this.experimentState.set(createDiExperiment(this.parent, outcome));
  }

  protected dispose(): void {
    this.generation++;
    const experiment = this.experimentState();
    if (experiment && !experiment.injector.destroyed) experiment.injector.destroy();
  }

  protected async probeContext(): Promise<void> {
    const experiment = this.experimentState();
    if (!experiment || experiment.injector.destroyed) return;
    const generation = this.generation;
    try {
      const result = await inspectContext(experiment.injector);
      if (!this.destroyRef.destroyed && generation === this.generation) {
        this.contextState.set(`Captured ${result.captured}; after await: ${result.afterAwait}`);
      }
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) this.contextState.set('Probe failed safely');
    }
  }
}
