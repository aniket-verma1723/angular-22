import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, ViewContainerRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import type { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatTree, MatTreeModule } from '@angular/material/tree';
import { MaterialActionSheetComponent } from './material-action-sheet.component';
import type { MaterialSheetData, MaterialSheetResult } from './material-action-sheet.component';
import { MaterialLessonComponent } from './material-lesson.component';
import type { MaterialLesson } from './material-lesson.component';

interface LessonNode {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly children?: readonly LessonNode[];
}

const LESSON_TREE: readonly LessonNode[] = [
  { id: 'sky', label: 'Sky notebook', children: [
    { id: 'aurora', label: 'Aurora notes' },
    { id: 'comet', label: 'Comet notes' },
    { id: 'archived', label: 'Archived notes', disabled: true }
  ] }
];

@Component({
  selector: 'app-material-display-feedback',
  imports: [MaterialLessonComponent, MatBadgeModule, MatButtonModule, MatDividerModule,
    MatExpansionModule, MatGridListModule, MatProgressBarModule, MatProgressSpinnerModule, MatTreeModule],
  templateUrl: './material-display-feedback.component.html',
  styleUrl: './material-display-feedback.component.css'
})
export class MaterialDisplayFeedbackComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly tree = viewChild<MatTree<LessonNode, string>>(MatTree);
  private readonly panel = viewChild(MatExpansionPanel);
  private readonly narrow = toSignal(inject(BreakpointObserver).observe('(max-width: 600px)'), {
    initialValue: { matches: true, breakpoints: {} }
  });
  private readonly progressState = signal(0);
  private readonly selectedState = signal('Aurora notes');
  private readonly noticeState = signal('No notice raised yet.');
  private readonly resultState = signal('No next step chosen.');
  private snackRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
  private sheetRef: MatBottomSheetRef<MaterialActionSheetComponent, MaterialSheetResult> | undefined;

  protected readonly columns = computed(() => this.narrow().matches ? 1 : 2);
  protected readonly progress = this.progressState.asReadonly();
  protected readonly running = computed(() => this.progress() > 0 && this.progress() < 100);
  protected readonly selected = this.selectedState.asReadonly();
  protected readonly notice = this.noticeState.asReadonly();
  protected readonly result = this.resultState.asReadonly();
  protected readonly nodes = [...LESSON_TREE];
  // CDK's public accessor takes mutable arrays; copy readonly compile-time fixtures at that boundary.
  protected readonly childrenAccessor = (node: LessonNode): LessonNode[] => [...(node.children ?? [])];
  protected readonly expansionKey = (node: LessonNode): string => node.id;
  protected readonly trackNode = (_index: number, node: LessonNode): string => node.id;
  protected readonly hasChildren = (_index: number, node: LessonNode): boolean => !!node.children?.length;
  protected readonly lesson: MaterialLesson = {
    title: 'Display and feedback · hierarchy, progress and overlays',
    concept: 'A tree exposes hierarchy; an expansion panel reveals supporting detail. Two summary tiles adapt to one column, a badge mirrors completed readings, and a divider separates structure from feedback. Progress is manually simulated, never a real request.',
    tryIt: 'Expand Sky notebook and choose Comet notes. Reveal Reading details, start the simulation and advance to 100%. Show the important notice and dismiss its snackbar: the notice stays inline. Open Choose next step, choose an action or press Escape, then reset.',
    mechanism: 'The tree uses public childrenAccessor, expansionKey and isExpandable rather than TreeControl. BreakpointObserver supplies one readonly column count. Signals drive progress, badge and previews. The root Material theme reaches overlays; typed references own dismissals and DestroyRef ends subscriptions and closes only this instance’s overlays.',
    mistake: 'A badge is not the only accessible count, a snackbar is not durable error storage, and an indeterminate spinner cannot imply measured progress. Never use service-wide dismiss during owner cleanup: it can close another feature’s overlay.',
    question: 'Why does dismissing the snackbar leave the notice visible? What distinguishes a chosen sheet result from Cancel or Escape, and who restores focus?',
    observation: 'Completed readings and the badge advance together. Disabled archived notes cannot be selected. Both sheet cancellation paths preserve the chosen subject; Material restores opener focus. Reset collapses the tree/panel and closes owned overlays; destroying this owner also cleans them up.'
  };

  constructor() {
    this.destroyRef.onDestroy(() => this.closeOwnedOverlays());
  }

  protected selectNode(node: LessonNode): void {
    if (!node.disabled && !node.children?.length) this.selectedState.set(node.label);
  }

  protected start(): void {
    if (this.progressState() === 0) this.progressState.set(25);
  }

  protected advance(): void {
    if (this.running()) this.progressState.update(value => Math.min(100, value + 25));
  }

  protected showNotice(): void {
    this.noticeState.set('Important: these readings are fictional. Do not use them for navigation.');
    if (this.snackRef) return;
    const ref = this.snackBar.open('Fictional readings only. The important notice remains in the page.', 'Dismiss notice popup', {
      duration: 0, politeness: 'polite', viewContainerRef: this.viewContainerRef
    });
    this.snackRef = ref;
    ref.afterDismissed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.snackRef === ref) this.snackRef = undefined;
    });
  }

  protected openSheet(): void {
    if (this.sheetRef) return;
    const ref = this.bottomSheet.open<MaterialActionSheetComponent, MaterialSheetData, MaterialSheetResult>(MaterialActionSheetComponent, {
      data: { subject: this.selectedState() }, ariaLabel: 'Choose a local next step',
      autoFocus: 'first-tabbable', restoreFocus: true, viewContainerRef: this.viewContainerRef
    });
    this.sheetRef = ref;
    ref.afterDismissed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (this.sheetRef !== ref) return;
      this.sheetRef = undefined;
      this.resultState.set(result?.kind === 'choose' ? `Next step: ${result.activity} locally.` : 'Next step cancelled; subject unchanged.');
    });
  }

  protected reset(): void {
    this.closeOwnedOverlays();
    this.progressState.set(0);
    this.selectedState.set('Aurora notes');
    this.noticeState.set('No notice raised yet.');
    this.resultState.set('No next step chosen.');
    this.tree()?.collapseAll();
    this.panel()?.close();
  }

  private closeOwnedOverlays(): void {
    const snack = this.snackRef;
    const sheet = this.sheetRef;
    // Detach first: late exit animations must not overwrite reset state.
    this.snackRef = undefined;
    this.sheetRef = undefined;
    snack?.dismiss();
    sheet?.dismiss();
  }
}
