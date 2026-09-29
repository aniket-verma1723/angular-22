import { Location } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, ResolveEnd, ResolveStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RoutingLabSession } from './routing-lab-session.service';

function stateMarker(value: unknown): string {
  return value !== null && typeof value === 'object' && 'labMarker' in value && value.labMarker === 'sample'
    ? 'sample' : '(none)';
}

@Component({
  selector: 'app-routing-lab',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './routing-lab.component.html', styleUrl: './routing-lab.component.css'
})
export class RoutingLabComponent {
  protected readonly session = inject(RoutingLabSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly helpButton = viewChild<ElementRef<HTMLButtonElement>>('helpButton');
  private readonly logsState = signal<readonly string[]>([]);
  protected readonly logs = this.logsState.asReadonly();
  private readonly markerState = signal('(none)');
  protected readonly marker = this.markerState.asReadonly();
  private readonly helpState = signal(false);
  protected readonly help = this.helpState.asReadonly();
  private readonly noticeState = signal('');
  protected readonly notice = this.noticeState.asReadonly();

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      const name = event instanceof NavigationStart ? 'NavigationStart'
        : event instanceof ResolveStart ? 'ResolveStart'
          : event instanceof ResolveEnd ? 'ResolveEnd'
            : event instanceof NavigationEnd ? 'NavigationEnd'
              : event instanceof NavigationCancel ? 'NavigationCancel'
                : event instanceof NavigationError ? 'NavigationError' : null;
      if (name && 'id' in event) this.logsState.update(values => [...values.slice(-11), `${event.id}: ${name}`]);
      if (event instanceof NavigationEnd) {
        this.markerState.set(stateMarker(this.location.getState()));
        this.noticeState.set('');
      }
      if (event instanceof NavigationCancel) this.noticeState.set('Navigation cancelled or redirected; current view may remain.');
      if (event instanceof NavigationError) this.noticeState.set('Navigation failed. Use a local recovery link.');
    });
    this.destroyRef.onDestroy(() => this.session.resetConfiguration());
  }

  protected setHelp(active: boolean): void { this.helpState.set(active); }
  protected async toggleHelp(): Promise<void> {
    const closing = this.helpState();
    try {
      const success = await this.router.navigate([{ outlets: { help: closing ? null : ['help'] } }], {
        relativeTo: this.route, queryParamsHandling: 'preserve', preserveFragment: true
      });
      if (success && closing && !this.destroyRef.destroyed) {
        afterNextRender(() => this.helpButton()?.nativeElement.focus(), { injector: this.injector });
      }
    } catch { if (!this.destroyRef.destroyed) this.noticeState.set('Help navigation failed safely.'); }
  }
}
