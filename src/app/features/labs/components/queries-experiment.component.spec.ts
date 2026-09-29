import { TestBed } from '@angular/core/testing';
import { labButton, labElement } from './component-lab.spec-helpers';
import { QueriesExperimentComponent } from './queries-experiment.component';
import { QueryPanelComponent } from './query-panel.component';

describe('QueriesExperimentComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [QueriesExperimentComponent, QueryPanelComponent] }));

  it('separates content and view queries and focuses a conditional view after rendering', async () => {
    const fixture = TestBed.createComponent(QueriesExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-content-order]')?.textContent).toContain('Projected A, Projected B, Projected C');
    expect(root.querySelector('[data-view-order]')?.textContent).toContain('none; first: none');
    expect(labButton(root, 'Focus first view target').disabled).toBeTrue();
    labButton(root, 'Show and focus view targets').click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(labButton(root, 'View A'));
    expect(root.querySelector('[data-view-order]')?.textContent).toContain('View A, View B');
    expect(root.querySelector('[data-content-order]')?.textContent).not.toContain('View A');
    const viewA = labButton(root, 'View A');
    labButton(root, 'Reverse view targets').click();
    await fixture.whenStable();
    expect(labButton(root, 'View A')).toBe(viewA);
    expect(root.querySelector('[data-view-order]')?.textContent).toContain('View B, View A; first: View B');
    labButton(root, 'Focus first view target').click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(labButton(root, 'View B'));
    labButton(root, 'Focus first projected target').click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(labElement(root, '[data-query-key="Projected A"]'));
    labButton(root, 'Hide view targets').click();
    await fixture.whenStable();
    expect(labButton(root, 'Focus first view target').disabled).toBeTrue();
    expect(root.querySelector('[data-content-order]')?.textContent).toContain('Projected A');
  });

  it('moves the same DOM nodes, restores focused identity, and handles empty and recreated content', async () => {
    const fixture = TestBed.createComponent(QueriesExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const target = labElement(root, '[data-query-key="Projected A"]');
    target.focus();
    target.click();
    await fixture.whenStable();
    expect(labElement(root, '[data-query-key="Projected A"]')).toBe(target);
    expect(document.activeElement).toBe(target);
    expect(root.querySelector('[data-content-order]')?.textContent).toContain('Projected B, Projected C, Projected A');
    labButton(root, 'Reverse projected targets').click();
    await fixture.whenStable();
    expect(labElement(root, '[data-query-key="Projected A"]')).toBe(target);
    expect(root.querySelector('[data-content-order]')?.textContent).toContain('Projected A, Projected C, Projected B');
    labButton(root, 'Clear projected targets').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-empty]')).not.toBeNull();
    expect(labButton(root, 'Focus first projected target').disabled).toBeTrue();
    labButton(root, 'Reset projected targets').click();
    await fixture.whenStable();
    expect(labElement(root, '[data-query-key="Projected A"]')).not.toBe(target);
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('renders the selected projection fallback when no heading is supplied', async () => {
    const fixture = TestBed.createComponent(QueryPanelComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Projected targets');
    expect(labButton(root, 'Focus first projected target').disabled).toBeTrue();
  });
});
