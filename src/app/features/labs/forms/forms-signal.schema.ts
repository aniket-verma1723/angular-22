import { applyEach, debounce, disabled, schema, validate } from '@angular/forms/signals';
import { acknowledgementIssue, annotationIssue, categoryIssue, dateIssue, dateOrderIssue, noteIssue,
  noteListIssue, priceIssue, stockIssue, titleIssue } from './forms-lab.model';
import type { FormsLabDraft } from './forms-lab.model';

export const formsSignalSchema = schema<FormsLabDraft>(path => {
  debounce(path.title, 'blur');
  validate(path.title, ({ value }) => titleIssue(value()));
  validate(path.price, ({ value }) => priceIssue(value()));
  validate(path.stock, ({ value }) => stockIssue(value()));
  validate(path.category, ({ value }) => categoryIssue(value()));
  disabled(path.reference, { when: 'A disabled local reference remains in the model.' });
  disabled(path.schedule.start, { when: ({ valueOf }) => !valueOf(path.schedule.enabled) });
  disabled(path.schedule.end, { when: ({ valueOf }) => !valueOf(path.schedule.enabled) });
  disabled(path.schedule.acknowledged, { when: ({ valueOf }) => !valueOf(path.schedule.enabled) });
  validate(path.schedule.start, ({ value }) => dateIssue(value()));
  validate(path.schedule.end, ({ value, valueOf }) => dateIssue(value()) ?? dateOrderIssue(valueOf(path.schedule.start), value()));
  validate(path.schedule.acknowledged, ({ value }) => acknowledgementIssue(value()));
  validate(path.notes, ({ value }) => noteListIssue(value()));
  applyEach(path.notes, note => validate(note.text, ({ value }) => noteIssue(value())));
  validate(path.annotations, ({ value }) => annotationIssue(value()));
  applyEach(path.annotations, entry => validate(entry, ({ value }) => noteIssue(value())));
});
