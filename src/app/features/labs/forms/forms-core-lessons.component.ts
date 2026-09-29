import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField, applyWhen, createMetadataKey, form, hidden, metadata, readonly, required, submit } from '@angular/forms/signals';
import { SignalFormControl, compatForm } from '@angular/forms/signals/compat';
import { map, merge } from 'rxjs';

type MetadataKeyName = 'alias' | 'details' | 'code';
interface TrustedTextField {
  readonly key: MetadataKeyName;
  readonly label: string;
  readonly kind: 'text';
  readonly required: boolean;
}

// A trusted, compile-time allowlist, not API JSON or dynamically compiled HTML.
const TEXT_FIELDS = [
  { key: 'alias', label: 'Practice alias', kind: 'text', required: true },
  { key: 'details', label: 'Optional details', kind: 'text', required: false },
  { key: 'code', label: 'Fixture code', kind: 'text', required: false }
] as const satisfies readonly TrustedTextField[];
const FIELD_LABEL = createMetadataKey<string>();

function metadataFixture() {
  return { showDetails: false, lockCode: true, fields: { alias: '', details: '', code: 'LOCAL FIXTURE' } };
}

@Component({
  selector: 'app-forms-core-lessons',
  imports: [JsonPipe, FormField, ReactiveFormsModule],
  templateUrl: './forms-core-lessons.component.html',
  styleUrl: './forms-lab.css'
})
export class FormsCoreLessonsComponent {
  protected readonly textFields = TEXT_FIELDS;
  protected readonly fieldLabel = FIELD_LABEL;
  private readonly metadataModel = signal(metadataFixture());
  protected readonly metadataDraft = this.metadataModel.asReadonly();
  protected readonly metadataForm = form(this.metadataModel, path => {
    for (const field of TEXT_FIELDS) {
      metadata(path.fields[field.key], FIELD_LABEL, () => field.label);
      if (field.required) required(path.fields[field.key], { message: 'Enter a practice alias.' });
    }
    hidden(path.fields.details, { when: ({ valueOf }) => !valueOf(path.showDetails) });
    readonly(path.fields.code, { when: ({ valueOf }) => valueOf(path.lockCode) });
    applyWhen(path, ({ value }) => value().showDetails, visible => {
      required(visible.fields.details, { message: 'Details are required while shown.' });
    });
  });
  protected readonly submissionNotice = signal('');

  // Top-down migration: the existing Reactive control remains the single owner
  // of its value; compatForm adapts it, rather than copying it into a new draft.
  protected readonly legacyControl = new FormControl('Legacy fixture', { nonNullable: true, validators: Validators.required });
  private readonly compatibilityModel = signal({ modern: 'Signal fixture', legacy: this.legacyControl });
  protected readonly compatibilityForm = compatForm(this.compatibilityModel, path => {
    required(path.modern, { message: 'Enter the Signal fixture value.' });
  });

  // Bottom-up migration: bind fieldTree, not competing directives on one input.
  protected readonly migratedControl = new SignalFormControl('Migrated fixture', path => {
    required(path, { message: 'Enter the migrated value.' });
  });
  protected readonly bridgeForm = new FormGroup({
    migrated: this.migratedControl,
    retained: new FormControl('Retained fixture', { nonNullable: true })
  });
  protected readonly bridgeStatus = toSignal(this.bridgeForm.statusChanges, { initialValue: this.bridgeForm.status });

  protected readonly updatesForm = inject(NonNullableFormBuilder).group({ label: 'Initial label', category: 'Local category' });
  protected readonly updatesState = toSignal(merge(this.updatesForm.valueChanges, this.updatesForm.statusChanges).pipe(
    map(() => this.updatesForm.getRawValue())
  ), { initialValue: this.updatesForm.getRawValue() });

  protected patchPractice(): void { this.updatesForm.patchValue({ label: 'Patched label' }); }
  protected setPractice(): void { this.updatesForm.setValue({ label: 'Set label', category: 'Set category' }); }
  protected resetPractice(): void { this.updatesForm.reset(); }

  protected rejectAlias(event: Event): void {
    event.preventDefault();
    if (this.metadataForm().submitting()) return;
    this.submissionNotice.set('');
    void submit(this.metadataForm, {
      ignoreValidators: 'none',
      action: async field => ({
        kind: 'server', fieldTree: field.fields.alias,
        message: 'Simulated server field error: this alias was rejected. Edit it to clear the error.'
      })
    }).catch(() => this.submissionNotice.set('The local submission exercise could not complete.'));
  }

  protected resetLessons(): void {
    if (this.metadataForm().submitting()) return;
    this.metadataForm().reset(metadataFixture());
    this.submissionNotice.set('');
    this.legacyControl.reset();
    this.compatibilityForm.modern().reset('Signal fixture');
    this.compatibilityForm().reset();
    this.bridgeForm.reset();
    this.updatesForm.reset();
  }
}
