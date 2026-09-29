import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Users | Angular 22 Learning Store',
    loadComponent: () => import('./directory/user-directory.component').then(m => m.UserDirectoryComponent) },
  { path: ':id', title: 'User profile | Angular 22 Learning Store',
    loadComponent: () => import('./profile/user-profile.component').then(m => m.UserProfileComponent) }
];
