import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { NgControl } from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import { MatButtonHarness } from '@angular/material/button/testing';
import { DateAdapter, MATERIAL_ANIMATIONS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MatDatepickerInput } from '@angular/material/datepicker';
import {
  MatDatepickerInputHarness, MatDatepickerToggleHarness, MatDateRangeInputHarness,
} from '@angular/material/datepicker/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatTimepickerInput } from '@angular/material/timepicker';
import { MatTimepickerInputHarness, MatTimepickerToggleHarness } from '@angular/material/timepicker/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MaterialDatesLabComponent } from './material-dates-lab.component';

describe('MaterialDatesLabComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MaterialDatesLabComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        // The component must override this without changing other screens.
        { provide: MAT_DATE_LOCALE, useValue: 'en-US' },
      ],
    });
  });

  afterEach(() => {
    // No initialization, edit, reset or destruction may issue an HTTP request.
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup() {
    const fixture = TestBed.createComponent(MaterialDatesLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const single = await loader.getHarness(MatDatepickerInputHarness);
    const range = await loader.getHarness(MatDateRangeInputHarness);
    const time = await loader.getHarness(MatTimepickerInputHarness);
    const button = async (text: string) => loader.getHarness(MatButtonHarness.with({ text }));
    const click = async (text: string) => (await button(text)).click();
    return { fixture, loader, single, range, time, click, button };
  }

  function element(fixture: ComponentFixture<MaterialDatesLabComponent>, selector: string): HTMLElement {
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected component host');
    const result = host.querySelector(selector);
    if (!(result instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
    return result;
  }

  function singleState(fixture: ComponentFixture<MaterialDatesLabComponent>) {
    return fixture.debugElement.query(By.css('app-material-single-date-control')).injector.get(FormField).state();
  }

  function reactiveControl(fixture: ComponentFixture<MaterialDatesLabComponent>, selector: string) {
    const control = fixture.debugElement.query(By.css(selector)).injector.get(NgControl).control;
    if (!control) throw new Error(`Missing control ${selector}`);
    return control;
  }

  it('uses a scoped native adapter, labels, scratch semantics and safe null observations', async () => {
    const { fixture, single, range, time } = await setup();
    expect(fixture.debugElement.injector.get(DateAdapter)).toBeInstanceOf(NativeDateAdapter);
    expect(fixture.debugElement.injector.get(MAT_DATE_LOCALE)).toBe('en-GB');
    expect(TestBed.inject(MAT_DATE_LOCALE)).toBe('en-US');
    expect(element(fixture, 'h1').getAttribute('tabindex')).toBe('-1');
    expect(element(fixture, 'a').getAttribute('href')).toBe('/labs');
    expect(await single.getValue()).toBe('');
    expect(await (await range.getStartInput()).getValue()).toBe('');
    expect(await (await range.getEndInput()).getValue()).toBe('');
    expect(await time.getValue()).toBe('');
    for (const selector of ['[data-single-value]', '[data-start-value]', '[data-end-value]', '[data-time-value]']) {
      expect(element(fixture, selector).textContent?.trim()).toBe('null');
    }
    expect(await range.getLabel()).toContain('Calendar date range');
    expect(element(fixture, '#material-range-start').getAttribute('aria-label')).toBe('Range start date');
    expect(element(fixture, '#material-range-end').getAttribute('aria-label')).toBe('Range end date');
    expect(element(fixture, '#dates-parser-note').textContent).toContain('not a strict en-GB');
    expect(element(fixture, 'header').textContent).toContain('Throwaway scratch lab');
    fixture.destroy();
  });

  it('opens and selects the actual datepicker through the Signal Forms CVA-only wrapper', async () => {
    const { fixture, single, click, range } = await setup();
    await single.openCalendar();
    const calendar = await single.getCalendar();
    expect(await calendar.getCurrentViewLabel()).toMatch(/SEP.*2026/i);
    await calendar.selectCell({ text: '15' });
    expect(await single.isCalendarOpen()).toBeFalse();
    expect(singleState(fixture).value()).toEqual(new Date(2026, 8, 15));
    expect(singleState(fixture).dirty()).toBeTrue();
    expect(element(fixture, '[data-single-value]').textContent).toBe('2026-09-15');
    expect(await single.getValue()).toBe('15/09/2026');
    expect(await (await range.getStartInput()).getValue()).toBe('');
    await click('Reset single date');
    expect(await single.getValue()).toBe('');
    expect(singleState(fixture).value()).toBeNull();
    expect(singleState(fixture).dirty()).toBeFalse();
    expect(singleState(fixture).touched()).toBeFalse();
  });

  it('bridges Material parse errors even when the Signal model is null and clears them on reset', async () => {
    const { fixture, single, loader, click } = await setup();
    await single.setValue('not-a-date');
    await single.blur();
    expect(singleState(fixture).value()).toBeNull();
    expect(singleState(fixture).errors().map(error => error.kind)).toContain('matDatepickerParse');
    expect(singleState(fixture).touched()).toBeTrue();
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: 'Single calendar date (Signal Forms)' }));
    expect((await field.getTextErrors()).join(' ')).toContain('Date text could not be parsed');
    await click('Reset single date');
    expect(await single.getValue()).toBe('');
    expect(singleState(fixture).errors()).toEqual([]);
    expect(singleState(fixture).touched()).toBeFalse();
    await single.setValue('not-a-date');
    await single.setValue('');
    await single.blur();
    expect(singleState(fixture).invalid()).toBeFalse();
    await click('Fill single sample');
    expect(await single.getValue()).toBe('15/09/2026');
  });

  it('forwards Signal bounds to calendar cells and rejects typed out-of-bounds dates', async () => {
    const { fixture, single } = await setup();
    const input = fixture.debugElement.query(By.css('#material-single-date')).injector.get(MatDatepickerInput);
    expect(input.min).toEqual(new Date(2026, 8, 10));
    expect(input.max).toEqual(new Date(2026, 8, 25));
    await single.openCalendar();
    const calendar = await single.getCalendar();
    expect((await calendar.getCells({ text: '9', disabled: true })).length).toBe(1);
    expect((await calendar.getCells({ text: '26', disabled: true })).length).toBe(1);
    expect((await calendar.getCells({ text: '10', disabled: false })).length).toBe(1);
    expect((await calendar.getCells({ text: '25', disabled: false })).length).toBe(1);
    await single.closeCalendar();
    await single.setValue('September 9, 2026');
    await single.blur();
    expect(singleState(fixture).errors().map(error => error.kind)).toContain('matDatepickerMin');
    await single.setValue('September 26, 2026');
    await single.blur();
    expect(singleState(fixture).errors().map(error => error.kind)).toContain('matDatepickerMax');
    for (const day of [10, 25]) {
      await single.setValue(`September ${day}, 2026`);
      await single.blur();
      expect(singleState(fixture).invalid()).toBeFalse();
    }
  });

  it('selects an actual range independently of the single-date fixture', async () => {
    const { fixture, single, range, click } = await setup();
    await range.openCalendar();
    const calendar = await range.getCalendar();
    await calendar.selectCell({ text: '16' });
    expect(await range.isCalendarOpen()).toBeTrue();
    await calendar.selectCell({ text: '18' });
    expect(await range.isCalendarOpen()).toBeFalse();
    expect(element(fixture, '[data-start-value]').textContent).toBe('2026-09-16');
    expect(element(fixture, '[data-end-value]').textContent).toBe('2026-09-18');
    expect(await single.getValue()).toBe('');
    await click('Reset range/time');
    expect(await (await range.getStartInput()).getValue()).toBe('');
    expect(await (await range.getEndInput()).getValue()).toBe('');
    expect(element(fixture, '[data-draft-observation]').textContent).toContain('Dirty: false');
    expect(element(fixture, '[data-draft-observation]').textContent).toContain('Touched: false');
  });

  it('validates reversed, partial, same-day, malformed and out-of-bounds ranges with recovery', async () => {
    const { fixture, range, loader, click } = await setup();
    const start = await range.getStartInput();
    const end = await range.getEndInput();
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: 'Calendar date range (Reactive Forms)' }));
    await start.setValue('September 20, 2026');
    await start.blur();
    expect(reactiveControl(fixture, '#material-range-start').valid).toBeTrue();
    await end.setValue('September 15, 2026');
    await end.blur();
    expect(reactiveControl(fixture, '#material-range-end').hasError('matEndDateInvalid')).toBeTrue();
    expect((await field.getTextErrors()).join(' ')).toContain('Range start must not be after range end');
    await end.setValue('September 20, 2026');
    await end.blur();
    expect(reactiveControl(fixture, '#material-range-start').valid).toBeTrue();
    expect(reactiveControl(fixture, '#material-range-end').valid).toBeTrue();
    await start.setValue('September 22, 2026');
    await start.blur();
    expect(reactiveControl(fixture, '#material-range-start').hasError('matStartDateInvalid')).toBeTrue();
    await end.setValue('September 23, 2026');
    await end.blur();
    expect(reactiveControl(fixture, '#material-range-start').valid).toBeTrue();
    expect(reactiveControl(fixture, '#material-range-end').valid).toBeTrue();
    await start.setValue('not-a-date');
    await start.blur();
    expect((await field.getTextErrors()).join(' ')).toContain('could not be parsed');
    await start.setValue('September 9, 2026');
    await start.blur();
    expect((await field.getTextErrors()).join(' ')).toContain('10 September 2026 or later');
    await start.setValue('September 10, 2026');
    await end.setValue('September 26, 2026');
    await end.blur();
    expect((await field.getTextErrors()).join(' ')).toContain('25 September 2026 or earlier');
    await click('Reset range/time');
    expect(reactiveControl(fixture, '#material-range-start').errors).toBeNull();
    expect(reactiveControl(fixture, '#material-range-end').errors).toBeNull();
    expect(await field.getTextErrors()).toEqual([]);
    await start.setValue('not-a-date');
    await end.setValue('not-a-date');
    await end.blur();
    expect(reactiveControl(fixture, '#material-range-start').value).toBeNull();
    expect(reactiveControl(fixture, '#material-range-end').value).toBeNull();
    await click('Reset range/time');
    expect(await start.getValue()).toBe('');
    expect(await end.getValue()).toBe('');
    expect(reactiveControl(fixture, '#material-range-start').errors).toBeNull();
    expect(reactiveControl(fixture, '#material-range-end').errors).toBeNull();
  });

  it('offers bounded native time options and selects a time without inventing an instant', async () => {
    const { fixture, time, click, loader } = await setup();
    const toggle = await loader.getHarness(MatTimepickerToggleHarness);
    await toggle.openTimepicker();
    const picker = await time.getTimepicker();
    const options = await picker.getOptions();
    expect(await Promise.all(options.map(option => option.getText()))).toEqual([
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
    ]);
    await picker.selectOption({ text: '10:30' });
    expect(await time.isTimepickerOpen()).toBeFalse();
    expect(await time.isFocused()).toBeTrue();
    expect(await time.getValue()).toBe('10:30');
    expect(element(fixture, '[data-time-value]').textContent).toBe('10:30');
    expect(element(fixture, '[data-start-value]').textContent).toBe('null');
    await click('Reset range/time');
    expect(await time.getValue()).toBe('');
    expect(element(fixture, '[data-time-value]').textContent).toBe('null');
    const input = fixture.debugElement.query(By.css('#material-time')).injector.get(MatTimepickerInput);
    expect(input.value()).toBeNull();
    expect(reactiveControl(fixture, '#material-time').value).toBeNull();
    expect(reactiveControl(fixture, '#material-time').pristine).toBeTrue();
    expect(reactiveControl(fixture, '#material-time').untouched).toBeTrue();
    await time.focus();
    await time.blur();
    expect(await time.getValue()).toBe('');
    expect(input.value()).toBeNull();
    expect(reactiveControl(fixture, '#material-time').value).toBeNull();
    await toggle.openTimepicker();
    expect(await picker.getOptions({ isSelected: true })).toEqual([]);
    await (await time.host()).sendKeys(TestKey.ESCAPE);
    await time.blur();
    expect(await time.getValue()).toBe('');
    expect(element(fixture, '[data-time-value]').textContent).toBe('null');
  });

  it('uses timepicker keyboard navigation, Enter selection and Escape dismissal with focus retained', async () => {
    const { fixture, time, click } = await setup();
    // A selected fixture value fixes the initial active option, independently
    // of the adapter's current time or the empty-picker fallback.
    await click('Fill range/time sample');
    expect(await time.getValue()).toBe('10:00');
    await time.focus();
    const host = await time.host();
    await host.sendKeys(TestKey.DOWN_ARROW);
    expect(await time.isTimepickerOpen()).toBeTrue();
    const picker = await time.getTimepicker();
    const activeText = async () => {
      const options = await picker.getOptions();
      for (const option of options) {
        if (await option.isActive()) return option.getText();
      }
      throw new Error('Expected an active time option');
    };
    // The opening key also reaches the overlay key manager after rendering.
    expect(await activeText()).toBe('10:30');
    await host.sendKeys(TestKey.DOWN_ARROW);
    expect(await activeText()).toBe('11:00');
    await host.sendKeys(TestKey.ENTER);
    expect(await time.isTimepickerOpen()).toBeFalse();
    expect(await time.getValue()).toBe('11:00');
    expect(await time.isFocused()).toBeTrue();
    await host.sendKeys(TestKey.DOWN_ARROW);
    expect(await activeText()).toBe('11:30');
    await host.sendKeys(TestKey.DOWN_ARROW);
    expect(await activeText()).toBe('12:00');
    await host.sendKeys(TestKey.ESCAPE);
    expect(await time.isTimepickerOpen()).toBeFalse();
    expect(await (await time.getTimepicker()).isOpen()).toBeFalse();
    expect(await time.isFocused()).toBeTrue();
    expect(await time.getValue()).toBe('11:00');
    expect(element(fixture, '[data-time-value]').textContent).toBe('11:00');
  });

  it('clears focused malformed and same-null time text without restoring it on blur or reopening', async () => {
    const { fixture, time, click } = await setup();
    const input = fixture.debugElement.query(By.css('#material-time')).injector.get(MatTimepickerInput);
    const control = reactiveControl(fixture, '#material-time');
    await click('Fill range/time sample');
    await time.focus();
    await time.setValue('not-a-time');
    expect(await time.isFocused()).toBeTrue();
    expect(control.hasError('matTimepickerParse')).toBeTrue();
    await click('Reset range/time');
    expect(await time.getValue()).toBe('');
    expect(input.value()).toBeNull();
    expect(control.value).toBeNull();
    expect(control.errors).toBeNull();
    expect(control.pristine).toBeTrue();
    expect(control.untouched).toBeTrue();
    await time.focus();
    await time.blur();
    expect(await time.getValue()).toBe('');
    expect(input.value()).toBeNull();
    expect(control.value).toBeNull();
    expect(element(fixture, '[data-time-value]').textContent).toBe('null');

    // Reproduce native text left behind while the CVA value is already null;
    // resetting that same null must still clear the displayed text.
    await time.focus();
    const nativeInput = element(fixture, '#material-time');
    if (!(nativeInput instanceof HTMLInputElement)) throw new Error('Expected time input');
    nativeInput.value = 'not-a-time';
    await click('Reset range/time');
    expect(await time.getValue()).toBe('');
    expect(input.value()).toBeNull();
    expect(control.value).toBeNull();
    await time.focus();
    await time.blur();
    expect(await time.getValue()).toBe('');
    const picker = await time.openTimepicker();
    expect(await picker.getOptions({ isSelected: true })).toEqual([]);
    await (await time.host()).sendKeys(TestKey.ESCAPE);
    await time.blur();
    expect(await time.getValue()).toBe('');
    expect(input.value()).toBeNull();
    expect(control.value).toBeNull();
    expect(control.errors).toBeNull();
    expect(element(fixture, '[data-time-value]').textContent).toBe('null');
  });

  it('closes the calendar with Escape and restores the input focus without changing the model', async () => {
    const { fixture, single } = await setup();
    await single.focus();
    await single.openCalendar();
    const calendar = await single.getCalendar();
    await (await calendar.host()).sendKeys(TestKey.ESCAPE);
    expect(await single.isCalendarOpen()).toBeFalse();
    expect(await single.isFocused()).toBeTrue();
    expect(singleState(fixture).value()).toBeNull();
  });

  it('rejects malformed and out-of-bounds time text, accepts inclusive bounds and clears invalid values', async () => {
    const { fixture, time, loader, click } = await setup();
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: 'Wall-clock time (Reactive Forms)' }));
    for (const [text, error, message] of [
      ['not-a-time', 'matTimepickerParse', 'Time text could not be parsed'],
      ['08:30', 'matTimepickerMin', '09:00 or later'],
      ['17:30', 'matTimepickerMax', '17:00 or earlier'],
    ]) {
      await time.setValue(text);
      await time.blur();
      expect(reactiveControl(fixture, '#material-time').hasError(error)).toBeTrue();
      expect((await field.getTextErrors()).join(' ')).toContain(message);
    }
    for (const text of ['09:00', '17:00', '10:15']) {
      await time.setValue(text);
      await time.blur();
      expect(reactiveControl(fixture, '#material-time').valid).toBeTrue();
      expect(element(fixture, '[data-time-value]').textContent).toBe(text);
    }
    await time.setValue('not-a-time');
    await time.blur();
    expect(element(fixture, '[data-time-value]').textContent).toBe('invalid');
    await click('Reset range/time');
    expect(await time.getValue()).toBe('');
    expect(reactiveControl(fixture, '#material-time').errors).toBeNull();
    expect(await field.getTextErrors()).toEqual([]);
  });

  it('disables both form systems and their toggles, preserves values and resets to enabled null', async () => {
    const { fixture, loader, single, range, time, click } = await setup();
    await click('Fill single sample');
    await click('Fill range/time sample');
    await click('Disable single date');
    await click('Disable range/time');
    expect(singleState(fixture).disabled()).toBeTrue();
    expect(await single.isDisabled()).toBeTrue();
    expect(await range.isDisabled()).toBeTrue();
    expect(await time.isDisabled()).toBeTrue();
    const dateToggles = await loader.getAllHarnesses(MatDatepickerToggleHarness);
    for (const toggle of dateToggles) {
      expect(await toggle.isDisabled()).toBeTrue();
      await toggle.openCalendar();
      expect(await toggle.isCalendarOpen()).toBeFalse();
    }
    const timeToggle = await loader.getHarness(MatTimepickerToggleHarness);
    expect(await timeToggle.isDisabled()).toBeTrue();
    await timeToggle.openTimepicker();
    await time.openTimepicker();
    expect(await time.isTimepickerOpen()).toBeFalse();
    expect(element(fixture, '[data-single-value]').textContent).toBe('2026-09-15');
    expect(element(fixture, '[data-time-value]').textContent).toBe('10:00');
    await click('Reset single date');
    await click('Reset range/time');
    expect(await single.isDisabled()).toBeFalse();
    expect(await range.isDisabled()).toBeFalse();
    expect(await time.isDisabled()).toBeFalse();
    expect(await single.getValue()).toBe('');
    expect(await time.getValue()).toBe('');
    expect(singleState(fixture).touched()).toBeFalse();
    expect(element(fixture, '[data-draft-observation]').textContent).toContain('Status: VALID');
  });

  for (const kind of ['single', 'range', 'time'] as const) {
    it(`destroys an open ${kind} popup with no leaked overlay or requests`, async () => {
      const { fixture, single, range, time } = await setup();
      let popup: HTMLElement;
      if (kind === 'time') {
        await time.openTimepicker();
        const panelId = await (await time.host()).getAttribute('aria-controls');
        const node = panelId ? document.getElementById(panelId) : null;
        if (!node) throw new Error('Expected time overlay');
        popup = node;
      } else {
        const trigger = kind === 'single' ? single : range;
        await trigger.openCalendar();
        const node = document.querySelector('mat-datepicker-content');
        if (!(node instanceof HTMLElement)) throw new Error('Expected calendar overlay');
        popup = node;
      }
      expect(popup.isConnected).toBeTrue();
      fixture.destroy();
      expect(popup.isConnected).toBeFalse();
    });
  }
});
