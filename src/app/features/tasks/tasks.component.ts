import { CdkDrag, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, apply, disabled, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import type { MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import type { PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../core/config/api-config';
import type { TaskQuery } from './data/task.models';
import { TASK_TEXT_MAX_LENGTH } from './data/task.models';
import { TaskBoardService } from './task-board.service';
import type { TaskRow } from './task-board.service';
import { TaskConfirmDialogComponent } from './task-confirm-dialog.component';
import type { TaskConfirmation } from './task-confirm-dialog.component';
import { taskFormSchema } from './task-form';
import type { TaskFormModel } from './task-form';
import { isCanonicalTaskUrl, parseTaskUrl, taskUrlParams, taskUserId } from './task-url';

@Component({
  selector: 'app-tasks',
  providers: [TaskBoardService],
  imports: [CdkDrag, CdkDragHandle, CdkDropList, FormField, MatButton, MatCard, MatCardContent, MatCheckbox, MatError, MatFormField, MatHint,
    MatLabel, MatInput, MatPaginator, MatProgressBar],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css',
  host: { '(window:beforeunload)': 'beforeUnload($event)' }
})
export class TasksComponent {
  protected readonly board = inject(TaskBoardService);
  protected readonly mode = inject(API_CONFIG).mode;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = inject(MatDialog);
  private confirmation: MatDialogRef<TaskConfirmDialogComponent, boolean> | null = null;
  private dragSnapshot: { readonly row: TaskRow; readonly rows: readonly TaskRow[] } | null = null;
  private readonly model = signal<TaskFormModel>({ todo: '', userId: 1 });
  private readonly defaultUser = signal(1);
  private readonly filterState = signal('');
  private readonly filterErrorState = signal('');
  private readonly urlErrorState = signal('');
  protected readonly filterDraft = this.filterState.asReadonly();
  protected readonly filterError = this.filterErrorState.asReadonly();
  protected readonly urlError = this.urlErrorState.asReadonly();
  protected readonly pageSizes = [10, 25, 50];
  protected readonly maxLength = TASK_TEXT_MAX_LENGTH;
  protected readonly taskForm = form(this.model, path => {
    apply(path, taskFormSchema);
    disabled(path, () => this.board.createPhase() !== null || this.board.confirming() || this.board.snapshot() === null);
  });
  private readonly unsaved = computed(() => this.taskForm().dirty() ||
    this.model().todo !== '' || this.model().userId !== this.defaultUser());

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const parsed = parseTaskUrl(params);
      this.filterErrorState.set('');
      this.filterState.set(params.get('userId') ?? '');
      if (!parsed.valid) {
        this.urlErrorState.set(parsed.message); this.board.load(null); return;
      }
      this.urlErrorState.set('');
      if (!isCanonicalTaskUrl(params, parsed.query)) {
        this.navigate(parsed.query, true); return;
      }
      this.defaultUser.set(parsed.query.userId ?? 1);
      this.taskForm().reset({ todo: '', userId: this.defaultUser() });
      this.board.load(parsed.query);
    });
    this.board.created$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.taskForm().reset({ todo: '', userId: this.defaultUser() });
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#creation-result-heading')?.focus(), { injector: this.injector });
    });
    this.board.rollingBack$.pipe(takeUntilDestroyed()).subscribe(id => {
      const row = this.host.nativeElement.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
      if (row?.contains(this.host.nativeElement.ownerDocument.activeElement)) this.focusRow(id);
    });
    this.destroyRef.onDestroy(() => this.confirmation?.close(false));
  }

  canLeave(): boolean | Observable<boolean> {
    if (this.board.locked()) {
      this.board.notify('Finish queued writes or close the confirmation before leaving or changing URL filters/pages.');
      return false;
    }
    if (!this.unsaved()) return true;
    return this.ask({ title: 'Discard task draft?', message: 'Your unsaved task draft will be lost. Keep working to preserve it.', confirm: 'Discard draft' })
      .pipe(map(confirmed => {
        if (confirmed) this.taskForm().reset({ todo: '', userId: this.defaultUser() });
        return confirmed;
      }));
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.board.locked() || this.unsaved()) { event.preventDefault(); event.returnValue = ''; }
  }

  protected editFilter(value: string): void { this.filterState.set(value); this.filterErrorState.set(''); }
  protected applyFilter(event: Event): void {
    event.preventDefault();
    if (!this.canChangePage()) return;
    const text = this.filterDraft();
    const userId = text === '' ? null : taskUserId(text);
    if (text !== '' && userId === null) {
      this.filterErrorState.set('Enter a positive whole-number public user ID, or choose All users.'); return;
    }
    this.navigate({ userId, pageIndex: 0, pageSize: this.board.query()?.pageSize ?? 10 });
  }
  protected allUsers(): void {
    if (this.canChangePage()) this.navigate({ userId: null, pageIndex: 0, pageSize: this.board.query()?.pageSize ?? 10 });
  }
  protected paginate(event: PageEvent): void {
    if (!this.canChangePage()) return;
    const query = this.board.query();
    if (!query || (event.pageSize !== 10 && event.pageSize !== 25 && event.pageSize !== 50)) return;
    const pageIndex = event.pageSize === query.pageSize ? event.pageIndex : 0;
    if (!Number.isSafeInteger(pageIndex + 1) || pageIndex < 0 || !Number.isSafeInteger((pageIndex + 1) * event.pageSize)) return;
    this.navigate({ ...query, pageIndex, pageSize: event.pageSize });
  }
  protected firstPage(): void {
    const query = this.board.query();
    if (query && this.canChangePage()) this.navigate({ ...query, pageIndex: 0 });
  }
  protected reload(): void { if (this.canChangePage()) this.board.load(this.board.query()); }

  protected create(event: Event): void {
    event.preventDefault();
    if (this.board.createPhase() !== null || this.board.confirming() || this.taskForm().pending()) return;
    this.taskForm().markAsTouched();
    if (this.taskForm().invalid()) {
      this.taskForm().errorSummary()[0]?.fieldTree().focusBoundControl(); return;
    }
    const draft = this.model();
    if (draft.userId !== null) this.board.create({ todo: draft.todo.trim(), userId: draft.userId });
  }

  protected complete(id: number, completed: boolean): void {
    if (this.board.setCompleted(id, completed)) this.focusRow(id);
  }
  protected move(id: number, direction: -1 | 1): void {
    if (this.board.move(id, direction)) this.focusRow(id, direction === -1 ? 'up' : 'down');
  }
  protected startDrag(row: TaskRow): void {
    this.dragSnapshot = !this.board.locked() && row.phase === null && this.board.rows().includes(row)
      ? { row, rows: this.board.rows() } : null;
  }
  protected drop(event: CdkDragDrop<readonly TaskRow[], readonly TaskRow[], TaskRow>): void {
    const snapshot = this.dragSnapshot;
    this.dragSnapshot = null;
    if (!snapshot) return;
    const column = this.board.columns().find(item => item.rows === event.container.data);
    if (!this.board.locked() && event.isPointerOverContainer && event.container === event.previousContainer &&
      event.item.dropContainer === event.container && column && event.container.id === `task-list-${column.name}` &&
      Number.isSafeInteger(event.previousIndex) && event.previousIndex >= 0 &&
      event.container.data[event.previousIndex] === snapshot.row && event.item.data === snapshot.row) {
      this.board.moveToIndex(snapshot.row.task.id, event.currentIndex, snapshot.rows);
    }
    // CDK manages the pointer gesture; native buttons remain the keyboard ordering path.
    if (!this.board.confirming()) this.focusRow(snapshot.row.task.id, 'drag');
  }
  protected remove(id: number): void {
    const row = this.board.rows().find(item => item.task.id === id);
    if (!row || row.phase !== null || this.board.confirming() || this.board.full()) return;
    this.ask({ title: 'Delete task?',
      message: `Delete task #${id}? ${this.mode === 'mock' ? 'This changes session mock data.' : 'Remote deletion is simulated, not saved.'}`,
      confirm: 'Delete task' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
        if (confirmed) {
          this.board.delete(id);
          afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#task-board-heading')?.focus(), { injector: this.injector });
        } else {
          // The dialog's automatic restore runs before the trigger is re-enabled.
          this.focusRow(id, 'delete');
        }
      });
  }

  private canChangePage(): boolean {
    if (!this.board.locked()) return true;
    this.board.notify('Finish queued writes or close the confirmation before reloading, filtering, or paging.'); return false;
  }
  private navigate(query: TaskQuery, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: taskUrlParams(query), replaceUrl })
      .then(ok => { if (!ok && !this.destroyRef.destroyed) this.board.notify('Navigation cancelled. Your current task page and draft are kept.'); })
      .catch(() => { if (!this.destroyRef.destroyed) this.board.notify('Navigation failed. Your current task page and draft are kept. Try again.'); });
  }
  private focusRow(id: number, action = 'heading'): void {
    afterNextRender(() => {
      const row = this.host.nativeElement.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
      const target = row?.querySelector<HTMLElement>(`[data-focus="${action}"]:not(:disabled)`);
      (target ?? row?.querySelector<HTMLElement>('h3'))?.focus();
    }, { injector: this.injector });
  }
  private ask(data: TaskConfirmation): Observable<boolean> {
    this.board.setConfirming(true);
    const ref = this.dialog.open<TaskConfirmDialogComponent, TaskConfirmation, boolean>(TaskConfirmDialogComponent,
      { data, width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: '[data-cancel]', restoreFocus: true, closeOnNavigation: false });
    this.confirmation = ref;
    // Keep cleanup independent of a cancelled router guard subscription.
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.board.setConfirming(false); this.confirmation = null;
    });
    return ref.afterClosed().pipe(map(result => result === true));
  }
}
