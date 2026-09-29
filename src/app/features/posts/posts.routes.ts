import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Page not found | Angular 22 Learning Store',
    loadComponent: () => import('../../shared/ui/route-message/route-message.component').then(m => m.RouteMessageComponent),
    data: { heading: 'Page not found', message: 'Posts will be opened from a user profile. Return to the overview to continue.' }
  },
  {
    path: ':id', title: 'Post & comments | Angular 22 Learning Store',
    loadComponent: () => import('./detail/post-detail.component').then(m => m.PostDetailComponent)
  }
];
