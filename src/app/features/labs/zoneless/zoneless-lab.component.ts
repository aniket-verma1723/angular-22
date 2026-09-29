import { ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

export type NotificationMode = 'signal' | 'mark-for-check';
export const ZONELESS_PROBE_DELAY_MS = 1000;

type ProbeSnapshot =
  | { readonly status: 'idle' | 'pending' | 'cancelled'; readonly count: 0 }
  | { readonly status: 'done'; readonly count: 1 };

const completionEvent = 'zoneless-probe-complete';

@Component({
  selector: 'app-zoneless-lab',
  imports: [RouterLink],
  templateUrl: './zoneless-lab.component.html',
  styleUrl: './zoneless-lab.component.css'
})
export class ZonelessLabComponent {
  private readonly changes = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly events = new EventTarget();
  private readonly modeState = signal<NotificationMode>('signal');
  protected readonly mode = this.modeState.asReadonly();
  private readonly signalSnapshot = signal<ProbeSnapshot>({ status: 'idle', count: 0 });
  private markedSnapshot: ProbeSnapshot = { status: 'idle', count: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  // This native listener is not an Angular template/host listener. It must notify explicitly.
  private readonly receiveCompletion = (): void => {
    if (this.destroyRef.destroyed || this.snapshot.status !== 'pending') return;
    this.releaseTimer();
    this.publish({ status: 'done', count: 1 });
  };

  constructor() {
    this.events.addEventListener(completionEvent, this.receiveCompletion);
    this.destroyRef.onDestroy(() => {
      this.releaseTimer();
      this.events.removeEventListener(completionEvent, this.receiveCompletion);
    });
  }

  protected get snapshot(): ProbeSnapshot {
    return this.mode() === 'signal' ? this.signalSnapshot() : this.markedSnapshot;
  }

  selectMode(mode: NotificationMode): void {
    if (this.destroyRef.destroyed || this.snapshot.status !== 'idle') return;
    this.modeState.set(mode);
    this.publish({ status: 'idle', count: 0 });
  }

  start(): void {
    if (this.destroyRef.destroyed || this.snapshot.status !== 'idle') return;
    const generation = ++this.generation;
    this.publish({ status: 'pending', count: 0 });
    this.timer = setTimeout(() => {
      // Cancellation/reset also invalidates a callback already handed to the event loop.
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.timer = undefined;
      this.events.dispatchEvent(new Event(completionEvent));
    }, ZONELESS_PROBE_DELAY_MS);
  }

  cancel(): void {
    if (this.destroyRef.destroyed || this.snapshot.status !== 'pending') return;
    this.releaseTimer();
    this.publish({ status: 'cancelled', count: 0 });
  }

  reset(): void {
    if (this.destroyRef.destroyed) return;
    this.releaseTimer();
    this.publish({ status: 'idle', count: 0 });
  }

  private publish(snapshot: ProbeSnapshot): void {
    if (this.mode() === 'signal') {
      this.signalSnapshot.set(snapshot);
    } else {
      // Intentionally no signal writes here: markForCheck is the sole completion notification.
      this.markedSnapshot = snapshot;
      this.changes.markForCheck();
    }
  }

  private releaseTimer(): void {
    this.generation++;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
