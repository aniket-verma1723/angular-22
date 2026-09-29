import type { CanDeactivateFn } from '@angular/router';
import type { ProductEditorComponent } from './product-editor.component';

export const productEditorGuard: CanDeactivateFn<ProductEditorComponent> = component => component.canLeave();
