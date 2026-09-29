import { OverlayContainer } from '@angular/cdk/overlay';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ANIMATION_MODULE_TYPE, afterNextRender } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import type { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatBottomSheetHarness } from '@angular/material/bottom-sheet/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { firstValueFrom } from 'rxjs';
import { MaterialActionSheetComponent } from './material-action-sheet.component';
import type { MaterialSheetData, MaterialSheetResult } from './material-action-sheet.component';
import { MaterialDisplayFeedbackComponent } from './material-display-feedback.component';
import { materialButton, materialElement } from './material.spec-helpers';

describe('Material gallery overlay ownership', () => {
  let fixture: ComponentFixture<MaterialDisplayFeedbackComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MaterialDisplayFeedbackComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }] });
    fixture = TestBed.createComponent(MaterialDisplayFeedbackComponent);
    fixture.detectChanges();
  });
  const root = (): HTMLElement => fixture.nativeElement;
  const overlayLoader = () => TestbedHarnessEnvironment.documentRootLoader(fixture);

  async function openSheet(): Promise<MatBottomSheetRef<unknown, unknown>> {
    const open = spyOn(TestBed.inject(MatBottomSheet), 'open').and.callThrough();
    const trigger = materialButton(root(), 'Choose next step');
    trigger.focus();
    trigger.click();
    const ref = open.calls.mostRecent().returnValue;
    const opened = firstValueFrom(ref.afterOpened());
    TestBed.tick();
    await opened;
    return ref;
  }

  async function openNotice(): Promise<MatSnackBarRef<TextOnlySnackBar>> {
    const open = spyOn(TestBed.inject(MatSnackBar), 'open').and.callThrough();
    materialButton(root(), 'Show important notice').click();
    const ref = open.calls.mostRecent().returnValue;
    const opened = firstValueFrom(ref.afterOpened());
    // Noop snackbar entry/exit completes afterNextRender, not after its announcement timer.
    TestBed.tick();
    await opened;
    return ref;
  }

  async function expectRestoredFocus(): Promise<void> {
    // Read after Material's own focus-restoration render work, not a sleep/whenStable on a pending sheet.
    const focused = new Promise<boolean>(resolve => afterNextRender({
      read: () => resolve(document.activeElement === materialButton(root(), 'Choose next step'))
    }, { injector: fixture.debugElement.injector }));
    TestBed.tick();
    expect(await focused).toBeTrue();
  }

  it('keeps important feedback inline after the persistent snackbar action dismisses its popup', async () => {
    const ref = await openNotice();
    const snack = await overlayLoader().getHarness(MatSnackBarHarness);
    expect(await snack.getAriaLive()).toBe('polite');
    expect(await snack.getMessage()).toContain('important notice remains');
    expect(await snack.getActionDescription()).toBe('Dismiss notice popup');
    const service = TestBed.inject(MatSnackBar);
    expect(service.open).toHaveBeenCalledWith(jasmine.any(String), 'Dismiss notice popup', jasmine.objectContaining({ duration: 0 }));
    materialButton(root(), 'Show important notice').click();
    expect(service.open).toHaveBeenCalledTimes(1);
    const dismissed = firstValueFrom(ref.afterDismissed());
    await snack.dismissWithAction();
    expect((await dismissed).dismissedByAction).toBeTrue();
    fixture.detectChanges();
    expect(root().querySelector('[data-important-notice]')?.textContent).toContain('Do not use them for navigation');
    expect(await overlayLoader().hasHarness(MatSnackBarHarness)).toBeFalse();
  });

  for (const activity of ['review', 'practice'] as const) {
    it(`returns the typed ${activity} action and restores focus after closing`, async () => {
      const ref = await openSheet();
      const sheet = await overlayLoader().getHarness(MatBottomSheetHarness);
      expect(await sheet.getAriaLabel()).toBe('Choose a local next step');
      expect(await (await sheet.host()).text()).toContain('Aurora notes');
      expect(document.activeElement?.textContent?.trim()).toBe('Review locally');
      const closed = firstValueFrom(ref.afterDismissed());
      const label = activity === 'review' ? 'Review locally' : 'Practice locally';
      await (await sheet.getHarness(MatButtonHarness.with({ text: label }))).click();
      expect(await closed).toEqual({ kind: 'choose', activity });
      await expectRestoredFocus();
      expect(root().querySelector('[data-sheet-result]')?.textContent).toBe(`Next step: ${activity} locally.`);
    });
  }

  for (const cancellation of ['button', 'escape'] as const) {
    it(`handles ${cancellation} cancellation without changing the subject and restores focus`, async () => {
      const ref = await openSheet();
      const sheet = await overlayLoader().getHarness(MatBottomSheetHarness);
      const closed = firstValueFrom(ref.afterDismissed());
      if (cancellation === 'button') {
        await (await sheet.getHarness(MatButtonHarness.with({ text: 'Cancel next step' }))).click();
      } else {
        await sheet.dismiss();
      }
      expect(await closed).toEqual(cancellation === 'button' ? { kind: 'cancel' } : undefined);
      await expectRestoredFocus();
      expect(root().querySelector('[data-sheet-result]')?.textContent).toContain('cancelled; subject unchanged');
      expect(root().querySelector('[data-selected-node]')?.textContent).toBe('Aurora notes');
    });
  }

  it('ignores repeated open requests and closes only its references on owner destruction', async () => {
    const snack = await openNotice();
    const sheet = await openSheet();
    // Synthetic repeat exercises the admission guard; modal focus prevents normal background interaction.
    materialButton(root(), 'Choose next step').click();
    expect(TestBed.inject(MatBottomSheet).open).toHaveBeenCalledTimes(1);
    const dismissSheetService = spyOn(TestBed.inject(MatBottomSheet), 'dismiss').and.callThrough();
    const dismissSnackService = spyOn(TestBed.inject(MatSnackBar), 'dismiss').and.callThrough();
    const sheetClosed = firstValueFrom(sheet.afterDismissed());
    const snackClosed = firstValueFrom(snack.afterDismissed());
    fixture.destroy();
    TestBed.tick();
    expect(await sheetClosed).toBeUndefined();
    await snackClosed;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('mat-bottom-sheet-container, mat-snack-bar-container')).toBeNull();
    expect(dismissSheetService).not.toHaveBeenCalled();
    expect(dismissSnackService).not.toHaveBeenCalled();
  });

  it('resets with open overlays without accepting late dismissal results', async () => {
    const snack = await openNotice();
    const sheet = await openSheet();
    const snackClosed = firstValueFrom(snack.afterDismissed());
    const sheetClosed = firstValueFrom(sheet.afterDismissed());
    // Exercise reset/close race directly through the DOM, even while the modal blocks pointer access.
    materialButton(root(), 'Reset display and feedback').click();
    // Drive the exit render before awaiting dismissal; awaiting first deadlocks this test.
    TestBed.tick();
    await Promise.all([snackClosed, sheetClosed]);
    fixture.detectChanges();
    expect(root().querySelector('[data-sheet-result]')?.textContent).toBe('No next step chosen.');
    expect(root().querySelector('[data-important-notice]')?.textContent).toBe('No notice raised yet.');
    expect(await overlayLoader().hasHarness(MatBottomSheetHarness)).toBeFalse();
    expect(await overlayLoader().hasHarness(MatSnackBarHarness)).toBeFalse();
  });

  it('does not dismiss a newer unrelated snackbar when this owner is destroyed', async () => {
    const owned = await openNotice();
    const oldClosed = firstValueFrom(owned.afterDismissed());
    const other = TestBed.inject(MatSnackBar).open('Another owner notice', 'Close other', { duration: 0 });
    const otherOpened = firstValueFrom(other.afterOpened());
    TestBed.tick();
    await oldClosed;
    // Replacement entry is scheduled by the old snackbar's dismissal, on the next render.
    TestBed.tick();
    await otherOpened;
    fixture.destroy();
    TestBed.tick();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.textContent).toContain('Another owner notice');
    const closed = firstValueFrom(other.afterDismissed());
    other.dismiss();
    // This overlay is application-owned: render it without touching the destroyed fixture.
    TestBed.tick();
    await closed;
  });

  it('does not dismiss a newer unrelated sheet when this owner is destroyed', async () => {
    const owned = await openSheet();
    const oldClosed = firstValueFrom(owned.afterDismissed());
    const other = TestBed.inject(MatBottomSheet).open<MaterialActionSheetComponent, MaterialSheetData, MaterialSheetResult>(MaterialActionSheetComponent, {
      data: { subject: 'Another owner notebook' }, ariaLabel: 'Another owner sheet', restoreFocus: false
    });
    const otherOpened = firstValueFrom(other.afterOpened());
    TestBed.tick();
    await oldClosed;
    TestBed.tick();
    await otherOpened;
    fixture.destroy();
    TestBed.tick();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(materialElement(overlay, 'mat-bottom-sheet-container').textContent).toContain('Another owner notebook');
    const closed = firstValueFrom(other.afterDismissed());
    other.dismiss();
    TestBed.tick();
    await closed;
  });
});
