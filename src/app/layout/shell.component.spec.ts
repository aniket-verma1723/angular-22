import { BreakpointObserver } from '@angular/cdk/layout';
import { TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSidenav } from '@angular/material/sidenav';
import { MatSidenavHarness } from '@angular/material/sidenav/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { BehaviorSubject, filter, firstValueFrom, map } from 'rxjs';
import { appConfig } from '../app.config';
import { provideAppData } from '../core/config/app-data.providers.mock';
import { ShellComponent } from './shell.component';
import { CartService } from '../features/cart/data/cart.service';
import { productFixture } from '../testing/product-fixtures';

describe('ShellComponent', () => {
  let mobile: BehaviorSubject<boolean>;

  function menuButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('header button[aria-controls="learning-navigation"]');
    if (!button) throw new Error('Missing menu button');
    return button;
  }

  async function clickMenu(fixture: ComponentFixture<ShellComponent>): Promise<void> {
    menuButton(fixture).click();
    await fixture.whenStable();
  }

  beforeEach(() => {
    mobile = new BehaviorSubject(false);
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        ...appConfig.providers,
        provideAppData(), provideHttpClientTesting(),
        { provide: BreakpointObserver, useValue: {
          isMatched: () => mobile.value,
          observe: () => mobile.pipe(map(matches => ({ matches, breakpoints: {} })))
        } }
      ]
    });
  });

  it('keeps desktop navigation open without a menu toggle', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const drawer = await loader.getHarness(MatSidenavHarness);
    expect(await drawer.getMode()).toBe('side');
    expect(await drawer.isOpen()).toBeTrue();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector<HTMLElement>('mat-sidenav-content')?.style.marginLeft).toBe('var(--sidebar-width)');
    expect(element.querySelector('header button[aria-controls="learning-navigation"]')).toBeNull();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('updates the visible and accessible session cart count', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const link = element.querySelector('header a[href="#/cart"]');
    expect(link?.getAttribute('aria-label')).toBe('Cart, 0 items');
    const cart = TestBed.inject(CartService);
    cart.add(productFixture({ stock: 3 }), 2); await fixture.whenStable();
    expect(link?.textContent).toContain('Cart (2)');
    expect(link?.getAttribute('aria-label')).toBe('Cart, 2 items');
    cart.clear(); await fixture.whenStable();
    expect(link?.textContent).toContain('Cart (0)');
  });

  it('preserves the search control focus for query-only navigation', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('Search input missing');
    input.focus();
    await router.navigateByUrl('/products?q=notebook');
    await fixture.whenStable();
    expect(document.activeElement).toBe(input);
  });

  it('toggles mobile navigation and reports expanded state', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const drawer = await loader.getHarness(MatSidenavHarness);
    const menu = menuButton(fixture);
    expect(await drawer.getMode()).toBe('over');
    expect(await drawer.isOpen()).toBeFalse();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector<HTMLElement>('mat-sidenav-content')?.style.marginLeft).toBe('0px');
    await clickMenu(fixture);
    expect(await drawer.isOpen()).toBeTrue();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    await clickMenu(fixture);
    expect(await drawer.isOpen()).toBeFalse();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  for (const narrow of [false, true]) {
    it(`preserves auxiliary-outlet focus but focuses primary pages (mobile: ${narrow})`, async () => {
      mobile.next(narrow);
      const fixture = TestBed.createComponent(ShellComponent);
      fixture.autoDetectChanges();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/labs/routing/workspace/1');
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      expect(document.activeElement).toBe(element.querySelector('h1'));
      const help = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Open help outlet');
      if (!help) throw new Error('Missing help action');
      help.focus(); help.click();
      await fixture.whenStable();
      expect(element.textContent).toContain('Named outlet help');
      expect(document.activeElement).toBe(help);
      help.click();
      await fixture.whenStable();
      expect(element.textContent).not.toContain('Named outlet help');
      expect(document.activeElement).toBe(help);
      await router.navigateByUrl('/labs/routing/workspace/2');
      await fixture.whenStable();
      expect(document.activeElement).toBe(element.querySelector('h1'));
      TestBed.inject(HttpTestingController).expectNone(() => true);
    });
  }

  it('closes mobile navigation after routing and marks the active page', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    await clickMenu(fixture);
    await TestBed.inject(Router).navigateByUrl('/products');
    await fixture.whenStable();
    expect(await (await loader.getHarness(MatSidenavHarness)).isOpen()).toBeFalse();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('nav[aria-label="Learning modules"] a[aria-current="page"]')?.textContent).toContain('Products');
    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('closes mobile navigation when selecting the current route again', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    await clickMenu(fixture);
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    expect(await (await loader.getHarness(MatSidenavHarness)).isOpen()).toBeFalse();
  });

  it('closes the mobile drawer on Escape and restores the menu focus', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = menuButton(fixture);
    menu.focus();
    await fixture.whenStable();
    const sidenav = fixture.debugElement.query(By.directive(MatSidenav)).injector.get(MatSidenav);
    // openedChange is asynchronous even without animations; wait for Material to
    // capture the opener before Escape, then for its close notification afterward.
    const opened = firstValueFrom(sidenav.openedChange.pipe(filter(value => value)));
    await clickMenu(fixture);
    await opened; await fixture.whenStable();
    const drawer = await loader.getHarness(MatSidenavHarness);
    const closed = firstValueFrom(sidenav.openedChange.pipe(filter(value => !value)));
    await (await drawer.host()).sendKeys(TestKey.ESCAPE);
    await closed;
    await fixture.whenStable();
    expect(await drawer.isOpen()).toBeFalse();
    expect(document.activeElement).toBe(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('stops observing breakpoints when destroyed', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect(mobile.observed).toBeTrue();
    fixture.destroy();
    expect(mobile.observed).toBeFalse();
  });

  it('resets the mobile drawer when resizing from desktop', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const drawer = await loader.getHarness(MatSidenavHarness);
    await clickMenu(fixture);
    mobile.next(false);
    await fixture.whenStable();
    expect(await drawer.getMode()).toBe('side');
    expect(await drawer.isOpen()).toBeTrue();
    mobile.next(true);
    await fixture.whenStable();
    expect(await drawer.isOpen()).toBeFalse();
  });

  it('changes theme through the labelled selector', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const select = element.querySelector('select');
    if (!select) { throw new Error('Missing theme selector'); }
    select.value = 'dark';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('moves keyboard focus to content through the skip link', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLAnchorElement>('.skip-link')?.click();
    expect(document.activeElement).toBe(element.querySelector('main'));
  });

  it('keeps native non-submit button and keyboard-focusable link semantics', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const menu = menuButton(fixture);
    expect(menu.type).toBe('button');
    expect(menu.tabIndex).toBe(0);
    expect(menu.disabled).toBeFalse();
    expect(menu.textContent?.trim()).toBe('Menu');
    expect(menu.getAttribute('aria-label')).toBe('Menu: toggle navigation');
    menu.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(menu);
    const element: HTMLElement = fixture.nativeElement;
    const cart = element.querySelector<HTMLAnchorElement>('header a[href="#/cart"]');
    const session = element.querySelector<HTMLAnchorElement>('header a[href="#/login"]');
    if (!cart || !session) throw new Error('Missing toolbar links');
    for (const link of [cart, session]) {
      expect(link.tabIndex).toBe(0);
      expect(link.getAttribute('role')).toBeNull();
    }
    expect(session.getAttribute('aria-label')).toBe('Demo session');
    cart.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(cart);
  });

  it('uses native disabled behavior without opening the drawer', async () => {
    mobile.next(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const drawer = await loader.getHarness(MatSidenavHarness);
    const menu = menuButton(fixture);
    const element: HTMLElement = fixture.nativeElement;
    const main = element.querySelector('main');
    if (!main) throw new Error('Missing main content');
    main.focus();
    menu.disabled = true;
    menu.focus();
    await clickMenu(fixture);
    expect(document.activeElement).toBe(main);
    expect(await drawer.isOpen()).toBeFalse();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.disabled = false;
    await clickMenu(fixture);
    expect(await drawer.isOpen()).toBeTrue();
  });
});
