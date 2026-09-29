import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { EventSourceComponent } from './event-source.component';
import { StateLabComponent } from './state-lab.component';
import { PreviewLedger } from './style-preview.component';

describe('StateLabComponent integrations', () => {
  let fixture: ComponentFixture<StateLabComponent>;
  let element: HTMLElement;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StateLabComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(StateLabComponent); element = fixture.nativeElement;
    fixture.detectChanges(); TestBed.tick();
  });
  function click(label: string): void {
    const button = Array.from(element.querySelectorAll('button')).find(value => value.textContent?.includes(label));
    if (!button) throw new Error(`Missing button: ${label}`);
    button.click(); fixture.detectChanges(); TestBed.tick();
  }

  it('integrates actual CSS, ignores incidental dependencies, and cleans on rerun/destroy', () => {
    const ledger = fixture.debugElement.injector.get(PreviewLedger);
    const host = element.querySelector<HTMLElement>('app-style-preview');
    expect(host?.style.getPropertyValue('--lab-radius')).toBe('8px');
    expect(ledger.inspect().runs).toBe(1);
    click('Change incidental');
    expect(ledger.inspect().runs).toBe(1);
    const choice = element.querySelector<HTMLSelectElement>('#state-choice');
    if (!choice) throw new Error('Missing selection control');
    choice.value = 'Blue'; choice.dispatchEvent(new Event('change'));
    fixture.detectChanges(); TestBed.tick();
    expect(host?.style.getPropertyValue('--lab-radius')).toBe('24px');
    expect(ledger.inspect()).toEqual({ runs: 2, cleanups: 1, incidentalNote: 'note 1' });
    click('Destroy integrations');
    expect(host?.style.getPropertyValue('--lab-radius')).toBe('');
    expect(ledger.inspect().cleanups).toBe(2);
    click('Read preview lifecycle');
    expect(element.textContent).toContain('2 effect runs · 2 cleanups');
    click('Recreate integrations');
    expect(ledger.inspect().runs).toBe(3);
    fixture.destroy(); expect(ledger.inspect().cleanups).toBe(3);
  });

  it('forwards real output events twice through different APIs without leaking destroyed children', () => {
    const oldChild = fixture.debugElement.query(By.directive(EventSourceComponent)).injector.get(EventSourceComponent);
    click('Emit child event'); click('Emit child event');
    expect(element.textContent).toContain('Template output events: 1, 2');
    expect(element.textContent).toContain('outputToObservable events: 1, 2');
    click('Destroy integrations'); oldChild.send(); fixture.detectChanges();
    expect(element.textContent).toContain('outputToObservable events: 1, 2');
    click('Recreate integrations'); click('Emit child event');
    expect(element.textContent).toContain('Template output events: 1, 2, 1');
    expect(element.textContent).toContain('outputToObservable events: 1, 2, 1');
    const current = fixture.debugElement.query(By.directive(EventSourceComponent)).injector.get(EventSourceComponent);
    let completed = false;
    const subscription = outputToObservable(current.counted).subscribe({ complete: () => { completed = true; } });
    fixture.destroy(); expect(() => current.send()).not.toThrow();
    expect(completed).toBeTrue(); expect(subscription.closed).toBeTrue();
  });

  it('keeps computed reads explicit and presents all learning labels with labelled native controls', () => {
    expect(element.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    expect(element.textContent).toContain('Not evaluated yet');
    click('Read computation'); click('Read computation');
    expect(element.textContent).toContain('executions 1');
    for (const section of Array.from(element.querySelectorAll('section'))) {
      for (const label of ['Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question']) {
        expect(section.textContent).toContain(label);
      }
    }
    expect(element.querySelector('label[for="debounce-text"]')).not.toBeNull();
    expect(element.textContent).toContain('experimental');
  });
});
