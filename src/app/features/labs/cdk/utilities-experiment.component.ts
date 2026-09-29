import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, NgZone, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FocusMonitor, LiveAnnouncer } from '@angular/cdk/a11y';
import type { FocusOrigin } from '@angular/cdk/a11y';
import { Dir, Directionality } from '@angular/cdk/bidi';
import type { Direction } from '@angular/cdk/bidi';
import { Clipboard } from '@angular/cdk/clipboard';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { map } from 'rxjs';
import { publicProductLink } from './public-product-link';

@Component({
  selector: 'app-utilities-experiment',
  imports: [Dir, CdkTextareaAutosize],
  // A pending announcement is removed with this experiment, not left in a root service.
  providers: [LiveAnnouncer],
  templateUrl: './utilities-experiment.component.html',
  styleUrls: ['./cdk-experiment.css', './utilities-experiment.component.css']
})
export class UtilitiesExperimentComponent {
  private readonly document = inject(DOCUMENT);
  private readonly clipboard = inject(Clipboard);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly monitor = inject(FocusMonitor);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly focusTarget = viewChild.required<ElementRef<HTMLButtonElement>>('focusTarget');
  private readonly localDir = viewChild('localDir', { read: Directionality });
  private readonly directionState = signal<Direction>('ltr');
  private readonly directionEventState = signal<Direction | null>(null);
  private readonly focusState = signal<FocusOrigin>(null);
  private readonly copyState = signal('Nothing copied.');
  private readonly noteState = signal('A fictional scratch note.\nTry adding more lines.');
  protected readonly direction = this.directionState.asReadonly();
  protected readonly directionEvent = this.directionEventState.asReadonly();
  protected readonly effectiveDirection = computed(() => this.localDir()?.valueSignal() ?? 'ltr');
  protected readonly focusOrigin = this.focusState.asReadonly();
  protected readonly copyResult = this.copyState.asReadonly();
  protected readonly note = this.noteState.asReadonly();
  protected readonly link = publicProductLink(this.document.location?.origin ?? '',
    this.document.querySelector('base')?.getAttribute('href') ?? '/');
  protected readonly narrowViewport = toSignal(
    inject(BreakpointObserver).observe('(max-width: 600px)').pipe(map(state => state.matches)),
    { initialValue: false }
  );

  constructor() {
    afterNextRender(() => {
      const element = this.focusTarget().nativeElement;
      this.monitor.monitor(element).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(origin => {
        this.zone.run(() => this.focusState.set(origin));
      });
      // Completing our subscription alone does not unregister FocusMonitor's DOM listeners.
      this.destroyRef.onDestroy(() => this.monitor.stopMonitoring(element));
    });
  }

  protected setDirection(direction: Direction): void {
    this.directionState.set(direction);
  }

  protected directionChanged(direction: Direction): void {
    this.directionEventState.set(direction);
  }

  protected editNote(value: string): void {
    this.noteState.set(value.slice(0, 240));
  }

  protected focusProgrammatically(): void {
    this.monitor.focusVia(this.focusTarget().nativeElement, 'program', { preventScroll: true });
  }

  protected copyPublicLink(): void {
    let copied = false;
    try {
      copied = this.link !== null && this.clipboard.copy(this.link);
    } catch {
      // Treat a platform failure like Clipboard's documented false result; never expose raw errors.
    }
    const message = copied ? 'Public product link copied.' :
      'Copy failed. Select and copy the public link manually.';
    this.copyState.set(message);
    // The visible result is deliberately NOT a second live region.
    void this.announcer.announce(message, 'polite').catch(() => {
      if (!this.destroyRef.destroyed) this.copyState.set(`${message} Live announcement unavailable.`);
    });
  }
}
