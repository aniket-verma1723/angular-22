import { Component, computed, inject, signal } from '@angular/core';
import { PROFILING_ITEMS, PROFILING_ROUNDS, ProfilingCalculator } from './profiling-calculator.service';
import type { ProfilingItem, ProfilingResult } from './profiling-calculator.service';

@Component({
  selector: 'app-profiling-lesson',
  providers: [ProfilingCalculator],
  templateUrl: './profiling-lesson.component.html',
  styleUrl: './profiling-lesson.component.css'
})
export class ProfilingLessonComponent {
  private readonly calculator = inject(ProfilingCalculator);
  private readonly itemsState = signal<readonly ProfilingItem[]>(PROFILING_ITEMS);
  private readonly modeState = signal<'method' | 'computed'>('computed');
  private readonly noteState = signal(false);
  protected readonly mode = this.modeState.asReadonly();
  protected readonly note = this.noteState.asReadonly();
  protected readonly rounds = PROFILING_ROUNDS;
  protected readonly memoizedRows = computed(() => this.calculator.calculate(this.itemsState()));

  protected chooseMode(mode: 'method' | 'computed'): void { this.modeState.set(mode); }

  protected toggleNote(): void { this.noteState.update(value => !value); }

  protected updateSample(): void {
    this.itemsState.update(items => items.map(item => item.id === 1
      ? { ...item, weight: item.weight === 1 ? 2 : 1 }
      : item));
  }

  protected reverseSamples(): void { this.itemsState.update(items => [...items].reverse()); }

  /** Intentional expensive-template anti-pattern ONLY in this lab; no side effects or counters. */
  protected calculateInTemplate(): readonly ProfilingResult[] {
    return this.calculator.calculate(this.itemsState());
  }
}
