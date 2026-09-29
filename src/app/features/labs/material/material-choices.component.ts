import { Component, computed, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ValidatorFn } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MaterialLessonComponent } from './material-lesson.component';
import type { MaterialLesson } from './material-lesson.component';

const SUBJECTS: readonly string[] = ['Aurora', 'Comet', 'Orbit'];
const allowlistedSubject: ValidatorFn = control => {
  const value: unknown = control.value;
  return typeof value === 'string' && SUBJECTS.includes(value) ? null : { allowlist: true };
};

@Component({
  selector: 'app-material-choices',
  imports: [MaterialLessonComponent, ReactiveFormsModule, MatAutocompleteModule, MatButtonModule,
    MatChipsModule, MatFormFieldModule, MatInputModule, MatSliderModule, MatSlideToggleModule],
  templateUrl: './material-choices.component.html',
  styleUrl: './material-choices.component.css'
})
export class MaterialChoicesComponent {
  private readonly autocomplete = viewChild(MatAutocompleteTrigger);
  private readonly lockedState = signal(false);
  protected readonly locked = this.lockedState.asReadonly();
  // Independent typed CVA controls, not a duplicate Signal Forms model.
  protected readonly subject = new FormControl('', { nonNullable: true, validators: [allowlistedSubject] });
  protected readonly activities = new FormControl<string[]>(['Read'], { nonNullable: true });
  protected readonly minutes = new FormControl(15, { nonNullable: true, validators: [Validators.min(5), Validators.max(30)] });
  protected readonly captions = new FormControl(true, { nonNullable: true });
  private readonly subjectValue = toSignal(this.subject.valueChanges, { initialValue: this.subject.value });
  protected readonly activityValue = toSignal(this.activities.valueChanges, { initialValue: this.activities.value });
  protected readonly minuteValue = toSignal(this.minutes.valueChanges, { initialValue: this.minutes.value });
  protected readonly captionValue = toSignal(this.captions.valueChanges, { initialValue: this.captions.value });
  protected readonly filteredSubjects = computed(() => {
    const query = this.subjectValue().trim().toLowerCase();
    return SUBJECTS.filter(subject => subject.toLowerCase().includes(query));
  });
  protected readonly selectedSubject = computed(() => SUBJECTS.includes(this.subjectValue()) ? this.subjectValue() : 'No valid subject');
  protected readonly lesson: MaterialLesson = {
    title: 'Choices · autocomplete and CVA controls',
    concept: 'Autocomplete suggests from a local allowlist; free text is not automatically a valid selection. Selection chips choose activities, a slider sets practice minutes and a slide toggle controls a fictional caption preview.',
    tryIt: 'Type co and select Comet. Try an unknown subject, then blur. Select Practice, move the slider, turn captions off, disable the controls and reset. Archived activity is always unavailable.',
    mechanism: 'This deliberate contrast lesson uses separate typed Reactive FormControls through Material ControlValueAccessors. toSignal reads each valueChanges stream once for the OnPush preview; it does not create a second writable model. A pure allowlist validator rejects unknown text.',
    mistake: 'Suggestions are not validation. Do not duplicate controls with a writable signal form, bind disabled separately from a CVA control, or put interactive buttons inside selection chips.',
    question: 'Why can autocomplete display typed text while the preview still says No valid subject? Which object owns disabled and reset state?',
    observation: 'Only an exact allowlisted subject enters the preview. Disabled controls retain their values without accepting edits. Reset choices enables every control, clears validation display and restores Read, 15 minutes and captions on.'
  };

  protected toggleDisabled(): void {
    const disabled = !this.lockedState();
    this.lockedState.set(disabled);
    this.autocomplete()?.closePanel();
    for (const control of [this.subject, this.activities, this.minutes, this.captions]) {
      if (disabled) control.disable(); else control.enable();
    }
  }

  protected reset(): void {
    this.autocomplete()?.closePanel();
    this.lockedState.set(false);
    this.subject.reset({ value: '', disabled: false });
    this.activities.reset({ value: ['Read'], disabled: false });
    this.minutes.reset({ value: 15, disabled: false });
    this.captions.reset({ value: true, disabled: false });
  }
}
