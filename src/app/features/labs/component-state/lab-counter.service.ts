import { computed, Injectable, signal } from '@angular/core';

export const LAB_EVENT_LIMIT = 12;

export interface LabLifecycleEvent {
  readonly id: number;
  readonly message: string;
}

@Injectable()
export class LabCounter {
  private readonly countState = signal(0);
  private readonly probesState = signal<readonly string[]>([]);
  private readonly eventsState = signal<readonly LabLifecycleEvent[]>([]);
  private nextEventId = 0;

  readonly count = this.countState.asReadonly();
  readonly activeProbes = computed(() => this.probesState().length);
  readonly events = this.eventsState.asReadonly();

  increment(): void {
    this.countState.update(count => count + 1);
  }

  register(name: string): void {
    this.probesState.update(probes => [...probes, name]);
    this.record(`${name}: OnInit`);
  }

  unregister(name: string): void {
    this.probesState.update(probes => probes.filter(probe => probe !== name));
    this.record(`${name}: OnDestroy`);
  }

  private record(message: string): void {
    const event: LabLifecycleEvent = { id: this.nextEventId++, message };
    this.eventsState.update(events => [...events, event].slice(-LAB_EVENT_LIMIT));
  }
}
