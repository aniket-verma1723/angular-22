import { Component, ElementRef, Renderer2, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormField, disabled, form, maxDate, minDate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import {
  MatDateRangeInput, MatDateRangePicker,
  MatDatepickerToggle, MatEndDate, MatStartDate,
} from '@angular/material/datepicker';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTimepicker, MatTimepickerInput, MatTimepickerToggle } from '@angular/material/timepicker';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { calendarDateText, wallClockText } from './material-dates-values';
import { MaterialSingleDateControlComponent } from './material-single-date-control.component';

@Component({
  selector: 'app-material-dates-lab',
  imports: [
    RouterLink, FormField, ReactiveFormsModule, MatButton, MatCard, MatCardContent,
    MatFormField, MatLabel, MatHint, MatError, MatSuffix, MatInput,
    MaterialSingleDateControlComponent, MatDatepickerToggle,
    MatDateRangeInput, MatDateRangePicker, MatStartDate, MatEndDate,
    MatTimepicker, MatTimepickerInput, MatTimepickerToggle,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  templateUrl: './material-dates-lab.component.html',
  styleUrl: './material-dates-lab.component.css',
})
export class MaterialDatesLabComponent {
  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);
  private readonly renderer = inject(Renderer2);
  private readonly singleModel = signal<Date | null>(null);
  private readonly singleDisabled = signal(false);
  private readonly singlePicker = viewChild(MaterialSingleDateControlComponent);
  private readonly rangePicker = viewChild<MatDateRangePicker<Date>>('rangePicker');
  private readonly timePicker = viewChild<MatTimepicker<Date>>('timePicker');
  private readonly rangeStartInput = viewChild(MatStartDate<Date>);
  private readonly rangeEndInput = viewChild(MatEndDate<Date>);
  private readonly timeInput = viewChild<MatTimepickerInput<Date>, ElementRef<HTMLInputElement>>(
    MatTimepickerInput, { read: ElementRef },
  );

  protected readonly minDate = new Date(2026, 8, 10);
  protected readonly maxDate = new Date(2026, 8, 25);
  protected readonly calendarStart = new Date(2026, 8, 15);
  protected readonly minTime = new Date(2026, 8, 15, 9, 0);
  protected readonly maxTime = new Date(2026, 8, 15, 17, 0);

  // The CVA-only wrapper preserves Material validation on same-null input/reset.
  // minDate/maxDate supply metadata forwarded through its min/max inputs.
  protected readonly singleDate = form(this.singleModel, path => {
    disabled(path, { when: () => this.singleDisabled() });
    minDate(path, this.minDate);
    maxDate(path, this.maxDate);
  });
  protected readonly singleText = computed(() => calendarDateText(this.singleModel()));
  protected readonly singleDisplay = computed(() => {
    const value = this.singleModel();
    return value && this.adapter.isValid(value)
      ? this.adapter.format(value, { year: 'numeric', month: 'long', day: 'numeric' })
      : 'No valid date selected';
  });
  // A separate fixture, not a second writable representation of singleModel.
  protected readonly draft = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
    time: new FormControl<Date | null>(null),
  });
  // Read-only observation of Reactive Forms events keeps this OnPush view current,
  // including touched/status changes that do not change a value.
  protected readonly draftState = toSignal(
    this.draft.events.pipe(map(() => this.readDraft())),
    { initialValue: this.readDraft() },
  );

  protected fillSingle(): void {
    this.singlePicker()?.close();
    this.singleDate().reset(new Date(2026, 8, 15));
  }

  protected resetSingle(): void {
    this.singlePicker()?.close();
    this.singleDisabled.set(false);
    this.singleDate().reset(null);
  }

  protected toggleSingle(): void {
    this.singlePicker()?.close();
    this.singleDisabled.update(value => !value);
  }

  protected fillDraft(): void {
    this.closeDraftPickers();
    this.draft.reset({
      start: new Date(2026, 8, 16), end: new Date(2026, 8, 18),
      time: new Date(2026, 8, 15, 10, 0),
    });
  }

  protected resetDraft(): void {
    this.closeDraftPickers();
    this.draft.enable();
    this.draft.reset({ start: null, end: null, time: null });
    // Material writeValue skips reformatting unchanged nulls. Its public value
    // setter also clears malformed raw text when the model was already null.
    const start = this.rangeStartInput();
    const end = this.rangeEndInput();
    if (start) start.value = null;
    if (end) end.value = null;
    // The time CVA resets its public value signal, but its formatting effect
    // skips focused inputs (and unchanged nulls); blur only formats non-null
    // values. Clear the native text too, without stealing focus or emitting input.
    const time = this.timeInput();
    if (time) this.renderer.setProperty(time.nativeElement, 'value', '');
  }

  protected toggleDraft(): void {
    this.closeDraftPickers();
    if (this.draft.disabled) this.draft.enable();
    else this.draft.disable();
  }

  protected revalidateRange(): void {
    // Both Material validators depend on the opposite endpoint. dateInput fires
    // after Material updates its range model; refresh both when either changes.
    this.draft.controls.start.updateValueAndValidity();
    this.draft.controls.end.updateValueAndValidity();
  }

  private closeDraftPickers(): void {
    this.rangePicker()?.close();
    this.timePicker()?.close();
  }

  private readDraft() {
    const { start, end, time } = this.draft.controls;
    const value = this.draft.getRawValue();
    let rangeError = '';
    if (start.hasError('matDatepickerParse') || end.hasError('matDatepickerParse')) {
      rangeError = 'Range date text could not be parsed. Clear it or use the calendar.';
    } else if (start.hasError('matDatepickerMin') || end.hasError('matDatepickerMin')) {
      rangeError = 'Both dates must be 10 September 2026 or later.';
    } else if (start.hasError('matDatepickerMax') || end.hasError('matDatepickerMax')) {
      rangeError = 'Both dates must be 25 September 2026 or earlier.';
    } else if (start.hasError('matStartDateInvalid') || end.hasError('matEndDateInvalid')) {
      rangeError = 'Range start must not be after range end. Choose an end on or after the start.';
    }
    let timeError = '';
    if (time.hasError('matTimepickerParse')) {
      timeError = 'Time text could not be parsed. Clear it or choose a time option.';
    } else if (time.hasError('matTimepickerMin')) {
      timeError = 'Choose 09:00 or later.';
    } else if (time.hasError('matTimepickerMax')) {
      timeError = 'Choose 17:00 or earlier.';
    }
    return {
      start: calendarDateText(value.start), end: calendarDateText(value.end),
      time: wallClockText(value.time), status: this.draft.status,
      disabled: this.draft.disabled, dirty: this.draft.dirty, touched: this.draft.touched,
      rangeError, timeError,
    };
  }
}
