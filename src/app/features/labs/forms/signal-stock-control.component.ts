import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

@Component({
  selector: 'app-signal-stock-control',
  template: `
    <label>Stock quantity (Signal control)
      <input #control type="number" [value]="value() ?? ''" [disabled]="disabled()"
        [attr.aria-invalid]="invalid()" [attr.aria-describedby]="errorId()"
        (input)="edit(control.value)" (blur)="touch.emit()">
    </label>
  `,
  styleUrl: './forms-control.css'
})
export class SignalStockControlComponent implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly errorId = input<string | null>(null);
  readonly touch = output<void>();
  private readonly control = viewChild<ElementRef<HTMLInputElement>>('control');

  focus(options?: FocusOptions): void { this.control()?.nativeElement.focus(options); }
  protected edit(raw: string): void {
    if (!this.disabled()) this.value.set(raw === '' ? null : Number(raw));
  }
}
