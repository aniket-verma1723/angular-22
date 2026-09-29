import { TestBed } from '@angular/core/testing';
import { labButton, labElement } from './component-lab.spec-helpers';
import { RenderExperimentComponent } from './render-experiment.component';
import { RenderMeasurements } from './render-measurements.service';

class ControlledResizeObserver implements ResizeObserver {
  private target: Element | undefined;
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void { this.target = target; }
  unobserve(): void { this.target = undefined; }
  disconnect(): void { this.disconnected = true; }

  // Also permits an already-queued callback after disconnect to exercise the destroyed guard.
  emit(): void {
    if (!this.target) throw new Error('Observer must have a target');
    this.callback([{
      target: this.target, contentRect: new DOMRect(0, 0, 210, 60),
      borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: []
    }], this);
  }
}

describe('RenderExperimentComponent', () => {
  let observers: ControlledResizeObserver[];
  let measuredPadding: string[];

  beforeEach(() => {
    observers = [];
    measuredPadding = [];
    TestBed.configureTestingModule({ imports: [RenderExperimentComponent] });
    spyOn(window, 'ResizeObserver').and.callFake(function(callback: ResizeObserverCallback): ResizeObserver {
      const observer = new ControlledResizeObserver(callback);
      observers.push(observer);
      return observer;
    });
    spyOn(HTMLElement.prototype, 'getBoundingClientRect').and.callFake(function(this: HTMLElement): DOMRect {
      if (this.classList.contains('surface')) measuredPadding.push(this.style.padding);
      return new DOMRect(0, 0, 240, 80);
    });
  });

  it('runs real hooks in order and measures only after the write phase without publishing automatically', async () => {
    const fixture = TestBed.createComponent(RenderExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const measurements = fixture.debugElement.injector.get(RenderMeasurements);
    expect(measurements.snapshot().reads).toEqual({ next: 0, every: 0, effect: 0, observer: 0 });
    expect(observers.length).toBe(0);
    labButton(root, 'Create render probe').click();
    await fixture.whenStable();
    expect(measurements.snapshot().hooks.map(entry => entry.hook)).toEqual(['constructor', 'input change', 'init', 'content init', 'view init']);
    expect(measurements.snapshot().reads.next).toBe(1);
    expect(measurements.snapshot().reads.effect).toBe(1);
    expect(measurements.snapshot().reads.every).toBeGreaterThan(0);
    expect(measuredPadding.length).toBeGreaterThan(0);
    expect(measuredPadding.every(value => value === '8px')).toBeTrue();
    expect(measurements.snapshot().width).toBe(240);
    expect(root.querySelector('[data-unread]')).not.toBeNull();
    const beforeEvent = measurements.snapshot().reads.every;
    labButton(root, 'Toggle measured emphasis').click();
    await fixture.whenStable();
    expect(labButton(root, 'Toggle measured emphasis').getAttribute('aria-pressed')).toBe('true');
    expect(measurements.snapshot().reads.every).toBeGreaterThan(beforeEvent);
    expect(measurements.snapshot().reads.effect).toBe(1);
    const frozen = measurements.snapshot();
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-next]')?.textContent).toBe('1');
    expect(root.querySelector('[data-width]')?.textContent).toBe('240');
    const previousRenderedEvery = root.querySelector('[data-every]')?.textContent;
    labButton(root, 'Change probe padding').click();
    await fixture.whenStable();
    expect(labElement(root, '.surface').style.padding).toBe('24px');
    expect(measurements.snapshot().reads.effect).toBe(2);
    expect(measurements.snapshot().effectCleanups).toBe(1);
    expect(root.querySelector('[data-effect]')?.textContent).toBe('1');
    expect(root.querySelector('[data-every]')?.textContent).toBe(previousRenderedEvery);
    expect(frozen.reads.effect).toBe(1);
    expect(frozen.effectCleanups).toBe(0);
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-effect]')?.textContent).toBe('2');
    expect(measurements.snapshot().reads.next).toBe(1);
    expect(measurements.snapshot().reads.effect).toBe(2);
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('records real observer callbacks without reactive publication and disposes observer/effect/render hooks on removal', async () => {
    const fixture = TestBed.createComponent(RenderExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const measurements = fixture.debugElement.injector.get(RenderMeasurements);
    labButton(root, 'Create render probe').click();
    await fixture.whenStable();
    const observer = observers[0];
    if (!observer) throw new Error('Expected observer construction');
    observer.emit();
    expect(measurements.snapshot().reads.observer).toBe(1);
    expect(measurements.snapshot().lastSource).toBe('observer');
    expect(measurements.snapshot().width).toBe(210);
    expect(root.querySelector('[data-unread]')).not.toBeNull();
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-observer]')?.textContent).toBe('1');
    const surface = labElement(root, '.surface');
    labButton(root, 'Destroy render probe').click();
    await fixture.whenStable();
    expect(observer.disconnected).toBeTrue();
    expect(measurements.snapshot().activeObservers).toBe(0);
    expect(measurements.snapshot().effectCleanups).toBe(1);
    expect(measurements.snapshot().hooks.at(-1)?.hook).toBe('destroy');
    expect(surface.style.padding).toBe('');
    const afterDestroy = measurements.snapshot();
    observer.emit();
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    expect(measurements.snapshot()).toEqual(afterDestroy);
    expect(root.querySelector('[data-active-observers]')?.textContent).toBe('0');
    labButton(root, 'Create render probe').click();
    await fixture.whenStable();
    expect(observers.length).toBe(2);
    expect(measurements.snapshot().reads.next).toBe(2);
    fixture.destroy();
    expect(observers.every(value => value.disconnected)).toBeTrue();
    expect(measurements.snapshot().activeObservers).toBe(0);
    expect(measurements.snapshot().effectCleanups).toBe(2);
  });

  it('bounds lifecycle observations across repeated view lifetimes', async () => {
    const fixture = TestBed.createComponent(RenderExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    for (let index = 0; index < 4; index++) {
      labButton(root, 'Create render probe').click();
      await fixture.whenStable();
      labButton(root, 'Destroy render probe').click();
      await fixture.whenStable();
    }
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('[data-hooks] li').length).toBe(16);
    expect(observers.every(value => value.disconnected)).toBeTrue();
    const previous = Array.from(root.querySelectorAll('[data-hooks] li'));
    labButton(root, 'Create render probe').click();
    await fixture.whenStable();
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    const current = Array.from(root.querySelectorAll('[data-hooks] li'));
    expect(current.length).toBe(16);
    // Five new hooks trim five old entries without recycling retained event nodes.
    previous.slice(5).forEach((node, index) => expect(current[index]).toBe(node));
  });
});
