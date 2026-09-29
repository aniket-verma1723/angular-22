import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Injectable, NgZone, inject, viewChild } from '@angular/core';

/** Deliberately plain external state: neither a signal nor a second application-state owner. */
@Injectable()
export class NotificationFixture {
  private readonly zone = inject(NgZone);
  private readonly target = new EventTarget();
  private count = 0;
  private readonly receive = (): void => { this.count++; };

  constructor() {
    this.zone.runOutsideAngular(() => this.target.addEventListener('fixture', this.receive));
    inject(DestroyRef).onDestroy(() => this.target.removeEventListener('fixture', this.receive));
  }

  read(): number { return this.count; }
  dispatch(): void { this.zone.runOutsideAngular(() => this.target.dispatchEvent(new Event('fixture'))); }
}

@Component({
  selector: 'app-eager-preview',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '<p data-eager>Eager preview: {{ source.read() }}</p>'
})
export class EagerPreviewComponent {
  protected readonly source = inject(NotificationFixture);
}

@Component({
  selector: 'app-on-push-preview',
  template: '<p data-on-push>OnPush preview: {{ source.read() }}</p>'
})
export class OnPushPreviewComponent {
  protected readonly source = inject(NotificationFixture);
  private readonly changes = inject(ChangeDetectorRef);

  // A legitimate notification boundary for an external integration, not forced synchronous rendering.
  notify(): void { this.changes.markForCheck(); }
}

@Component({
  selector: 'app-notification-preview',
  imports: [EagerPreviewComponent, OnPushPreviewComponent],
  providers: [NotificationFixture],
  template: `
    <section aria-labelledby="notification-heading">
      <h2 id="notification-heading">Eager and OnPush notification contrast · S07</h2>
      <h3>Concept</h3><p>These siblings read the same plain external fixture. One explicitly uses Eager; the other uses Angular 22's default OnPush.</p>
      <h3>Try it</h3>
      <div class="actions">
        <button type="button" (click)="source.dispatch()">Dispatch external fixture event</button>
        <button type="button" (click)="notify()">Notify OnPush preview</button>
      </div>
      <app-eager-preview /><app-on-push-preview />
      <h3>What Angular does</h3><p>The native fixture event mutates no signal. The Angular-bound button event notifies this parent in both Zone-based and zoneless scheduling. That traversal checks Eager but skips the clean OnPush sibling. The second control uses public markForCheck to notify OnPush; it does not force detectChanges. NgZone wrappers alone do not notify a zoneless view.</p>
      <h3>Common mistake</h3><p>An external callback alone is not a notification. Eager is not polling, and a clean OnPush ancestor can still skip a subtree. Prefer signals for normal UI state; this plain fixture deliberately exposes the distinction.</p>
      <h3>Revision question</h3><p>Which event schedules the parent, and what makes the OnPush sibling eligible?</p>
      <p><strong>Test observation:</strong> isolated tests run with both Zone-based and zoneless providers, asserting stale versus refreshed DOM, explicit notification and listener teardown. P12 migrates application scheduling separately; this contrast is not a performance benchmark.</p>
    </section>
  `,
  styleUrl: './state-lab.component.css'
})
export class NotificationPreviewComponent {
  protected readonly source = inject(NotificationFixture);
  private readonly preview = viewChild(OnPushPreviewComponent);
  protected notify(): void { this.preview()?.notify(); }
}
