import { createCheckoutForm, createDeliveryNote } from './checkout-form';

describe('Typed checkout form', () => {
  it('requires address, a supported delivery method and acknowledgement', () => {
    const form = createCheckoutForm(); expect(form.invalid).toBeTrue();
    form.controls.address.setValue({ recipient: 'Demo', street: 'Imaginary road', city: 'Example', postalCode: '00000' });
    form.controls.delivery.controls.method.setValue('standard');
    expect(form.invalid).toBeTrue(); form.controls.review.controls.acknowledged.setValue(true);
    expect(form.valid).toBeTrue();
    form.controls.address.controls.recipient.setValue('   '); expect(form.invalid).toBeTrue();
  });
  it('rejects malformed postal codes and overly long fields', () => {
    const form = createCheckoutForm(); const address = form.controls.address;
    for (const code of ['', 'abcd', '1234', '123456', ' 00000 ']) { address.controls.postalCode.setValue(code); expect(address.controls.postalCode.invalid).toBeTrue(); }
    address.controls.street.setValue('x'.repeat(121)); expect(address.controls.street.invalid).toBeTrue();
  });
  it('validates bounded dynamic notes and preserves disabled values only in getRawValue', () => {
    const form = createCheckoutForm(); const notes = form.controls.delivery.controls.notes;
    const note = createDeliveryNote(); notes.push(note); expect(notes.invalid).toBeTrue();
    note.setValue('Fictional instruction'); expect(notes.valid).toBeTrue();
    for (let i = 0; i < 3; i++) { const extra = createDeliveryNote(); extra.setValue('Note'); notes.push(extra); }
    expect(notes.invalid).toBeTrue(); notes.removeAt(3); expect(notes.valid).toBeTrue();
    form.controls.address.controls.recipient.setValue('Demo'); form.controls.address.controls.recipient.disable();
    expect(form.value.address?.recipient).toBeUndefined(); expect(form.getRawValue().address.recipient).toBe('Demo');
  });
  it('resets non-nullable text/boolean defaults and nullable delivery choice', () => {
    const form = createCheckoutForm(); form.controls.address.controls.recipient.setValue('Demo');
    form.controls.delivery.controls.method.setValue('express'); form.controls.review.controls.acknowledged.setValue(true);
    form.markAsDirty(); form.reset();
    expect(form.getRawValue().address.recipient).toBe(''); expect(form.getRawValue().delivery.method).toBeNull();
    expect(form.getRawValue().review.acknowledged).toBeFalse(); expect(form.pristine).toBeTrue();
  });
});
