import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { PROFILING_ITEMS, PROFILING_ITEM_LIMIT, ProfilingCalculator } from './profiling-calculator.service';
import { ProfilingLessonComponent } from './profiling-lesson.component';

describe('ProfilingLessonComponent', () => {
  let fixture: ComponentFixture<ProfilingLessonComponent>;
  let root: HTMLElement;
  let calculator: ProfilingCalculator;
  let calculations: jasmine.Spy<ProfilingCalculator['calculate']>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ProfilingLessonComponent] });
    fixture = TestBed.createComponent(ProfilingLessonComponent);
    calculator = fixture.debugElement.injector.get(ProfilingCalculator);
    calculations = spyOn(calculator, 'calculate').and.callThrough();
    fixture.autoDetectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement;
  });

  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing profiling element: ${selector}`);
    return found;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(control => control.textContent?.trim() === label);
    if (!found) throw new Error(`Missing profiling button: ${label}`);
    return found;
  }

  async function click(label: string): Promise<void> {
    button(label).click();
    await fixture.whenStable();
  }

  it('starts with memoization, bounded output, native mode controls and honest learning guidance', () => {
    expect(button('Use computed memoization').getAttribute('aria-pressed')).toBe('true');
    expect(button('Use expensive template method').getAttribute('aria-pressed')).toBe('false');
    expect(Array.from(root.querySelectorAll('button')).every(control => control.type === 'button')).toBeTrue();
    expect(root.querySelectorAll('[data-profiling-id]').length).toBe(PROFILING_ITEM_LIMIT);
    expect(element('[data-profiling-id="1"] [data-score]').textContent).toBe('191172');
    expect(Array.from(root.querySelectorAll('h3'), heading => heading.textContent)).toEqual([
      'Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question', 'Test observation'
    ]);
    expect(root.textContent).toContain('intentional anti-pattern');
    expect(root.textContent).toContain('No profiler results have been collected');
    expect(root.textContent).toContain('Injector Tree');
    expect(root.textContent).toContain('Bottom-up');
    expect(calculations).toHaveBeenCalledTimes(1);
  });

  it('does not recalculate computed rows when an unrelated signal changes', async () => {
    const scores = element('.samples').textContent;
    calculations.calls.reset();
    await click('Toggle unrelated note');
    expect(element('[data-profiling-note]').textContent).toContain('shown');
    await click('Toggle unrelated note');
    expect(element('[data-profiling-note]').textContent).toContain('hidden');
    expect(calculations).not.toHaveBeenCalled();
    expect(element('.samples').textContent).toBe(scores);
  });

  it('recalculates the method on template checks without changing the result or row identity', async () => {
    const scores = element('.samples').textContent;
    const firstRow = element('[data-profiling-id="1"]');
    await click('Use expensive template method');
    expect(button('Use expensive template method').getAttribute('aria-pressed')).toBe('true');
    calculations.calls.reset();
    await click('Toggle unrelated note');
    expect(calculations.calls.count()).toBeGreaterThan(0);
    // Development verification may evaluate a method more than once; no exact per-click count.
    expect(element('.samples').textContent).toBe(scores);
    expect(element('[data-profiling-id="1"]')).toBe(firstRow);
    calculations.calls.reset();
    await click('Use computed memoization');
    await click('Toggle unrelated note');
    expect(calculations).not.toHaveBeenCalled();
  });

  it('immutably updates the changed object and array, recalculates once, and preserves stable rows', async () => {
    const before = calculations.calls.mostRecent().args[0];
    const firstRow = element('[data-profiling-id="1"]');
    const secondRow = element('[data-profiling-id="2"]');
    const previousScore = element('[data-profiling-id="1"] [data-score]').textContent;
    calculations.calls.reset();
    await click('Toggle sample 1 weight');
    expect(calculations).toHaveBeenCalledTimes(1);
    const after = calculations.calls.mostRecent().args[0];
    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(before).toEqual(PROFILING_ITEMS);
    expect(element('[data-profiling-id="1"] [data-weight]').textContent).toBe('2');
    expect(element('[data-profiling-id="1"] [data-score]').textContent).not.toBe(previousScore);
    expect(element('[data-profiling-id="1"]')).toBe(firstRow);
    expect(element('[data-profiling-id="2"]')).toBe(secondRow);
    await click('Toggle sample 1 weight');
    expect(element('[data-profiling-id="1"] [data-score]').textContent).toBe(previousScore);
  });

  it('reverses a new array while moving existing DOM nodes by ID, not by index', async () => {
    const before = calculations.calls.mostRecent().args[0];
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-profiling-id]'));
    calculations.calls.reset();
    await click('Reverse samples');
    expect(calculations).toHaveBeenCalledTimes(1);
    const after = calculations.calls.mostRecent().args[0];
    expect(after).not.toBe(before);
    expect(before.map(item => item.id)).toEqual(PROFILING_ITEMS.map(item => item.id));
    expect(after).toEqual([...before].reverse());
    const reversed = Array.from(root.querySelectorAll<HTMLElement>('[data-profiling-id]'));
    expect(reversed.length).toBe(PROFILING_ITEM_LIMIT);
    reversed.forEach((row, index) => expect(row).toBe(rows[rows.length - 1 - index]));
    await click('Toggle sample 1 weight');
    expect(element('[data-profiling-id="1"] [data-weight]').textContent).toBe('2');
    expect(element('[data-profiling-id="1"]')).toBe(rows[0]);
  });

  it('invalidates a cached computed result even when data changed while method mode was selected', async () => {
    await click('Use expensive template method');
    await click('Toggle sample 1 weight');
    const updatedOutput = element('.samples').textContent;
    calculations.calls.reset();
    await click('Use computed memoization');
    expect(calculations).toHaveBeenCalledTimes(1);
    expect(element('.samples').textContent).toBe(updatedOutput);
    await click('Toggle unrelated note');
    expect(calculations).toHaveBeenCalledTimes(1);
  });

  it('keeps data bounded over repeated updates and gives each lesson its own calculator', async () => {
    for (let cycle = 0; cycle < 10; cycle++) {
      await click('Toggle sample 1 weight');
      await click('Reverse samples');
    }
    expect(root.querySelectorAll('[data-profiling-id]').length).toBe(PROFILING_ITEM_LIMIT);
    expect(element('[data-profiling-id="1"] [data-weight]').textContent).toBe('1');
    const other = TestBed.createComponent(ProfilingLessonComponent);
    other.autoDetectChanges();
    await other.whenStable();
    expect(other.debugElement.injector.get(ProfilingCalculator)).not.toBe(calculator);
    expect(TestBed.inject(ProfilingCalculator, null)).toBeNull();
    other.destroy();
    fixture.destroy();
  });
});
