import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NgZone } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { FocusTrapFactory } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { CdkLabComponent } from './cdk-lab.component';
import { labButton, labElement } from './cdk-lab.spec-helpers';
import { VirtualPeopleExperimentComponent } from './virtual-people-experiment.component';

describe('CdkLabComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [CdkLabComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  }));

  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
  });

  it('exports a standalone entry and creates only the selected experiment', async () => {
    const fixture = TestBed.createComponent(CdkLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(labElement(root, 'h1').textContent).toBe('CDK lab');
    const allLabs = labElement(root, 'a');
    expect(allLabs.textContent?.trim()).toBe('All labs');
    expect(allLabs.getAttribute('href')).toBe('/labs');
    expect(root.querySelector('app-overlay-experiment')).not.toBeNull();
    expect(root.querySelector('app-virtual-people-experiment')).toBeNull();
    expect(root.querySelector('app-utilities-experiment')).toBeNull();
    labButton(root, 'Accessibility and utilities').click();
    await fixture.whenStable();
    expect(root.querySelector('app-overlay-experiment')).toBeNull();
    expect(root.querySelector('app-utilities-experiment')).not.toBeNull();
    expect(labButton(root, 'Accessibility and utilities').getAttribute('aria-pressed')).toBe('true');
    for (const heading of ['Concept', 'Try it', 'CDK mechanism', 'Common mistake', 'Revision question', 'Test observation']) {
      expect(root.textContent).toContain(heading);
    }
  });

  it('switches away before autofocus without stealing the new selector focus or leaking a portal', async () => {
    const fixture = TestBed.createComponent(CdkLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const traps = spyOn(TestBed.inject(FocusTrapFactory), 'create').and.callThrough();
    const next = labButton(root, 'Accessibility and utilities');
    // Render the new selection before the old portal's afterNextRender callback can run.
    TestBed.inject(NgZone).run(() => {
      labButton(root, 'Open portal help').click();
      expect(traps).not.toHaveBeenCalled();
      next.focus();
      next.click();
      expect(root.querySelector('app-overlay-experiment')).not.toBeNull();
      expect(traps).not.toHaveBeenCalled();
    });
    await fixture.whenStable();
    expect(traps).not.toHaveBeenCalled();
    expect(root.querySelector('app-overlay-experiment')).toBeNull();
    expect(root.querySelector('app-utilities-experiment')).not.toBeNull();
    expect(document.activeElement).toBe(next);
    expect(TestBed.inject(OverlayContainer).getContainerElement().childElementCount).toBe(0);
    fixture.destroy();
  });

  it('disposes an already focused overlay on switching without overriding navigation focus', async () => {
    const fixture = TestBed.createComponent(CdkLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    labButton(root, 'Open portal help').click();
    await fixture.whenStable();
    const next = labButton(root, 'Accessibility and utilities');
    // A programmatic experiment change models navigation; pointer backdrop intentionally blocks
    // clicks behind the modal. Focus restoration must not undo that navigation's chosen focus.
    next.focus();
    next.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(next);
    expect(TestBed.inject(OverlayContainer).getContainerElement().childElementCount).toBe(0);
  });

  it('preserves a selected experiment on reselection but resets selection when its view is recreated', fakeAsync(() => {
    const fixture = TestBed.createComponent(CdkLabComponent);
    fixture.autoDetectChanges();
    TestBed.tick();
    const root: HTMLElement = fixture.nativeElement;
    const renderFrame = (): void => {
      flushMicrotasks();
      TestBed.tick();
      tick(16); // one fake CDK scroll frame
      TestBed.tick();
    };
    labButton(root, 'Virtual people').click();
    renderFrame();
    const currentExperiment = (): VirtualPeopleExperimentComponent =>
      fixture.debugElement.query(By.directive(VirtualPeopleExperimentComponent)).injector.get(VirtualPeopleExperimentComponent);
    const original = currentExperiment();
    labElement<HTMLInputElement>(root, '[data-person-id="lab-person-1"] input').click();
    renderFrame();
    expect(labElement(root, '[data-selected-count]').textContent).toBe('1');
    labButton(root, 'Virtual people').click();
    renderFrame();
    expect(currentExperiment()).toBe(original);
    expect(labElement(root, '[data-selected-count]').textContent).toBe('1');
    labButton(root, 'Overlay and portal').click();
    renderFrame();
    labButton(root, 'Virtual people').click();
    renderFrame();
    expect(currentExperiment()).not.toBe(original);
    expect(labElement(root, '[data-selected-count]').textContent).toBe('0');
    fixture.destroy();
  }));
});
