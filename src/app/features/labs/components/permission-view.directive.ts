import { Directive, TemplateRef, ViewContainerRef, inject, input } from '@angular/core';
import type { EmbeddedViewRef, OnChanges } from '@angular/core';

export interface PermissionSubject {
  readonly label: string;
  readonly revision: number;
}

export interface PermissionViewContext {
  $implicit: PermissionSubject;
  readonly allowed: true;
}

/** Presentation-only permission-view fixture. It never authorizes data or actions. */
@Directive({ selector: '[appPermissionView]' })
export class PermissionViewDirective implements OnChanges {
  readonly appPermissionView = input.required<boolean>();
  readonly appPermissionViewSubject = input.required<PermissionSubject>();
  private readonly template = inject<TemplateRef<PermissionViewContext>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private view: EmbeddedViewRef<PermissionViewContext> | undefined;

  ngOnChanges(): void {
    if (!this.appPermissionView()) {
      this.container.clear();
      this.view = undefined;
      return;
    }
    if (this.view) {
      // Update Angular's existing context, not the immutable subject or a second business-state owner.
      this.view.context.$implicit = this.appPermissionViewSubject();
    } else {
      this.view = this.container.createEmbeddedView(this.template, {
        $implicit: this.appPermissionViewSubject(), allowed: true
      });
    }
  }

  // A compiler contract for contexts constructed above, NOT a runtime authorization check.
  static ngTemplateContextGuard(_directive: PermissionViewDirective, context: unknown): context is PermissionViewContext {
    return true;
  }
}
