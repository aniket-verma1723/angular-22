import { Component, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import type { MatDialogRef } from '@angular/material/dialog';
import type { CanDeactivateFn } from '@angular/router';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

export interface FormsLabPage { canLeave(): boolean | Observable<boolean>; }
export const FormsLabGuard: CanDeactivateFn<FormsLabPage> = component => component.canLeave();

@Component({
  selector: 'app-forms-lab-discard-dialog',
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  template: `
    <h2 mat-dialog-title>Discard local draft?</h2>
    <mat-dialog-content><p>Nothing is persisted. Leaving loses your local draft and validation experiment.</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" data-stay [mat-dialog-close]="false">Stay</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">Discard draft</button>
    </mat-dialog-actions>
  `
})
export class FormsLabDiscardDialogComponent {}

// Each page provides its own dialog owner. No form/model is stored here.
@Injectable()
export class FormsLabLeaveService {
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef: MatDialogRef<FormsLabDiscardDialogComponent, boolean> | null = null;
  private readonly confirmingState = signal(false);
  private readonly messageState = signal('');
  readonly confirming = this.confirmingState.asReadonly();
  readonly message = this.messageState.asReadonly();

  constructor() { this.destroyRef.onDestroy(() => this.dialogRef?.close(false)); }

  canLeave(dirty: boolean, busy: boolean): boolean | Observable<boolean> {
    if (busy || this.confirming()) {
      this.messageState.set('Complete or fail the local save, and close any confirmation, before leaving.');
      return false;
    }
    if (!dirty) return true;
    this.confirmingState.set(true);
    const ref = this.dialog.open<FormsLabDiscardDialogComponent, undefined, boolean>(FormsLabDiscardDialogComponent,
      { width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: '[data-stay]', restoreFocus: true, closeOnNavigation: false });
    this.dialogRef = ref;
    // Keep cleanup separate from the router subscription: a superseding navigation
    // can unsubscribe that subscription while the dialog remains open.
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.dialogRef = null;
      this.confirmingState.set(false);
      this.messageState.set('');
    });
    return ref.afterClosed().pipe(map(result => result === true), takeUntilDestroyed(this.destroyRef));
  }
}
