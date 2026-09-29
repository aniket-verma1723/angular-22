import { Component, DestroyRef, effect, inject, signal, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import type { Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MaterialLessonComponent } from './material-lesson.component';
import type { MaterialLesson } from './material-lesson.component';

interface Reading {
  readonly id: number;
  readonly label: string;
  readonly minutes: number;
}

type ReadingColumn = keyof Reading;
type PageSize = 5 | 10;

const READINGS: readonly Reading[] = [
  { id: 1, label: 'Lunar sketch', minutes: 35 },
  { id: 2, label: 'Comet watch', minutes: 12 },
  { id: 3, label: 'Zenith scan', minutes: 100 },
  { id: 4, label: 'Orbit notes', minutes: 45 },
  { id: 5, label: 'Nebula map', minutes: 20 },
  { id: 6, label: 'Aurora watch', minutes: 2 },
  { id: 7, label: 'Meteor watch', minutes: 9 },
  { id: 8, label: 'Binary sketch', minutes: 60 },
  { id: 9, label: 'Horizon scan', minutes: 15 },
  { id: 10, label: 'Eclipse notes', minutes: 120 },
  { id: 11, label: 'Dawn watch', minutes: 5 },
  { id: 12, label: 'Galaxy map', minutes: 30 },
  { id: 13, label: 'Flare watch', minutes: 10 },
  { id: 14, label: 'Ion scan', minutes: 25 },
  { id: 15, label: 'Kite watch', minutes: 50 }
];

function isReadingColumn(value: string): value is ReadingColumn {
  return value === 'id' || value === 'label' || value === 'minutes';
}

@Component({
  selector: 'app-material-table',
  imports: [MaterialLessonComponent, MatButton, MatFormField, MatHint, MatLabel, MatInput,
    MatPaginator, MatSort, MatSortHeader, MatTableModule],
  templateUrl: './material-table.component.html',
  styleUrl: './material-table.component.css'
})
export class MaterialTableComponent {
  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);
  private readonly sortNoticeState = signal('Sorted by ID ascending.');

  protected readonly sortNotice = this.sortNoticeState.asReadonly();
  protected readonly filterMaxLength = 80;
  protected readonly defaultPageSize: PageSize = 5;
  protected readonly pageSizes: PageSize[] = [5, 10];
  protected readonly columns: readonly ReadingColumn[] = ['id', 'label', 'minutes'];
  protected readonly dataSource = new MatTableDataSource<Reading>([...READINGS]);
  protected readonly trackReading = (_index: number, row: Reading): number => row.id;
  protected readonly lesson: MaterialLesson = {
    title: 'Local table · filter, sort and paginate',
    concept: 'This complete dataset contains 15 fictional readings, not one remote API page. Its paginator total is the actual filtered local count. Numeric minutes sort as numbers, not text.',
    tryIt: 'Predict the shortest reading. Go to page two, then activate Minutes twice for ascending and descending order. Filter by watch or 120, try an unmatched word, then Clear table filter. Choose 10 items per page and Reset local table.',
    mechanism: 'MatTableDataSource filters the complete dataset, sorts it, then slices a page. Signal queries bind MatSort and MatPaginator through an imperative library effect, without copying their state into signals. Only ID, Label and Minutes are sortable. The owner disconnects its data source on destruction.',
    mistake: 'Do not attach this local paginator or sorter to a remotely paged subset and call its length a global total. Do not sort numeric minutes lexically or announce the same change through both a live region and LiveAnnouncer.',
    question: 'Why does Aurora watch appear first when sorting Minutes from page two? What is restored by clearing a filter, clearing a sort, and resetting the whole table?',
    observation: 'Filter changes and sorting return to page one. Clear table filter keeps sort and page size; the third header activation clears sorting to original ID order. Reset restores ID ascending, five rows per page and an empty filter. Enter activates a focused sort header; one inline status announces sorting. Nothing uses HTTP or storage.'
  };

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column): string | number => {
      // Explicit allowlist: no arbitrary property lookup or conversion of minutes to text.
      switch (column) {
        case 'label': return row.label.toLowerCase();
        case 'minutes': return row.minutes;
        default: return row.id;
      }
    };
    this.dataSource.filterPredicate = (row, filter): boolean =>
      [String(row.id), row.label.toLowerCase(), String(row.minutes)].some(value => value.includes(filter));

    effect(() => {
      const sort = this.sort();
      const paginator = this.paginator();
      if (sort && paginator) {
        this.dataSource.sort = sort;
        this.dataSource.paginator = paginator;
      }
    });
    // MatTable also disconnects. Material 22's implementation is idempotent; this covers
    // owner destruction before the table connects to the eagerly created data source.
    inject(DestroyRef).onDestroy(() => this.dataSource.disconnect());
  }

  protected applyFilter(input: HTMLInputElement): void {
    input.value = input.value.slice(0, this.filterMaxLength);
    this.paginator()?.firstPage();
    this.dataSource.filter = input.value.trim().toLowerCase();
  }

  protected clearFilter(input: HTMLInputElement): void {
    input.value = '';
    this.applyFilter(input);
  }

  protected onSortChange(sort: Sort): void {
    if (!isReadingColumn(sort.active) || !['asc', 'desc', ''].includes(sort.direction)) {
      this.restoreDefaultSort();
      return;
    }
    this.paginator()?.firstPage();
    const labels: Record<ReadingColumn, string> = { id: 'ID', label: 'Label', minutes: 'Minutes' };
    this.sortNoticeState.set(sort.direction
      ? `Sorted by ${labels[sort.active]} ${sort.direction === 'asc' ? 'ascending' : 'descending'}.`
      : 'Sorting cleared. Original ID order restored.');
  }

  protected reset(input: HTMLInputElement): void {
    const paginator = this.paginator();
    if (paginator) paginator.pageSize = this.defaultPageSize;
    this.clearFilter(input);
    this.restoreDefaultSort();
  }

  private restoreDefaultSort(): void {
    const sort = this.sort();
    if (!sort) return;
    // Reset the active ID so the public sort method starts at asc rather than cycling.
    sort.active = '';
    sort.sort({ id: 'id', start: 'asc', disableClear: false });
  }
}
