import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { form } from '@angular/forms/signals';
import { of } from 'rxjs';
import { draftIssues, emptyLabDraft, isCalendarDate, noteIssue, sampleLabDraft } from './forms-lab.model';
import type { FormsLabDraft } from './forms-lab.model';
import { businessValidator, createNoteControl, createReactiveLabForm } from './forms-reactive-form';
import { formsSignalSchema } from './forms-signal.schema';

describe('Forms comparison pure constraints and adapters', () => {
  // Project the entire domain contract, not framework-owned symbol metadata.
  // Unlike JSON round-tripping this retains NaN, Infinity and nullable numbers.
  function domain(draft: FormsLabDraft): FormsLabDraft {
    return {
      title: draft.title, price: draft.price, stock: draft.stock,
      category: draft.category, reference: draft.reference,
      schedule: {
        enabled: draft.schedule.enabled, start: draft.schedule.start,
        end: draft.schedule.end, acknowledged: draft.schedule.acknowledged
      },
      notes: draft.notes.map(note => ({ id: note.id, text: note.text })),
      annotations: Object.fromEntries(Object.entries(draft.annotations))
    };
  }

  function equivalent(draft: FormsLabDraft, valid: boolean): void {
    const signalForm = TestBed.runInInjectionContext(() => form(signal(domain(draft)), formsSignalSchema));
    const reactive = createReactiveLabForm(() => of(null), TestBed.inject(DestroyRef));
    for (const note of draft.notes) reactive.controls.notes.push(createNoteControl(note));
    for (const [key, value] of Object.entries(draft.annotations)) {
      reactive.controls.annotations.addControl(key, new FormControl(value, { nonNullable: true, validators: businessValidator(noteIssue) }));
    }
    reactive.setValue(draft);
    expect(draftIssues(draft).length === 0).withContext('pure business rules').toBe(valid);
    expect(signalForm().valid()).withContext('Signal schema').toBe(valid);
    expect(reactive.valid).withContext('Reactive validators').toBe(valid);
    expect(domain(signalForm().value())).toEqual(domain(reactive.getRawValue()));
    expect(domain(signalForm().value())).toEqual(domain(draft));
  }

  it('starts empty and invalid, with fresh nested state per draft', () => {
    equivalent(emptyLabDraft(), false);
    const first = emptyLabDraft();
    first.notes.push({ id: 1, text: 'One' });
    first.schedule.enabled = true;
    expect(emptyLabDraft().notes).toEqual([]);
    expect(emptyLabDraft().schedule.enabled).toBeFalse();
  });

  it('accepts all inclusive numeric/title boundaries including zero stock', () => {
    equivalent(sampleLabDraft(), true);
    equivalent({ ...sampleLabDraft(), title: 'a'.repeat(120), price: 0.01, stock: 0 }, true);
    equivalent({ ...sampleLabDraft(), price: 1_000_000, stock: 1_000_000 }, true);
  });

  for (const title of ['', '   ', 'a'.repeat(121)]) {
    it(`rejects invalid title of length ${title.length}`, () => equivalent({ ...sampleLabDraft(), title }, false));
  }
  for (const price of [null, 0, -1, 0.001, 1.234, 1_000_000.01, NaN, Infinity]) {
    it(`rejects invalid price ${price}`, () => equivalent({ ...sampleLabDraft(), price }, false));
  }
  for (const stock of [null, -1, 0.5, 1_000_001, NaN, Infinity]) {
    it(`rejects invalid stock ${stock}`, () => equivalent({ ...sampleLabDraft(), stock }, false));
  }
  for (const category of ['', 'unknown', 'groceries\n', '<script>']) {
    it(`rejects unlisted category ${category}`, () => equivalent({ ...sampleLabDraft(), category }, false));
  }

  it('validates real Gregorian calendar strings without UTC conversion', () => {
    for (const date of ['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31']) expect(isCalendarDate(date)).toBeTrue();
    for (const date of ['2023-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '0000-01-01', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01\n']) {
      expect(isCalendarDate(date)).withContext(date).toBeFalse();
    }
  });

  it('requires acknowledgement and valid ordered dates only when scheduled', () => {
    const draft = sampleLabDraft();
    draft.schedule = { enabled: true, start: '2026-10-01', end: '2026-10-01', acknowledged: true };
    equivalent(draft, true);
    equivalent({ ...draft, schedule: { ...draft.schedule, end: '2026-09-30' } }, false);
    equivalent({ ...draft, schedule: { ...draft.schedule, start: '2026-02-30' } }, false);
    equivalent({ ...draft, schedule: { ...draft.schedule, acknowledged: false } }, false);
    equivalent({ ...draft, schedule: { enabled: false, start: 'bad', end: '', acknowledged: false } }, true);
  });

  it('matches item, cross-item, identity, array-length and optional record rules', () => {
    const draft = { ...sampleLabDraft(), notes: [{ id: 1, text: 'One' }, { id: 2, text: 'Two' }, { id: 3, text: 'Three' }], annotations: { label: 'Public exercise' } };
    equivalent(draft, true);
    equivalent({ ...draft, notes: [...draft.notes, { id: 4, text: 'Four' }] }, false);
    equivalent({ ...draft, notes: [{ id: 1, text: 'Same' }, { id: 2, text: ' same ' }] }, false);
    equivalent({ ...draft, notes: [{ id: 1, text: 'One' }, { id: 1, text: 'Two' }] }, false);
    equivalent({ ...draft, notes: [{ id: 1, text: '   ' }] }, false);
    equivalent({ ...draft, notes: [{ id: 1, text: 'a'.repeat(121) }] }, false);
    equivalent({ ...draft, annotations: { label: '' } }, false);
    equivalent({ ...draft, annotations: { extra: 'Not allowed' } }, false);
  });

  it('updates cross-field rules after an independent start change', () => {
    const draft = { ...sampleLabDraft(), schedule: { enabled: true, start: '2026-10-01', end: '2026-10-02', acknowledged: true } };
    const signalForm = TestBed.runInInjectionContext(() => form(signal(draft), formsSignalSchema));
    const reactive = createReactiveLabForm(() => of(null), TestBed.inject(DestroyRef));
    reactive.setValue(draft);
    signalForm.schedule.start().value.set('2026-10-03');
    reactive.controls.schedule.controls.start.setValue('2026-10-03');
    expect(signalForm.schedule.end().invalid()).toBeTrue();
    expect(reactive.controls.schedule.hasError('dateOrder')).toBeTrue();
    signalForm.schedule.enabled().value.set(false);
    reactive.controls.schedule.controls.enabled.setValue(false);
    expect(signalForm().valid()).toBeTrue();
    expect(reactive.valid).toBeTrue();
    expect(reactive.value.reference).toBeUndefined();
    expect(reactive.getRawValue().reference).toBe('LOCAL ONLY');
    expect(signalForm().value().schedule.start).toBe('2026-10-03');
  });

  it('restores non-nullable defaults but keeps empty numeric controls nullable', () => {
    const reactive = createReactiveLabForm(() => of(null), TestBed.inject(DestroyRef));
    reactive.setValue(sampleLabDraft());
    reactive.reset();
    expect(reactive.getRawValue()).toEqual(emptyLabDraft());
  });
});
