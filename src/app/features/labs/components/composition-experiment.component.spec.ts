import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { labButton, labInput } from './component-lab.spec-helpers';
import { CompositionExperimentComponent } from './composition-experiment.component';
import { ComposedToggleComponent, InheritedToggleComponent } from './toggle-examples.component';

@Component({
  imports: [ComposedToggleComponent, InheritedToggleComponent],
  template: `
    <button appComposedToggle type="button" [disabled]="disabled()" (activated)="activation.set($event)"></button>
    <button appInheritedToggle type="button"></button>
    <button type="button" (click)="disabled.set('')">Use empty disabled attribute</button>
    <p>{{ activation() ?? 'none' }}</p>
  `
})
class ToggleAttributeHostComponent {
  protected readonly disabled = signal('false');
  protected readonly activation = signal<boolean | null>(null);
}

describe('CompositionExperimentComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [CompositionExperimentComponent, ToggleAttributeHostComponent] }));

  it('composes host bindings and semantic outputs while keeping inherited and composed models independent', async () => {
    const fixture = TestBed.createComponent(CompositionExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const composed = labButton(root, 'Composed toggle');
    composed.click();
    await fixture.whenStable();
    expect(composed.getAttribute('aria-pressed')).toBe('true');
    expect(composed.classList.contains('lab-pressed')).toBeTrue();
    expect(root.querySelector('[data-composed]')?.textContent).toBe('true');
    expect(root.querySelector('[data-inherited]')?.textContent).toBe('false');
    expect(root.querySelector('[data-activation]')?.textContent).toBe('true');
    labButton(root, 'Inherited toggle').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-inherited]')?.textContent).toBe('true');
    labButton(root, 'Reset parent models').click();
    await fixture.whenStable();
    expect(composed.getAttribute('aria-pressed')).toBe('false');
    expect(labButton(root, 'Inherited toggle').getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('[data-activation]')?.textContent).toBe('true');
    labInput(root, 'input[type="checkbox"]').click();
    await fixture.whenStable();
    expect(composed.disabled).toBeTrue();
    composed.click();
    await fixture.whenStable();
    expect(composed.getAttribute('aria-pressed')).toBe('false');
    expect(labButton(root, 'Inherited toggle').disabled).toBeFalse();
  });

  it('transforms false and empty attribute strings through the exposed alias and renders projection fallbacks', async () => {
    const fixture = TestBed.createComponent(ToggleAttributeHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const composed = labButton(root, 'Composed toggle');
    expect(composed.disabled).toBeFalse();
    expect(labButton(root, 'Inherited toggle')).toBeTruthy();
    composed.click();
    await fixture.whenStable();
    expect(root.querySelector('p')?.textContent).toBe('true');
    labButton(root, 'Use empty disabled attribute').click();
    await fixture.whenStable();
    expect(composed.disabled).toBeTrue();
  });
});
