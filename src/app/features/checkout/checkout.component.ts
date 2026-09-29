import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import type { MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatStep, MatStepper, MatStepperIcon, MatStepperPrevious } from '@angular/material/stepper';
import { RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../core/config/api-config';
import { SessionStore } from '../../core/session/session.store';
import { toApiError } from '../../core/http/api-error';
import type { ApiError } from '../../core/http/api-error';
import { CartService } from '../cart/data/cart.service';
import { UsdCentsPipe } from '../cart/ui/usd-cents.pipe';
import { CheckoutApiService } from './data/checkout-api.service';
import type { CheckoutResult } from './data/checkout.models';
import { CheckoutConfirmDialogComponent } from './checkout-confirm-dialog.component';
import type { CheckoutConfirmation } from './checkout-confirm-dialog.component';
import { MAX_DELIVERY_NOTES, createCheckoutForm, createDeliveryNote } from './checkout-form';
import { DeliveryChoiceComponent } from './ui/delivery-choice.component';

type CheckoutState = { readonly status: 'idle' } | { readonly status: 'submitting' } |
  { readonly status: 'error'; readonly error: ApiError } |
  { readonly status: 'success'; readonly result: CheckoutResult; readonly snapshotCents: number; readonly cartCleared: boolean };

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, MatButton, MatCard, MatCardContent, MatCheckbox, MatError, MatFormField,
    MatHint, MatLabel, MatInput, MatStep, MatStepper, MatStepperIcon, MatStepperPrevious, DeliveryChoiceComponent, UsdCentsPipe],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
  host: { '(window:beforeunload)': 'beforeUnload($event)' }
})
export class CheckoutComponent {
  protected readonly cart = inject(CartService);
  protected readonly session = inject(SessionStore);
  protected readonly mode = inject(API_CONFIG).mode;
  private readonly api = inject(CheckoutApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = inject(MatDialog);
  private readonly stepper = viewChild(MatStepper);
  private readonly formDirective = viewChild(FormGroupDirective);
  private confirmation: MatDialogRef<CheckoutConfirmDialogComponent, boolean> | null = null;
  protected readonly form = createCheckoutForm();
  protected readonly address = this.form.controls.address;
  protected readonly delivery = this.form.controls.delivery;
  protected readonly review = this.form.controls.review;
  protected readonly notes = this.delivery.controls.notes;
  protected readonly maxNotes = MAX_DELIVERY_NOTES;
  // Observable views notify OnPush; there is no second writable form model.
  protected readonly draft = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  protected readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  protected readonly state = signal<CheckoutState>({ status: 'idle' });
  protected readonly busy = computed(() => this.state().status === 'submitting');
  protected readonly message = signal('');

  constructor() { this.destroyRef.onDestroy(() => this.confirmation?.close(false)); }

  canLeave(): boolean | Observable<boolean> {
    if (this.busy()) { this.message.set('Please wait for checkout to finish before leaving.'); return false; }
    if (this.confirmation) return false;
    if (this.state().status === 'success' || !this.form.dirty) return true;
    return this.ask(false);
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || (this.state().status !== 'success' && this.form.dirty)) { event.preventDefault(); event.returnValue = ''; }
  }

  protected useSample(): void {
    if (this.busy() || this.confirmation) return;
    this.address.setValue({ recipient: 'Demo Learner', street: '123 Fictional Lane', city: 'Example City', postalCode: '00000' });
    this.address.markAsDirty(); this.message.set('Fictional sample filled. These address values are never sent to the API.');
  }

  protected addNote(): void {
    if (this.busy() || this.notes.length >= MAX_DELIVERY_NOTES) return;
    this.notes.push(createDeliveryNote()); this.notes.markAsDirty();
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`#delivery-note-${this.notes.length - 1}`)?.focus(), { injector: this.injector });
  }

  protected removeNote(index: number): void {
    if (this.busy() || !Number.isInteger(index) || index < 0 || index >= this.notes.length) return;
    this.notes.removeAt(index); this.notes.markAsDirty();
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#add-note')?.focus(), { injector: this.injector });
  }

  protected next(index: 0 | 1): void {
    if (this.busy()) return;
    const group = index === 0 ? this.address : this.delivery;
    group.markAllAsTouched();
    if (!group.valid) { this.message.set('Complete the highlighted fields before continuing.'); this.focusInvalid(index); return; }
    this.message.set(''); this.stepper()?.next();
  }

  protected placeOrder(): void {
    if (this.busy() || this.confirmation || this.state().status === 'success') return;
    const user = this.session.currentUser();
    if (!user) { this.message.set('Your demo session ended. Sign in again before submitting. Your draft and cart are kept.'); return; }
    this.form.markAllAsTouched();
    if (!this.form.valid) {
      const index = !this.address.valid ? 0 : !this.delivery.valid ? 1 : 2;
      const stepper = this.stepper(); if (stepper) stepper.selectedIndex = index;
      this.message.set('Review the checkout fields and acknowledge the simulation before submitting.'); this.focusInvalid(index); return;
    }
    const snapshot = this.cart.lines();
    if (!snapshot.length) { this.message.set('Your cart is empty. Add products before checking out.'); return; }
    const snapshotCents = this.cart.subtotalCents();
    this.state.set({ status: 'submitting' }); this.message.set(''); this.form.disable();
    // The finite HTTP subscription is an intentional submission side effect. Both
    // the UI and this synchronous gate reject duplicate clicks; no write is retried.
    this.api.create({ userId: user.id, products: snapshot.map(line => ({ id: line.productId, quantity: line.quantity })) })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (!this.destroyRef.destroyed) this.form.enable(); }))
      .subscribe({
        next: result => {
          const cartCleared = this.cart.clearSubmitted(snapshot);
          this.resetValues();
          this.state.set({ status: 'success', result, snapshotCents, cartCleared });
          afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#receipt-heading')?.focus(), { injector: this.injector });
        },
        error: (error: unknown) => { this.state.set({ status: 'error', error: toApiError(error) }); }
      });
  }

  protected resetDraft(): void {
    if (this.busy() || this.confirmation) return;
    this.ask(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (confirmed) {
        this.resetValues(); this.state.set({ status: 'idle' }); this.message.set('Draft reset; cart kept.');
        const stepper = this.stepper(); if (stepper) stepper.selectedIndex = 0;
      }
    });
  }

  private resetValues(): void {
    this.notes.clear();
    const directive = this.formDirective();
    // Reset the directive's submitted flag as well as control values/state.
    if (directive) directive.resetForm(); else this.form.reset();
  }
  private focusInvalid(index: number): void {
    afterNextRender(() => this.host.nativeElement.querySelector(`[data-step="${index}"]`)
      ?.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, app-delivery-choice.ng-invalid input, mat-checkbox.ng-invalid input')?.focus(),
    { injector: this.injector });
  }
  private ask(reset: boolean): Observable<boolean> {
    const ref = this.dialog.open<CheckoutConfirmDialogComponent, CheckoutConfirmation, boolean>(CheckoutConfirmDialogComponent,
      { data: { reset }, width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: 'first-tabbable', restoreFocus: true, closeOnNavigation: false });
    this.confirmation = ref;
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.confirmation = null; });
    return ref.afterClosed().pipe(map(result => result === true));
  }
}
