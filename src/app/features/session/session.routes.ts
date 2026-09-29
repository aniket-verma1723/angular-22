import type { Routes } from '@angular/router';

export const routes: Routes = [{
  path: '', title: 'Demo session | Angular 22 Learning Store',
  loadComponent: () => import('./session.component').then(m => m.SessionComponent)
}];
