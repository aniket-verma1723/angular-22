import { TestBed } from '@angular/core/testing';
import { labButton, labElement } from './component-lab.spec-helpers';
import { EncapsulationExperimentComponent } from './encapsulation-experiment.component';

function shadowRoot(root: ParentNode): ShadowRoot {
  const shadow = labElement(root, 'app-shadow-sample').shadowRoot;
  if (!shadow) throw new Error('Expected a native shadow root');
  return shadow;
}

describe('EncapsulationExperimentComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [EncapsulationExperimentComponent] }));

  it('creates different actual CSS boundaries without leaking None or Emulated styles to the outside sentinel', async () => {
    const fixture = TestBed.createComponent(EncapsulationExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const sentinel = labElement(root, '[data-sentinel]');
    const beforeBorder = getComputedStyle(sentinel).borderTopStyle;
    labButton(root, 'Create encapsulation samples').click();
    await fixture.whenStable();
    const emulated = labElement(root, 'app-emulated-sample .sample');
    const none = labElement(root, 'app-none-sample .sample');
    const shadow = shadowRoot(root);
    expect(labElement(root, 'app-emulated-sample').shadowRoot).toBeNull();
    expect(labElement(root, 'app-none-sample').shadowRoot).toBeNull();
    expect(getComputedStyle(emulated).borderTopStyle).toBe('solid');
    expect(getComputedStyle(none).borderTopStyle).toBe('dashed');
    expect(getComputedStyle(labElement(shadow, '.sample')).borderTopStyle).toBe('double');
    expect(getComputedStyle(sentinel).borderTopStyle).toBe(beforeBorder);
    expect(root.querySelector('[data-shadow-state]')).toBeNull();
    labButton(root, 'Destroy encapsulation samples').click();
    await fixture.whenStable();
    expect(root.querySelector('app-none-sample')).toBeNull();
    expect(getComputedStyle(sentinel).borderTopStyle).toBe(beforeBorder);
  });

  it('inherits CSS variable themes into a working, focusable shadow control and destroys its state', async () => {
    const fixture = TestBed.createComponent(EncapsulationExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    // Local theme fixture: no global stylesheet or persistent theme changes.
    root.style.setProperty('--mat-sys-primary', 'rgb(20, 40, 60)');
    root.style.setProperty('--mat-sys-tertiary', 'rgb(60, 40, 20)');
    root.style.setProperty('--mat-sys-surface', 'rgb(240, 240, 240)');
    labButton(root, 'Create encapsulation samples').click();
    await fixture.whenStable();
    const oldShadow = shadowRoot(root);
    const sample = labElement(oldShadow, '.sample');
    expect(getComputedStyle(sample).borderTopColor).toBe('rgb(20, 40, 60)');
    expect(getComputedStyle(sample).backgroundColor).toBe('rgb(240, 240, 240)');
    const button = labButton(oldShadow, 'Shadow toggle');
    button.focus();
    expect(oldShadow.activeElement).toBe(button);
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    labButton(root, 'Alternate theme token').click();
    await fixture.whenStable();
    expect(getComputedStyle(sample).borderTopColor).toBe('rgb(60, 40, 20)');
    labButton(root, 'Destroy encapsulation samples').click();
    await fixture.whenStable();
    labButton(root, 'Create encapsulation samples').click();
    await fixture.whenStable();
    expect(shadowRoot(root)).not.toBe(oldShadow);
    expect(labButton(shadowRoot(root), 'Shadow toggle').getAttribute('aria-pressed')).toBe('false');
  });
});
