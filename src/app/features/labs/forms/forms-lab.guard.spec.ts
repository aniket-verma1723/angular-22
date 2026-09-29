import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { routes } from '../labs.routes';
import { FormsLabGuard, FormsLabLeaveService } from './forms-lab.guard';
import type { FormsLabPage } from './forms-lab.guard';

@Component({
  providers: [FormsLabLeaveService],
  template: '<button type="button">Navigate away</button>'
})
class GuardOwner { readonly leave = inject(FormsLabLeaveService); }

@Component({ template: '<h1>Destination</h1>' })
class Destination {}

describe('FormsLabGuard and component-owned consent', () => {
  it('integrates the real route guard with cancel, superseding navigation and explicit discard', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'labs', children: routes.filter(route => route.path === 'forms-template') },
      { path: 'away', component: Destination },
      { path: 'other', component: Destination }
    ])] });
    const harness = await RouterTestingHarness.create('/labs/forms-template');
    const router = TestBed.inject(Router);
    const dialog = TestBed.inject(MatDialog);
    const label = harness.routeNativeElement?.querySelector<HTMLInputElement>('input[name=label]');
    if (!label) throw new Error('Expected routed preference input');
    label.value = 'Unsaved local preference';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();

    const opened = firstValueFrom(dialog.afterOpened);
    const cancelled = router.navigateByUrl('/away');
    const first = await opened;
    await firstValueFrom(first.afterOpened());
    // Navigation is deliberately pending on consent; whenStable would deadlock.
    TestBed.tick();
    expect(document.activeElement?.textContent?.trim()).toBe('Stay');
    first.close(false);
    expect(await cancelled).toBeFalse();
    expect(router.url).toBe('/labs/forms-template');
    expect(label.value).toBe('Unsaved local preference');

    const nextOpened = firstValueFrom(dialog.afterOpened);
    const superseded = router.navigateByUrl('/away');
    const second = await nextOpened;
    await firstValueFrom(second.afterOpened());
    expect(await router.navigateByUrl('/other')).toBeFalse();
    expect(await superseded).toBeFalse();
    expect(dialog.openDialogs.length).toBe(1);
    const closed = firstValueFrom(second.afterClosed());
    second.close(true);
    await closed;
    expect(router.url).toBe('/labs/forms-template');

    const finalOpened = firstValueFrom(dialog.afterOpened);
    const discarded = router.navigateByUrl('/away');
    const final = await finalOpened;
    await firstValueFrom(final.afterOpened());
    final.close(true);
    expect(await discarded).toBeTrue();
    expect(router.url).toBe('/away');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Destination');
    expect(dialog.openDialogs.length).toBe(0);
  });

  it('exports a functional guard delegating to the page contract', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const router = TestBed.inject(Router);
    const state = router.routerState.snapshot;
    const canLeave = jasmine.createSpy('canLeave').and.returnValue(false);
    const page: FormsLabPage = { canLeave };
    expect(FormsLabGuard(page, state.root, state, state)).toBeFalse();
    expect(canLeave).toHaveBeenCalledTimes(1);
  });

  it('allows pristine departure and blocks active saves without opening a dialog', () => {
    const fixture = TestBed.createComponent(GuardOwner);
    const leave = fixture.componentInstance.leave;
    expect(leave.canLeave(false, false)).toBeTrue();
    expect(leave.canLeave(true, true)).toBeFalse();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
    fixture.destroy();
  });

  it('defaults to Stay, restores initiating focus and emits discard only on explicit consent', async () => {
    const fixture = TestBed.createComponent(GuardOwner);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector('button');
    if (!button) throw new Error('Missing initiating button');
    button.focus();
    const leave = fixture.componentInstance.leave;
    const result = leave.canLeave(true, false);
    if (typeof result === 'boolean') throw new Error('Expected consent observable');
    const decision = firstValueFrom(result);
    const dialog = TestBed.inject(MatDialog);
    const ref = dialog.openDialogs[0];
    if (!ref) throw new Error('Expected dialog');
    await firstValueFrom(ref.afterOpened());
    TestBed.tick();
    await fixture.whenStable();
    expect(document.activeElement?.textContent?.trim()).toBe('Stay');
    ref.close(false);
    expect(await decision).toBeFalse();
    expect(document.activeElement).toBe(button);
    expect(leave.confirming()).toBeFalse();
    const discard = leave.canLeave(true, false);
    if (typeof discard === 'boolean') throw new Error('Expected second consent');
    const discarded = firstValueFrom(discard);
    const second = dialog.openDialogs[0];
    if (!second) throw new Error('Expected second dialog');
    second.close(true);
    expect(await discarded).toBeTrue();
    fixture.destroy();
  });

  it('unlocks after a superseded guard unsubscribes, and closes its dialog on destruction', async () => {
    const fixture = TestBed.createComponent(GuardOwner);
    fixture.detectChanges();
    const leave = fixture.componentInstance.leave;
    const result = leave.canLeave(true, false);
    if (typeof result === 'boolean') throw new Error('Expected consent');
    const subscriber = result.subscribe();
    subscriber.unsubscribe();
    expect(leave.canLeave(true, false)).toBeFalse();
    const dialog = TestBed.inject(MatDialog);
    const ref = dialog.openDialogs[0];
    if (!ref) throw new Error('Expected dialog');
    const closed = firstValueFrom(ref.afterClosed());
    ref.close();
    await closed;
    expect(leave.confirming()).toBeFalse();
    leave.canLeave(true, false);
    const remaining = dialog.openDialogs[0];
    if (!remaining) throw new Error('Expected owned dialog');
    const destroyed = firstValueFrom(remaining.afterClosed());
    fixture.destroy();
    expect(await destroyed).toBeFalse();
    expect(dialog.openDialogs.length).toBe(0);
  });
});
