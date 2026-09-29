import type { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, FormRecord } from '@angular/forms';
import type { AsyncValidatorFn, NonNullableFormBuilder, ValidatorFn } from '@angular/forms';
import { acknowledgementIssue, annotationIssue, categoryIssue, dateIssue, dateOrderIssue, noteIssue,
  noteListIssue, priceIssue, stockIssue, titleIssue } from './forms-lab.model';
import type { LabIssue, LabNote } from './forms-lab.model';

export function businessValidator(rule: (value: unknown) => LabIssue | undefined): ValidatorFn {
  return control => {
    const value: unknown = control.value;
    const issue = rule(value);
    return issue ? { [issue.kind]: issue.message } : null;
  };
}

export function createNoteControl(note: LabNote) {
  return new FormGroup({
    id: new FormControl(note.id, { nonNullable: true }),
    text: new FormControl(note.text, { nonNullable: true, validators: businessValidator(noteIssue) })
  });
}

export function createReactiveLabForm(availability: AsyncValidatorFn, destroyRef: DestroyRef) {
  const builder: NonNullableFormBuilder = new FormBuilder().nonNullable;
  const schedule = builder.group({
    enabled: builder.control(false),
    start: builder.control({ value: '', disabled: true }, { validators: businessValidator(dateIssue) }),
    end: builder.control({ value: '', disabled: true }, { validators: businessValidator(dateIssue) }),
    acknowledged: builder.control({ value: false, disabled: true }, { validators: businessValidator(acknowledgementIssue) })
  });
  schedule.addValidators(() => {
    const value = schedule.getRawValue();
    const issue = value.enabled ? dateOrderIssue(value.start, value.end) : undefined;
    return issue ? { [issue.kind]: issue.message } : null;
  });
  schedule.controls.enabled.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(enabled => {
    for (const control of [schedule.controls.start, schedule.controls.end, schedule.controls.acknowledged]) {
      if (enabled) control.enable({ emitEvent: false, onlySelf: true });
      else control.disable({ emitEvent: false, onlySelf: true });
    }
    schedule.updateValueAndValidity({ emitEvent: false });
  });
  const notes = new FormArray<ReturnType<typeof createNoteControl>>([]);
  notes.addValidators(() => {
    const issue = noteListIssue(notes.getRawValue());
    return issue ? { [issue.kind]: issue.message } : null;
  });
  const annotations = new FormRecord<FormControl<string>>({});
  annotations.addValidators(() => {
    const issue = annotationIssue(annotations.getRawValue());
    return issue ? { [issue.kind]: issue.message } : null;
  });
  return new FormGroup({
    title: builder.control('', { updateOn: 'blur', validators: businessValidator(titleIssue), asyncValidators: availability }),
    price: new FormControl<number | null>(null, businessValidator(priceIssue)),
    stock: new FormControl<number | null>(null, businessValidator(stockIssue)),
    category: builder.control('', { validators: businessValidator(categoryIssue) }),
    reference: builder.control({ value: 'LOCAL ONLY', disabled: true }),
    schedule, notes, annotations
  });
}
