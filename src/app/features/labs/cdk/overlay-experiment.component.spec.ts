import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { FocusTrapFactory } from '@angular/cdk/a11y';
import { BlockScrollStrategy, Overlay, OverlayContainer, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { labButton, labElement } from './cdk-lab.spec-helpers';
import { OverlayExperimentComponent } from './overlay-experiment.component';

describe('OverlayExperimentComponent', () => {
  let fixture: ComponentFixture<OverlayExperimentComponent>;
  let root: HTMLElement;
  let overlays: HTMLElement;
  let create: jasmine.Spy<Overlay['create']>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [OverlayExperimentComponent] });
    create = spyOn(TestBed.inject(Overlay), 'create').and.callThrough();
    overlays = TestBed.inject(OverlayContainer).getContainerElement();
    fixture = TestBed.createComponent(OverlayExperimentComponent);
    root = fixture.nativeElement;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function open(): HTMLButtonElement {
    const trigger = labButton(root, 'Open portal help');
    trigger.focus();
    trigger.click();
    return trigger;
  }

  function latestOverlay(): OverlayRef {
    return create.calls.mostRecent().returnValue;
  }

  it('attaches a real TemplatePortal with labelled modal semantics and initial focus', async () => {
    const attach = spyOn(OverlayRef.prototype, 'attach').and.callThrough();
    const trigger = open();
    await fixture.whenStable();
    const dialog = labElement(overlays, '[data-help-dialog]');
    expect(attach.calls.mostRecent().args[0] instanceof TemplatePortal).toBeTrue();
    expect(latestOverlay().hasAttached()).toBeTrue();
    expect(latestOverlay().getConfig().scrollStrategy instanceof BlockScrollStrategy).toBeTrue();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(labElement(dialog, 'h2').id);
    expect(dialog.querySelector(`#${dialog.getAttribute('aria-describedby')}`)).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(labButton(dialog, 'Acknowledge help'));
    labButton(dialog, 'Acknowledge help').click();
    await fixture.whenStable();
    expect(labElement(dialog, '[data-help-acknowledged]').textContent).toContain('Help acknowledged');
  });

  it('wraps both real focus-trap boundaries and restores the opener on Escape', async () => {
    const trigger = open();
    await fixture.whenStable();
    const dialog = labElement(overlays, '[data-help-dialog]');
    // Synthetic Tab does not run the browser default action. Focus the actual trap boundary
    // elements instead, exercising the listeners that Tab/Shift+Tab would reach.
    const start = dialog.previousElementSibling;
    const end = dialog.nextElementSibling;
    if (!(start instanceof HTMLElement) || !(end instanceof HTMLElement)) throw new Error('Expected focus boundaries');
    start.focus();
    expect(document.activeElement).toBe(labButton(dialog, 'Close help'));
    end.focus();
    expect(document.activeElement).toBe(labButton(dialog, 'Acknowledge help'));
    const ref = latestOverlay();
    const dispose = spyOn(ref, 'dispose').and.callThrough();
    const block = ref.getConfig().scrollStrategy;
    if (!block) throw new Error('Expected scroll strategy');
    const disable = spyOn(block, 'disable').and.callThrough();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    labButton(dialog, 'Acknowledge help').dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBeTrue();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(disable).toHaveBeenCalled();
    expect(ref.hasAttached()).toBeFalse();
    expect(overlays.childElementCount).toBe(0);
    expect(start.isConnected).toBeFalse();
    expect(end.isConnected).toBeFalse();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores unrelated/composing keys, closes on backdrop, and releases event subscriptions', async () => {
    const trigger = open();
    await fixture.whenStable();
    const ref = latestOverlay();
    const complete = jasmine.createSpy('event completion');
    ref.keydownEvents().subscribe({ complete });
    const action = labButton(overlays, 'Acknowledge help');
    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    expect(ref.hasAttached()).toBeTrue();
    const backdrop = ref.backdropElement;
    if (!backdrop) throw new Error('Expected real overlay backdrop');
    backdrop.click();
    await fixture.whenStable();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    expect(overlays.childElementCount).toBe(0);
    // Detached DOM cannot mutate a future portal or keep its event bindings alive.
    open();
    await fixture.whenStable();
    action.click();
    await fixture.whenStable();
    expect(labElement(overlays, '[data-help-acknowledged]').textContent).toContain('No action');
    labButton(overlays, 'Close help').click();
    await fixture.whenStable();
    expect(overlays.childElementCount).toBe(0);
  });

  it('cancels old autofocus when reopened before render and destroys the live trap with its owner', async () => {
    const traps = spyOn(TestBed.inject(FocusTrapFactory), 'create').and.callThrough();
    // Nested click handlers must finish in one turn, before auto-detection renders either portal.
    const old = TestBed.inject(NgZone).run(() => {
      const trigger = open();
      const ref = latestOverlay();
      expect(ref.hasAttached()).toBeTrue();
      expect(traps).not.toHaveBeenCalled();
      trigger.click();
      expect(traps).not.toHaveBeenCalled();
      return ref;
    });
    await fixture.whenStable();
    expect(old.hasAttached()).toBeFalse();
    expect(traps).toHaveBeenCalledTimes(1);
    const trap = traps.calls.mostRecent().returnValue;
    const destroy = spyOn(trap, 'destroy').and.callThrough();
    expect(overlays.querySelectorAll('[data-help-dialog]').length).toBe(1);
    fixture.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(overlays.childElementCount).toBe(0);
    expect(trap.hasAttached()).toBeFalse();
  });

  it('cancels autofocus if destroyed before the first overlay render', async () => {
    const traps = spyOn(TestBed.inject(FocusTrapFactory), 'create').and.callThrough();
    TestBed.inject(NgZone).run(() => {
      open();
      expect(latestOverlay().hasAttached()).toBeTrue();
      expect(traps).not.toHaveBeenCalled();
      fixture.destroy();
    });
    await fixture.whenStable();
    expect(traps).not.toHaveBeenCalled();
    expect(overlays.childElementCount).toBe(0);
  });
});
