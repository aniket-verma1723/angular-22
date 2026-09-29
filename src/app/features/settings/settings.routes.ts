import type { Routes } from '@angular/router';
import { learningModules } from '../../core/learning/learning-modules';

export const routes: Routes = [{
  path: '', title: 'Settings | Angular 22 Learning Store',
  loadComponent: () => import('../../shared/ui/planned-module/planned-module.component').then(m => m.PlannedModuleComponent),
  data: { plan: learningModules.settings, heading: 'Settings' }
}];
