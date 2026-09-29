import { Component, forwardRef, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import type { ControlValueAccessor } from '@angular/forms';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';

export type DeliveryMethod = 'standard' | 'express';
export function isDeliveryMethod(value: unknown): value is DeliveryMethod { return value === 'standard' || value === 'express'; }

@Component({
  selector: 'app-delivery-choice',
  imports: [MatRadioButton, MatRadioGroup],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DeliveryChoiceComponent), multi: true }],
  template: `
    <mat-radio-group aria-label="Fictional delivery method" [value]="value()" [disabled]="disabled()"
      [attr.aria-invalid]="invalid()" [attr.aria-describedby]="errorId()"
      (change)="choose($event.value)" (focusout)="touch()">
      <mat-radio-button value="standard">Standard · practice option</mat-radio-button>
      <mat-radio-button value="express">Express · practice option</mat-radio-button>
    </mat-radio-group>
  `,
  styles: `:host, mat-radio-group { display: block; } mat-radio-group { display: grid; gap: 12px; }`
})
export class DeliveryChoiceComponent implements ControlValueAccessor {
  readonly invalid = input(false);
  readonly errorId = input<string | null>(null);
  protected readonly value = signal<DeliveryMethod | null>(null);
  protected readonly disabled = signal(false);
  private onChange: (value: DeliveryMethod | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void { this.value.set(isDeliveryMethod(value) ? value : null); }
  registerOnChange(fn: (value: DeliveryMethod | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
  protected touch(): void { this.onTouched(); }
  protected choose(value: unknown): void {
    if (this.disabled() || !isDeliveryMethod(value)) return;
    this.value.set(value); this.onChange(value);
  }
}
