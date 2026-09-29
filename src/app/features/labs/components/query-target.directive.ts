import { Directive, ElementRef, inject, input } from '@angular/core';

@Directive({ selector: 'button[appQueryTarget]', host: { '[attr.data-query-key]': 'key()' } })
export class QueryTargetDirective {
  readonly key = input.required<string>({ alias: 'appQueryTarget' });
  private readonly element = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  focus(): void {
    this.element.nativeElement.focus();
  }
}
