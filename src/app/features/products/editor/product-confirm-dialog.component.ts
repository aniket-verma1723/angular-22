import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';

export interface ProductConfirmation {
  readonly title: string;
  readonly message: string;
  readonly confirm: string;
}

@Component({
  selector: 'app-product-confirm-dialog',
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content><p>{{ data.message }}</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" data-cancel [mat-dialog-close]="false">Keep editing</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">{{ data.confirm }}</button>
    </mat-dialog-actions>
  `
})
export class ProductConfirmDialogComponent {
  protected readonly data = inject<ProductConfirmation>(MAT_DIALOG_DATA);
}
