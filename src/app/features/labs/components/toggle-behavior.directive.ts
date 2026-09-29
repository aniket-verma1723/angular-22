import { Directive, booleanAttribute, input, model, output } from '@angular/core';

@Directive({
  selector: 'button[appToggleBehavior]',
  host: {
    '[disabled]': 'blocked()',
    '[attr.aria-pressed]': 'pressed()',
    '[class.lab-pressed]': 'pressed()',
    '(click)': 'toggle()'
  }
})
export class ToggleBehaviorDirective {
  readonly blocked = input(false, { transform: booleanAttribute });
  readonly pressed = model(false);
  readonly toggled = output<boolean>();

  protected toggle(): void {
    if (this.blocked()) return;
    this.pressed.update(value => !value);
    this.toggled.emit(this.pressed());
  }
}
