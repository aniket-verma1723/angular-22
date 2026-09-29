import { Component, Directive, model } from '@angular/core';
import { ToggleBehaviorDirective } from './toggle-behavior.directive';

/** Intentionally tiny inheritance comparison, not an application base hierarchy. */
@Directive({ host: { '[attr.aria-pressed]': 'pressed()', '(click)': 'toggle()' } })
export abstract class InheritedToggleBehavior {
  readonly pressed = model(false);

  protected toggle(): void {
    this.pressed.update(value => !value);
  }
}

@Component({
  selector: 'button[appInheritedToggle]',
  template: '<ng-content>Inherited toggle</ng-content>'
})
export class InheritedToggleComponent extends InheritedToggleBehavior {}

@Component({
  selector: 'button[appComposedToggle]',
  template: '<ng-content>Composed toggle</ng-content>',
  hostDirectives: [{
    directive: ToggleBehaviorDirective,
    inputs: ['pressed', 'blocked: disabled'],
    outputs: ['pressedChange', 'toggled: activated']
  }]
})
export class ComposedToggleComponent {}
