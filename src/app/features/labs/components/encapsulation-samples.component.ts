import { Component, ViewEncapsulation, signal } from '@angular/core';

@Component({
  selector: 'app-emulated-sample',
  encapsulation: ViewEncapsulation.Emulated,
  template: '<p class="sample">Emulated: solid border, component-scoped selectors.</p>',
  styles: `
    :host { display: block; }
    .sample { border: 3px solid var(--lab-edge, currentColor); padding: .75rem;
      background: var(--lab-surface, Canvas); color: var(--lab-ink, CanvasText); }
  `
})
export class EmulatedSampleComponent {}

@Component({
  selector: 'app-shadow-sample',
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <p class="sample">Shadow DOM: double border, real shadow content.</p>
    <button type="button" [attr.aria-pressed]="pressed()" (click)="pressed.set(!pressed())">Shadow toggle</button>
    <p data-shadow-state>Shadow pressed: {{ pressed() }}</p>
  `,
  styles: `
    :host { display: block; color: var(--lab-ink, CanvasText); }
    .sample { border: 3px double var(--lab-edge, currentColor); padding: .75rem;
      background: var(--lab-surface, Canvas); }
    button { font: inherit; color: var(--lab-ink, CanvasText); background: var(--lab-surface, Canvas);
      min-height: 44px; padding: .5rem .75rem; border: 1px solid currentColor; border-radius: .5rem; }
    button:focus-visible { outline: 3px solid var(--lab-edge, Highlight); outline-offset: 3px; }
  `
})
export class ShadowSampleComponent {
  protected readonly pressed = signal(false);
}

@Component({
  selector: 'app-none-sample',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'components-lab-none' },
  template: '<p class="sample">None: dashed border, manually prefixed global selectors.</p>',
  // Every selector is restricted to this exact lab host. Never add a bare element/class rule here.
  styles: `
    app-none-sample.components-lab-none { display: block; }
    app-none-sample.components-lab-none .sample { border: 3px dashed var(--lab-edge, currentColor);
      padding: .75rem; background: var(--lab-surface, Canvas); color: var(--lab-ink, CanvasText); }
  `
})
export class NoneSampleComponent {}
