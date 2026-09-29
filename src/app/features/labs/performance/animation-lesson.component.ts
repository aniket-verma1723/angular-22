import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AnimationCardComponent } from './animation-card.component';
import { AnimationLifetime } from './animation-lifetime.service';
import type { AnimationLifetimeSnapshot } from './animation-lifetime.service';

interface AnimationObservation extends AnimationLifetimeSnapshot {
  readonly domNodes: number;
}

@Component({
  selector: 'app-animation-lesson',
  imports: [AnimationCardComponent],
  providers: [AnimationLifetime],
  templateUrl: './animation-lesson.component.html',
  styleUrl: './animation-lesson.component.css'
})
export class AnimationLessonComponent {
  private readonly lifetime = inject(AnimationLifetime);
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('animationStage');
  private readonly visibleState = signal(false);
  private readonly blockedState = signal(false);
  private readonly observationState = signal<AnimationObservation | null>(null);
  protected readonly visible = this.visibleState.asReadonly();
  protected readonly blocked = this.blockedState.asReadonly();
  protected readonly observation = this.observationState.asReadonly();

  protected toggleCard(): void {
    // Read only on interaction: do not queue new cards while Angular owns a leaving host.
    if (!this.visibleState() && this.stage().nativeElement.childElementCount > 0) {
      this.blockedState.set(true);
      return;
    }
    this.blockedState.set(false);
    this.visibleState.update(value => !value);
  }

  protected inspectAnimation(): void {
    this.observationState.set({
      ...this.lifetime.snapshot(),
      domNodes: this.stage().nativeElement.childElementCount
    });
  }
}
