import { Component, DestroyRef, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { labButton, labInput } from './component-lab.spec-helpers';
import { PermissionViewDirective } from './permission-view.directive';
import { TemplatesExperimentComponent } from './templates-experiment.component';

@Component({ selector: 'app-permission-probe', template: 'Embedded probe' })
class PermissionProbeComponent {
  constructor() { inject(DestroyRef).onDestroy(() => destroyedProbes++); }
}
let destroyedProbes = 0;

@Component({
  imports: [PermissionViewDirective, PermissionProbeComponent],
  template: `
    <button type="button" (click)="allowed.set(!allowed())">Toggle permission</button>
    <button type="button" (click)="revise()">Revise immutable subject</button>
    <section *appPermissionView="allowed(); subject: subject(); let value">
      <span>{{ value.revision }}</span><app-permission-probe />
    </section>
  `
})
class PermissionHostComponent {
  protected readonly allowed = signal(true);
  readonly subject = signal({ label: 'Fixture', revision: 0 });
  protected revise(): void { this.subject.update(value => ({ ...value, revision: value.revision + 1 })); }
}

describe('TemplatesExperimentComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [TemplatesExperimentComponent, PermissionHostComponent] }));

  it('retains the embedded context identity while replacing, never mutating, the subject', async () => {
    const fixture = TestBed.createComponent(PermissionHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const probe = fixture.debugElement.query(By.directive(PermissionProbeComponent));
    const context: unknown = fixture.debugElement.query(By.css('span')).context;
    const original = fixture.componentInstance.subject();
    Object.freeze(original);
    labButton(root, 'Revise immutable subject').click();
    await fixture.whenStable();
    const updated = fixture.debugElement.query(By.directive(PermissionProbeComponent));
    expect(updated.componentInstance).toBe(probe.componentInstance);
    expect(fixture.debugElement.query(By.css('span')).context).toBe(context);
    expect(root.querySelector('span')?.textContent).toBe('1');
    expect(fixture.componentInstance.subject()).toEqual({ label: 'Fixture', revision: 1 });
    expect(original.revision).toBe(0);
  });

  it('renders typed implicit/named outlet values including zero, and keeps the allowed view while its context updates', async () => {
    const fixture = TestBed.createComponent(TemplatesExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-notice]')?.textContent).toContain('Local learner: revision 0');
    expect(root.querySelector('[data-permission]')).toBeNull();
    labInput(root, 'input[type="checkbox"]').click();
    await fixture.whenStable();
    const input = labInput(root, 'input[type="text"]');
    input.value = 'Kept without a second draft owner';
    labButton(root, 'Update template context').click();
    await fixture.whenStable();
    expect(labInput(root, 'input[type="text"]')).toBe(input);
    expect(input.value).toBe('Kept without a second draft owner');
    expect(root.querySelector('[data-notice]')?.textContent).toContain('revision 1');
    expect(root.querySelector('[data-permission]')?.textContent).toContain('revision 1; allowed: true');
    labInput(root, 'input[type="checkbox"]').click();
    await fixture.whenStable();
    expect(root.querySelector('input[type="text"]')).toBeNull();
    labInput(root, 'input[type="checkbox"]').click();
    await fixture.whenStable();
    expect(labInput(root, 'input[type="text"]')).not.toBe(input);
    expect(labInput(root, 'input[type="text"]').value).toBe('');
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('destroys embedded components on denial and on host destruction without retaining detached views', async () => {
    destroyedProbes = 0;
    const fixture = TestBed.createComponent(PermissionHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    labButton(root, 'Toggle permission').click();
    await fixture.whenStable();
    expect(destroyedProbes).toBe(1);
    labButton(root, 'Toggle permission').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('app-permission-probe').length).toBe(1);
    fixture.destroy();
    expect(destroyedProbes).toBe(2);
  });
});
