import type { Routes } from '@angular/router';
import { checkoutGuard } from './checkout.guard';
import { sessionGuard } from '../../core/session/session.guard';

export const routes: Routes = [{
  path: '', title: 'Checkout | Angular 22 Learning Store',
  loadComponent: () => import('./checkout.component').then(m => m.CheckoutComponent),
  canActivate: [sessionGuard], canDeactivate: [checkoutGuard]
}];
