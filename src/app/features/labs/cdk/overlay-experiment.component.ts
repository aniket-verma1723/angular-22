import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, Injector, signal, TemplateRef, ViewContainerRef, viewChild } from '@angular/core';
import type { AfterRenderRef, OnDestroy } from '@angular/core';
import { FocusTrapFactory } from '@angular/cdk/a11y';
import type { FocusTrap } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-overlay-experiment',
  templateUrl: './overlay-experiment.component.html',
  styleUrls: ['./cdk-experiment.css', './overlay-experiment.component.css']
})
export class OverlayExperimentComponent implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly traps = inject(FocusTrapFactory);
  private readonly injector = inject(Injector);
  private readonly container = inject(ViewContainerRef);
  private readonly document = inject(DOCUMENT);
  private readonly template = viewChild.required<TemplateRef<unknown>>('help');
  private readonly openState = signal(false);
  private readonly acknowledgedState = signal(false);
  private ref: OverlayRef | null = null;
  private trap: FocusTrap | null = null;
  private pendingFocus: AfterRenderRef | null = null;
  private events = new Subscription();
  private trigger: HTMLButtonElement | null = null;
  protected readonly isOpen = this.openState.asReadonly();
  protected readonly acknowledged = this.acknowledgedState.asReadonly();

  protected open(trigger: HTMLButtonElement): void {
    this.release(false);
    this.trigger = trigger;
    this.acknowledgedState.set(false);
    const ref = this.overlay.create({
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: true,
      disableAnimations: true,
      usePopover: false,
      maxWidth: 'calc(100vw - 2rem)'
    });
    this.ref = ref;
    ref.attach(new TemplatePortal(this.template(), this.container));
    this.openState.set(true);
    this.events = new Subscription();
    this.events.add(ref.backdropClick().subscribe(() => this.close()));
    this.events.add(ref.keydownEvents().subscribe(event => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    }));
    this.events.add(ref.detachments().subscribe(() => this.close()));

    // Unlike focusInitialElementWhenReady(), this callback can be cancelled on replacement.
    this.pendingFocus = afterNextRender(() => {
      if (this.ref !== ref || !ref.hasAttached()) return;
      const dialog = ref.overlayElement.querySelector<HTMLElement>('[data-help-dialog]');
      if (!dialog) return;
      this.trap = this.traps.create(dialog);
      if (!this.trap.focusInitialElement({ preventScroll: true })) dialog.focus();
      this.pendingFocus = null;
    }, { injector: this.injector });
  }

  protected acknowledge(): void {
    this.acknowledgedState.set(true);
  }

  protected close(): void {
    this.release(true);
  }

  ngOnDestroy(): void {
    // Navigation/switching owns the next focus target, not this disappearing trigger.
    this.release(false);
  }

  private release(restoreFocus: boolean): void {
    const ref = this.ref;
    const trigger = this.trigger;
    const active = this.document.activeElement;
    const ownsFocus = !!ref && (ref.overlayElement.contains(active) || active === this.document.body);
    this.ref = null;
    this.trigger = null;
    this.pendingFocus?.destroy();
    this.pendingFocus = null;
    this.events.unsubscribe();
    this.trap?.destroy();
    this.trap = null;
    ref?.dispose();
    this.openState.set(false);
    if (restoreFocus && ownsFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  }
}
