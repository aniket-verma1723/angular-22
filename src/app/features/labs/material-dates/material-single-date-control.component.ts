import { Component, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValueChangeEvent,
} from '@angular/forms';
import type { ControlValueAccessor, ValidationErrors, Validator } from '@angular/forms';
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from '@angular/material/datepicker';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

/**
 * CVA-only boundary for the installed Material 22.1.8 date input.
 * Its writeValue(null) skips reformatting when already null; an invalid text input
 * also calls onChange(null) without a validator-change notification. The outer
 * Signal Form can therefore miss same-null parse changes. An internal Reactive
 * FormControl emits validation events even when its value remains null.
 * This wrapper forwards those events and uses the public Material value setter
 * to clear raw text on programmatic reset. It is NOT a FormValueControl.
 */
@Component({
  selector: 'app-material-single-date-control',
  imports: [
    ReactiveFormsModule, MatFormField, MatLabel, MatHint, MatError, MatSuffix, MatInput,
    MatDatepicker, MatDatepickerInput, MatDatepickerToggle,
  ],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MaterialSingleDateControlComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => MaterialSingleDateControlComponent), multi: true },
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Single calendar date (Signal Forms)</mat-label>
      <input matInput id="material-single-date" [matDatepicker]="picker" [formControl]="control"
        [min]="min() ?? null" [max]="max() ?? null" aria-describedby="dates-parser-note" (blur)="touch()">
      <mat-datepicker-toggle matSuffix [for]="picker" aria-label="Open single-date calendar" />
      <mat-datepicker #picker [startAt]="startAt()" (closed)="touch()" />
      <mat-hint>Use the calendar to avoid ambiguous date text.</mat-hint>
      <mat-error>{{ errorText() }}</mat-error>
    </mat-form-field>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    mat-form-field { display: block; width: 100%; margin-block: 1.25rem; }
  `,
})
export class MaterialSingleDateControlComponent implements ControlValueAccessor, Validator {
  readonly min = input<Date | undefined>();
  readonly max = input<Date | undefined>();
  readonly startAt = input.required<Date>();
  private readonly dateInput = viewChild(MatDatepickerInput<Date>);
  private readonly picker = viewChild(MatDatepicker<Date>);
  private readonly revision = signal(0);
  private onChange: (value: Date | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};
  protected readonly control = new FormControl<Date | null>(null);
  protected readonly errorText = computed(() => {
    this.revision();
    if (this.control.hasError('matDatepickerParse')) {
      return 'Date text could not be parsed. Clear it or choose a calendar day.';
    }
    if (this.control.hasError('matDatepickerMin')) return 'Choose 10 September 2026 or later.';
    if (this.control.hasError('matDatepickerMax')) return 'Choose 25 September 2026 or earlier.';
    return '';
  });

  constructor() {
    this.control.events.pipe(takeUntilDestroyed()).subscribe(event => {
      this.revision.update(value => value + 1);
      if (event instanceof ValueChangeEvent) {
        const value = this.control.value;
        // This boundary represents calendar days, even if permissive parsing
        // accepts text containing hours. Never turn a local day into a UTC date.
        this.onChange(value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : null);
      }
      // Unlike a signal value update, this also invalidates same-null parse errors.
      this.onValidatorChange();
    });
  }

  writeValue(value: unknown): void {
    const date = value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
    this.control.reset(date, { emitEvent: false });
    const input = this.dateInput();
    if (input) input.value = date;
    this.revision.update(current => current + 1);
    this.onValidatorChange();
  }

  registerOnChange(fn: (value: Date | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  validate(): ValidationErrors | null { return this.control.errors; }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.control.disable({ emitEvent: false });
    else this.control.enable({ emitEvent: false });
    this.revision.update(current => current + 1);
    this.onValidatorChange();
  }

  close(): void { this.picker()?.close(); }

  protected touch(): void {
    this.control.markAsTouched();
    this.onTouched();
  }
}
