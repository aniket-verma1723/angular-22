import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { NoticeTemplateDirective } from './notice-template.directive';
import type { NoticeContext } from './notice-template.directive';
import { PermissionViewDirective } from './permission-view.directive';
import type { PermissionSubject } from './permission-view.directive';

@Component({
  selector: 'app-templates-experiment',
  imports: [ExperimentCardComponent, NgTemplateOutlet, NoticeTemplateDirective, PermissionViewDirective],
  templateUrl: './templates-experiment.component.html',
  styleUrl: './experiment-controls.css'
})
export class TemplatesExperimentComponent {
  protected readonly allowed = signal(false);
  protected readonly subject = signal<PermissionSubject>({ label: 'Local learner', revision: 0 });
  protected readonly context = computed<NoticeContext>(() => ({
    $implicit: this.subject().label, count: this.subject().revision
  }));
  protected readonly lesson: ComponentLesson = {
    title: 'Typed fragments and permission-view', coverage: 'C02 · C05 · C09 · C14',
    concept: 'A template is a typed recipe for an embedded view, not a rendered element. Permission-view is UX only: there is no authentication or authorization here.',
    tryIt: 'Predict the zero count, allow the local preview, update its context, then hide and recreate it. Type in the preview field before updating.',
    mechanism: 'NgTemplateOutlet receives TemplateRef<NoticeContext> and a matching context. The custom structural directive injects TemplateRef and ViewContainerRef, updates an existing context, and clears denied views. ngTemplateContextGuard types let variables at compile time.',
    mistake: 'Do not use truthiness to discard zero or treat a context guard or hidden button as server authorization. Prefer @if for ordinary conditions; never compile JSON templates.',
    revision: 'Why does updating the context preserve the preview input, but denying and allowing again creates a blank input?',
    observation: 'The specs compare real input node identity, named and implicit context values, denied-view destruction, and recreation. Guards are type contracts, not runtime validators.'
  };

  protected revise(): void {
    this.subject.update(value => ({ ...value, revision: value.revision + 1 }));
  }
}
