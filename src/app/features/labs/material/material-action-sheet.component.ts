import { Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';

export interface MaterialSheetData {
  readonly subject: string;
}

export type MaterialSheetResult =
  | { readonly kind: 'choose'; readonly activity: 'review' | 'practice' }
  | { readonly kind: 'cancel' };

@Component({
  selector: 'app-material-action-sheet',
  imports: [MatButtonModule],
  template: `
    <h2>Choose a local next step</h2>
    <p>For {{ data.subject }}. This changes only the gallery observation.</p>
    <div class="actions">
      <button mat-button type="button" (click)="choose('review')">Review locally</button>
      <button mat-button type="button" (click)="choose('practice')">Practice locally</button>
      <button mat-button type="button" (click)="cancel()">Cancel next step</button>
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; max-width: 100%; padding: .5rem;
      color: var(--mat-sys-on-surface); overflow-wrap: anywhere; }
    h2 { font-size: 1.3rem; }
    p { line-height: 1.6; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
  `
})
export class MaterialActionSheetComponent {
  protected readonly data = inject<MaterialSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly ref = inject<MatBottomSheetRef<MaterialActionSheetComponent, MaterialSheetResult>>(MatBottomSheetRef);

  protected choose(activity: 'review' | 'practice'): void { this.ref.dismiss({ kind: 'choose', activity }); }
  protected cancel(): void { this.ref.dismiss({ kind: 'cancel' }); }
}
