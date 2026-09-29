import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QuantityControlComponent } from '../../cart/ui/quantity-control.component';
import { ComponentStateLabComponent } from './component-state-lab.component';
import { CounterExperimentComponent } from './counter-experiment.component';
import { LabCounter } from './lab-counter.service';

function quantityInput(element: HTMLElement): HTMLInputElement {
  const input = element.querySelector('app-quantity-control input[type="number"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing lab quantity input');
  return input;
}

function clickButton(element: HTMLElement, text: string): void {
  const button = Array.from(element.querySelectorAll('button')).find(candidate => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  button.click();
}

function enterQuantity(element: HTMLElement, quantity: number): void {
  const input = quantityInput(element);
  input.value = String(quantity);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ComponentStateLabComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ComponentStateLabComponent] }));

  it('renders one focusable page heading and all six educational sections', async () => {
    const fixture = TestBed.createComponent(ComponentStateLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('h1').length).toBe(1);
    const heading = element.querySelector('h1');
    expect(heading?.textContent).toBe('Component state lab');
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    expect(Array.from(element.querySelectorAll('h2'), node => node.textContent)).toEqual([
      'Concept', 'Try it', 'Angular mechanism', 'Common mistake', 'Revision question', 'Test observation'
    ]);
    expect(element.textContent).toContain('This lab never injects or updates that cart.');
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('binds the rendered quantity model to the local draft and resets from the parent', async () => {
    const fixture = TestBed.createComponent(ComponentStateLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const control = fixture.debugElement.query(By.directive(QuantityControlComponent)).injector.get(QuantityControlComponent);
    expect(control.max()).toBe(5);
    expect(control.label()).toBe('Lab draft quantity');
    expect(quantityInput(element).value).toBe('1');
    enterQuantity(element, 4);
    await fixture.whenStable();
    expect(element.querySelector('[data-draft]')?.textContent).toBe('4');
    expect(control.quantity()).toBe(4);
    clickButton(element, 'Reset draft quantity');
    await fixture.whenStable();
    expect(quantityInput(element).value).toBe('1');
    expect(element.querySelector('[data-draft]')?.textContent).toBe('1');
  });

  it('supports the upper quantity boundary without changing experiment state', async () => {
    const fixture = TestBed.createComponent(ComponentStateLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    enterQuantity(element, 5);
    await fixture.whenStable();
    expect(element.querySelector('[data-draft]')?.textContent).toBe('5');
    expect(quantityInput(element).max).toBe('5');
    expect(Array.from(element.querySelectorAll('[data-total]'), node => node.textContent)).toEqual(['0', '0']);
  });

  it('renders both caller-projected content and an empty panel with fallbacks', async () => {
    const fixture = TestBed.createComponent(ComponentStateLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const panels = element.querySelectorAll('app-lesson-panel');
    expect(panels.length).toBe(2);
    expect(panels[0].querySelector('header h3')?.textContent).toBe('Local quantity model');
    expect(panels[0].querySelector('.lesson-content app-quantity-control')).not.toBeNull();
    expect(panels[0].querySelector('footer button')?.textContent?.trim()).toBe('Reset draft quantity');
    expect(panels[1].textContent).toContain('Default content appears here');
    expect(panels[1].textContent).toContain('explanatory fallback');
  });

  it('destroys and recreates the first experiment without losing the local quantity', async () => {
    const fixture = TestBed.createComponent(ComponentStateLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const original = fixture.debugElement.queryAll(By.directive(CounterExperimentComponent))[0].injector.get(LabCounter);
    clickButton(element, 'Increment from Probe A');
    enterQuantity(element, 3);
    await fixture.whenStable();
    expect(original.count()).toBe(1);
    clickButton(element, 'Destroy first experiment');
    await fixture.whenStable();
    expect(original.activeProbes()).toBe(0);
    expect(element.querySelectorAll('app-counter-experiment').length).toBe(1);
    clickButton(element, 'Recreate first experiment');
    await fixture.whenStable();
    expect(element.querySelectorAll('app-counter-experiment').length).toBe(2);
    expect(Array.from(element.querySelectorAll('[data-total]'), node => node.textContent)).toEqual(['0', '0']);
    expect(element.querySelector('[data-draft]')?.textContent).toBe('3');
  });

  it('does not share draft quantity across page instances or persist it after destruction', async () => {
    const first = TestBed.createComponent(ComponentStateLabComponent);
    const second = TestBed.createComponent(ComponentStateLabComponent);
    first.autoDetectChanges();
    second.autoDetectChanges();
    await first.whenStable();
    await second.whenStable();
    const firstElement: HTMLElement = first.nativeElement;
    const secondElement: HTMLElement = second.nativeElement;
    enterQuantity(firstElement, 4);
    await first.whenStable();
    expect(firstElement.querySelector('[data-draft]')?.textContent).toBe('4');
    expect(secondElement.querySelector('[data-draft]')?.textContent).toBe('1');
    const oldCounters = first.debugElement.queryAll(By.directive(CounterExperimentComponent))
      .map(owner => owner.injector.get(LabCounter));
    first.destroy();
    expect(oldCounters.every(counter => counter.activeProbes() === 0)).toBeTrue();
    const recreated = TestBed.createComponent(ComponentStateLabComponent);
    recreated.autoDetectChanges();
    await recreated.whenStable();
    const recreatedElement: HTMLElement = recreated.nativeElement;
    expect(quantityInput(recreatedElement).value).toBe('1');
    expect(Array.from(recreatedElement.querySelectorAll('[data-total]'), node => node.textContent)).toEqual(['0', '0']);
  });
});
