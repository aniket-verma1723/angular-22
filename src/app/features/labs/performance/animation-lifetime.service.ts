import { Injectable } from '@angular/core';

export interface AnimationLifetimeSnapshot {
  readonly created: number;
  readonly destroyed: number;
  readonly active: 0 | 1;
  readonly domPresentAtLastDestruction: boolean | null;
}

/** One-card, component-scoped instrumentation; never writes signals during rendering. */
@Injectable()
export class AnimationLifetime {
  private created = 0;
  private destroyed = 0;
  private active: 0 | 1 = 0;
  private domPresentAtLastDestruction: boolean | null = null;

  recordCreation(): void {
    this.created = Math.min(999, this.created + 1);
    this.active = 1;
  }

  recordDestruction(domPresent: boolean): void {
    this.destroyed = Math.min(999, this.destroyed + 1);
    this.active = 0;
    this.domPresentAtLastDestruction = domPresent;
  }

  snapshot(): AnimationLifetimeSnapshot {
    return Object.freeze({
      created: this.created,
      destroyed: this.destroyed,
      active: this.active,
      domPresentAtLastDestruction: this.domPresentAtLastDestruction
    });
  }
}
