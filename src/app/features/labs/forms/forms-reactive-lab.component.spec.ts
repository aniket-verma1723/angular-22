import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, fakeAsync } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { FormsReactiveLabComponent } from './forms-reactive-lab.component';
import { LocalAvailabilityService } from './local-availability.service';
import { clickLab, labButton, labElement, labInput, renderLab, submitLab, typeLab } from './forms-lab.spec-helpers';

describe('FormsReactiveLabComponent', () => {
  it('blocks invalid/pending/duplicate saves, retains failure and resets directive metadata on success', fakeAsync(() => {
    const fixture = TestBed.createComponent(FormsReactiveLabComponent);
    renderLab(fixture);
    const availability = fixture.debugElement.injector.get(LocalAvailabilityService);
    const directive = fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective);
    expect(fixture.componentInstance.canLeave()).toBeTrue();
    submitLab(fixture);
    expect(directive.submitted).toBeTrue();
    expect(labButton(fixture, 'Complete success').disabled).toBeTrue();
    clickLab(fixture, 'Fill sample');
    submitLab(fixture);
    expect(labElement(fixture).textContent).toContain('Form status: PENDING');
    availability.resolve(availability.requests()[0]?.id ?? -1); renderLab(fixture);
    submitLab(fixture); submitLab(fixture);
    expect(labElement(fixture).textContent).toContain('Save stage: saving');
    expect(fixture.componentInstance.canLeave()).toBeFalse();
    expect(labInput(fixture, 'app-reactive-stock-control input').disabled).toBeTrue();
    clickLab(fixture, 'Fail response');
    expect(labInput(fixture, '[data-title]').value).toBe('Practice notebook');
    expect(labElement(fixture).textContent).toContain('Draft preserved');
    availability.resolve(availability.requests()[0]?.id ?? -1); renderLab(fixture);
    submitLab(fixture);
    clickLab(fixture, 'Complete success');
    expect(labInput(fixture, '[data-title]').value).toBe('');
    expect(directive.submitted).toBeFalse();
    expect(directive.form.pristine).toBeTrue();
    expect(directive.form.untouched).toBeTrue();
    expect(fixture.componentInstance.canLeave()).toBeTrue();
    fixture.destroy();
  }));

  it('uses actual updateOn blur, cancels stale checks and tears down pending validation', fakeAsync(() => {
    const fixture = TestBed.createComponent(FormsReactiveLabComponent);
    renderLab(fixture);
    const availability = fixture.debugElement.injector.get(LocalAvailabilityService);
    const directive = fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective);
    expect(directive.form.get('title')?.updateOn).toBe('blur');
    typeLab(fixture, '[data-title]', 'First', false);
    expect(availability.requests()).toEqual([]);
    expect(directive.form.get('title')?.value).toBe('');
    submitLab(fixture);
    expect(labElement(fixture).textContent).toContain('Tab out of the title');
    labInput(fixture, '[data-title]').dispatchEvent(new Event('blur')); renderLab(fixture);
    const oldId = availability.requests()[0]?.id ?? -1;
    typeLab(fixture, '[data-title]', 'demo');
    expect(availability.resolve(oldId)).toBeFalse();
    availability.resolve(availability.requests()[0]?.id ?? -1); renderLab(fixture);
    expect(labElement(fixture).textContent).toContain('This name is reserved');
    typeLab(fixture, '[data-title]', 'Allowed');
    availability.fail(availability.requests()[0]?.id ?? -1); renderLab(fixture);
    expect(labElement(fixture).textContent).toContain('Local availability failed');
    clickLab(fixture, 'Retry availability');
    const activeId = availability.requests()[0]?.id ?? -1;
    fixture.destroy();
    expect(availability.requests()).toEqual([]);
    expect(availability.resolve(activeId)).toBeFalse();
  }));

  it('binds native calendar strings and focuses cross-field errors while preserving disabled dates', fakeAsync(() => {
    const fixture = TestBed.createComponent(FormsReactiveLabComponent);
    renderLab(fixture);
    clickLab(fixture, 'Fill sample');
    const availability = fixture.debugElement.injector.get(LocalAvailabilityService);
    availability.resolve(availability.requests()[0]?.id ?? -1); renderLab(fixture);
    const enabled = labInput(fixture, 'input[formControlName=enabled]');
    const start = labInput(fixture, 'input[formControlName=start]');
    const end = labInput(fixture, 'input[formControlName=end]');
    const ack = labInput(fixture, 'input[formControlName=acknowledged]');
    expect(start.disabled).toBeTrue(); expect(ack.disabled).toBeTrue();
    enabled.click(); renderLab(fixture);
    expect(start.disabled).toBeFalse(); expect(ack.disabled).toBeFalse();
    typeLab(fixture, 'input[formControlName=start]', '2026-10-02');
    typeLab(fixture, 'input[formControlName=end]', '2026-10-01');
    ack.click(); renderLab(fixture);
    clickLab(fixture, 'Review errors');
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(end);
    expect(labButton(fixture, 'Save local draft').disabled).toBeTrue();
    enabled.click(); renderLab(fixture);
    expect(start.disabled).toBeTrue(); expect(start.value).toBe('2026-10-02');
    expect(ack.checked).toBeTrue();
    expect(labButton(fixture, 'Save local draft').disabled).toBeFalse();
    clickLab(fixture, 'Reset draft');
    expect(start.value).toBe(''); expect(end.value).toBe('');
    expect(ack.checked).toBeFalse(); expect(ack.disabled).toBeTrue();
    fixture.destroy();
  }));

  it('bounds dynamic controls, omits disabled reference from value and resets buffered input', fakeAsync(() => {
    const fixture = TestBed.createComponent(FormsReactiveLabComponent);
    renderLab(fixture);
    const directive = fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective);
    expect(directive.form.value.reference).toBeUndefined();
    expect(directive.form.getRawValue().reference).toBe('LOCAL ONLY');
    clickLab(fixture, 'Add note'); clickLab(fixture, 'Add note'); clickLab(fixture, 'Add note');
    expect(labButton(fixture, 'Add note').disabled).toBeTrue();
    clickLab(fixture, 'Add note');
    expect(labElement(fixture).querySelectorAll('.note').length).toBe(3);
    clickLab(fixture, 'Remove note 2');
    expect(labButton(fixture, 'Add note').disabled).toBeFalse();
    clickLab(fixture, 'Toggle optional label');
    expect(directive.form.get('annotations.label')).not.toBeNull();
    typeLab(fixture, '[data-title]', 'Buffered', false);
    clickLab(fixture, 'Reset draft');
    expect(directive.form.get('annotations.label')).toBeNull();
    expect(labElement(fixture).querySelectorAll('.note').length).toBe(0);
    expect(labInput(fixture, '[data-title]').value).toBe('');
    expect(directive.submitted).toBeFalse();
    expect(fixture.componentInstance.canLeave()).toBeTrue();
    fixture.destroy();
  }));
});

describe('Reactive Forms async notifications with zoneless scheduling', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [FormsReactiveLabComponent], providers: [provideZonelessChangeDetection()]
  }));

  for (const outcome of ['success', 'failure'] as const) {
    it(`renders async validator ${outcome} without forced change detection or another button event`, async () => {
      const fixture = TestBed.createComponent(FormsReactiveLabComponent);
      await fixture.whenStable();
      labButton(fixture, 'Fill sample').click();
      await fixture.whenStable();
      const availability = fixture.debugElement.injector.get(LocalAvailabilityService);
      const directive = fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective);
      directive.form.markAllAsTouched();
      const request = availability.requests()[0];
      if (!request) throw new Error('Expected a pending validation request');
      expect(labElement(fixture).textContent).toContain('Form status: PENDING');
      expect(labButton(fixture, 'Save local draft').disabled).toBeTrue();

      if (outcome === 'success') availability.resolve(request.id);
      else availability.fail(request.id);
      await fixture.whenStable();

      expect(labElement(fixture).textContent).toContain(`Form status: ${outcome === 'success' ? 'VALID' : 'INVALID'}`);
      expect(labButton(fixture, 'Save local draft').disabled).toBe(outcome !== 'success');
      if (outcome === 'failure') {
        expect(labElement(fixture).textContent).toContain('Local availability failed');
        expect(labInput(fixture, '[data-title]').value).toBe('Practice notebook');
      }
      fixture.destroy();
      expect(availability.requests()).toEqual([]);
    });
  }
});
