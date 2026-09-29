import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormField, apply, disabled, form, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import type { MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, combineLatest, distinctUntilChanged, firstValueFrom, map, of, startWith, switchMap, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { SessionStore } from '../../../core/session/session.store';
import { productLoadState } from '../data/product-load-state';
import type { ProductLoadState } from '../data/product-load-state';
import type { ProductDeletion, ProductDraft, ProductMutation, ProductWriteResult } from '../data/product.models';
import { parseProductUrl, productIdFromUrl, productUrlParams } from '../data/product-url';
import { ProductsApiService } from '../data/products-api.service';
import { ProductErrorComponent } from '../ui/product-error.component';
import { ProductConfirmDialogComponent } from './product-confirm-dialog.component';
import type { ProductConfirmation } from './product-confirm-dialog.component';
import { editorModel, emptyProductEditor, productChanges, productEditorSchema } from './product-editor.schema';
import type { ProductEditorModel } from './product-editor.schema';

interface EditorSession { readonly id: number | null; readonly model: ProductEditorModel; }

@Component({
  selector: 'app-product-editor',
  imports: [CurrencyPipe, FormField, MatButton, MatCard, MatCardContent, MatError, MatFormField, MatHint, MatLabel,
    MatInput, MatProgressBar, MatOption, MatSelect, RouterLink, ProductErrorComponent],
  templateUrl: './product-editor.component.html',
  styleUrl: './product-editor.component.css',
  host: { '(window:beforeunload)': 'beforeUnload($event)' }
})
export class ProductEditorComponent {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(ProductsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(MatDialog);
  private readonly reload$ = new Subject<void>();
  private readonly reloadCategories$ = new Subject<void>();
  private readonly model = signal(emptyProductEditor());
  private readonly baseline = signal(emptyProductEditor());
  private confirmation: MatDialogRef<ProductConfirmDialogComponent, boolean> | null = null;
  protected readonly isCreate = this.route.snapshot.routeConfig?.path === 'new';
  protected readonly mode = inject(API_CONFIG).mode;
  protected readonly loadState = signal<ProductLoadState<EditorSession>>({ status: 'loading' });
  protected readonly saveResult = signal<ProductMutation<ProductWriteResult> | null>(null);
  protected readonly deleteResult = signal<ProductMutation<ProductDeletion> | null>(null);
  protected readonly deleting = signal(false);
  protected readonly confirming = signal(false);
  protected readonly mutationError = signal<ApiError | null>(null);
  protected readonly navigationMessage = signal('');
  protected readonly categories = toSignal(this.reloadCategories$.pipe(startWith(undefined),
    switchMap(() => productLoadState(this.api.categories()))), { initialValue: { status: 'loading' } });
  protected readonly choices = computed(() => { const state = this.categories(); return state.status === 'success' ? state.value : []; });
  protected readonly originalCategory = computed(() => this.baseline().category);
  protected readonly missingCategory = computed(() => this.originalCategory() && !this.choices().some(choice => choice.slug === this.originalCategory()));
  protected readonly backParams = toSignal(this.route.queryParamMap.pipe(map(params => productUrlParams(parseProductUrl(params)))),
    { initialValue: productUrlParams(parseProductUrl(this.route.snapshot.queryParamMap)) });
  protected readonly completed = computed(() => this.deleteResult() !== null || (this.isCreate && this.saveResult() !== null));
  protected readonly productForm = form(this.model, path => {
    apply(path, productEditorSchema);
    disabled(path, { when: ({ state }) => state.submitting() || this.deleting() || this.completed() || this.loadState().status !== 'success' });
    validate(path.category, ({ value }) => {
      if (this.categories().status !== 'success') return { kind: 'choices', message: 'Load category choices before saving.' };
      return this.choices().some(choice => choice.slug === value()) || (value() !== '' && value() === this.originalCategory())
        ? undefined : { kind: 'choice', message: 'Choose one of the available categories.' };
    });
  });
  protected readonly busy = computed(() => this.productForm().submitting() || this.deleting());
  private readonly unsaved = computed(() => !this.completed() &&
    (this.productForm().dirty() || JSON.stringify(this.model()) !== JSON.stringify(this.baseline())));

  constructor() {
    combineLatest([
      this.route.paramMap.pipe(map(params => this.isCreate ? null : productIdFromUrl(params.get('id'))), distinctUntilChanged()),
      this.reload$.pipe(startWith(undefined))
    ]).pipe(switchMap(([id]) => productLoadState(this.isCreate
      ? of<EditorSession>({ id: null, model: emptyProductEditor() })
      : id === null ? throwError(() => new ApiError('validation', 'Use a positive whole-number product ID.'))
        : this.api.get(id).pipe(map(product => ({ id, model: editorModel(product) }))))), takeUntilDestroyed())
      .subscribe(state => {
        this.loadState.set(state);
        this.saveResult.set(null); this.deleteResult.set(null); this.mutationError.set(null);
        const value = state.status === 'success' ? state.value.model : emptyProductEditor();
        this.baseline.set(value); this.productForm().reset(value);
      });
    this.destroyRef.onDestroy(() => this.confirmation?.close(false));
  }

  canLeave(): boolean | Observable<boolean> {
    if (this.busy() || this.confirming()) {
      this.navigationMessage.set('Finish the current operation or close its confirmation before leaving.');
      return false;
    }
    if (!this.unsaved()) return true;
    return this.ask({ title: 'Discard unsaved changes?', message: 'Your product draft will be lost. Stay to keep editing.', confirm: 'Discard changes' });
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.unsaved()) { event.preventDefault(); event.returnValue = ''; }
  }
  protected retryLoad(): void { this.reload$.next(); }
  protected retryCategories(): void { this.reloadCategories$.next(); }
  protected checkFields(): void {
    this.productForm().markAsTouched();
    this.productForm().errorSummary()[0]?.fieldTree().focusBoundControl();
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.busy() || this.confirming() || this.completed() || this.loadState().status !== 'success') return;
    if (!this.canWrite()) return;
    this.mutationError.set(null); this.navigationMessage.set('');
    void submit(this.productForm, {
      ignoreValidators: 'none',
      onInvalid: field => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
      action: async field => {
        if (!this.session.isAdmin()) throw new ApiError('forbidden', 'An active local demo-admin session is required to write.');
        const state = this.loadState();
        if (state.status !== 'success') return { kind: 'state', message: 'Reload the product before saving.' };
        const value = field().value();
        if (value.price === null || value.stock === null) return { kind: 'required', message: 'Price and stock are required.' };
        const draft: ProductDraft = { ...value, price: value.price, stock: value.stock, title: value.title.trim(), description: value.description.trim() };
        const patch = productChanges(this.baseline(), draft);
        if (state.value.id !== null && Object.keys(patch).length === 0) {
          this.navigationMessage.set('No product changes to save.');
          field().reset(draft);
          return;
        }
        const request$ = state.value.id === null ? this.api.create(draft) : this.api.update(state.value.id, patch);
        // Reject into the handled promise boundary, not a sticky field error: an explicit
        // retry must work without editing valid data after a transient service failure.
        const result = await firstValueFrom(request$.pipe(timeout(15000), takeUntilDestroyed(this.destroyRef)));
        if (this.destroyRef.destroyed) return;
        this.saveResult.set(result);
        const saved = editorModel(result.value); this.baseline.set(saved); field().reset(saved);
        return;
      }
    }).catch((error: unknown) => { if (!this.destroyRef.destroyed) this.mutationError.set(toApiError(error)); });
  }

  protected resetDraft(): void {
    if (this.busy() || this.confirming()) return;
    this.ask({ title: 'Reset product draft?', message: 'Discard your edits and restore the last loaded or saved values?', confirm: 'Reset draft' })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
        if (confirmed) { this.productForm().reset(this.baseline()); this.mutationError.set(null); }
      });
  }

  protected startAnother(): void {
    if (!this.isCreate || this.busy()) return;
    this.saveResult.set(null); this.baseline.set(emptyProductEditor()); this.productForm().reset(emptyProductEditor());
    afterNextRender(() => this.productForm.title().focusBoundControl(), { injector: this.injector });
  }

  protected remove(): void {
    const state = this.loadState();
    if (state.status !== 'success' || state.value.id === null || this.busy() || this.confirming() || this.completed()) return;
    if (!this.canWrite()) return;
    const id = state.value.id;
    this.ask({ title: 'Delete product?', message: `Delete “${this.baseline().title}”? Unsaved edits will be discarded only if deletion succeeds. ${this.mode === 'mock' ? 'This changes session mock data.' : 'Remote deletion is simulated, not saved.'}`, confirm: 'Delete product' })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
        if (confirmed) void this.deleteProduct(id);
      });
  }

  private async deleteProduct(id: number): Promise<void> {
    if (!this.canWrite()) return;
    this.deleting.set(true); this.mutationError.set(null); this.navigationMessage.set('');
    try {
      const result = await firstValueFrom(this.api.delete(id).pipe(timeout(15000), takeUntilDestroyed(this.destroyRef)));
      if (!this.destroyRef.destroyed) { this.deleteResult.set(result); this.productForm().reset(); }
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.mutationError.set(toApiError(error));
    } finally { if (!this.destroyRef.destroyed) this.deleting.set(false); }
  }

  private ask(data: ProductConfirmation): Observable<boolean> {
    this.confirming.set(true);
    const ref = this.dialog.open<ProductConfirmDialogComponent, ProductConfirmation, boolean>(ProductConfirmDialogComponent,
      { data, width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: '[data-cancel]', restoreFocus: true, closeOnNavigation: false });
    this.confirmation = ref;
    // A newer navigation can unsubscribe the guard. Dialog ownership must survive
    // that cancellation so closing it cannot leave the editor permanently locked.
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.confirming.set(false); this.confirmation = null;
    });
    return ref.afterClosed().pipe(map(result => result === true));
  }

  private canWrite(): boolean {
    if (this.session.isAdmin()) return true;
    this.navigationMessage.set('An active local demo-admin session is required to write. Your draft is kept.');
    return false;
  }
}
