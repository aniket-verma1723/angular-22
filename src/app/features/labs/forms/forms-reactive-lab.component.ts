import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, AsyncValidatorFn } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { catchError, map, merge, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { FormsLabLeaveService } from './forms-lab.guard';
import type { FormsLabPage } from './forms-lab.guard';
import { MAX_NOTES, emptyLabDraft, noteIssue, sampleLabDraft } from './forms-lab.model';
import type { SaveStage } from './forms-lab.model';
import { FormsLessonComponent } from './forms-lesson.component';
import { businessValidator, createNoteControl, createReactiveLabForm } from './forms-reactive-form';
import { LocalAvailabilityService } from './local-availability.service';
import { ReactiveStockControlComponent } from './reactive-stock-control.component';

@Component({
  selector: 'app-forms-reactive-lab',
  imports: [JsonPipe, ReactiveFormsModule, MatButton, MatCard, MatCardContent, FormsLessonComponent, ReactiveStockControlComponent],
  providers: [LocalAvailabilityService, FormsLabLeaveService],
  templateUrl: './forms-reactive-lab.component.html',
  styleUrl: './forms-lab.css',
  host: { '(window:beforeunload)': 'beforeUnload($event)' }
})
export class FormsReactiveLabComponent implements FormsLabPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formDirective = viewChild(FormGroupDirective);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private nextNoteId = 0;
  protected readonly availability = inject(LocalAvailabilityService);
  protected readonly leave = inject(FormsLabLeaveService);
  protected readonly stage = signal<SaveStage>('idle');
  protected readonly notice = signal('');
  protected readonly titleBuffered = signal(false);
  protected readonly maxNotes = MAX_NOTES;
  private readonly availabilityValidator: AsyncValidatorFn = control => {
    const title: unknown = control.value;
    if (typeof title !== 'string') return of({ unavailable: 'Use a text title.' });
    return this.availability.check(title).pipe(
      map(available => available ? null : { unavailable: 'This name is reserved by the small local fixture.' }),
      catchError(() => of({ availabilityFailure: 'Local availability failed. Retry the check.' })),
      takeUntilDestroyed(this.destroyRef)
    );
  };
  protected readonly draftForm = createReactiveLabForm(this.availabilityValidator, this.destroyRef);
  protected readonly fields = this.draftForm.controls;
  // A single readonly view boundary notifies the default OnPush view on async status changes.
  protected readonly observation = toSignal(merge(this.draftForm.valueChanges, this.draftForm.statusChanges).pipe(
    map(() => ({ value: this.draftForm.value, raw: this.draftForm.getRawValue(), status: this.draftForm.status }))
  ), { initialValue: { value: this.draftForm.value, raw: this.draftForm.getRawValue(), status: this.draftForm.status } });

  canLeave(): boolean | Observable<boolean> {
    return this.leave.canLeave(this.dirty(), this.stage() === 'saving');
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.stage() === 'saving') { event.preventDefault(); event.returnValue = ''; }
  }

  protected error(control: AbstractControl<unknown>): string {
    if (!control.touched) return '';
    const message: unknown = Object.values(control.errors ?? {})[0];
    return typeof message === 'string' ? message : '';
  }

  protected review(): void {
    this.draftForm.markAllAsTouched();
    // Let cross-field error attributes render before choosing a native control.
    afterNextRender(() => {
      this.element.nativeElement.querySelector<HTMLElement>('input[aria-invalid="true"]:not(:disabled), select[aria-invalid="true"]:not(:disabled)')?.focus();
    }, { injector: this.injector });
  }

  protected save(): void {
    if (this.stage() === 'saving' || this.leave.confirming()) return;
    if (this.titleBuffered()) {
      this.notice.set('Tab out of the title to commit its updateOn: blur value before saving.');
      this.titleInput()?.nativeElement.focus();
      return;
    }
    this.draftForm.markAllAsTouched();
    if (!this.draftForm.valid || this.draftForm.pending) {
      this.notice.set('Review errors and resolve pending availability before saving.');
      this.review();
      return;
    }
    this.notice.set('');
    this.stage.set('saving');
    this.draftForm.disable();
  }

  protected completeSave(success: boolean): void {
    if (this.stage() !== 'saving' || this.destroyRef.destroyed) return;
    this.draftForm.enable();
    this.restoreDisabledFields();
    if (success) this.clearDraft();
    this.stage.set(success ? 'success' : 'failure');
  }

  protected resetDraft(): void {
    if (this.stage() === 'saving' || this.leave.confirming()) return;
    this.clearDraft();
    this.stage.set('idle');
    this.notice.set('');
  }

  protected sample(): void {
    if (this.stage() === 'saving' || this.leave.confirming()) return;
    this.fields.notes.clear();
    this.fields.annotations.removeControl('label');
    this.draftForm.setValue(sampleLabDraft());
    this.restoreDisabledFields();
    this.draftForm.markAsDirty();
    this.titleBuffered.set(false);
    this.stage.set('idle');
  }

  protected addNote(): void {
    if (this.stage() === 'saving' || this.fields.notes.length >= MAX_NOTES) return;
    this.fields.notes.push(createNoteControl({ id: ++this.nextNoteId, text: '' }));
    this.fields.notes.markAsDirty();
  }

  protected removeNote(index: number): void {
    if (this.stage() === 'saving' || index < 0 || index >= this.fields.notes.length) return;
    this.fields.notes.removeAt(index);
    this.fields.notes.markAsDirty();
    this.focusTitle();
  }

  protected toggleAnnotation(): void {
    if (this.stage() === 'saving') return;
    if (this.fields.annotations.controls['label']) this.fields.annotations.removeControl('label');
    else this.fields.annotations.addControl('label', new FormControl('', { nonNullable: true, validators: businessValidator(noteIssue) }));
    this.fields.annotations.markAsDirty();
  }

  protected retryAvailability(): void {
    if (this.stage() !== 'saving' && !this.fields.title.pending) this.fields.title.updateValueAndValidity();
  }

  private dirty(): boolean {
    return this.draftForm.dirty || this.titleBuffered() || JSON.stringify(this.draftForm.getRawValue()) !== JSON.stringify(emptyLabDraft());
  }

  private clearDraft(): void {
    this.fields.notes.clear();
    this.fields.annotations.removeControl('label');
    this.formDirective()?.resetForm(emptyLabDraft());
    this.restoreDisabledFields();
    this.titleBuffered.set(false);
    this.focusTitle();
  }

  private restoreDisabledFields(): void {
    this.fields.reference.disable();
    if (!this.fields.schedule.controls.enabled.value) {
      this.fields.schedule.controls.start.disable();
      this.fields.schedule.controls.end.disable();
      this.fields.schedule.controls.acknowledged.disable();
    }
  }

  private focusTitle(): void {
    afterNextRender(() => this.titleInput()?.nativeElement.focus(), { injector: this.injector });
  }
}
