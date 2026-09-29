import type { Routes } from '@angular/router';

export const routes: Routes = [{
  path: '', title: 'Cart | Angular 22 Learning Store',
  loadComponent: () => import('./cart.component').then(m => m.CartComponent)
}];
