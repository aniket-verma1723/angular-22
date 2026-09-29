import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';

export interface CheckoutConfirmation { readonly reset: boolean; }
@Component({
  selector: 'app-checkout-confirm-dialog',
  imports: [MatButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose],
  template: `
    <h2 mat-dialog-title>{{ data.reset ? 'Reset checkout draft?' : 'Leave checkout?' }}</h2>
    <mat-dialog-content><p>Your fictional address and delivery draft will be discarded. Your cart will be kept.</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Keep draft</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">{{ data.reset ? 'Reset draft' : 'Discard draft' }}</button>
    </mat-dialog-actions>
  `
})
export class CheckoutConfirmDialogComponent { protected readonly data = inject<CheckoutConfirmation>(MAT_DIALOG_DATA); }
