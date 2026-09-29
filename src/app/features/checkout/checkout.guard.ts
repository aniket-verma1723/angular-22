import type { CanDeactivateFn } from '@angular/router';
import type { CheckoutComponent } from './checkout.component';

export const checkoutGuard: CanDeactivateFn<CheckoutComponent> = component => component.canLeave();
