import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, ElementRef, Injector, afterNextRender, computed, inject, linkedSignal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { NavigationEnd, NavigationSkipped, PRIMARY_OUTLET, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { learningModuleList } from '../core/learning/learning-modules';
import { ThemeService } from '../core/theme/theme.service';
import { CartService } from '../features/cart/data/cart.service';
import { SessionStore } from '../core/session/session.store';

@Component({
  selector: 'app-shell',
  imports: [MatSidenav, MatSidenavContainer,
    MatSidenavContent, MatToolbar, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css'
})
export class ShellComponent {
  protected readonly session = inject(SessionStore);
  protected readonly cartCount = inject(CartService).itemCount;
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly injector = inject(Injector);
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  private readonly drawer = viewChild.required(MatSidenav);
  private pendingPageFocus = false;
  private lastPagePath = '';
  protected readonly theme = inject(ThemeService);
  protected readonly modules = learningModuleList;
  protected readonly isMobile = toSignal(
    this.breakpoints.observe('(max-width: 959px)').pipe(map(state => state.matches)),
    { initialValue: this.breakpoints.isMatched('(max-width: 959px)') }
  );
  protected readonly mobileOpen = linkedSignal({ source: this.isMobile, computation: () => false });
  protected readonly drawerOpen = computed(() => !this.isMobile() || this.mobileOpen());

  constructor() {
    const router = inject(Router);
    router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Auxiliary help is not a new page. Follow only the primary branch so
        // its owning feature can retain/restore focus without a competing heading focus.
        const segments: string[] = [];
        let group = router.parseUrl(event.urlAfterRedirects).root;
        while (group) {
          segments.push(...group.segments.map(segment => segment.toString()));
          const next = group.children[PRIMARY_OUTLET];
          if (!next) break;
          group = next;
        }
        const path = segments.join('/');
        if (path !== this.lastPagePath) {
          this.lastPagePath = path;
          this.onPageActivated();
        } else {
          // Query/fragment and auxiliary-only changes must not steal focus.
          this.mobileOpen.set(false);
        }
      } else if (event instanceof NavigationSkipped) {
        this.mobileOpen.set(false);
      }
    });
  }

  protected toggleNavigation(): void {
    this.mobileOpen.update(open => !open);
  }

  protected onPageActivated(): void {
    this.pendingPageFocus = true;
    if (this.isMobile() && this.mobileOpen()) {
      this.mobileOpen.set(false);
    } else {
      this.focusPage();
    }
  }

  protected onDrawerClosed(): void {
    if (this.pendingPageFocus) {
      this.focusPage();
    }
  }

  protected onDrawerOpenedChange(opened: boolean): void {
    // Opening is owned by user intent. A delayed open notification must not undo
    // navigation's close request; accept only a still-current library close (Escape/backdrop).
    if (!opened && !this.drawer().opened) this.mobileOpen.set(false);
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main()?.nativeElement.focus();
  }

  private focusPage(): void {
    this.pendingPageFocus = false;
    // Wait for the routed heading; on mobile, also wait for drawer focus restoration.
    afterNextRender(() => {
      const main = this.main()?.nativeElement;
      (main?.querySelector<HTMLElement>('h1') ?? main)?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
}
