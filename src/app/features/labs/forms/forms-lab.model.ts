export interface LabSchedule {
  enabled: boolean;
  start: string;
  end: string;
  acknowledged: boolean;
}

export interface LabNote { id: number; text: string; }

export interface FormsLabDraft {
  title: string;
  price: number | null;
  stock: number | null;
  category: string;
  reference: string;
  schedule: LabSchedule;
  notes: LabNote[];
  annotations: Record<string, string>;
}

export interface LabIssue { readonly kind: string; readonly message: string; }
export type SaveStage = 'idle' | 'saving' | 'success' | 'failure';
export const MAX_NOTES = 3;
export const LAB_CATEGORIES: readonly string[] = ['groceries', 'beauty', 'furniture'];

export function emptyLabDraft(): FormsLabDraft {
  return {
    title: '', price: null, stock: null, category: '', reference: 'LOCAL ONLY',
    schedule: { enabled: false, start: '', end: '', acknowledged: false },
    notes: [], annotations: {}
  };
}

export function sampleLabDraft(): FormsLabDraft {
  return { ...emptyLabDraft(), title: 'Practice notebook', price: 12.5, stock: 8, category: 'groceries' };
}

// Same title/price/stock limits as products/editor; no product schema import because
// that schema also requires a description and owns a different editing contract.
export function titleIssue(value: unknown): LabIssue | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120
    ? undefined : { kind: 'title', message: 'Enter a non-blank title of at most 120 characters.' };
}

export function priceIssue(value: unknown): LabIssue | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.01 && value <= 1_000_000
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
    ? undefined : { kind: 'price', message: 'Use USD 0.01–1,000,000 with at most two decimal places.' };
}

export function stockIssue(value: unknown): LabIssue | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000
    ? undefined : { kind: 'stock', message: 'Use whole stock from 0 to 1,000,000.' };
}

export function categoryIssue(value: unknown): LabIssue | undefined {
  return typeof value === 'string' && LAB_CATEGORIES.includes(value)
    ? undefined : { kind: 'category', message: 'Choose groceries, beauty or furniture.' };
}

// Calendar dates are not instants: validate Gregorian days without timezone conversion.
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (days[month - 1] ?? 0);
}

export function dateIssue(value: unknown): LabIssue | undefined {
  return isCalendarDate(value) ? undefined : { kind: 'date', message: 'Enter a real calendar date (YYYY-MM-DD).' };
}

export function dateOrderIssue(start: unknown, end: unknown): LabIssue | undefined {
  return isCalendarDate(start) && isCalendarDate(end) && end < start
    ? { kind: 'dateOrder', message: 'End must be on or after start.' } : undefined;
}

export function acknowledgementIssue(value: unknown): LabIssue | undefined {
  return value === true ? undefined : { kind: 'acknowledged', message: 'Acknowledge the local schedule before saving.' };
}

export function noteIssue(value: unknown): LabIssue | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120
    ? undefined : { kind: 'note', message: 'Each added note needs 1–120 non-blank characters.' };
}

export function noteListIssue(notes: readonly LabNote[]): LabIssue | undefined {
  if (notes.length > MAX_NOTES) return { kind: 'noteLimit', message: 'Add at most three notes.' };
  if (new Set(notes.map(note => note.id)).size !== notes.length) return { kind: 'noteIdentity', message: 'Notes need unique identities.' };
  const texts = notes.map(note => note.text.trim().toLowerCase()).filter(Boolean);
  return new Set(texts).size === texts.length ? undefined : { kind: 'duplicateNotes', message: 'Use distinct note text.' };
}

export function annotationIssue(annotations: Readonly<Record<string, string>>): LabIssue | undefined {
  return Object.keys(annotations).some(key => key !== 'label')
    ? { kind: 'annotation', message: 'Only the optional label entry is supported.' } : undefined;
}

export function localNameAvailable(title: string): boolean {
  return !['reserved', 'demo'].includes(title.trim().toLowerCase());
}

export function draftIssues(draft: FormsLabDraft): readonly LabIssue[] {
  const schedule = draft.schedule;
  return [titleIssue(draft.title), priceIssue(draft.price), stockIssue(draft.stock), categoryIssue(draft.category),
    ...(schedule.enabled ? [dateIssue(schedule.start), dateIssue(schedule.end),
      dateOrderIssue(schedule.start, schedule.end), acknowledgementIssue(schedule.acknowledged)] : []),
    noteListIssue(draft.notes), ...draft.notes.map(note => noteIssue(note.text)),
    annotationIssue(draft.annotations), ...Object.values(draft.annotations).map(noteIssue)]
    .filter((issue): issue is LabIssue => issue !== undefined);
}
