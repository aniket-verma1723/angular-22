import { afterEveryRender, afterNextRender, Component, computed, DestroyRef, inject, NgZone, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SelectionModel } from '@angular/cdk/collections';
import type { ListRange } from '@angular/cdk/collections';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { FICTIONAL_PEOPLE, PERSON_ROW_HEIGHT } from './fictional-people';
import type { FictionalPerson } from './fictional-people';

@Component({
  selector: 'app-virtual-people-experiment',
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
  templateUrl: './virtual-people-experiment.component.html',
  styleUrls: ['./cdk-experiment.css', './virtual-people-experiment.component.css']
})
export class VirtualPeopleExperimentComponent {
  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly selection = new SelectionModel<string>(true);
  private readonly selectedState = signal<ReadonlySet<string>>(new Set());
  private readonly rangeState = signal<ListRange>({ start: 0, end: 0 });
  private readonly domCountState = signal(0);
  protected readonly people = FICTIONAL_PEOPLE;
  protected readonly rowHeight = PERSON_ROW_HEIGHT;
  protected readonly selected = this.selectedState.asReadonly();
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly range = this.rangeState.asReadonly();
  protected readonly domCount = this.domCountState.asReadonly();
  protected readonly trackPerson = (_index: number, person: FictionalPerson): string => person.id;

  constructor() {
    this.selection.changed.pipe(takeUntilDestroyed()).subscribe(event => {
      this.selectedState.set(new Set(event.source.selected));
    });
    afterNextRender(() => {
      const viewport = this.viewport();
      this.rangeState.set(viewport.getRenderedRange());
      viewport.renderedRangeStream.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(range => {
        this.zone.run(() => this.rangeState.set({ ...range }));
      });
    });
    // Count actual attached rows after rendering, not the requested range or cached views.
    // Angular owns this render observer's lifetime; no polling or pending timer is introduced.
    afterEveryRender({ read: () => {
      const element = this.viewport().elementRef.nativeElement;
      this.domCountState.set(element.querySelectorAll('[data-person-row]').length);
    } });
  }

  protected toggle(person: FictionalPerson): void {
    this.selection.toggle(person.id);
  }

  protected resetSelection(): void {
    this.selection.clear();
  }

  protected jump(edge: 'first' | 'last'): void {
    // The focused native button stays mounted; never focus a recycled/offscreen row.
    this.viewport().scrollToIndex(edge === 'first' ? 0 : this.people.length - 1, 'auto');
  }
}
