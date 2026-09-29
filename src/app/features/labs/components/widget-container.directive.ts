import { Directive, ViewContainerRef, inject, input, inputBinding, output, outputBinding } from '@angular/core';
import type { OnInit, Type } from '@angular/core';
import type { WidgetContract, WidgetData, WidgetSelection } from './dynamic-widgets.component';

/** One Angular-owned container per keyed widget; no detached component refs or manual subscriptions. */
@Directive({ selector: '[appWidgetContainer]' })
export class WidgetContainerDirective implements OnInit {
  readonly appWidgetContainer = input.required<Type<WidgetContract>>();
  readonly data = input.required<WidgetData>();
  readonly selected = output<WidgetSelection>();
  private readonly container = inject(ViewContainerRef);

  ngOnInit(): void {
    this.container.createComponent(this.appWidgetContainer(), {
      bindings: [
        inputBinding('data' satisfies keyof WidgetContract, this.data),
        outputBinding<WidgetSelection>('selected' satisfies keyof WidgetContract, value => this.selected.emit(value))
      ]
    });
  }
}
