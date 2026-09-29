import { Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import type { ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-reactive-stock-control',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ReactiveStockControlComponent), multi: true }],
  template: `
    <label>Stock quantity (Reactive CVA)
      <input #control type="number" [value]="value() ?? ''" [disabled]="disabled()"
        [attr.aria-invalid]="invalid()" [attr.aria-describedby]="errorId()"
        (input)="edit(control.value)" (blur)="touch()">
    </label>
  `,
  styleUrl: './forms-control.css'
})
export class ReactiveStockControlComponent implements ControlValueAccessor {
  readonly invalid = input(false);
  readonly errorId = input<string | null>(null);
  protected readonly value = signal<number | null>(null);
  protected readonly disabled = signal(false);
  private readonly control = viewChild<ElementRef<HTMLInputElement>>('control');
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void { this.value.set(typeof value === 'number' ? value : null); }
  registerOnChange(fn: (value: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
  focus(options?: FocusOptions): void { this.control()?.nativeElement.focus(options); }
  protected touch(): void { this.onTouched(); }
  protected edit(raw: string): void {
    if (this.disabled()) return;
    const value = raw === '' ? null : Number(raw);
    this.value.set(value);
    this.onChange(value);
  }
}
