import { Injectable } from '@angular/core';

export type RenderPhase = 'next' | 'every' | 'effect' | 'observer';
export type RenderHook = 'constructor' | 'input change' | 'init' | 'content init' | 'view init' | 'destroy';
export interface RenderHookObservation {
  readonly id: number;
  readonly hook: RenderHook;
}
export interface RenderMeasurementSnapshot {
  readonly reads: Readonly<Record<RenderPhase, number>>;
  readonly lastSource: RenderPhase | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly effectCleanups: number;
  readonly activeObservers: number;
  readonly observerSupported: boolean | null;
  readonly hookCount: number;
  readonly hooks: readonly RenderHookObservation[];
}

/** Plain diagnostic data: recording a render must never schedule another render. */
@Injectable()
export class RenderMeasurements {
  private state: RenderMeasurementSnapshot = {
    reads: { next: 0, every: 0, effect: 0, observer: 0 },
    lastSource: null, width: null, height: null, effectCleanups: 0,
    activeObservers: 0, observerSupported: null, hookCount: 0, hooks: []
  };

  recordHook(hook: RenderHook): void {
    const id = this.state.hookCount + 1;
    this.state = { ...this.state, hookCount: id, hooks: [...this.state.hooks, { id, hook }].slice(-16) };
  }

  recordMeasurement(phase: RenderPhase, width: number, height: number): void {
    this.state = { ...this.state, reads: { ...this.state.reads, [phase]: this.state.reads[phase] + 1 },
      lastSource: phase, width, height };
  }

  recordEffectCleanup(): void {
    this.state = { ...this.state, effectCleanups: this.state.effectCleanups + 1 };
  }

  observerAvailability(supported: boolean): void {
    this.state = { ...this.state, observerSupported: supported };
  }

  observerConnected(): void {
    this.state = { ...this.state, activeObservers: this.state.activeObservers + 1 };
  }

  observerDisconnected(): void {
    this.state = { ...this.state, activeObservers: this.state.activeObservers - 1 };
  }

  snapshot(): RenderMeasurementSnapshot {
    return { ...this.state, reads: { ...this.state.reads }, hooks: [...this.state.hooks] };
  }
}
