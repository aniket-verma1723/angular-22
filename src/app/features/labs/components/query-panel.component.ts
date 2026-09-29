import { Component, Injector, afterNextRender, computed, contentChild, contentChildren, inject, signal, viewChild, viewChildren } from '@angular/core';
import { QueryTargetDirective } from './query-target.directive';

@Component({
  selector: 'app-query-panel',
  imports: [QueryTargetDirective],
  template: `
    <div class="controls">
      <button type="button" [disabled]="!firstContent()" (click)="firstContent()?.focus()">Focus first projected target</button>
      <button type="button" (click)="toggleView()">{{ showView() ? 'Hide' : 'Show and focus' }} view targets</button>
      <button type="button" [disabled]="!firstView()" (click)="firstView()?.focus()">Focus first view target</button>
      <button type="button" [disabled]="!firstView()" (click)="reverseView()">Reverse view targets</button>
    </div>
    <ng-content select="[query-heading]"><p>Projected targets</p></ng-content>
    <ng-content />
    <p data-content-order>Content queries: {{ contentOrder() || 'none' }}; first: {{ firstContent()?.key() ?? 'none' }}</p>
    <div class="controls">
      @if (showView()) {
        @for (key of viewKeys(); track key) { <button type="button" [appQueryTarget]="key">{{ key }}</button> }
      }
    </div>
    <p data-view-order>View queries: {{ viewOrder() || 'none' }}; first: {{ firstView()?.key() ?? 'none' }}</p>
  `,
  styleUrl: './experiment-controls.css'
})
export class QueryPanelComponent {
  private readonly injector = inject(Injector);
  protected readonly firstContent = contentChild(QueryTargetDirective);
  private readonly projected = contentChildren(QueryTargetDirective, { descendants: true });
  protected readonly firstView = viewChild(QueryTargetDirective);
  private readonly ownTargets = viewChildren(QueryTargetDirective);
  protected readonly contentOrder = computed(() => this.projected().map(target => target.key()).join(', '));
  protected readonly viewOrder = computed(() => this.ownTargets().map(target => target.key()).join(', '));
  protected readonly showView = signal(false);
  protected readonly viewKeys = signal<readonly string[]>(['View A', 'View B']);

  focusProjected(key: string): void {
    this.projected().find(target => target.key() === key)?.focus();
  }

  protected reverseView(): void {
    this.viewKeys.update(keys => [...keys].reverse());
  }

  protected toggleView(): void {
    this.showView.update(value => !value);
    if (this.showView()) {
      afterNextRender({ write: () => this.firstView()?.focus() }, { injector: this.injector });
    }
  }
}
