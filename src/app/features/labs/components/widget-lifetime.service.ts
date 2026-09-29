import { Injectable } from '@angular/core';

export interface WidgetLifetimeSnapshot {
  readonly created: number;
  readonly destroyed: number;
}

/** Nonreactive instrumentation, scoped to a single dynamic experiment. */
@Injectable()
export class WidgetLifetime {
  private created = 0;
  private destroyed = 0;

  recordCreation(): void { this.created++; }
  recordDestruction(): void { this.destroyed++; }

  snapshot(): WidgetLifetimeSnapshot {
    return { created: this.created, destroyed: this.destroyed };
  }
}
