import { DOCUMENT, DestroyRef, Service, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly preferenceState = signal<ThemePreference>('system');
  readonly preference = this.preferenceState.asReadonly();

  constructor() {
    const root = this.document.documentElement;
    const previous = root.getAttribute('data-theme');
    // Root-level theme also reaches Material overlays outside the component tree.
    effect(() => root.setAttribute('data-theme', this.preferenceState()));
    inject(DestroyRef).onDestroy(() => {
      if (previous === null) {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', previous);
      }
    });
  }

  setPreference(value: string): void {
    if (value === 'system' || value === 'light' || value === 'dark') {
      this.preferenceState.set(value);
    }
  }
}
