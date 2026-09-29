import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CounterExperimentComponent } from './counter-experiment.component';
import { CounterProbeComponent } from './counter-probe.component';
import { LAB_EVENT_LIMIT, LabCounter } from './lab-counter.service';

@Component({
  imports: [CounterExperimentComponent],
  template: `
    <button type="button" (click)="visible.set(!visible())">Toggle first experiment</button>
    @if (visible()) {
      <app-counter-experiment label="First experiment" />
    }
    <app-counter-experiment label="Independent experiment" />
  `
})
class ExperimentHostComponent {
  protected readonly visible = signal(true);
}

function button(element: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(element.querySelectorAll('button')).find(candidate => candidate.textContent?.trim() === text);
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

function experiment(element: HTMLElement, label: string): HTMLElement {
  const found = element.querySelector(`section[aria-label="${label}"]`);
  if (!(found instanceof HTMLElement)) throw new Error(`Missing experiment: ${label}`);
  return found;
}

describe('CounterExperimentComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ExperimentHostComponent] }));

  it('shares one provider between siblings and isolates the other experiment', async () => {
    const fixture = TestBed.createComponent(ExperimentHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const owners = fixture.debugElement.queryAll(By.directive(CounterExperimentComponent));
    const firstCounter = owners[0].injector.get(LabCounter);
    const secondCounter = owners[1].injector.get(LabCounter);
    expect(firstCounter).not.toBe(secondCounter);
    for (const probe of owners[0].queryAll(By.directive(CounterProbeComponent))) {
      expect(probe.injector.get(LabCounter)).toBe(firstCounter);
    }
    const first = experiment(element, 'First experiment');
    button(first, 'Increment from Probe A').click();
    await fixture.whenStable();
    expect(Array.from(first.querySelectorAll('[data-count]'), node => node.textContent)).toEqual(['1', '1']);
    button(first, 'Increment from Probe B').click();
    await fixture.whenStable();
    expect(Array.from(first.querySelectorAll('[data-count]'), node => node.textContent)).toEqual(['2', '2']);
    expect(experiment(element, 'Independent experiment').querySelector('[data-total]')?.textContent).toBe('0');
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('unregisters hidden probes and recreates them without resetting the owning counter', async () => {
    const fixture = TestBed.createComponent(ExperimentHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const first = experiment(element, 'First experiment');
    expect(first.querySelector('[data-active]')?.textContent).toBe('2');
    expect(first.textContent).toContain('Probe A: OnInit');
    button(first, 'Increment from Probe A').click();
    await fixture.whenStable();
    button(first, 'Hide probes').click();
    await fixture.whenStable();
    expect(first.querySelectorAll('app-counter-probe').length).toBe(0);
    expect(first.querySelector('[data-active]')?.textContent).toBe('0');
    expect(first.querySelector('[data-total]')?.textContent).toBe('1');
    expect(first.textContent).toContain('Probe A: OnDestroy');
    expect(first.textContent).toContain('Probe B: OnDestroy');
    expect(() => fixture.checkNoChanges()).not.toThrow();
    button(first, 'Show probes').click();
    await fixture.whenStable();
    expect(first.querySelector('[data-active]')?.textContent).toBe('2');
    expect(Array.from(first.querySelectorAll('[data-count]'), node => node.textContent)).toEqual(['1', '1']);
    expect(first.querySelectorAll('li').length).toBe(6);
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('cleans up destroyed experiments and recreates fresh state without touching the sibling owner', async () => {
    const fixture = TestBed.createComponent(ExperimentHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const owners = fixture.debugElement.queryAll(By.directive(CounterExperimentComponent));
    const oldCounter = owners[0].injector.get(LabCounter);
    const independentCounter = owners[1].injector.get(LabCounter);
    button(experiment(element, 'First experiment'), 'Increment from Probe A').click();
    button(experiment(element, 'Independent experiment'), 'Increment from Probe B').click();
    await fixture.whenStable();
    button(element, 'Toggle first experiment').click();
    await fixture.whenStable();
    expect(oldCounter.activeProbes()).toBe(0);
    expect(oldCounter.events().slice(-2).map(event => event.message)).toEqual([
      'Probe A: OnDestroy', 'Probe B: OnDestroy'
    ]);
    button(element, 'Toggle first experiment').click();
    await fixture.whenStable();
    const recreatedOwners = fixture.debugElement.queryAll(By.directive(CounterExperimentComponent));
    const freshCounter = recreatedOwners[0].injector.get(LabCounter);
    expect(freshCounter).not.toBe(oldCounter);
    expect(freshCounter.count()).toBe(0);
    expect(freshCounter.activeProbes()).toBe(2);
    expect(freshCounter.events().length).toBe(2);
    expect(recreatedOwners[1].injector.get(LabCounter)).toBe(independentCounter);
    expect(independentCounter.count()).toBe(1);
    fixture.destroy();
    expect(freshCounter.activeProbes()).toBe(0);
    expect(independentCounter.activeProbes()).toBe(0);
  });

  it('keeps the rendered lifecycle log bounded across repeated creation and cleanup', async () => {
    const fixture = TestBed.createComponent(ExperimentHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const first = experiment(element, 'First experiment');
    for (let index = 0; index < 4; index++) {
      button(first, 'Hide probes').click();
      await fixture.whenStable();
      button(first, 'Show probes').click();
      await fixture.whenStable();
    }
    expect(first.querySelectorAll('li').length).toBe(LAB_EVENT_LIMIT);
    expect(first.querySelector('[data-active]')?.textContent).toBe('2');
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('emits typed lifecycle observations and unregisters on destruction', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CounterProbeComponent], providers: [LabCounter] });
    const fixture = TestBed.createComponent(CounterProbeComponent);
    fixture.componentRef.setInput('name', 'Observed probe');
    const events: string[] = [];
    fixture.componentInstance.lifecycle.subscribe(event => events.push(event));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect(events).toEqual(['Observed probe: OnInit']);
    const counter = TestBed.inject(LabCounter);
    expect(counter.activeProbes()).toBe(1);
    fixture.destroy();
    expect(events).toEqual(['Observed probe: OnInit', 'Observed probe: OnDestroy']);
    expect(counter.activeProbes()).toBe(0);
  });
});
