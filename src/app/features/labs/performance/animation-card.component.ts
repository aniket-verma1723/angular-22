import { Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { AnimationLifetime } from './animation-lifetime.service';

@Component({
  selector: 'app-animation-card',
  template: `<p><strong>A short-lived Angular component</strong></p>
    <p>This card has no focusable controls. Its leaving DOM can outlive its Angular instance.</p>`
})
export class AnimationCardComponent {
  private readonly lifetime = inject(AnimationLifetime);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.lifetime.recordCreation();
    inject(DestroyRef).onDestroy(() => {
      // A snapshot of attachment, not a claim that the element is still rendered or interactive.
      this.lifetime.recordDestruction(this.host.nativeElement.parentElement !== null);
    });
  }
}
