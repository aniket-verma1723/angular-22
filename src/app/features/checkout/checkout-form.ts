import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import type { ValidatorFn } from '@angular/forms';
import { isDeliveryMethod } from './ui/delivery-choice.component';
import type { DeliveryMethod } from './ui/delivery-choice.component';

const nonBlank: ValidatorFn = control => typeof control.value === 'string' && control.value.trim() ? null : { blank: true };
const deliveryMethod: ValidatorFn = control => isDeliveryMethod(control.value) ? null : { delivery: true };
export const MAX_DELIVERY_NOTES = 3;

export function createDeliveryNote(): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: [nonBlank, Validators.maxLength(120)] });
}
export function createCheckoutForm() {
  return new FormGroup({
    address: new FormGroup({
      recipient: new FormControl('', { nonNullable: true, validators: [nonBlank, Validators.maxLength(80)] }),
      street: new FormControl('', { nonNullable: true, validators: [nonBlank, Validators.maxLength(120)] }),
      city: new FormControl('', { nonNullable: true, validators: [nonBlank, Validators.maxLength(80)] }),
      postalCode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{5}$/)] })
    }),
    delivery: new FormGroup({
      method: new FormControl<DeliveryMethod | null>(null, { validators: [deliveryMethod] }),
      notes: new FormArray<FormControl<string>>([], { validators: [Validators.maxLength(MAX_DELIVERY_NOTES)] })
    }),
    review: new FormGroup({ acknowledged: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }) })
  });
}
export type CheckoutForm = ReturnType<typeof createCheckoutForm>;
