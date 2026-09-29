import { TestBed } from '@angular/core/testing';
import { MAX_TRACE_EVENTS } from './experiment-trace';
import { RXJS_LESSONS } from './rxjs-lessons';
import { RxjsLabComponent } from './rxjs-lab.component';

function select(element: HTMLElement, id: string): HTMLSelectElement {
  const control = element.querySelector(`#rxjs-${id}`);
  if (!(control instanceof HTMLSelectElement)) throw new Error(`Missing select: ${id}`);
  return control;
}

function choose(element: HTMLElement, id: string, value: string): void {
  const control = select(element, id);
  control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function button(element: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

function rows(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.timeline li'), row =>
    Array.from(row.children, child => child.textContent?.trim() ?? '').join(' '));
}

async function createLab() {
  const fixture = TestBed.createComponent(RxjsLabComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  return { fixture, element };
}

describe('RxjsLabComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RxjsLabComponent] }));

  it('starts idle with one focusable heading, associated native labels and a prediction before Run', async () => {
    const { fixture, element } = await createLab();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Idle.');
    expect(rows(element)).toEqual([]);
    for (const control of Array.from(element.querySelectorAll('select'))) {
      expect(element.querySelector(`label[for="${control.id}"]`)).not.toBeNull();
      expect(control.getAttribute('aria-describedby')).toBe('rxjs-validation');
    }
    expect(Array.from(element.querySelectorAll('h2'), node => node.textContent)).toEqual([
      'Concept', 'Try it', 'Angular and RxJS mechanism', 'Common mistake', 'Revision question', 'Test observation'
    ]);
    const prediction = element.querySelector('#rxjs-predict');
    expect(prediction).not.toBeNull();
    if (prediction) expect(prediction.compareDocumentPosition(button(element, 'Run experiment')) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(element.textContent).toContain('virtual milliseconds');
    expect(element.textContent).toContain('not an Angular destruction test');
    expect(() => fixture.checkNoChanges()).not.toThrow();
  });

  it('renders the actual four-click timeline and resets without retaining old logs', async () => {
    const { fixture, element } = await createLab();
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    const first = rows(element);
    expect(first).toContain('+7 virtual ms A cancel');
    expect(first).toContain('+34 virtual ms C next');
    expect(first).toContain('+56 virtual ms D complete');
    expect(first.length).toBeLessThanOrEqual(MAX_TRACE_EVENTS);
    expect(element.querySelector('ol')?.getAttribute('aria-label')).toContain('Chronological virtual-time');
    button(element, 'Reset experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toEqual([]);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Idle.');
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toEqual(first);
  });

  it('uses selected strategy, inner error and teardown rather than displaying a static example', async () => {
    const { fixture, element } = await createLab();
    choose(element, 'strategy', 'concatMap');
    choose(element, 'error', 'B');
    choose(element, 'teardown', 'late');
    await fixture.whenStable();
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toContain('+31 virtual ms A next');
    expect(rows(element)).toContain('+44 virtual ms B error');
    expect(rows(element)).toContain('+50 virtual ms C cancel');
    expect(rows(element)).toContain('+50 virtual ms D drop');
    expect(rows(element).some(row => row.includes('D next'))).toBeFalse();
    expect(element.textContent).toContain('unbounded internal queue');
    choose(element, 'teardown', 'none');
    await fixture.whenStable();
    expect(rows(element)).toEqual([]);
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toContain('+76 virtual ms D next');
  });

  it('supports spaced clicks and restores default controls on Reset', async () => {
    const { fixture, element } = await createLab();
    choose(element, 'clicks', 'spaced');
    choose(element, 'strategy', 'exhaustMap');
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    expect(rows(element).filter(row => row.endsWith(' next')).length).toBe(4);
    expect(rows(element).some(row => row.endsWith(' ignore'))).toBeFalse();
    button(element, 'Reset experiment').click();
    await fixture.whenStable();
    expect(select(element, 'clicks').value).toBe('burst');
    expect(select(element, 'strategy').value).toBe('switchMap');
    expect(select(element, 'error').value).toBe('none');
    expect(select(element, 'teardown').value).toBe('none');
  });

  for (const id of ['recipe', 'clicks', 'strategy', 'error', 'teardown']) {
    it(`rejects unsupported ${id} values without logging or rendering supplied content`, async () => {
      const { fixture, element } = await createLab();
      const control = select(element, id);
      const original = control.value;
      const option = document.createElement('option');
      option.value = '<img src=x onerror=alert(1)> secret';
      option.textContent = 'Unsupported option';
      control.append(option);
      control.value = option.value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
      expect(control.getAttribute('aria-invalid')).toBe('true');
      expect(control.value).toBe(original);
      expect(element.querySelector('[role="alert"]')?.textContent).toContain('Choose a listed option');
      expect(button(element, 'Run experiment').disabled).toBeTrue();
      expect(element.textContent).not.toContain('secret');
      expect(element.querySelector('img')).toBeNull();
      expect(rows(element)).toEqual([]);
      option.remove();
      button(element, 'Reset experiment').click();
      await fixture.whenStable();
      expect(button(element, 'Run experiment').disabled).toBeFalse();
      expect(control.getAttribute('aria-invalid')).toBeNull();
      expect(control.value).toBe(original);
    });
  }

  it('rejects blank controls and permits deliberate valid-selection recovery', async () => {
    const { fixture, element } = await createLab();
    choose(element, 'strategy', '');
    await fixture.whenStable();
    expect(button(element, 'Run experiment').disabled).toBeTrue();
    choose(element, 'strategy', 'mergeMap');
    await fixture.whenStable();
    expect(button(element, 'Run experiment').disabled).toBeFalse();
    expect(select(element, 'strategy').getAttribute('aria-invalid')).toBeNull();
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toContain('+20 virtual ms B next');
    expect(rows(element)).toContain('+31 virtual ms A next');
  });

  for (const recipe of RXJS_LESSONS.filter(item => item.id !== 'flattening')) {
    it(`runs the ${recipe.id} recipe and presents its mechanism, mistake and revision`, async () => {
      const { fixture, element } = await createLab();
      choose(element, 'recipe', recipe.id);
      await fixture.whenStable();
      expect(element.querySelector('#rxjs-strategy')).toBeNull();
      expect(element.textContent).toContain(recipe.prediction);
      expect(element.textContent).toContain(recipe.mechanism);
      expect(element.textContent).toContain(recipe.mistake);
      expect(element.textContent).toContain(recipe.revision);
      button(element, 'Run experiment').click();
      await fixture.whenStable();
      expect(element.querySelector('[role="status"]')?.textContent).toContain('Complete.');
      expect(rows(element).length).toBeGreaterThan(0);
      expect(rows(element).length).toBeLessThanOrEqual(MAX_TRACE_EVENTS);
    });
  }

  it('does not leave an invisible validation failure when switching to another valid recipe', async () => {
    const { fixture, element } = await createLab();
    choose(element, 'error', 'unsupported');
    choose(element, 'recipe', 'sources');
    await fixture.whenStable();
    expect(button(element, 'Run experiment').disabled).toBeFalse();
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe('');
  });

  it('cannot publish a pending promise result after Reset or recipe replacement', async () => {
    const { fixture, element } = await createLab();
    choose(element, 'recipe', 'promises');
    await fixture.whenStable();
    button(element, 'Run experiment').click();
    button(element, 'Reset experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toEqual([]);
    expect(select(element, 'recipe').value).toBe('flattening');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Idle.');
    choose(element, 'recipe', 'promises');
    await fixture.whenStable();
    button(element, 'Run experiment').click();
    choose(element, 'recipe', 'transform');
    await fixture.whenStable();
    expect(rows(element)).toEqual([]);
    button(element, 'Run experiment').click();
    await fixture.whenStable();
    expect(rows(element)).toContain('+0 virtual ms SCAN:14 next');
    expect(rows(element).some(row => row.includes('FIRST'))).toBeFalse();
  });

  it('does not share observations across page instances or update a destroyed promise view', async () => {
    const first = await createLab();
    choose(first.element, 'recipe', 'promises');
    await first.fixture.whenStable();
    button(first.element, 'Run experiment').click();
    first.fixture.destroy();
    const second = await createLab();
    expect(rows(second.element)).toEqual([]);
    expect(second.element.querySelector('[role="status"]')?.textContent).toContain('Idle.');
  });

  it('uses no fetch or browser persistence while exercising every recipe', async () => {
    const fetch = spyOn(window, 'fetch');
    const storage = spyOn(Storage.prototype, 'setItem');
    const { fixture, element } = await createLab();
    for (const recipe of RXJS_LESSONS) {
      choose(element, 'recipe', recipe.id);
      await fixture.whenStable();
      button(element, 'Run experiment').click();
      await fixture.whenStable();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
});
