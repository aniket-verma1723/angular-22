import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import type { Type } from '@angular/core';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { LAB_WIDGETS } from './dynamic-widgets.component';
import type { WidgetContract, WidgetData, WidgetKind, WidgetOutletInputs, WidgetSelection } from './dynamic-widgets.component';
import { WidgetContainerDirective } from './widget-container.directive';
import { WidgetLifetime } from './widget-lifetime.service';

@Component({
  selector: 'app-dynamic-experiment',
  imports: [ExperimentCardComponent, NgComponentOutlet, WidgetContainerDirective],
  providers: [WidgetLifetime],
  templateUrl: './dynamic-experiment.component.html',
  styleUrl: './experiment-controls.css'
})
export class DynamicExperimentComponent {
  private readonly lifetime = inject(WidgetLifetime);
  protected readonly data = signal<WidgetData>({ title: 'Trusted local fixture', revision: 0 });
  private nextInstance = 0;
  protected readonly implementation = signal<'container' | 'outlet'>('container');
  protected readonly widgets = signal<readonly { readonly instance: number; readonly kind: WidgetKind }[]>([]);
  protected readonly kind = computed<WidgetKind | 'empty'>(() => this.widgets()[0]?.kind ?? 'empty');
  protected readonly widgetTypes: Readonly<Record<WidgetKind, Type<WidgetContract>>> = LAB_WIDGETS;
  protected readonly selection = signal<WidgetSelection | null>(null);
  private readonly onSelection = (value: WidgetSelection): void => { this.selection.set(value); };
  protected readonly outletInputs = computed(() => ({
    data: this.data(), onSelection: this.onSelection
  } satisfies WidgetOutletInputs));
  protected readonly counts = signal(this.lifetime.snapshot());
  protected readonly lesson: ComponentLesson = {
    title: 'Create, bind, replace, destroy', coverage: 'C04–C06 · C11 · C18',
    concept: 'Dynamic creation still has typed component contracts and Angular-owned lifetimes. This host allows exactly two statically compiled widget classes.',
    tryIt: 'Create a note, change its input, and select its revision. Replace it with a meter, then clear the host. Switch implementation and repeat. Read lifetime counts after each render.',
    mechanism: 'ViewContainerRef.createComponent uses inputBinding and outputBinding<WidgetSelection>. NgComponentOutlet uses a typed inputs object and an explicit onSelection callback input: it does not automatically bind outputs. Both use the same static widget contract. A keyed view owns exactly one implementation; replacement, switching or clearing destroys it.',
    mistake: 'Do not keep detached widgets or manually subscribe forever. Binding names are strings in Angular’s API: local keyof checks and contract tests matter. Never compile API-supplied JSON templates.',
    revision: 'Does changing an input create a widget? Why must replacing even the same kind destroy the previous instance?',
    observation: 'Explicitly inspected creation/destruction numbers come from real constructors and DestroyRef callbacks, without publishing reactive state during rendering. Specs check both implementations, input updates without recreation, selection payloads, replacement, disconnected old DOM listeners and owner cleanup.'
  };

  protected create(kind: WidgetKind): void {
    this.widgets.set([{ instance: ++this.nextInstance, kind }]);
    this.selection.set(null);
  }

  protected switchImplementation(): void {
    this.clear();
    this.implementation.update(value => value === 'container' ? 'outlet' : 'container');
  }

  protected inspect(): void { this.counts.set(this.lifetime.snapshot()); }

  protected revise(): void {
    this.data.update(value => ({ ...value, revision: (value.revision + 1) % 11 }));
  }

  protected clear(): void {
    this.widgets.set([]);
    this.selection.set(null);
  }
}
