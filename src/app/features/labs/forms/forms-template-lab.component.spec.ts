import { TestBed, fakeAsync } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { FormsTemplateLabComponent } from './forms-template-lab.component';
import { clickLab, labButton, labElement, labInput, renderLab, submitLab, typeLab } from './forms-lab.spec-helpers';

describe('FormsTemplateLabComponent', () => {
  it('registers only small named preferences, validates, preserves failure and resets submitted on success', fakeAsync(() => {
    const fixture = TestBed.createComponent(FormsTemplateLabComponent);
    renderLab(fixture);
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    expect(Object.keys(form.controls).sort()).toEqual(['density', 'label', 'tips']);
    expect(fixture.componentInstance.canLeave()).toBeTrue();
    submitLab(fixture);
    expect(form.submitted).toBeTrue();
    expect(labElement(fixture).textContent).toContain('Enter a non-blank display label');
    expect(labButton(fixture, 'Complete success').disabled).toBeTrue();
    typeLab(fixture, '[name=label]', '   ');
    expect(form.invalid).toBeTrue();
    typeLab(fixture, '[name=label]', 'a'.repeat(41));
    expect(form.invalid).toBeTrue();
    typeLab(fixture, '[name=label]', '<b>Practice</b>');
    expect(form.valid).toBeTrue();
    expect(labElement(fixture).querySelector('b')).toBeNull();
    submitLab(fixture); submitLab(fixture);
    expect(fixture.componentInstance.canLeave()).toBeFalse();
    expect(labInput(fixture, '[name=label]').disabled).toBeTrue();
    clickLab(fixture, 'Fail response');
    expect(labInput(fixture, '[name=label]').value).toBe('<b>Practice</b>');
    expect(labElement(fixture).textContent).toContain('draft preserved');
    submitLab(fixture);
    clickLab(fixture, 'Complete success');
    expect(labInput(fixture, '[name=label]').value).toBe('');
    expect(form.submitted).toBeFalse();
    expect(form.pristine).toBeTrue();
    expect(form.untouched).toBeTrue();
    expect(fixture.componentInstance.canLeave()).toBeTrue();
    fixture.destroy();
  }));

  it('blocks pending submissions and explicitly resets values and submission metadata', fakeAsync(() => {
    const fixture = TestBed.createComponent(FormsTemplateLabComponent);
    renderLab(fixture);
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    typeLab(fixture, '[name=label]', 'Local label');
    form.control.markAsPending(); renderLab(fixture);
    submitLab(fixture);
    expect(labElement(fixture).textContent).toContain('Save stage: idle');
    clickLab(fixture, 'Reset draft');
    expect(form.value).toEqual({ label: '', density: 'comfortable', tips: true });
    expect(form.submitted).toBeFalse();
    expect(form.pending).toBeFalse();
    fixture.destroy();
  }));

  it('does not share preferences between mounted labs', fakeAsync(() => {
    const first = TestBed.createComponent(FormsTemplateLabComponent);
    const second = TestBed.createComponent(FormsTemplateLabComponent);
    renderLab(first); renderLab(second);
    typeLab(first, '[name=label]', 'Only first');
    expect(labInput(second, '[name=label]').value).toBe('');
    first.destroy(); second.destroy();
  }));
});
