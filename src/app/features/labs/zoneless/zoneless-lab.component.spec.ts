import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ZONELESS_PROBE_DELAY_MS, ZonelessLabComponent } from './zoneless-lab.component';
import type { NotificationMode } from './zoneless-lab.component';

interface CapturedTimer {
  readonly handle: number;
  readonly complete: () => void;
}

describe('ZonelessLabComponent', () => {
  let fixture: ComponentFixture<ZonelessLabComponent>;
  let element: HTMLElement;
  let timers: CapturedTimer[];
  let clearTimer: jasmine.Spy<typeof window.clearTimeout>;
  let registrations: jasmine.Spy<typeof EventTarget.prototype.addEventListener>;
  const eventName = 'zoneless-probe-complete';

  beforeEach(async () => {
    timers = [];
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    // Capture only the experiment's bounded timer, never Angular's scheduling timers.
    spyOn(window, 'setTimeout').and.callFake((handler: TimerHandler, delay?: number, ...args: unknown[]): number => {
      if (delay === ZONELESS_PROBE_DELAY_MS && typeof handler === 'function') {
        const handle = -(timers.length + 1);
        timers.push({ handle, complete: () => handler(...args) });
        return handle;
      }
      return nativeSetTimeout(handler, delay, ...args);
    });
    clearTimer = spyOn(window, 'clearTimeout').and.callFake(handle => {
      if (!timers.some(timer => timer.handle === handle)) nativeClearTimeout(handle);
    });
    registrations = spyOn(EventTarget.prototype, 'addEventListener').and.callThrough();
    TestBed.configureTestingModule({
      imports: [ZonelessLabComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])]
    });
    fixture = TestBed.createComponent(ZonelessLabComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  function button(label: string): HTMLButtonElement {
    const result = Array.from(element.querySelectorAll('button')).find(value => value.textContent?.trim() === label);
    if (!result) throw new Error(`Missing button: ${label}`);
    return result;
  }

  function radio(mode: NotificationMode): HTMLInputElement {
    const result = element.querySelector<HTMLInputElement>(`input[value="${mode}"]`);
    if (!result) throw new Error(`Missing radio: ${mode}`);
    return result;
  }

  function text(testId: string): string {
    const result = element.querySelector(`[data-testid="${testId}"]`);
    if (!result) throw new Error(`Missing observation: ${testId}`);
    return result.textContent?.trim() ?? '';
  }

  function timer(index = timers.length - 1): CapturedTimer {
    const result = timers[index];
    if (!result) throw new Error('The probe did not arm a timer');
    return result;
  }

  function source(): EventTarget {
    const registration = registrations.calls.all().find(call => call.args[0] === eventName);
    const target: unknown = registration?.object;
    if (!(target instanceof EventTarget)) throw new Error('Missing owned native event source');
    return target;
  }

  async function arm(mode: NotificationMode): Promise<void> {
    radio(mode).click();
    await fixture.whenStable();
    button('Arm callback').click();
    await fixture.whenStable();
    expect(text('probe-status')).toContain('Pending');
    expect(text('probe-count')).toBe('0');
  }

  it('starts idle with labelled controls, learning sections, and no timer', () => {
    expect(text('probe-status')).toContain('Idle');
    expect(text('probe-count')).toBe('0');
    expect(timers.length).toBe(0);
    expect(button('Arm callback').disabled).toBeFalse();
    expect(button('Cancel callback').disabled).toBeTrue();
    expect(radio('signal').checked).toBeTrue();
    expect(element.querySelector('legend')?.textContent).toContain('Notification mode');
    expect(element.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    expect(element.querySelector('[role="status"]')).not.toBeNull();
    expect(element.querySelector('a[href="/labs/state"]')).not.toBeNull();
    for (const heading of ['Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question', 'Observation']) {
      expect(element.textContent).toContain(heading);
    }
  });

  it('removes its native listener even when destroyed before arming', () => {
    const target = source();
    const removeListener = spyOn(target, 'removeEventListener').and.callThrough();
    const registration = registrations.calls.all().find(call => call.args[0] === eventName);
    if (!registration) throw new Error('Missing native listener registration');
    fixture.destroy();
    expect(removeListener).toHaveBeenCalledOnceWith(eventName, registration.args[1]);
    expect(timers.length).toBe(0);
    expect(() => target.dispatchEvent(new Event(eventName))).not.toThrow();
  });

  for (const mode of ['signal', 'mark-for-check'] as const) {
    describe(mode, () => {
      it('renders a programmatically completed timer without another Angular event', async () => {
        await arm(mode);
        expect(fixture.isStable()).toBeTrue();
        expect(button('Arm callback').disabled).toBeTrue();
        expect(button('Cancel callback').disabled).toBeFalse();
        expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
        timer().complete();
        // No clicks, detectChanges, test-only notification, or forced tick after completion.
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Done');
        expect(text('probe-count')).toBe('1');
        expect(text('probe-observation')).toContain(mode === 'signal' ? 'wrote a signal' : 'No signal was written');
        expect(element.querySelector('[aria-busy="true"]')).toBeNull();
        timer().complete();
        await fixture.whenStable();
        expect(text('probe-count')).toBe('1');
      });

      it('renders a direct native EventTarget delivery using its own notification', async () => {
        await arm(mode);
        source().dispatchEvent(new Event(eventName));
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Done');
        expect(text('probe-count')).toBe('1');
        expect(clearTimer).toHaveBeenCalledWith(timer().handle);
        timer().complete();
        await fixture.whenStable();
        expect(text('probe-count')).toBe('1');
      });

      it('rejects duplicate starts and mode changes while pending', async () => {
        await arm(mode);
        fixture.componentInstance.start();
        fixture.componentInstance.selectMode(mode === 'signal' ? 'mark-for-check' : 'signal');
        await fixture.whenStable();
        expect(timers.length).toBe(1);
        expect(radio(mode).checked).toBeTrue();
        expect(element.querySelector('fieldset')?.disabled).toBeTrue();
        expect(text('probe-status')).toContain('Pending');
      });

      it('cancels the timer and ignores both late callback and event deliveries', async () => {
        await arm(mode);
        button('Cancel callback').click();
        await fixture.whenStable();
        expect(clearTimer).toHaveBeenCalledWith(timer().handle);
        timer().complete();
        source().dispatchEvent(new Event(eventName));
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Cancelled');
        expect(text('probe-count')).toBe('0');
        expect(button('Arm callback').disabled).toBeTrue();
        expect(button('Cancel callback').disabled).toBeTrue();
        button('Reset probe').click();
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Idle');
        expect(button('Arm callback').disabled).toBeFalse();
      });

      it('resets pending work without allowing an old callback to complete a new run', async () => {
        await arm(mode);
        const previous = timer();
        button('Reset probe').click();
        await fixture.whenStable();
        expect(clearTimer).toHaveBeenCalledWith(previous.handle);
        expect(text('probe-status')).toContain('Idle');
        button('Arm callback').click();
        await fixture.whenStable();
        previous.complete();
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Pending');
        expect(text('probe-count')).toBe('0');
        timer().complete();
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Done');
        expect(text('probe-count')).toBe('1');
        expect(timers.length).toBe(2);
      });

      it('requires reset after completion before changing modes or starting again', async () => {
        await arm(mode);
        timer().complete();
        await fixture.whenStable();
        const otherMode = mode === 'signal' ? 'mark-for-check' : 'signal';
        fixture.componentInstance.start();
        fixture.componentInstance.selectMode(otherMode);
        fixture.componentInstance.cancel();
        await fixture.whenStable();
        expect(timers.length).toBe(1);
        expect(text('probe-status')).toContain('Done');
        expect(radio(mode).checked).toBeTrue();
        button('Reset probe').click();
        await fixture.whenStable();
        expect(text('probe-status')).toContain('Idle');
        expect(text('probe-count')).toBe('0');
        expect(element.querySelector('fieldset')?.disabled).toBeFalse();
        radio(otherMode).click();
        await fixture.whenStable();
        expect(radio(otherMode).checked).toBeTrue();
        expect(text('probe-count')).toBe('0');
      });

      it('clears its timer and exact listener on destruction and rejects later work', async () => {
        await arm(mode);
        const target = source();
        const removeListener = spyOn(target, 'removeEventListener').and.callThrough();
        const registration = registrations.calls.all().find(call => call.args[0] === eventName);
        if (!registration) throw new Error('Missing native listener registration');
        fixture.destroy();
        expect(clearTimer).toHaveBeenCalledWith(timer().handle);
        expect(removeListener).toHaveBeenCalledOnceWith(eventName, registration.args[1]);
        expect(() => {
          timer().complete();
          target.dispatchEvent(new Event(eventName));
          fixture.componentInstance.start();
          fixture.componentInstance.reset();
          fixture.componentInstance.cancel();
          fixture.componentInstance.selectMode('signal');
        }).not.toThrow();
        expect(timers.length).toBe(1);
      });
    });
  }
});
