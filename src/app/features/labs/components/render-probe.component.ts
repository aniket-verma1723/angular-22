import { Component, DestroyRef, ElementRef, afterEveryRender, afterNextRender, afterRenderEffect, inject, input, signal, viewChild } from '@angular/core';
import type { AfterContentInit, AfterViewInit, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { RenderMeasurements } from './render-measurements.service';

@Component({
  selector: 'app-render-probe',
  template: `
    <div #surface class="surface" [class.emphasized]="emphasized()">
      <ng-content><p>Measurement fallback content</p></ng-content>
      <button type="button" [attr.aria-pressed]="emphasized()" (click)="emphasized.set(!emphasized())">Toggle measured emphasis</button>
    </div>
  `,
  styleUrls: ['./experiment-controls.css', './render-probe.component.css']
})
export class RenderProbeComponent implements OnChanges, OnInit, AfterContentInit, AfterViewInit, OnDestroy {
  readonly padding = input.required<8 | 24>();
  protected readonly emphasized = signal(false);
  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly measurements = inject(RenderMeasurements);
  private readonly destroyRef = inject(DestroyRef);
  private observer: ResizeObserver | undefined;

  constructor() {
    this.measurements.recordHook('constructor');
    this.destroyRef.onDestroy(() => {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = undefined;
        this.measurements.observerDisconnected();
      }
    });

    // Angular owns these registrations through this component's DestroyRef.
    // They do not run on the server. None writes a signal or a template-bound field.
    afterNextRender({ read: () => {
      const surface = this.surface().nativeElement;
      const rect = surface.getBoundingClientRect();
      this.measurements.recordMeasurement('next', rect.width, rect.height);
      const supported = typeof ResizeObserver !== 'undefined';
      this.measurements.observerAvailability(supported);
      if (!supported) return;
      this.observer = new ResizeObserver(entries => {
        if (this.destroyRef.destroyed) return;
        const entry = entries.find(value => value.target === surface);
        if (entry) this.measurements.recordMeasurement('observer', entry.contentRect.width, entry.contentRect.height);
      });
      this.observer.observe(surface);
      this.measurements.observerConnected();
    } });

    afterEveryRender({ read: () => {
      const rect = this.surface().nativeElement.getBoundingClientRect();
      this.measurements.recordMeasurement('every', rect.width, rect.height);
    } });

    afterRenderEffect({
      write: onCleanup => {
        const surface = this.surface().nativeElement;
        const padding = this.padding();
        // Imperative integration demonstration. Ordinary layout should prefer CSS bindings.
        surface.style.padding = `${padding}px`;
        onCleanup(() => {
          surface.style.removeProperty('padding');
          this.measurements.recordEffectCleanup();
        });
        return { surface, padding };
      },
      read: written => {
        const rect = written().surface.getBoundingClientRect();
        this.measurements.recordMeasurement('effect', rect.width, rect.height);
      }
    });
  }

  ngOnChanges(): void { this.measurements.recordHook('input change'); }
  ngOnInit(): void { this.measurements.recordHook('init'); }
  ngAfterContentInit(): void { this.measurements.recordHook('content init'); }
  ngAfterViewInit(): void { this.measurements.recordHook('view init'); }
  ngOnDestroy(): void { this.measurements.recordHook('destroy'); }
}
