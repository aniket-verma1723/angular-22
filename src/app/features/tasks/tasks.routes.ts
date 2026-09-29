import type { Routes } from '@angular/router';
import { tasksGuard } from './tasks.guard';

export const routes: Routes = [{
  path: '', title: 'Tasks | Angular 22 Learning Store',
  loadComponent: () => import('./tasks.component').then(m => m.TasksComponent),
  canDeactivate: [tasksGuard],
  runGuardsAndResolvers: 'always'
}];
