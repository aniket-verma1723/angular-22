import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AnimationLessonComponent } from './animation-lesson.component';
import { DeferredSummaryComponent } from './deferred-summary.component';
import { ImageLessonComponent } from './image-lesson.component';
import { PayloadLifetime } from './payload-lifetime.service';
import { ProfilingLessonComponent } from './profiling-lesson.component';

const TRIGGERS = [
  { id: 'interaction', label: 'Interaction', hint: 'Hover or focus the button to prefetch code; click or press a key on it to render.' },
  { id: 'viewport', label: 'Viewport', hint: 'The single-element placeholder is observed. It may already be in the viewport when selected.' },
  { id: 'when', label: 'When (signal)', hint: 'Open the signal gate. Closing it after completion does not undo this one-shot defer block.' },
  { id: 'idle', label: 'Idle', hint: 'Angular schedules this block when the browser is idle; this is not a fixed delay.' },
  { id: 'timer', label: 'Timer (1500 ms)', hint: 'The 1500 ms trigger starts when this branch mounts, not when the lab first opens.' },
  { id: 'hover', label: 'Hover or focus', hint: 'Hover over or keyboard-focus the native button to render; focus is the keyboard alternative.' },
  { id: 'immediate', label: 'Immediate', hint: 'Load after the non-deferred content renders. Immediate still uses a deferred dependency boundary.' }
] as const;

type Trigger = typeof TRIGGERS[number]['id'];

/** Lazy route entry; the summary is referenced only in @defer blocks, never in a query. */
@Component({
  selector: 'app-performance-lab',
  imports: [RouterLink, RouterOutlet, DeferredSummaryComponent, AnimationLessonComponent, ProfilingLessonComponent, ImageLessonComponent],
  providers: [PayloadLifetime],
  templateUrl: './performance-lab.component.html',
  styleUrl: './performance-lab.component.css'
})
export class PerformanceLabComponent {
  private readonly lifetime = inject(PayloadLifetime);
  private readonly triggerState = signal<Trigger>('interaction');
  private readonly mountedState = signal(true);
  private readonly gateState = signal(false);
  private readonly selectionErrorState = signal('');
  private readonly inspectedState = signal(this.lifetime.snapshot());
  protected readonly triggers = TRIGGERS;
  protected readonly trigger = this.triggerState.asReadonly();
  protected readonly mounted = this.mountedState.asReadonly();
  protected readonly gate = this.gateState.asReadonly();
  protected readonly selectionError = this.selectionErrorState.asReadonly();
  protected readonly inspected = this.inspectedState.asReadonly();
  protected readonly hint = computed(() => TRIGGERS.find(item => item.id === this.trigger())?.hint ?? '');

  protected chooseTrigger(value: string): void {
    const choice = TRIGGERS.find(item => item.id === value);
    if (!choice) {
      this.selectionErrorState.set('Choose one of the listed triggers.');
      return;
    }
    this.selectionErrorState.set('');
    if (choice.id === this.trigger()) return;
    this.gateState.set(false);
    this.triggerState.set(choice.id);
  }

  protected toggleMount(): void {
    this.gateState.set(false);
    this.mountedState.update(value => !value);
  }

  protected toggleGate(): void { this.gateState.update(value => !value); }

  protected inspect(): void { this.inspectedState.set(this.lifetime.snapshot()); }
}
