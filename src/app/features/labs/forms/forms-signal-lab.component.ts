import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal, viewChildren } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, apply, disabled, form, submit, validateAsync } from '@angular/forms/signals';
import type { ReadonlyFieldTree } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { of } from 'rxjs';
import type { Observable } from 'rxjs';
import { FormsLabLeaveService } from './forms-lab.guard';
import type { FormsLabPage } from './forms-lab.guard';
import { MAX_NOTES, emptyLabDraft, sampleLabDraft } from './forms-lab.model';
import type { SaveStage } from './forms-lab.model';
import { FormsLessonComponent } from './forms-lesson.component';
import { FormsCoreLessonsComponent } from './forms-core-lessons.component';
import { formsSignalSchema } from './forms-signal.schema';
import { LocalAvailabilityService } from './local-availability.service';
import { SignalAckControlComponent } from './signal-ack-control.component';
import { SignalStockControlComponent } from './signal-stock-control.component';

@Component({
  selector: 'app-forms-signal-lab',
  imports: [JsonPipe, FormField, MatButton, MatCard, MatCardContent, FormsLessonComponent, FormsCoreLessonsComponent, SignalAckControlComponent, SignalStockControlComponent],
  providers: [LocalAvailabilityService, FormsLabLeaveService],
  templateUrl: './forms-signal-lab.component.html',
  styleUrl: './forms-lab.css',
  host: { '(window:beforeunload)': 'beforeUnload($event)' }
})
export class FormsSignalLabComponent implements FormsLabPage {
  private readonly model = signal(emptyLabDraft());
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly bindings = viewChildren(FormField);
  private readonly availabilityGeneration = signal(0);
  private resolveSave: ((success: boolean) => void) | null = null;
  private nextNoteId = 0;
  protected readonly availability = inject(LocalAvailabilityService);
  protected readonly leave = inject(FormsLabLeaveService);
  protected readonly stage = signal<SaveStage>('idle');
  protected readonly notice = signal('');
  protected readonly draft = this.model.asReadonly();
  protected readonly maxNotes = MAX_NOTES;
  protected readonly draftForm = form(this.model, path => {
    apply(path, formsSignalSchema);
    disabled(path, { when: () => this.stage() === 'saving' });
    validateAsync(path.title, {
      params: ({ value }) => ({ title: value(), generation: this.availabilityGeneration() }),
      factory: params => rxResource({
        // In 22.1.7 undefined resource params can leave the previous stream subscribed.
        // A defined idle request replaces it with a finite, local result instead.
        params: computed(() => ({ request: params() })),
        stream: ({ params }) => params.request === undefined ? of(true) : this.availability.check(params.request.title)
      }),
      onSuccess: (available: boolean) => available ? undefined : { kind: 'unavailable', message: 'This name is reserved by the small local fixture.' },
      onError: () => ({ kind: 'availabilityFailure', message: 'Local availability failed. Retry the check.' })
    });
  });
  protected readonly busy = computed(() => this.stage() === 'saving' || this.draftForm().submitting());
  private readonly dirty = computed(() => this.draftForm().dirty()
    || this.draftForm.title().controlValue() !== this.draftForm.title().value()
    || JSON.stringify(this.model()) !== JSON.stringify(emptyLabDraft()));

  constructor() {
    this.destroyRef.onDestroy(() => { this.resolveSave?.(false); this.resolveSave = null; });
  }

  canLeave(): boolean | Observable<boolean> { return this.leave.canLeave(this.dirty(), this.busy()); }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.busy()) { event.preventDefault(); event.returnValue = ''; }
  }

  protected error(field: ReadonlyFieldTree<unknown>): string {
    if (!field().touched()) return '';
    const issue = field().errors()[0];
    return issue?.message ?? (issue?.kind === 'parse' ? 'Enter a value in the expected format.' : '');
  }

  protected review(): void {
    this.draftForm.title().markAsTouched();
    this.draftForm().markAsTouched();
    afterNextRender(() => {
      // View queries follow rendered order, including custom controls. Group-only
      // note errors belong at the first note, before later annotation errors.
      const noteFields = new Set<ReadonlyFieldTree<unknown>>(Array.from(this.draftForm.notes, note => note.text));
      this.bindings().find(binding => {
        const state = binding.state();
        return !state.disabled() && !state.hidden() && !state.readonly()
          && (state.invalid() || (this.draftForm.notes().errors().length > 0 && noteFields.has(binding.field())));
      })?.focus();
    }, { injector: this.injector });
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.busy() || this.leave.confirming()) return;
    // Touch the buffered field itself: touching the root only marks descendants.
    this.draftForm.title().markAsTouched();
    this.draftForm().markAsTouched();
    if (this.draftForm().pending() || !this.draftForm().valid()) {
      this.notice.set('Review errors and resolve pending availability before saving.');
      this.review();
      return;
    }
    this.notice.set('');
    void submit(this.draftForm, {
      ignoreValidators: 'none',
      onInvalid: () => this.review(),
      action: async field => {
        this.stage.set('saving');
        const success = await new Promise<boolean>(resolve => { this.resolveSave = resolve; });
        if (this.destroyRef.destroyed) return;
        if (!success) throw new Error('Local save failed');
        field().reset(emptyLabDraft());
        this.stage.set('success');
        this.focusTitle();
      }
    }).catch(() => {
      if (!this.destroyRef.destroyed) this.stage.set('failure');
    });
  }

  protected completeSave(success: boolean): void {
    const resolve = this.resolveSave;
    this.resolveSave = null;
    resolve?.(success);
  }

  protected resetDraft(): void {
    if (this.busy() || this.leave.confirming()) return;
    this.draftForm().reset(emptyLabDraft());
    this.availabilityGeneration.update(generation => generation + 1);
    this.stage.set('idle');
    this.notice.set('');
    this.focusTitle();
  }

  protected sample(): void {
    if (this.busy() || this.leave.confirming()) return;
    this.draftForm().reset(sampleLabDraft());
    // A same-title sample is still a new experiment, not the old cached result.
    this.availabilityGeneration.update(generation => generation + 1);
    this.draftForm().markAsDirty();
    this.stage.set('idle');
    this.notice.set('');
  }

  protected addNote(): void {
    if (this.busy() || this.model().notes.length >= MAX_NOTES) return;
    this.model.update(draft => ({ ...draft, notes: [...draft.notes, { id: ++this.nextNoteId, text: '' }] }));
    this.draftForm.notes().markAsDirty();
  }

  protected removeNote(id: number): void {
    if (this.busy()) return;
    this.model.update(draft => ({ ...draft, notes: draft.notes.filter(note => note.id !== id) }));
    this.draftForm.notes().markAsDirty();
    this.focusTitle();
  }

  protected toggleAnnotation(): void {
    if (this.busy()) return;
    const annotations: Record<string, string> = Object.hasOwn(this.model().annotations, 'label') ? {} : { label: '' };
    this.model.update(draft => ({ ...draft, annotations }));
    this.draftForm.annotations().markAsDirty();
  }

  private focusTitle(): void {
    afterNextRender(() => this.draftForm.title().focusBoundControl(), { injector: this.injector });
  }
}
