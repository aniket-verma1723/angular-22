import { Directive, TemplateRef, inject } from '@angular/core';

export interface NoticeContext {
  readonly $implicit: string;
  readonly count: number;
}

@Directive({ selector: 'ng-template[appNoticeTemplate]', exportAs: 'appNoticeTemplate' })
export class NoticeTemplateDirective {
  readonly template = inject<TemplateRef<NoticeContext>>(TemplateRef);

  static ngTemplateContextGuard(_directive: NoticeTemplateDirective, context: unknown): context is NoticeContext {
    return true;
  }
}
