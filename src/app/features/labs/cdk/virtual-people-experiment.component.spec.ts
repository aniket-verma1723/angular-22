import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkVirtualScrollViewport, ScrollDispatcher } from '@angular/cdk/scrolling';
import { labButton, labElement } from './cdk-lab.spec-helpers';
import { FICTIONAL_PEOPLE, PEOPLE_COUNT, PERSON_ROW_HEIGHT } from './fictional-people';
import { VirtualPeopleExperimentComponent } from './virtual-people-experiment.component';

describe('VirtualPeopleExperimentComponent', () => {
  let fixture: ComponentFixture<VirtualPeopleExperimentComponent>;
  let root: HTMLElement;
  let viewport: CdkVirtualScrollViewport;
  let measuredOffset: jasmine.Spy<CdkVirtualScrollViewport['measureScrollOffset']>;
  let scrollToIndex: jasmine.Spy<CdkVirtualScrollViewport['scrollToIndex']>;

  beforeEach(() => TestBed.configureTestingModule({ imports: [VirtualPeopleExperimentComponent] }));

  // Flush Angular work and any frame captured by fakeAsync. This does not advance native
  // browser scrolling or guarantee delivery of CDK's outside-zone animation frame.
  function renderFrame(): void {
    flushMicrotasks();
    TestBed.tick();
    tick(16);
    TestBed.tick();
  }

  function mount(): void {
    fixture = TestBed.createComponent(VirtualPeopleExperimentComponent);
    root = fixture.nativeElement;
    fixture.autoDetectChanges();
    viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport)).injector.get(CdkVirtualScrollViewport);
    renderFrame();
  }

  function controlScrollMeasurement(): void {
    // Only the browser measurement boundary is controlled. The strategy, repeater, views,
    // selection, render observers and destruction remain real. The layout test is unstubbed.
    measuredOffset = spyOn(viewport, 'measureScrollOffset').and.returnValue(0);
    scrollToIndex = spyOn(viewport, 'scrollToIndex').and.callThrough();
  }

  function deliverScroll(index: number): void {
    const maxOffset = viewport.getDataLength() * PERSON_ROW_HEIGHT - viewport.getViewportSize();
    measuredOffset.and.returnValue(Math.max(0, Math.min(index * PERSON_ROW_HEIGHT, maxOffset)));
    // Establish the measured position before delivering the event. checkViewportSize is the
    // public synchronous strategy entry point; do not depend on a real RAF inside fakeAsync.
    viewport.checkViewportSize();
    viewport.elementRef.nativeElement.dispatchEvent(new Event('scroll'));
    renderFrame();
  }

  function jump(label: string, index: number): HTMLButtonElement {
    const button = labButton(root, label);
    button.focus();
    scrollToIndex.calls.reset();
    button.click();
    expect(scrollToIndex).toHaveBeenCalledOnceWith(index, 'auto');
    deliverScroll(index);
    return button;
  }

  function checkbox(id: number): HTMLInputElement {
    return labElement(root, `[data-person-id="lab-person-${id}"] input`);
  }

  function expectBoundedDom(): void {
    const rows = root.querySelectorAll('[data-person-row]');
    const range = viewport.getRenderedRange();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(14); // six visible rows plus at most four on either side
    expect(rows.length).toBe(range.end - range.start);
    expect(labElement(root, '[data-dom-count]').textContent).toBe(String(rows.length));
    expect(labElement(root, '[data-range]').textContent).toBe(`${range.start}–${range.end}`);
  }

  it('uses a complete bounded fixture, fixed-height viewport and finite attached DOM with list semantics', async () => {
    fixture = TestBed.createComponent(VirtualPeopleExperimentComponent);
    root = fixture.nativeElement;
    fixture.autoDetectChanges();
    viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport)).injector.get(CdkVirtualScrollViewport);

    async function waitForRenderedIndex(index: number): Promise<void> {
      // A range/render notification can precede CDK's outside-zone spacer/transform
      // update. Observe the actual geometry, not an arbitrary number of frames.
      await new Promise<void>((resolve, reject) => {
        let frame = 0;
        const timeout = window.setTimeout(() => {
          cancelAnimationFrame(frame);
          reject(new Error(`Virtual row ${index} did not reach its rendered geometry`));
        }, 4000);
        const inspect = (): void => {
          try {
            fixture.detectChanges();
            const element = viewport.elementRef.nativeElement;
            const range = viewport.getRenderedRange();
            const row = root.querySelector<HTMLElement>(`[data-person-id="lab-person-${index + 1}"]`);
            const bounds = element.getBoundingClientRect();
            const rowBounds = row?.getBoundingClientRect();
            if (element.scrollHeight === PEOPLE_COUNT * PERSON_ROW_HEIGHT &&
                range.start <= index && range.end > index && rowBounds &&
                rowBounds.height === PERSON_ROW_HEIGHT &&
                rowBounds.top >= bounds.top - 1 && rowBounds.bottom <= bounds.bottom + 1) {
              window.clearTimeout(timeout);
              resolve();
            } else {
              frame = requestAnimationFrame(inspect);
            }
          } catch (error: unknown) {
            window.clearTimeout(timeout);
            reject(error);
          }
        };
        inspect();
      });
      await fixture.whenStable();
    }

    await waitForRenderedIndex(0);
    expect(FICTIONAL_PEOPLE.length).toBe(1000);
    expect(new Set(FICTIONAL_PEOPLE.map(person => person.id)).size).toBe(1000);
    expect(FICTIONAL_PEOPLE.every(person => person.name.startsWith('Fictional person '))).toBeTrue();
    expect(viewport.getDataLength()).toBe(PEOPLE_COUNT);
    expect(viewport.getViewportSize()).toBe(288);
    const scrollElement = viewport.elementRef.nativeElement;
    expect(scrollElement.clientHeight).toBe(288);
    expect(scrollElement.scrollHeight).toBe(PEOPLE_COUNT * PERSON_ROW_HEIGHT);
    expect(getComputedStyle(scrollElement).overflowY).toBe('auto');
    expect(viewport.appendOnly).toBeFalse();
    expect(labElement(root, '[data-total]').textContent).toBe('1000');
    expectBoundedDom();
    const row = labElement(root, '[data-person-row]');
    expect(row.getBoundingClientRect().height).toBe(PERSON_ROW_HEIGHT);
    expect(row.getAttribute('role')).toBe('listitem');
    expect(row.getAttribute('aria-posinset')).toBe('1');
    expect(row.getAttribute('aria-setsize')).toBe('1000');
    expect(viewport.elementRef.nativeElement.getAttribute('role')).toBe('list');
    expect(viewport.elementRef.nativeElement.tabIndex).toBe(0);

    const lastButton = labButton(root, 'Jump to last person');
    lastButton.focus();
    // Subscribe before the native click: CDK delivers the scroll range on a real frame.
    const lastRendered = waitForRenderedIndex(PEOPLE_COUNT - 1);
    lastButton.click();
    await lastRendered;
    expect(scrollElement.scrollTop).toBe(PEOPLE_COUNT * PERSON_ROW_HEIGHT - scrollElement.clientHeight);
    expect(scrollElement.scrollHeight).toBe(PEOPLE_COUNT * PERSON_ROW_HEIGHT);
    expect(viewport.getRenderedRange().end).toBe(PEOPLE_COUNT);
    expect(row.isConnected).toBeFalse();
    expect(labElement(root, '[data-person-id="lab-person-1000"]').getAttribute('aria-posinset')).toBe('1000');
    expect(document.activeElement).toBe(lastButton);
    expectBoundedDom();
    fixture.destroy();
  });

  it('jumps to both boundaries, retains selection across destroyed views and keeps button focus', fakeAsync(() => {
    mount();
    controlScrollMeasurement();
    const first = checkbox(1);
    first.click();
    renderFrame();
    expect(first.checked).toBeTrue();
    const lastButton = jump('Jump to last person', PEOPLE_COUNT - 1);
    expect(document.activeElement).toBe(lastButton);
    expect(first.isConnected).toBeFalse();
    expect(viewport.getRenderedRange().end).toBe(1000);
    expect(viewport.getRenderedRange().start).toBeGreaterThan(0);
    expect(labElement(root, '[data-person-id="lab-person-1000"]').getAttribute('aria-posinset')).toBe('1000');
    expectBoundedDom();
    checkbox(1000).click();
    renderFrame();
    expect(labElement(root, '[data-selected-count]').textContent).toBe('2');
    const firstButton = jump('Jump to first person', 0);
    expect(document.activeElement).toBe(firstButton);
    expect(viewport.getRenderedRange().start).toBe(0);
    expect(checkbox(1)).not.toBe(first);
    expect(checkbox(1).checked).toBeTrue();
    expectBoundedDom();
    jump('Jump to last person', PEOPLE_COUNT - 1);
    expect(checkbox(1000).checked).toBeTrue();
    expectBoundedDom();
    fixture.destroy();
  }));

  it('updates the range at a measured middle offset and resets offscreen IDs without moving the viewport', fakeAsync(() => {
    mount();
    controlScrollMeasurement();
    checkbox(1).click();
    renderFrame();
    viewport.scrollToIndex(500, 'auto');
    deliverScroll(500);
    expect(viewport.getRenderedRange().start).toBeGreaterThan(0);
    expect(viewport.getRenderedRange().end).toBeLessThan(1000);
    expectBoundedDom();
    const beforeReset = viewport.getRenderedRange();
    scrollToIndex.calls.reset();
    labButton(root, 'Reset local selection').click();
    renderFrame();
    expect(labElement(root, '[data-selected-count]').textContent).toBe('0');
    expect(viewport.getRenderedRange()).toEqual(beforeReset);
    expect(scrollToIndex).not.toHaveBeenCalled();
    jump('Jump to first person', 0);
    expect(checkbox(1).checked).toBeFalse();
    fixture.destroy();
  }));

  it('deregisters scrolling and resets all selection at the experiment lifetime boundary', fakeAsync(() => {
    mount();
    checkbox(1).click();
    renderFrame();
    const oldViewport = viewport;
    const dispatcher = TestBed.inject(ScrollDispatcher);
    const complete = jasmine.createSpy('range stream completion');
    oldViewport.renderedRangeStream.subscribe({ complete });
    expect(dispatcher.scrollContainers.has(oldViewport)).toBeTrue();
    fixture.destroy();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(dispatcher.scrollContainers.has(oldViewport)).toBeFalse();
    mount();
    expect(labElement(root, '[data-selected-count]').textContent).toBe('0');
    expect(checkbox(1).checked).toBeFalse();
    expect(dispatcher.scrollContainers.has(viewport)).toBeTrue();
    expectBoundedDom();
    fixture.destroy();
  }));
});
