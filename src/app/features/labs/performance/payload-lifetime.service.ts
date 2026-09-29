import { Injectable } from '@angular/core';

export interface PayloadLifetimeSnapshot {
  readonly created: number;
  readonly destroyed: number;
  readonly active: number;
}

/** Component-scoped, nonreactive instrumentation: inspect explicitly after rendering. */
@Injectable()
export class PayloadLifetime {
  private created = 0;
  private destroyed = 0;
  private readonly activeIds = new Set<number>();

  recordCreation(): number {
    const id = ++this.created;
    this.activeIds.add(id);
    return id;
  }

  recordDestruction(id: number): void {
    if (this.activeIds.delete(id)) this.destroyed++;
  }

  snapshot(): PayloadLifetimeSnapshot {
    return Object.freeze({
      created: this.created,
      destroyed: this.destroyed,
      active: this.activeIds.size
    });
  }
}
