import { Component, DestroyRef, inject, input, output } from '@angular/core';
import type { InputSignal, OutputEmitterRef, Type } from '@angular/core';
import { WidgetLifetime } from './widget-lifetime.service';

export type WidgetKind = 'note' | 'meter';
export interface WidgetData {
  readonly title: string;
  readonly revision: number;
}
export interface WidgetSelection {
  readonly kind: WidgetKind;
  readonly revision: number;
}
export type WidgetSelectionHandler = (selection: WidgetSelection) => void;
export interface WidgetOutletInputs {
  readonly data: WidgetData;
  readonly onSelection: WidgetSelectionHandler;
}
export interface WidgetContract {
  readonly data: InputSignal<WidgetData>;
  readonly selected: OutputEmitterRef<WidgetSelection>;
  readonly onSelection: InputSignal<WidgetSelectionHandler | undefined>;
}

@Component({
  selector: 'app-note-widget',
  template: `
    <p data-widget>Note: {{ data().title }} · revision {{ data().revision }}</p>
    <button type="button" (click)="select()">Select note revision</button>
  `,
  styleUrl: './experiment-controls.css'
})
export class NoteWidgetComponent implements WidgetContract {
  readonly data = input.required<WidgetData>();
  readonly selected = output<WidgetSelection>();
  // NgComponentOutlet has inputs, not automatic output bindings. Its host explicitly supplies this callback.
  readonly onSelection = input<WidgetSelectionHandler>();

  constructor() {
    const lifetime = inject(WidgetLifetime);
    lifetime.recordCreation();
    inject(DestroyRef).onDestroy(() => lifetime.recordDestruction());
  }

  protected select(): void {
    const selection: WidgetSelection = { kind: 'note', revision: this.data().revision };
    this.selected.emit(selection);
    this.onSelection()?.(selection);
  }
}

@Component({
  selector: 'app-meter-widget',
  template: `
    <p data-widget>Meter: {{ data().title }} · revision {{ data().revision }}</p>
    <meter min="0" max="10" [value]="data().revision" aria-label="Fixture revision out of ten"></meter>
    <button type="button" (click)="select()">Select meter revision</button>
  `,
  styleUrl: './experiment-controls.css'
})
export class MeterWidgetComponent implements WidgetContract {
  readonly data = input.required<WidgetData>();
  readonly selected = output<WidgetSelection>();
  readonly onSelection = input<WidgetSelectionHandler>();

  constructor() {
    const lifetime = inject(WidgetLifetime);
    lifetime.recordCreation();
    inject(DestroyRef).onDestroy(() => lifetime.recordDestruction());
  }

  protected select(): void {
    const selection: WidgetSelection = { kind: 'meter', revision: this.data().revision };
    this.selected.emit(selection);
    this.onSelection()?.(selection);
  }
}

// Static classes only: no remote component names, templates, eval or JSON compilation.
export const LAB_WIDGETS = {
  note: NoteWidgetComponent,
  meter: MeterWidgetComponent
} satisfies Record<WidgetKind, Type<WidgetContract>>;
