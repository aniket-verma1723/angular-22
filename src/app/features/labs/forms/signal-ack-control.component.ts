import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';

@Component({
  selector: 'app-signal-ack-control',
  template: `
    <label class="check"> <input #control type="checkbox" [checked]="checked()" [disabled]="disabled()"
      [attr.aria-invalid]="invalid()" [attr.aria-describedby]="errorId()"
      (change)="change(control.checked)" (blur)="touch.emit()"> Acknowledge local schedule </label>
  `,
  styleUrl: './forms-control.css'
})
export class SignalAckControlComponent implements FormCheckboxControl {
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly errorId = input<string | null>(null);
  readonly touch = output<void>();
  private readonly control = viewChild<ElementRef<HTMLInputElement>>('control');

  focus(options?: FocusOptions): void { this.control()?.nativeElement.focus(options); }
  protected change(checked: boolean): void { if (!this.disabled()) this.checked.set(checked); }
}
