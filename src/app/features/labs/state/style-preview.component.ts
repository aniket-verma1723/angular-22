import { Component, ElementRef, Injectable, Renderer2, effect, inject, input, untracked } from '@angular/core';

export interface PreviewObservation {
  readonly runs: number;
  readonly cleanups: number;
  readonly incidentalNote: string;
}

@Injectable()
export class PreviewLedger {
  private runs = 0;
  private cleanups = 0;
  private note = '';
  recordRun(note: string): void { this.runs++; this.note = note; }
  recordCleanup(): void { this.cleanups++; }
  inspect(): PreviewObservation { return { runs: this.runs, cleanups: this.cleanups, incidentalNote: this.note }; }
}

@Component({
  selector: 'app-style-preview',
  template: `<p>Imperative CSS preview · corner radius {{ radius() }} px</p>`,
  styles: `:host { display: block; border: 2px solid currentColor; border-radius: var(--lab-radius, 0px); padding: 1rem; margin-block: 1rem; }`
})
export class StylePreviewComponent {
  readonly radius = input.required<number>();
  readonly note = input('note 0');
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly ledger = inject(PreviewLedger);

  constructor() {
    effect(onCleanup => {
      const radius = this.radius();
      // An isolated stand-in for a CSS-based third-party renderer. Ordinary views should bind styles.
      this.renderer.setStyle(this.element.nativeElement, '--lab-radius', `${radius}px`);
      untracked(() => this.ledger.recordRun(this.note()));
      onCleanup(() => {
        this.renderer.removeStyle(this.element.nativeElement, '--lab-radius');
        this.ledger.recordCleanup();
      });
    });
  }
}
